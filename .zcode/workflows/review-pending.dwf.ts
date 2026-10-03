/* zcode-workflow
description: Review every pending-review (⏳) branch — two lenses, a skeptic
  pass, reviewer nits committed on the task branch — and return verdicts plus
  a merge plan for the owner-attended integration.
whenToUse: "Sweep the le-truc review queue. Args: id (one LT-NNN) or nothing
  for every ⏳ entry with a committed branch. Reviews committed branches only;
  nit fixes are committed on the branch. Writes no queue file and performs no
  merge: the Architect confirms the verdicts, applies the queue moves and
  integrates via scripts/worktree.ts integrate."
args:
  id:
    type: string
    description: A specific LT-NNN to review instead of every pending-review entry.
    required: false
*/
// Contract: .agents/skills/architect/SKILL.md rule 3 and
// .agents/skills/architect/references/task-queue.md. A finding inside the
// task's scope stays in the task: a nit the reviewer fixes, or a change
// requested (↩); only an out-of-scope finding becomes a follow-up task.
// Tasks arrive here committed on task/LT-NNN (owner ruling 2026-10-03), so
// the change under review is the branch's three-dot diff against the source
// branch — an immutable snapshot, not a moving worktree. This run writes one
// thing: nit fixes, committed on the task branch (unsigned there by
// worktree-local config) via scripts/worktree.ts commit. It never edits a
// queue file, NOTES.md or ARCHITECTURE.md, and never merges: the verdicts and
// the merge plan are proposals for the owner-attended Architect session,
// which applies the queue moves and integrates with
// `bun run scripts/worktree.ts integrate <LT-NNN>` (signed --no-ff merge).
// The Claude Code twin (.claude/workflows/review-pending.js) relays the same
// reads through low-effort agents.

interface StoreTask {
	id: string
	title: string
	area: string
	status: string
	entry: string
}

interface PendingEntry {
	id: string
	title: string
	area: string
	entry: string
	branch: string
	tip: string
	/** Commits on the branch beyond HEAD; 0 means already integrated. */
	beyondHead: number
	/** .worktrees/<id> when it exists, else empty. */
	worktree: string
	worktreeDirty: boolean
}

interface Findings {
	findings: {
		/** nit: cannot change behavior, exact fix given; change: inside the task's scope; followup: outside it. */
		kind: 'nit' | 'change' | 'followup'
		file?: string
		issue: string
		fix?: string
	}[]
	/** One line on what is right, for the Review line. */
	strengths: string
}

interface Verdict {
	kept: {
		kind: 'nit' | 'change' | 'followup'
		file?: string
		issue: string
		fix?: string
		/** For a followup: a BACKLOG.md entry in the queue format, Area and Context filled. */
		followupEntry?: string
	}[]
	dropped: { issue: string; why: string }[]
}

interface Nits {
	applied: string[]
	/** Nits undone because a gate went red or the fix turned out to change behavior. */
	reverted: string[]
	gates: string[]
	/** The worktree.ts commit exited 0 (false when there was nothing to commit or it refused). */
	commitDone: boolean
	/** The nit commit's short sha when committed. */
	sha?: string
}

interface Proposal {
	reviewLine: string
	/** Only when approved: the compacted DONE.md entry. */
	doneEntry?: string
}

interface ReviewResult {
	id: string
	verdict: 'reviewed ✓' | 'changes requested ↩' | 'unreviewed'
	reviewLine?: string
	doneEntry?: string
	followups: string[]
	nitsApplied: string[]
	nitCommitSha?: string
	dropped: string[]
}

interface MergePlanEntry {
	id: string
	branch: string
	verdict: string
	ready: boolean
	note?: string
}

const only = typeof args.id === 'string' ? [args.id] : []
const tail = (s: string): string => {
	const t = s.trim()
	return t.length > 600 ? `…${t.slice(-599)}` : t
}

// ── Collect: the store, the branches, the worktrees ──────────────────────────
phase('Collect pending branches and entries')
const listRun = await world.run('bun', ['run', 'scripts/queue.ts', 'list', '--status', 'pending-review'])
if (listRun.exitCode !== 0)
	throw new Error(`queue list refused: ${tail(listRun.stderr || listRun.stdout)}`)
const stored = JSON.parse(listRun.stdout).tasks as StoreTask[]
const all = stored
	.filter(t => !only.length || only.includes(t.id))
	.map(t => ({ id: t.id, title: t.title, area: t.area, entry: t.entry }))

const branchRun = await world.run('git', ['for-each-ref', '--format=%(refname:short)', 'refs/heads/task/'])
const branches = new Set(branchRun.stdout.split('\n').map(s => s.trim()).filter(Boolean))

const entries: PendingEntry[] = []
for (const t of all) {
	const branch = `task/${t.id}`
	if (!branches.has(branch)) {
		log(`${t.id}: no branch — nothing committed to review; clean it up or run do-task first`)
		continue
	}
	const tip = (await world.run('git', ['rev-parse', '--short', branch])).stdout.trim()
	const beyondHead = Number(
		(await world.run('git', ['rev-list', '--count', `HEAD..${branch}`])).stdout.trim(),
	)
	if (beyondHead === 0) {
		log(`${t.id}: ${branch} carries no commits beyond HEAD — already integrated; clean leftovers up by hand`)
		continue
	}
	const wtPath = `.worktrees/${t.id}`
	let worktree = ''
	let worktreeDirty = false
	try {
		const dirty = await world.run('git', ['-C', wtPath, 'status', '--porcelain'])
		worktree = wtPath
		worktreeDirty = dirty.stdout.trim().length > 0
	} catch {
		// No worktree — the branch is still reviewable via git.
	}
	entries.push({ ...t, branch, tip, beyondHead, worktree, worktreeDirty })
}
if (!entries.length) {
	log('No pending-review branches to review.')
	return { reviews: [], mergePlan: [], stale: all.map(t => t.id) }
}
log(`Reviewing ${entries.map(e => e.id).join(', ')}`)

const diffOf = (e: PendingEntry): string =>
	`the committed branch ${e.branch} (git diff HEAD...${e.branch}; files readable in the worktree ${e.worktree || `(absent — git show ${e.branch}:<path>)`})`

const LENSES: { key: string; prompt: string }[] = [
	{
		key: 'design',
		prompt:
			"Review as the Architect, for DX and goals alignment. Test the change against REQUIREMENTS.md (goals, personas, constraints), CONTEXT.md (every new name uses the glossary), ARCHITECTURE.md, and the published-surface stability rule: anything a user or adapter can see must be a shape we can keep through 3.x. Judge names, defaults and error copy from the author's seat.",
	},
	{
		key: 'conformance',
		prompt:
			'Review for conformance. Read every changed file in full, not only the hunks. Check the change against the ADRs and REQUIREMENTS items the entry cites, its Context, and every Verification/Check line (run those checks). Check the ADR 0028 channel/tier the entry names, that each fix has a regression test, and that docs the change made stale were updated.',
	},
]

// ── Review each branch on both lenses, then a skeptic sorts the findings ────
phase('Review each branch, then sort the findings')
const reviewed = await Promise.all(
	entries.map(async (e): Promise<{ e: PendingEntry; v: Verdict | null; strengths: string[] }> => {
		const lensResults = await Promise.all(
			LENSES.map(l =>
				agent(`review:${l.key} ${e.id}`)
					.ask<Findings>(
						`Review ${e.id} (${e.title}; Area: ${e.area}). The change is ${diffOf(e)}. The entry:\n---\n${e.entry}\n---\n${l.prompt}\n\n` +
							"Read only; change no file. Sort each finding: nit (cannot change behavior; give the exact fix), change (inside the task's scope), or followup (outside it: a new design question, another area, work the entry never asked for). Report only what you can tie to a file and line. The entry's own Check notes are known; report them only if the change did not address them. If you find nothing, return an empty findings list.",
					)
					.then(r => (r.findings.length ? { ...r, key: l.key } : null)),
			),
		)
		const withFindings = lensResults.filter(Boolean) as (Findings & { key: string })[]
		const strengths = lensResults.map(r => r?.strengths).filter((s): s is string => !!s)
		if (!withFindings.length) return { e, v: null, strengths }
		const findings = withFindings.flatMap(r => r.findings)
		const v = await agent(`skeptic ${e.id}`).ask<Verdict>(
			`You are the skeptic for the review of ${e.id} (${e.title}). The change is ${diffOf(e)}. The entry:\n---\n${e.entry}\n---\n` +
				`Reviewers reported:\n${findings.map((f, i) => `${i + 1}. [${f.kind}] ${f.file || ''} ${f.issue}${f.fix ? ` (fix: ${f.fix})` : ''}`).join('\n')}\n\n` +
				"Try to refute each one against the code; drop it with the reason if it is wrong, a duplicate, or a matter of taste. Re-sort what survives: a nit must be unable to change behavior (otherwise it is a change); a change must be inside the entry's scope (otherwise it is a followup). Every change requested costs a rework round, so keep only those that make the task wrong to accept. For each followup, draft a BACKLOG.md entry in the format of .agents/skills/architect/references/task-queue.md, leaving the LT-ID as LT-???. Read only; change no file.",
		)
		return { e, v, strengths }
	}),
)

// ── Apply the nits, one worktree at a time ───────────────────────────────────
phase('Apply reviewer nits on each branch')
const nitResults: (Nits | null)[] = []
for (let i = 0; i < reviewed.length; i++) {
	const { e, v } = reviewed[i]
	const nits = (v?.kept || []).filter(f => f.kind === 'nit')
	if (!nits.length || !e.worktree) {
		nitResults.push(null)
		continue
	}
	nitResults.push(
		await agent(`nit fixes ${e.id}`).ask<Nits>(
			`Apply these reviewer nits for ${e.id} inside the git worktree ${e.worktree} (branch ${e.branch}) — work only there. Each must leave behavior unchanged:\n${nits.map((f, n) => `${n + 1}. ${f.file || ''} ${f.issue}${f.fix ? ` — fix: ${f.fix}` : ''}`).join('\n')}\n\n` +
				`Then run the gates the touched files need inside the worktree (\`bun run --cwd ${e.worktree} <script>\`, \`bun test --cwd ${e.worktree} <paths>\`; lint's read-only form is \`bunx biome check <files>\`; a 10-minute timeout each). If a nit turns a gate red or would change behavior, revert it and list it as reverted.\n` +
				`Then commit exactly the nit-fixed files on the branch: write the commit message to .zcode/workflow-drafts/review-nits/${e.id}.txt (subject \`review: ${e.id} — reviewer nit fixes\`, body only when it carries what the diff cannot show, end with a blank line and the Co-Authored-By trailer your session instructions give) and run:\n` +
				`bun run scripts/worktree.ts commit ${e.id} --message-file .zcode/workflow-drafts/review-nits/${e.id}.txt -- <the nit-fixed files>\n` +
				`Worktree commits are unsigned by design. Touch no other file and no queue file. Return the applied/reverted lists, the gates you ran, commitDone=true only when the commit exited 0, and its sha.`,
		),
	)
}

// ── Propose the verdicts and the merge plan ──────────────────────────────────
phase('Draft verdicts and the merge plan')
const reviews: ReviewResult[] = await Promise.all(
	reviewed.map(async ({ e, v, strengths }, i) => {
		const n = nitResults[i]
		const kept = v?.kept || []
		const changes = kept.filter(f => f.kind === 'change')
		const followups = kept.filter(f => f.kind === 'followup')
		const reverted = new Set(n?.reverted || [])
		const verdict: ReviewResult['verdict'] = !v ? 'unreviewed' : changes.length ? 'changes requested ↩' : 'reviewed ✓'
		if (verdict === 'unreviewed') return { id: e.id, verdict, followups: [], nitsApplied: [], dropped: [] }
		const p = await agent(`verdict ${e.id}`).ask<Proposal>(
			`Draft the queue text for the review of ${e.id} (${e.title}). Verdict: ${verdict}.\n` +
				`What is right: ${strengths.join(' ') || '-'}\n` +
				`Changes requested: ${changes.map((f, k) => `(${k + 1}) ${f.file || ''} ${f.issue}${f.fix ? ` — ${f.fix}` : ''}`).join(' ') || 'none'}\n` +
				`Nits fixed by the reviewer: ${(n?.applied || []).join('; ') || 'none'}${reverted.size ? `; reverted: ${[...reverted].join('; ')}` : ''}${n?.commitDone ? ` (committed ${n.sha} on ${e.branch})` : ''}\n` +
				`Follow-ups: ${followups.map(f => f.issue).join('; ') || 'none'}\n\n` +
				"Write reviewLine: one **Review:** line for the entry. Name the verdict, number the changes requested (each says what is wrong, where, and the expected shape), name the nits fixed, and name follow-ups as \"follow-up: LT-???\". Keep it as short as the queue's register allows. " +
				(verdict === 'reviewed ✓'
					? `Also write doneEntry: the entry compacted for DONE.md per .agents/skills/architect/references/task-queue.md → Moves ("After review"). The entry is:\n\n${e.entry}`
					: 'Leave doneEntry empty.') +
				' Read only; change no file.',
		)
		return {
			id: e.id,
			verdict,
			reviewLine: p?.reviewLine,
			doneEntry: p?.doneEntry,
			followups: followups.map(f => f.followupEntry || f.issue),
			nitsApplied: n?.applied || [],
			nitCommitSha: n?.commitDone ? n.sha : undefined,
			dropped: (v?.dropped || []).map(d => `${d.issue} — ${d.why}`),
		}
	}),
)

// The merge plan is script work, not an agent's: ready means approved, over a
// clean worktree, with any nit commit actually landed. Order is the
// collection order — the queue store's.
const mergePlan: MergePlanEntry[] = reviews.map((r, i) => {
	const e = reviewed[i].e
	const n = nitResults[i]
	return {
		id: r.id,
		branch: e.branch,
		verdict: r.verdict,
		ready:
			r.verdict === 'reviewed ✓' && !e.worktreeDirty && !(n && !n.commitDone && n.applied.length > 0),
		...(e.worktreeDirty ? { note: 'worktree has residue — restore it before integrating' } : {}),
	}
})

const lines: string[] = ['# review-pending handoff', '']
for (let i = 0; i < reviews.length; i++) {
	const r = reviews[i]
	const e = reviewed[i].e
	lines.push(
		`## ${r.id} — ${r.verdict}`,
		'',
		`- Branch: ${e.branch}${e.worktree ? ` · worktree ${e.worktree}${e.worktreeDirty ? ' (dirty)' : ' (clean)'}` : ''}`,
		`- Review: ${r.reviewLine || '-'}`,
		...(r.followups.length ? [`- Follow-ups: ${r.followups.join('; ')}`] : []),
		'',
	)
}
lines.push(
	'Confirm each verdict, then: queue moves (store status edits + `bun run queue:build`), and integrate each ready branch, one at a time in pick order, with `bun run scripts/worktree.ts integrate <LT-NNN>` (signed --no-ff merge; worktree and branch cleaned up). Nothing in the queue is written yet; the nit commits on task branches are the only writes this run made.',
)
await artifact.markdown('handoff', lines.join('\n'), {
	title: 'review-pending handoff',
	description: `${reviews.length} branch(es) reviewed; ${mergePlan.filter(p => p.ready).length} ready to integrate.`,
	primary: true,
})

const nitCommits = reviews.filter(r => r.nitCommitSha).map(r => r.id)
return {
	reviews,
	mergePlan,
	nitCommits: nitCommits.length ? `review: ${nitCommits.join(', ')} — reviewer nit fixes` : null,
	next: 'Architect: confirm each verdict, apply the queue moves (store status edits + bun run queue:build), then integrate each ready branch with bun run scripts/worktree.ts integrate <LT-NNN>, one at a time in pick order. Nothing in the queue is written yet.',
}
