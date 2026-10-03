/* zcode-workflow
description: Pick the next ready TODO task (or a given LT-ID), implement it in
  its own git worktree, verify gates, review, annotate the suffix.
whenToUse: "Work the le-truc queue without hand-offs. Args: id (an LT-NNN to
  implement instead of picking) or max (run up to that many ready tasks). Ends
  with one task branch per task in its own worktree, waiting for the owner to
  commit and merge."
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
// The queue lives only in the main checkout and is written exclusively by
// scripts/queue.ts — deterministic pick/claim/annotate under `bun test`
// (contract: .agents/skills/architect/references/task-queue.md). Code work
// happens in a per-task git worktree (.worktrees/LT-NNN, branch task/LT-NNN,
// bootstrapped by scripts/worktree.ts), so two runs — or a run and a human —
// cannot collide in one tree, and a task's diff is exactly its worktree's
// diff. Nothing is ever committed by this run: patches wait on the task
// branch for the owner. The Claude Code twin (.claude/workflows/do-task.js)
// drives the same queue script.

interface QueuePick {
	picked: boolean
	reason: string
	/** Absent when picked is false. */
	task?: {
		id: string
		title: string
		area?: string
		/** The suffix found on the entry: '' (open) or 'changes-requested'. */
		suffix: string
		rework: boolean
		needs: string[]
		/** Extra commands from the entry's Gates line. */
		gates: string[]
		/** ADRs, REQUIREMENTS items, ARCHITECTURE sections and LT-IDs the entry cites. */
		citations: string[]
		/** The full entry text, injected into the agent prompts. */
		entryText: string
	}
}

interface Worktree {
	created: boolean
	/** Absolute path of .worktrees/<id>. */
	path: string
	branch: string
	nodeModules: string
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
	/** True once the prose file at prosePath is written. */
	written: boolean
	/** The full commit message for this task's changes. */
	commit: string
}

interface TaskRun {
	id: string
	title: string
	area: string
	suffix: string
	branch: string
	worktree: string
	changed: string[]
	gates: string[]
	ownerMustRun: string[]
	minorFindings: string[]
	blocker?: string
	commit?: string
}

// ── Contract ────────────────────────────────────────────────────────────────
// This script never edits a queue file directly — every queue write goes
// through `bun run scripts/queue.ts` in the main checkout, so a task branch
// never touches queue files and merges back stay clean by construction. It
// never edits ARCHITECTURE.md, never commits, and its agents never touch
// .agents/ or .vscode/ (the worktree copies are read-only references).

const inputId = typeof args.id === 'string' ? args.id : undefined
const inputMax = typeof args.max === 'number' ? args.max : undefined
const MAX_TASKS = inputId ? 1 : Math.max(1, inputMax ?? 1)
const MAX_FIX_ROUNDS = 2
const GATE_TIMEOUT = { timeoutMs: 1_800_000 }

// The queue tool. Every call is a world.run: exit 0 means the JSON/prose on
// stdout is authoritative, anything else means the queue refused (already
// claimed, contract violation) and the run must stop for that task.
const QUEUE = ['run', 'scripts/queue.ts'] as const

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
// Paths stay worktree-relative: gates run with the worktree as cwd.
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

// Gates that read the built docs/ output, which a fresh worktree lacks —
// build:docs runs first in the worktree whenever one of them is in the gate
// list (serve.test.ts 404s without it).
const DOCS_DEPENDENT = new Set(['test:server', 'check:links'])

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
//
// Every gate runs with the task's worktree as cwd, via flags AFTER the
// subcommand: `bun run --cwd <wt> <script>` and `bun test --cwd <wt> <paths>`.
// NEVER `bun --cwd <wt> run <script>` — bun 1.4.2 silently ignores that form
// (usage on stderr, exit 0, nothing runs), so the gate would report green
// without executing. Lint goes through `bun run --cwd <wt> biome check …`
// because bunx has no usable --cwd (it would resolve a package named after
// the path).
async function runGate(rawCmd: string, wt: string): Promise<GateOutcome> {
	const cmd = normalizeGate(rawCmd)
	const lintPath = LINT_READ_ONLY[cmd]
	const bunTest = /^bun\s+test\s+/.exec(cmd)
	let argv: string[]
	if (lintPath) {
		argv = ['run', '--cwd', wt, 'biome', 'check', lintPath]
	} else if (bunTest) {
		argv = ['test', '--cwd', wt, ...cmd.slice(bunTest[0].length).split(/\s+/), '--dots']
	} else {
		const parts = cmd.split(/\s+/)
		const dots = BUN_TEST_SCRIPTS.has(parts[0]) ? ['--dots'] : []
		argv = ['run', '--cwd', wt, parts[0], ...dots, ...parts.slice(1)]
	}
	try {
		let result = await world.run('bun', argv, GATE_TIMEOUT)
		if (result.exitCode !== 0) {
			const rerun = await world.run('bun', argv, GATE_TIMEOUT)
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

// One deterministic queue command. A nonzero exit is the queue refusing —
// surfaced to the caller as null.
async function queueRun(op: 'pick' | 'claim' | 'reset' | 'annotate', rest: string[]): Promise<string | null> {
	try {
		const result = await world.run('bun', [...QUEUE, op, ...rest])
		if (result.exitCode !== 0) {
			log(`queue ${op} refused: ${tail(result.stderr || result.stdout)}`)
			return null
		}
		return result.stdout
	} catch (e) {
		log(`queue ${op} could not run: ${tail(String(e))}`)
		return null
	}
}

const runs: TaskRun[] = []

for (let n = 0; n < MAX_TASKS; n++) {
	// ── Pick, claim, bootstrap the worktree ───────────────────────────────────
	phase('Pick')
	const pickOut = await queueRun('pick', inputId ? [inputId] : [])
	if (pickOut === null) {
		report({ outcome: 'pick-failed' })
		break
	}
	const decision = JSON.parse(pickOut) as QueuePick
	if (!decision.picked || !decision.task) {
		log(`Nothing picked: ${decision.reason || 'queue reports nothing ready'}`)
		break
	}
	const task = decision.task
	const area = task.area ?? 'runtime'
	log(`Picked ${describe({ id: task.id, title: task.title, area })}: ${decision.reason}`)

	if ((await queueRun('claim', [task.id])) === null) {
		report({ id: task.id, outcome: 'claim-failed' })
		break
	}

	let wt: Worktree | undefined
	try {
		const boot = await world.run('bun', ['run', 'scripts/worktree.ts', task.id])
		if (boot.exitCode !== 0) {
			log(`worktree bootstrap failed for ${task.id}: ${tail(boot.stderr || boot.stdout)}`)
		} else {
			wt = JSON.parse(boot.stdout) as Worktree
			log(
				`Worktree ${wt.path} ready on ${wt.branch}${wt.created ? ' (created)' : ' (reused)'}`,
			)
		}
	} catch (e) {
		log(`worktree bootstrap failed for ${task.id}: ${tail(String(e))}`)
	}
	if (!wt) {
		// The task is claimed (— in progress ⚙) but has no workspace: reset it so
		// the next pick can take it, rather than stranding a claim.
		await queueRun('reset', [task.id])
		report({ id: task.id, outcome: 'bootstrap-failed' })
		break
	}

	// ── Implement ─────────────────────────────────────────────────────────────
	phase('Implement')
	const implementer = agent(`implement ${task.id}`)
	let handoff: Handoff
	try {
		handoff = await implementer.ask<Handoff>(
			`Work ONLY inside the git worktree ${wt.path} (branch ${wt.branch}). Read .agents/skills/contributor/SKILL.md there and follow its conventions.\n` +
				`Implement queue task ${describe({ id: task.id, title: task.title, area })}. Its full queue entry:\n---\n${task.entryText}\n---\n` +
				`Sources it cites: ${(task.citations ?? []).join(', ') || 'none listed'} — read them, plus the area's living docs, before coding.` +
				(task.rework
					? `\nThis is rework: review requested changes. The numbered findings on the entry's **Review:** line are the work; the rest of the task is done (see its Changed/How lines and git log of the main checkout). Fix each finding in the same task, or rebut one with evidence in "how". Keep dependents' gates green.`
					: '') +
				`\nRun ${GATE_TABLE}${task.gates?.length ? ` (${task.gates.join(', ')})` : ''} and report each real result — from inside the worktree. Report each gate as the bare package.json script name (for example \`test:server\`), not the full command line — the script re-runs them from those names in your worktree. Lint gates use biome --write, so run their read-only form instead (bunx biome check <same path>) and change no file. The script re-runs the gates independently after your turn, so report honestly and never a gate you did not run.\n` +
				`Boundaries: the worktree's BACKLOG.md, TODO.md, DONE.md, NOTES.md, .agents/ and .vscode/ are read-only references — the queue is managed in the main checkout, so never edit those files here, and never stage or commit anything (the owner commits). If the task needs an architectural decision it does not contain, stop: return outcome=blocked with the blocker, and make no further edits. Do not write the handoff fields from outside — report your own result honestly.`,
		)
	} catch (e) {
		log(`${task.id}: the implement agent failed (${String(e)}); resetting the claim`)
		await queueRun('reset', [task.id])
		report({ id: task.id, outcome: 'agent-failed' })
		break
	}

	// The gate list: area defaults, the entry's Gates line, and any extra gate
	// the implement agent reports it ran (the conditional ones in the table) —
	// all normalized to bare script names before deduplication. Gates that read
	// built docs/ get build:docs first, which a fresh worktree lacks.
	const gateSet = new Set<string>([
		...(AREA_GATES[area] ?? []),
		...(task.gates ?? []).map(normalizeGate),
	])
	for (const g of handoff.gates) {
		gateSet.add(normalizeGate(g.cmd))
	}
	const gateList = [...gateSet].filter(Boolean)
	if (gateList.some((g) => DOCS_DEPENDENT.has(g))) {
		gateList.unshift('build:docs')
	}

	// Review lenses; the actors are created once per task and reused across fix
	// rounds so each round builds on what the reviewer already saw.
	const lenses: { key: string; prompt: string }[] = [
		{
			key: 'conformance',
			prompt: `Does the change do what ${task.id} asks, and only that? The full queue entry is your contract:\n---\n${task.entryText}\n---\nCheck the change against that entry's Context, Check/Verification lines and the sources it cites (${(task.citations ?? []).join(', ') || 'none listed'}), AGENTS.md, and the ADR 0028 channel/tier the entry names. Run the entry's Check line yourself, inside the worktree. If it fails but the handoff explains why with evidence and the explanation holds, report a minor finding (the Architect rules on it), not a blocking one. Flag scope creep, a missing regression test for a fix, and docs the change made stale but did not update.`,
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
			Promise.all(gateList.map((c) => runGate(c, wt.path))),
			...reviewers.map((r) =>
				r.actor.ask<Review>(
					`Review the change for ${describe({ id: task.id, title: task.title, area })}, isolated in the git worktree ${wt.path} (branch ${wt.branch}) — nothing else is in progress there. Read-only: do not edit any file. See it with \`git -C ${wt.path} diff HEAD\` plus \`git -C ${wt.path} status --porcelain\` for untracked files.\n` +
						`The handoff says:\n- ${changed}\nHow: ${handoff.how ?? '-'}\n\n${r.prompt}\n\nMark a finding blocking only if the task would be wrong to accept as is. Also judge whether the handoff's reviewClass="${handoff.reviewClass}" is right per the contributor skill's rule 3.`,
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
				`You are continuing ${describe({ id: task.id, title: task.title, area })}; the uncommitted change is in your worktree ${wt.path} (git -C ${wt.path} diff HEAD). Fix these, or rebut a finding with evidence in "how" if it is wrong:\n` +
					[
						...red.map((x) => `- RED GATE ${x.cmd}: ${x.tail || ''}`),
						...blocking.map((f) => `- ${f.file ?? ''} ${f.issue}${f.fix ? ` (suggested: ${f.fix})` : ''}`),
					].join('\n') +
					`\n\nThen re-run the affected gates (read-only lint form) inside the worktree. Same limits as before: queue files, .agents/ and .vscode/ stay untouched, no staging, no commit. Return the full updated handoff (all changed files, not only this round's).`,
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
	const statusKey =
		handoff.outcome === 'blocked' ? 'blocked' : handoff.reviewClass === 'api' ? 'pending-review' : 'done'
	const prosePath = `.zcode/workflow-drafts/queue-annotate/${task.id}.md`
	let annotation: Annotation | undefined
	try {
		annotation = await agent(`annotate ${task.id}`).ask<Annotation>(
			`Compose the queue annotation for ${task.id} and write it to ${prosePath} (create the directory if needed). The queue script inserts it after the entry; you write only the prose.\n` +
				(handoff.outcome === 'blocked'
					? `The run blocked: ${handoff.blocker ?? 'no stated reason'}. Write a NOTES.md entry in the format of .agents/skills/architect/references/task-queue.md ("NOTES.md entry format"), Area ${area}, describing the blocker. Give options only if they follow from the facts.`
					: handoff.reviewClass === 'api'
						? `Write Changed/How/Check lines in the queue's register, one or two lines each: **Changed:** (${handoff.changed.join('; ')}), **How:** (${handoff.how ?? ''}), **Check:** (${handoff.check ?? ''}${minors.length ? `; minor review notes: ${minors.map((f) => f.issue).join('; ')}` : ''}).`
						: `Write one line: **Changed:** summarizing ${handoff.changed.join('; ')}.`) +
				(task.rework && handoff.outcome !== 'blocked'
					? ` This was rework: instead of new Changed/How/Check lines, write one **Reworked:** line answering each numbered finding on the entry's **Review:** line briefly (fixed how, or rebutted why).`
					: '') +
				`\nThe handoff for context: outcome=${handoff.outcome}, reviewClass=${handoff.reviewClass}, changed=${JSON.stringify(handoff.changed)}.\n` +
				`Then return written=true once the file exists, and a commit message for the task's changes (run \`git -C ${wt.path} diff HEAD\` and \`git -C ${wt.path} status --porcelain\` to see them). Style: ${COMMIT_STYLE}`,
		)
	} catch {
		log(`${task.id}: the annotate agent failed; the computed suffix was not written — check the queue manually`)
	}
	let annotated = false
	if (annotation?.written) {
		const out = await queueRun('annotate', [task.id, statusKey, prosePath])
		annotated = out !== null
		if (!annotated) log(`${task.id}: the queue refused the annotation — check the queue manually`)
	}

	const run: TaskRun = {
		id: task.id,
		title: task.title,
		area,
		suffix: annotated ? suffix : '— in progress ⚙ (annotation failed)',
		branch: wt.branch,
		worktree: wt.path,
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
const NEXT = [
	'Owner, per task branch (nothing is committed; the queue suffix edits stay uncommitted in the main checkout for a separate docs(queue) commit):',
	'1. Review: git -C <worktree> diff HEAD  ·  git -C <worktree> status --porcelain',
	'2. Commit in the worktree: git -C <worktree> add -A && git -C <worktree> commit -m "<the message below>"',
	'3. Merge from v3 (task branches never touch queue files, so the dirty queue merges clean): git merge task/<id>',
	'4. Clean up: git worktree remove --force <worktree> && git branch -d task/<id>',
].join('\n')
if (runs.length) {
	const lines: string[] = ['# do-task handoff', '']
	for (const r of runs) {
		lines.push(
			`## ${r.id} — ${r.title}`,
			'',
			`- Status: ${r.suffix}`,
			`- Branch: ${r.branch} · worktree ${r.worktree}`,
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
		description: `${runs.length} task branch(es) ready in their worktrees; patches wait for the owner.`,
		primary: true,
	})
}

return {
	conclusion: runs.length
		? `${runs.map((r) => `${r.id} ${r.suffix} on ${r.branch}`).join('; ')}. Nothing committed; each patch waits on its task branch.`
		: 'Nothing picked: the queue reports no ready task for the chain contract.',
	runs,
	next: NEXT,
}
