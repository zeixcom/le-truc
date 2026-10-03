export const meta = {
  name: 'review-pending',
  description: 'Review every pending-review (⏳) branch: two lenses, a skeptic pass, reviewer nits committed on the task branch, proposed verdicts and a merge plan for the owner-attended integration',
  whenToUse: 'Sweep the le-truc review queue. Args: none for every ⏳ entry with a committed branch, or "LT-NNN" / ["LT-NNN", …]. Reviews committed branches only; nit fixes are committed on the branch. Writes no queue file and performs no merge: the Architect confirms the verdicts, applies the queue moves and integrates via scripts/worktree.ts.',
  phases: [
    { title: 'Collect', detail: 'pending-review entries from the store, their branches and worktrees' },
    { title: 'Review', detail: 'design and conformance lenses per branch' },
    { title: 'Verify', detail: 'a skeptic sorts each finding into nit, change or follow-up' },
    { title: 'Nits', detail: 'behavior-free fixes in the worktree, committed on the branch' },
    { title: 'Propose', detail: 'verdict, Review line, follow-ups, DONE.md compaction, merge plan' },
  ],
}

// ── Contract ────────────────────────────────────────────────────────────────
// Rules: .agents/skills/architect/SKILL.md rule 3 and
// .agents/skills/architect/references/task-queue.md. A finding inside the
// task's scope stays in the task: a nit the reviewer fixes, or a change
// requested (↩). Only an out-of-scope finding becomes a follow-up task.
// Tasks arrive here committed on task/LT-NNN (owner ruling 2026-10-03), so
// the change under review is the branch's three-dot diff against the source
// branch — an immutable snapshot, not a moving worktree. This run writes one
// thing: nit fixes, committed on the task branch (unsigned there by
// worktree-local config) via scripts/worktree.ts commit. It never edits a
// queue file, NOTES.md or ARCHITECTURE.md, and never merges: the verdicts and
// the merge plan are proposals for the owner-attended Architect session,
// which applies the queue moves and integrates with
// `bun run scripts/worktree.ts integrate <LT-NNN>` (signed --no-ff merge).

const only = typeof args === 'string' ? [args] : Array.isArray(args) ? args : []

const ENTRIES = {
  type: 'object',
  properties: {
    entries: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      area: { type: 'string' },
      entry: { type: 'string', description: 'The full rendered entry text from the list JSON, verbatim' },
      branch: { type: 'string', description: 'The task/<id> branch name, empty when none exists' },
      tip: { type: 'string', description: 'The branch\'s short sha' },
      beyondHead: { type: 'number', description: 'Commits on the branch beyond HEAD; 0 means already integrated' },
      worktree: { type: 'string', description: 'The .worktrees/<id> path when it exists, else empty' },
      worktreeDirty: { type: 'boolean', description: 'git status in the worktree shows residue' },
    }, required: ['id', 'title', 'area', 'entry', 'branch', 'beyondHead'] } },
  },
  required: ['entries'],
}

const FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      kind: { type: 'string', enum: ['nit', 'change', 'followup'], description: 'nit: cannot change behavior (type error, lint, stale/misplaced JSDoc, typo, dead import), give the exact fix. change: inside the task\'s scope, needs the contributor. followup: outside the task\'s scope.' },
      file: { type: 'string' },
      issue: { type: 'string' },
      fix: { type: 'string' },
    }, required: ['kind', 'issue'] } },
    strengths: { type: 'string', description: 'One line on what is right, for the Review line' },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    kept: { type: 'array', items: { type: 'object', properties: {
      kind: { type: 'string', enum: ['nit', 'change', 'followup'] },
      file: { type: 'string' },
      issue: { type: 'string' },
      fix: { type: 'string' },
      followupEntry: { type: 'string', description: 'For a followup: a BACKLOG.md entry in the queue format, Area and Context filled' },
    }, required: ['kind', 'issue'] } },
    dropped: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, why: { type: 'string' } }, required: ['issue', 'why'] } },
  },
  required: ['kept', 'dropped'],
}

const NITS = {
  type: 'object',
  properties: {
    applied: { type: 'array', items: { type: 'string' } },
    reverted: { type: 'array', items: { type: 'string' }, description: 'Nits undone because a gate went red or the fix turned out to change behavior' },
    gates: { type: 'array', items: { type: 'string' } },
    commitDone: { type: 'boolean', description: 'The worktree.ts commit exited 0 (false when there was nothing to commit or it refused)' },
    sha: { type: 'string', description: 'The nit commit\'s short sha when committed' },
  },
  required: ['applied', 'reverted', 'gates', 'commitDone'],
}

const PROPOSAL = {
  type: 'object',
  properties: {
    reviewLine: { type: 'string' },
    doneEntry: { type: 'string', description: 'Only when approved: the compacted DONE.md entry' },
  },
  required: ['reviewLine'],
}

// The change under review is the branch's commits only — the three-dot diff
// against the source branch (what integrate would bring in). Worktree residue
// is not part of it; it is reported to the confirming session separately.
const diffOf = e =>
  e.branch && e.beyondHead > 0
    ? `the committed branch ${e.branch} (git diff HEAD...${e.branch}; files readable in the worktree ${e.worktree || '(absent — git show ' + e.branch + ':<path>)'})`
    : `nothing — ${e.branch ? `${e.branch} carries no commits beyond HEAD (already integrated)` : 'no branch exists for it'}`

const LENSES = [
  {
    key: 'design',
    prompt: 'Review as the Architect, for DX and goals alignment. Test the change against REQUIREMENTS.md (goals, personas, constraints), CONTEXT.md (every new name uses the glossary), ARCHITECTURE.md, and the published-surface stability rule: anything a user or adapter can see must be a shape we can keep through 3.x. Judge names, defaults and error copy from the author\'s seat.',
  },
  {
    key: 'conformance',
    prompt: 'Review for conformance. Read every changed file in full, not only the hunks. Check the change against the ADRs and REQUIREMENTS items the entry cites, its Context, and every Verification/Check line (run those checks). Check the ADR 0028 channel/tier the entry names, that each fix has a regression test, and that docs the change made stale were updated.',
  },
]

// ── Collect ─────────────────────────────────────────────────────────────────
phase('Collect')
const collected = await agent(
  'Collect the pending-review tasks and their branches. Read only; change no file. From the repository root:\n' +
  `1. Run \`bun run scripts/queue.ts list --status pending-review\` — its JSON's tasks are the entries (the \`entry\` field is the rendered text).${only.length ? ` Keep only ${only.join(', ')}.` : ''}\n` +
  `2. Run \`git for-each-ref --format='%(refname:short)' refs/heads/task/\` to learn which task/LT-NNN branches exist.\n` +
  '3. For each entry: its branch task/<id> (empty when none), short tip (git rev-parse --short), commits beyond HEAD (git rev-list --count HEAD..task/<id>; 0 means already integrated), the worktree path .worktrees/<id> when it exists, and whether that worktree is dirty (git -C <path> status --porcelain).',
  { label: 'collect', phase: 'Collect', schema: ENTRIES, effort: 'low' },
)
const all = collected?.entries || []
const stale = all.filter(e => !e.branch || e.beyondHead === 0)
const entries = all.filter(e => e.branch && e.beyondHead > 0)
if (stale.length)
  log(`Skipping ${stale.map(e => e.id).join(', ')} — no branch or already integrated; clean leftovers up by hand.`)
if (!entries.length) {
  log('No pending-review branches to review.')
  return { reviews: [], mergePlan: [], stale: stale.map(e => e.id) }
}
log(`Reviewing ${entries.map(e => e.id).join(', ')}`)

// ── Review → Verify, per entry, no barrier ──────────────────────────────────
const verified = await pipeline(
  entries,
  e => parallel(LENSES.map(l => () => agent(
    `Review ${e.id} (${e.title}; Area: ${e.area}). The change is ${diffOf(e)}. The entry:\n\n${e.entry}\n\n${l.prompt}\n\n` +
    'Read only; change no file. Sort each finding: nit (cannot change behavior; give the exact fix), change (inside the task\'s scope), or followup (outside it: a new design question, another area, work the entry never asked for). Report only what you can tie to a file and line. The entry\'s own Check notes are known; report them only if the change did not address them.',
    { label: `review:${l.key} ${e.id}`, phase: 'Review', schema: FINDINGS },
  ))),
  (lensResults, e) => {
    const findings = lensResults.filter(Boolean).flatMap(r => r.findings)
    if (!findings.length) return { kept: [], dropped: [], strengths: lensResults.filter(Boolean).map(r => r.strengths).filter(Boolean) }
    return agent(
      `You are the skeptic for the review of ${e.id} (${e.title}). The change is ${diffOf(e)}. The entry:\n\n${e.entry}\n\n` +
      `Reviewers reported:\n${findings.map((f, i) => `${i + 1}. [${f.kind}] ${f.file || ''} ${f.issue}${f.fix ? ` (fix: ${f.fix})` : ''}`).join('\n')}\n\n` +
      'Try to refute each one against the code; drop it with the reason if it is wrong, a duplicate, or a matter of taste. Re-sort what survives: a nit must be unable to change behavior (otherwise it is a change); a change must be inside the entry\'s scope (otherwise it is a followup). Every change requested costs a rework round, so keep only those that make the task wrong to accept. For each followup, draft a BACKLOG.md entry in the format of .agents/skills/architect/references/task-queue.md, leaving the LT-ID as LT-???. Read only; change no file.',
      { label: `verify ${e.id}`, phase: 'Verify', schema: VERDICT },
    ).then(v => v && { ...v, strengths: lensResults.filter(Boolean).map(r => r.strengths).filter(Boolean) })
  },
)

// ── Nits: one entry at a time, since each edits its own worktree ────────────
phase('Nits')
const nitResults = []
for (let i = 0; i < entries.length; i++) {
  const e = entries[i]
  const nits = (verified[i]?.kept || []).filter(f => f.kind === 'nit')
  if (!nits.length || !e.worktree) { nitResults.push(null); continue }
  nitResults.push(await agent(
    `Apply these reviewer nits for ${e.id} inside the git worktree ${e.worktree} (branch ${e.branch}) — work only there. Each must leave behavior unchanged:\n${nits.map((f, n) => `${n + 1}. ${f.file || ''} ${f.issue}${f.fix ? ` — fix: ${f.fix}` : ''}`).join('\n')}\n\n` +
    `Then run the gates the touched files need inside the worktree (\`bun run --cwd ${e.worktree} <script>\`, \`bun test --cwd ${e.worktree} <paths>\`; lint's read-only form is \`bunx biome check <files>\`; a 10-minute timeout each). If a nit turns a gate red or would change behavior, revert it and list it as reverted.\n` +
    `Then commit exactly the nit-fixed files on the branch: write the commit message to .zcode/workflow-drafts/review-nits/${e.id}.txt (subject \`review: ${e.id} — reviewer nit fixes\`, body only when it carries what the diff cannot show, end with a blank line and the Co-Authored-By trailer your session instructions give) and run:\n` +
    `bun run scripts/worktree.ts commit ${e.id} --message-file .zcode/workflow-drafts/review-nits/${e.id}.txt -- <the nit-fixed files>\n` +
    `Worktree commits are unsigned by design. Touch no other file and no queue file. Return the applied/reverted lists, the gates you ran, commitDone=true only when the commit exited 0, and its sha.`,
    { label: `nits ${e.id}`, phase: 'Nits', schema: NITS },
  ))
}

// ── Propose ─────────────────────────────────────────────────────────────────
const reviews = await pipeline(
  entries.map((e, i) => ({ e, v: verified[i], n: nitResults[i] })),
  ({ e, v, n }) => {
    const kept = v?.kept || []
    const changes = kept.filter(f => f.kind === 'change')
    const followups = kept.filter(f => f.kind === 'followup')
    const reverted = new Set(n?.reverted || [])
    const verdict = !v ? 'unreviewed' : changes.length ? 'changes requested ↩' : 'reviewed ✓'
    if (verdict === 'unreviewed') return { id: e.id, verdict }
    return agent(
      `Draft the queue text for the review of ${e.id} (${e.title}). Verdict: ${verdict}.\n` +
      `What is right: ${(v.strengths || []).join(' ') || '-'}\n` +
      `Changes requested: ${changes.map((f, k) => `(${k + 1}) ${f.file || ''} ${f.issue}${f.fix ? ` — ${f.fix}` : ''}`).join(' ') || 'none'}\n` +
      `Nits fixed by the reviewer: ${(n?.applied || []).join('; ') || 'none'}${reverted.size ? `; reverted: ${[...reverted].join('; ')}` : ''}${n?.commitDone ? ` (committed ${n.sha} on ${e.branch})` : ''}\n` +
      `Follow-ups: ${followups.map(f => f.issue).join('; ') || 'none'}\n\n` +
      'Write reviewLine: one **Review:** line for the entry. Name the verdict, number the changes requested (each says what is wrong, where, and the expected shape), name the nits fixed, and name follow-ups as "follow-up: LT-???". Keep it as short as the queue\'s register allows. ' +
      (verdict === 'reviewed ✓'
        ? `Also write doneEntry: the entry compacted for DONE.md per .agents/skills/architect/references/task-queue.md → Moves ("After review"). The entry is:\n\n${e.entry}`
        : 'Leave doneEntry empty.') +
      ' Read only; change no file.',
      { label: `propose ${e.id}`, phase: 'Propose', schema: PROPOSAL, effort: 'low' },
    ).then(p => ({
      id: e.id,
      verdict,
      reviewLine: p?.reviewLine,
      doneEntry: p?.doneEntry || null,
      followups: followups.map(f => f.followupEntry || f.issue),
      nitsApplied: n?.applied || [],
      nitCommitSha: n?.commitDone ? n.sha : null,
      dropped: (v.dropped || []).map(d => `${d.issue} — ${d.why}`),
    }))
  },
)

// The merge plan is script work, not an agent's: ready means approved, on a
// branch with commits, over a clean worktree. Order is the collection order —
// the entry order, which follows the queue store.
const mergePlan = reviews.map((r, i) => ({
  id: entries[i].id,
  branch: entries[i].branch,
  verdict: r.verdict,
  ready:
    r.verdict === 'reviewed ✓' &&
    !(entries[i].worktreeDirty) &&
    !(nitResults[i] && !nitResults[i].commitDone && nitResults[i].applied.length),
  note: entries[i].worktreeDirty ? 'worktree has residue — restore it before integrating' : undefined,
}))

const nitIds = reviews.filter(r => r?.nitCommitSha).map(r => r.id)
const lines = ['# review-pending handoff', '']
for (const r of reviews) {
  const e = entries[reviews.indexOf(r)]
  lines.push(
    `## ${r.id} — ${r.verdict}`,
    '',
    `- Branch: ${e.branch || 'none'}${e.worktree ? ` · worktree ${e.worktree}${e.worktreeDirty ? ' (dirty)' : ' (clean)'}` : ''}`,
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

return {
  reviews,
  mergePlan,
  nitCommits: nitIds.length ? `review: ${nitIds.join(', ')} — reviewer nit fixes` : null,
  stale: stale.map(e => e.id),
  next: 'Architect: confirm each verdict, apply the queue moves (store status edits + bun run queue:build), then integrate each ready branch with bun run scripts/worktree.ts integrate <LT-NNN>, one at a time in pick order. Nothing in the queue is written yet.',
}
