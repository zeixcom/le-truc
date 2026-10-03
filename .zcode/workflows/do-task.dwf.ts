/* zcode-workflow
description: Pick the next ready TODO task (or a given LT-ID), implement it,
  verify gates, review, annotate the suffix.
whenToUse: "Work the le-truc queue without hand-offs. Args: id (an LT-NNN to
  implement instead of picking) or max (run up to that many ready tasks). Ends
  with a patch for the owner to commit."
args:
  id:
    type: string
    description: A specific LT-NNN to implement instead of picking the next ready task.
    required: false
  max:
    type: number
    description: Run up to this many ready tasks in sequence; ignored when id is given.
    required: false
    default: 1
*/
// Ported from .claude/workflows/do-task.js (the Claude Code version stays in
// service for Claude sessions). ZCode-facade differences: gates run as
// deterministic world.run commands instead of a trusting subagent, per-task
// results are reported as they land so a dead run still salvages finished
// work, and the owner handoff is published as an artifact.

interface PickResult {
	picked: boolean
	/** The LT-NNN, empty when nothing is pickable. */
	id: string
	title: string
	area: 'runtime' | 'compiler' | 'server' | 'examples' | 'docs'
	/** The task carried — changes requested ↩. */
	rework?: boolean
	/** Extra commands from the entry's Gates line. */
	gates?: string[]
	/** ADRs, REQUIREMENTS items, ARCHITECTURE sections and LT-IDs the entry cites. */
	citations?: string[]
	reason: string
}

interface Handoff {
	outcome: 'done' | 'blocked'
	/** api = public API, compiler-authored surface semantics, a diagnostic code's meaning, or server routes/output (→ ⏳); internal = everything else (→ done ✓). */
	reviewClass: 'api' | 'internal'
	/** An error class in src/errors.ts or a code in diagnostics.ts was added, reworded or retired. */
	errorCopyChanged: boolean
	/** No behavior can change: comments, docs, or a rename proven byte-identical by goldens. */
	mechanical: boolean
	/** Path plus what changed, one per entry. */
	changed: string[]
	how?: string
	/** Where a reviewer should look. */
	check?: string
	gates: { cmd: string; pass: boolean; note?: string }[]
	/** When blocked: the decision the task does not contain. */
	blocker?: string
}

interface GateOutcome {
	cmd: string
	pass: boolean
	/** Could not be decided in the run: spawn failure, or output over the harness's 256KB world-read cap. */
	unrunnable: boolean
	flaky: boolean
	/** Last relevant lines of output on failure, or the rejection reason. */
	tail: string
}

interface ReviewFinding {
	severity: 'blocking' | 'minor'
	file?: string
	issue: string
	fix?: string
}

interface Review {
	findings: ReviewFinding[]
	/** Whether the handoff's api/internal classification is right. */
	reviewClassAgrees: boolean
}

interface Annotation {
	suffix: string
	notesEntry: boolean
	/** The full commit message for this task's changes. */
	commit: string
}

interface TaskRun {
	id: string
	title: string
	area: string
	suffix: string
	changed: string[]
	gates: string[]
	ownerMustRun: string[]
	minorFindings: string[]
	blocker?: string
	commit?: string
}

// ── Contract ────────────────────────────────────────────────────────────────
// The queue format and the chain are defined in
// .agents/skills/architect/references/task-queue.md. This script never moves
// entries between queue files, never edits ARCHITECTURE.md, never commits and
// never stages .agents/. Implementation runs sequentially in the main checkout
// (worktrees start on main and lack node_modules and docs/), so no isolation.

const inputId = typeof args.id === 'string' ? args.id : undefined
const inputMax = typeof args.max === 'number' ? args.max : undefined
const MAX_TASKS = inputId ? 1 : Math.max(1, inputMax ?? 1)
const MAX_FIX_ROUNDS = 2
const GATE_TIMEOUT = { timeoutMs: 1_800_000 }

const COMMIT_STYLE = [
	'Subject: `<area>: LT-NNN — <what changed>`, at most 72 characters, phrased like `git log --oneline -10`. Use `docs(queue):` when only queue files changed.',
	'Body only when needed, at most 3 lines: what the diff cannot show — a ruling, a deviation, a follow-up LT-ID, a red gate. No file lists, gate transcripts, or restating the subject.',
	'End with a blank line and the Co-Authored-By trailer your session instructions give.',
].join(' ')

// The entry's Check line is the conformance reviewer's to judge, so a sound,
// evidenced deviation from it is a finding, not a red gate.
const GATE_TABLE =
	"the area's default gates in the contributor skill's Gates table (.agents/skills/contributor/SKILL.md), plus the entry's Gates line"

// The lint scripts use biome --write; their read-only form changes no file.
const LINT_READ_ONLY: Record<string, string> = {
	lint: './src',
	'lint:server': './server',
	'lint:examples': './examples',
}

// The package.json scripts whose underlying command is `bun test`. They accept
// --dots, which keeps their stdout under the harness's 256KB world-read cap —
// the default console reporter overruns it on the big suites. Keep in step
// with package.json.
const BUN_TEST_SCRIPTS = new Set([
	'test:src',
	'test:server',
	'test:server:unit',
	'test:server:integration',
	'check:size',
])

// The area's unconditional defaults. The conditional ones (Playwright,
// check:size, build:docs, check:links, test:variants) ride in through the
// entry's Gates line and the gates the implement agent reports it ran.
// Source of truth: the Gates table in .agents/skills/contributor/SKILL.md —
// keep this map in step when that table changes.
const AREA_GATES: Record<string, string[]> = {
	runtime: ['test:src', 'lint', 'typecheck'],
	compiler: ['test:server', 'lint:server', 'typecheck', 'check:contract', 'check:corpus'],
	server: ['test:server', 'lint:server'],
	examples: ['lint:examples', 'check:corpus'],
	docs: ['check:links'],
}

const describe = (t: { id: string; title: string; area: string }): string =>
	`${t.id} (${t.title}; Area: ${t.area})`

const tail = (s: string | undefined): string => {
	const t = (s ?? '').trim()
	return t.length > 600 ? `…${t.slice(-599)}` : t
}

// Entry Gates lines and agent handoffs spell gates loosely ("bun run
// test:variants", "bun test server/tests (the test:server suite)"). Normalize
// to what runGate dispatches on: the bare package.json script name, or an
// explicit "bun test <paths>" invocation. This is the single choke point every
// gate string passes through, so a doubled "bun run bun run …" can reach the
// command line from nowhere else.
function normalizeGate(raw: string): string {
	return raw
		.replace(/\s*\([^)]*\)/g, '')
		.trim()
		.replace(/^bun\s+run\s+/, '')
		.trim()
}

// An unrunnable gate is not red: no code change fixes the sandbox. This covers
// spawn failures AND world-read caps (stdout/stderr over 256KB) — the script
// cannot decide either, so the gate goes to the owner with the rejection
// reason in the tail. A failing gate is re-run once to rule out a flake
// (NOTES.md lists the known ones).
async function runGate(rawCmd: string): Promise<GateOutcome> {
	const cmd = normalizeGate(rawCmd)
	const lintPath = LINT_READ_ONLY[cmd]
	const bunTest = /^bun\s+test\s+/.exec(cmd)
	let argv: string[]
	if (lintPath) {
		argv = ['biome', 'check', lintPath]
	} else if (bunTest) {
		argv = ['test', ...cmd.slice(bunTest[0].length).split(/\s+/), '--dots']
	} else {
		const parts = cmd.split(/\s+/)
		const dots = BUN_TEST_SCRIPTS.has(parts[0]) ? ['--dots'] : []
		argv = ['run', parts[0], ...dots, ...parts.slice(1)]
	}
	try {
		let result = lintPath
			? await world.run('bunx', argv, GATE_TIMEOUT)
			: await world.run('bun', argv, GATE_TIMEOUT)
		if (result.exitCode !== 0) {
			const rerun = lintPath
				? await world.run('bunx', argv, GATE_TIMEOUT)
				: await world.run('bun', argv, GATE_TIMEOUT)
			if (rerun.exitCode === 0) {
				return { cmd, pass: true, unrunnable: false, flaky: true, tail: '' }
			}
			result = rerun
		}
		return {
			cmd,
			pass: result.exitCode === 0,
			unrunnable: false,
			flaky: false,
			tail: tail(result.stderr || result.stdout),
		}
	} catch (e) {
		return { cmd, pass: false, unrunnable: true, flaky: false, tail: tail(String(e)) }
	}
}

const pickPrompt =
	(inputId
		? `Find ${inputId} in TODO.md. It is pickable if it is in TODO.md (not BACKLOG.md) and either carries "— changes requested ↩", or has no status suffix, its Area is not design, and every LT-ID on its Needs line is done ✓, done, pending review ⏳, changes requested ↩ or reviewed ✓ in any queue file.`
		: `Pick by the contract in .agents/skills/architect/references/task-queue.md → "The chain". First, any TODO.md entry carrying "— changes requested ↩", in file order. Otherwise read TODO.md's "The chain" section and pick the first ready task, tracks in order: no suffix, Area not design, every Needs LT-ID satisfied (done ✓, ⏳, ↩ or reviewed ✓ in TODO.md, BACKLOG.md or DONE.md), and every earlier task in its track satisfied or blocked ⛔. Do not guess an order the chain does not state.`) +
	`\n\nIf a task is pickable, claim it: on its title line in TODO.md, replace "— changes requested ↩" with "— in progress ⚙", or append " — in progress ⚙" when it had no suffix. Change nothing else in any file. Set rework=true for a changes-requested task. Return picked=false with the reason when nothing is pickable; never claim a task that fails the contract.`

const runs: TaskRun[] = []
const picker = agent('pick next queue task')

for (let n = 0; n < MAX_TASKS; n++) {
	// ── Pick and claim ────────────────────────────────────────────────────────
	phase('Pick')
	const task = await picker.ask<PickResult>(pickPrompt)
	if (!task.picked) {
		log(`Nothing picked: ${task.reason || 'pick agent failed'}`)
		break
	}
	log(`Picked ${describe(task)}: ${task.reason}`)

	// ── Implement ─────────────────────────────────────────────────────────────
	phase('Implement')
	const implementer = agent(`implement ${task.id}`)
	let handoff: Handoff
	try {
		handoff = await implementer.ask<Handoff>(
			`Read .agents/skills/contributor/SKILL.md and follow its conventions. Implement queue task ${describe(task)} from TODO.md. It is already claimed (— in progress ⚙); leave that suffix in place, the Annotate step replaces it.\n` +
				(task.rework
					? `This is rework: review requested changes. The numbered findings on the entry's **Review:** line are the work; the rest of the task is done (see its Changed/How lines and git log). Fix each finding in the same task, or rebut one with evidence in "how". Keep dependents' gates green. `
					: `Read the entry, the sources it cites (${(task.citations ?? []).join(', ') || 'none listed'}) and the area's living docs first. `) +
				`Run ${GATE_TABLE}${task.gates?.length ? ` (${task.gates.join(', ')})` : ''} and report each real result. Report each gate as the bare package.json script name (for example \`test:server\`), not the full command line — the script re-runs them from those names. Lint gates use biome --write, so run their read-only form instead (bunx biome check <same path>) and change no file. The script re-runs the gates independently after your turn, so report honestly and never a gate you did not run.\n` +
				`If the task needs an architectural decision it does not contain, stop: return outcome=blocked with the blocker, and make no further edits. ` +
				`Do not commit, do not move queue entries, do not edit ARCHITECTURE.md, and do not write the status suffix or handoff fields.`,
		)
	} catch (e) {
		log(
			`${task.id}: the implement agent failed (${String(e)}); the entry is still claimed (— in progress ⚙) and needs a manual reset`,
		)
		report({ id: task.id, outcome: 'agent-failed' })
		break
	}

	// The gate list: area defaults, the entry's Gates line, and any extra gate
	// the implement agent reports it ran (the conditional ones in the table) —
	// all normalized to bare script names before deduplication.
	const gateSet = new Set<string>([
		...(AREA_GATES[task.area] ?? []),
		...(task.gates ?? []).map(normalizeGate),
	])
	for (const g of handoff.gates) {
		gateSet.add(normalizeGate(g.cmd))
	}
	const gateList = [...gateSet].filter(Boolean)

	// Review lenses; the actors are created once per task and reused across fix
	// rounds so each round builds on what the reviewer already saw.
	const lenses: { key: string; prompt: string }[] = [
		{
			key: 'conformance',
			prompt: `Does the change do what ${task.id}'s entry in TODO.md asks, and only that? Check it against the entry's Context, Check/Verification lines and the sources it cites (${(task.citations ?? []).join(', ') || 'none listed'}), AGENTS.md, and the ADR 0028 channel/tier the entry names. Run the entry's Check line yourself. If it fails but the handoff explains why with evidence and the explanation holds, report a minor finding (the Architect rules on it), not a blocking one. Flag scope creep, a missing regression test for a fix, and docs the change made stale but did not update.`,
		},
	]
	if (!handoff.mechanical) {
		lenses.push({
			key: 'correctness',
			prompt: `Try to break the change: edge cases, both authored surfaces (.tsx and .tsrx) where the compiler is touched, server/client parity, cleanup on disconnect, silent fallbacks. Report only defects you can tie to a line.`,
		})
	}
	if (handoff.errorCopyChanged) {
		lenses.push({
			key: 'copy',
			prompt: `Review the added, reworded or retired error copy against .agents/skills/writer/references/error-messages.md: three-part message, Tier 2 wording, prefix, the propagation checklist (including skills/le-truc/references/errors.md) and message-substring tests.`,
		})
	}
	const reviewers = lenses.map((l) => ({
		...l,
		actor: agent(`${l.key} review of ${task.id}`),
	}))

	// ── Verify, then fix, up to MAX_FIX_ROUNDS ────────────────────────────────
	let gates: GateOutcome[] = []
	let reviews: Review[] = []
	for (let round = 0; handoff.outcome === 'done' && round <= MAX_FIX_ROUNDS; round++) {
		phase('Verify')
		const changed = handoff.changed.join('\n- ')
		const [gateResults, ...reviewResults] = await Promise.all([
			Promise.all(gateList.map((c) => runGate(c))),
			...reviewers.map((r) =>
				r.actor.ask<Review>(
					`Review the uncommitted change for ${describe(task)}. Read-only: do not edit any file. Use git diff to see it.` +
						(runs.length
							? ` The working tree also holds this run's earlier, uncommitted tasks (${runs
									.map((x) => x.id)
									.filter(Boolean)
									.join(', ')}); judge only ${task.id}'s files.`
							: '') +
						` The handoff says:\n- ${changed}\nHow: ${handoff.how ?? '-'}\n\n${r.prompt}\n\nMark a finding blocking only if the task would be wrong to accept as is. Also judge whether the handoff's reviewClass="${handoff.reviewClass}" is right per the contributor skill's rule 3.`,
				),
			),
		])
		gates = gateResults
		reviews = reviewResults

		const blocking = reviews.flatMap((x) => x.findings.filter((f) => f.severity === 'blocking'))
		const red = gates.filter((g) => !g.pass && !g.unrunnable)
		if (reviews.some((x) => !x.reviewClassAgrees) && handoff.reviewClass === 'internal') {
			log(`${task.id}: a reviewer reads this as an API change; marking for review`)
			handoff = { ...handoff, reviewClass: 'api' }
		}
		if (!blocking.length && !red.length) break
		if (round === MAX_FIX_ROUNDS) {
			log(
				`${task.id}: still ${blocking.length} blocking finding(s), ${red.length} red gate(s) after ${MAX_FIX_ROUNDS} fix rounds`,
			)
			handoff = {
				...handoff,
				outcome: 'blocked',
				blocker: `Unresolved after ${MAX_FIX_ROUNDS} fix rounds: ${[
					...red.map((x) => `gate ${x.cmd} red`),
					...blocking.map((f) => f.issue),
				].join('; ')}`,
			}
			break
		}

		phase('Fix')
		try {
			handoff = await implementer.ask<Handoff>(
				`You are continuing ${describe(task)}; the uncommitted change is in the working tree (git diff). Fix these, or rebut a finding with evidence in "how" if it is wrong:\n` +
					[
						...red.map((x) => `- RED GATE ${x.cmd}: ${x.tail || ''}`),
						...blocking.map((f) => `- ${f.file ?? ''} ${f.issue}${f.fix ? ` (suggested: ${f.fix})` : ''}`),
					].join('\n') +
					`\n\nThen re-run the affected gates (read-only lint form). Same limits as before: no commit, no queue moves, no ARCHITECTURE.md, no suffix. Return the full updated handoff (all changed files, not only this round's).`,
			)
		} catch {
			handoff = { ...handoff, outcome: 'blocked', blocker: 'fix agent failed' }
		}
	}

	// ── Annotate ──────────────────────────────────────────────────────────────
	phase('Annotate')
	const minors = reviews.flatMap((x) => x.findings.filter((f) => f.severity === 'minor'))
	const suffix =
		handoff.outcome === 'blocked'
			? '— blocked ⛔'
			: handoff.reviewClass === 'api'
				? '— done, pending review ⏳'
				: '— done ✓'
	let annotation: Annotation | undefined
	try {
		annotation = await agent(`annotate ${task.id}`).ask<Annotation>(
			`In TODO.md, on ${task.id}'s title line, replace " — in progress ⚙" with " ${suffix}". Do not move the entry or touch any other entry.\n` +
				(handoff.outcome === 'blocked'
					? `Append a NOTES.md entry in the format of .agents/skills/architect/references/task-queue.md ("NOTES.md entry format"), Area ${task.area}, describing: ${handoff.blocker ?? 'the run blocked without a stated reason'}. Give options only if they follow from the facts.`
					: handoff.reviewClass === 'api'
						? `Add under the entry, after its existing fields: **Changed:** (${handoff.changed.join('; ')}), **How:** (${handoff.how ?? ''}), **Check:** (${handoff.check ?? ''}${minors.length ? `; minor review notes: ${minors.map((f) => f.issue).join('; ')}` : ''}). Keep each to one or two lines in the queue's register.`
						: `Add one line under the entry: **Changed:** summarizing ${handoff.changed.join('; ')}.`) +
				(task.rework && handoff.outcome !== 'blocked'
					? ` This was rework: instead of new Changed/How/Check lines, add one **Reworked:** line after the **Review:** line, answering each numbered finding briefly (fixed how, or rebutted why).`
					: '') +
				`\nReturn the suffix written, whether you wrote a NOTES.md entry, and a commit message for the uncommitted changes of ${task.id} (git diff, including your queue edits). Style: ${COMMIT_STYLE}`,
		)
	} catch {
		log(`${task.id}: the annotate agent failed; the computed suffix was not written — check TODO.md manually`)
	}

	const run: TaskRun = {
		id: task.id,
		title: task.title,
		area: task.area,
		suffix: annotation?.suffix ?? suffix,
		changed: handoff.changed,
		gates: gates.length
			? gates.map((x) => `${x.pass ? '✓' : x.unrunnable ? '⊘' : '✗'} ${x.cmd}`)
			: handoff.gates.map((x) => `${x.pass ? '✓' : '✗'} ${x.cmd}${x.note ? ` — ${x.note}` : ''}`),
		ownerMustRun: gates.filter((x) => !x.pass && x.unrunnable).map((x) => x.cmd),
		minorFindings: minors.map((f) => `${f.file ?? ''} ${f.issue}`.trim()),
		blocker: handoff.blocker,
		commit: annotation?.commit,
	}
	runs.push(run)
	report(run)
	if (handoff.outcome === 'blocked') break
}

// ── Owner handoff ─────────────────────────────────────────────────────────────
const NEXT = "Owner: review git diff and commit with each run's commit message. Nothing is committed or moved between queue files."
if (runs.length) {
	const lines: string[] = ['# do-task handoff', '']
	for (const r of runs) {
		lines.push(
			`## ${r.id} — ${r.title}`,
			'',
			`- Status: ${r.suffix}`,
			`- Gates: ${r.gates.join(' · ') || 'none run'}`,
			`- Changed: ${r.changed.join('; ')}`,
		)
		if (r.ownerMustRun.length) lines.push(`- Owner must run (undecidable in the run): ${r.ownerMustRun.join(', ')}`)
		if (r.minorFindings.length) lines.push(`- Minor review notes: ${r.minorFindings.join('; ')}`)
		if (r.blocker) lines.push(`- Blocker: ${r.blocker}`)
		if (r.commit) lines.push('', '```', r.commit, '```')
		lines.push('')
	}
	lines.push(NEXT)
	await artifact.markdown('handoff', lines.join('\n'), {
		title: 'do-task handoff',
		description: `${runs.length} task(s) processed; patches wait uncommitted for the owner.`,
		primary: true,
	})
}

return {
	conclusion: runs.length
		? `${runs.map((r) => `${r.id} ${r.suffix}`).join('; ')}. Nothing committed; patches wait for the owner.`
		: 'Nothing picked: no ready TODO task matched the chain contract.',
	runs,
	next: NEXT,
}