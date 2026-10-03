export const meta = {
  name: 'review-pending',
  description: 'Review every pending-review (⏳) TODO entry: two lenses, a skeptic pass, reviewer nit fixes, proposed verdicts and DONE.md compactions',
  whenToUse: 'Sweep the le-truc review queue. Args: none for every ⏳ entry in TODO.md, or "LT-NNN" / ["LT-NNN", …]. Writes no queue file: the Architect or owner confirms the verdicts and moves.',
  phases: [
    { title: 'Collect', detail: 'list ⏳ entries and their commits' },
    { title: 'Review', detail: 'design and conformance lenses per entry' },
    { title: 'Verify', detail: 'a skeptic sorts each finding into nit, change or follow-up' },
    { title: 'Nits', detail: 'apply behavior-free fixes, one entry at a time' },
    { title: 'Propose', detail: 'verdict, Review line, follow-ups, DONE.md compaction' },
  ],
}

// ── Contract ────────────────────────────────────────────────────────────────
// Rules: .agents/skills/architect/SKILL.md rule 3 and
// .agents/skills/architect/references/task-queue.md. A finding inside the
// task's scope stays in the task: a nit the reviewer fixes, or a change
// requested (↩). Only an out-of-scope finding becomes a follow-up task.
// This workflow edits source files only to apply nits, and never edits a
// queue file, NOTES.md or ARCHITECTURE.md: the verdicts it returns are
// proposals for the Architect or the owner to confirm and apply.

const only = typeof args === 'string' ? [args] : Array.isArray(args) ? args : []

const ENTRIES = {
  type: 'object',
  properties: {
    entries: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      area: { type: 'string' },
      entry: { type: 'string', description: 'The full entry text, verbatim' },
      commits: { type: 'array', items: { type: 'string' }, description: 'Hashes of commits for this LT-ID (git log --grep), oldest first' },
      uncommitted: { type: 'boolean', description: 'git status shows uncommitted changes that belong to this entry' },
    }, required: ['id', 'title', 'area', 'entry', 'commits', 'uncommitted'] } },
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
  },
  required: ['applied', 'reverted', 'gates'],
}

const PROPOSAL = {
  type: 'object',
  properties: {
    reviewLine: { type: 'string' },
    doneEntry: { type: 'string', description: 'Only when approved: the compacted DONE.md entry' },
  },
  required: ['reviewLine'],
}

const diffOf = e =>
  `${e.commits.length ? `its commits (git show ${e.commits.join(' ')})` : 'no commit found for it'}` +
  `${e.uncommitted ? ' plus its uncommitted changes (git diff)' : ''}`

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
  `List the TODO.md entries whose title line ends with "— done, pending review ⏳"${only.length ? `, limited to ${only.join(', ')}` : ''}. For each, copy the full entry verbatim, and find its commits with git log --grep="<LT-ID>" --format=%h (oldest first). Say whether git status shows uncommitted changes that belong to it. Read only; change no file.`,
  { label: 'collect', phase: 'Collect', schema: ENTRIES, effort: 'low' },
)
const entries = collected?.entries || []
if (!entries.length) {
  log('No pending-review entries.')
  return { reviews: [] }
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

// ── Nits: one entry at a time, since they edit the main checkout ────────────
phase('Nits')
const nitResults = []
for (let i = 0; i < entries.length; i++) {
  const nits = (verified[i]?.kept || []).filter(f => f.kind === 'nit')
  if (!nits.length) { nitResults.push(null); continue }
  nitResults.push(await agent(
    `Apply these reviewer nits for ${entries[i].id}. Each must leave behavior unchanged:\n${nits.map((f, n) => `${n + 1}. ${f.file || ''} ${f.issue}${f.fix ? ` — fix: ${f.fix}` : ''}`).join('\n')}\n\n` +
    'Then run the gates the touched files need (bunx biome check <files>, bun run typecheck, and the test files that cover them; a 10-minute timeout each). If a nit turns a gate red or would change behavior, revert it and list it as reverted. Touch no other file and no queue file; do not commit.',
    { label: `nits ${entries[i].id}`, phase: 'Nits', schema: NITS },
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
      `Nits fixed by the reviewer: ${(n?.applied || []).join('; ') || 'none'}${reverted.size ? `; reverted: ${[...reverted].join('; ')}` : ''}\n` +
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
      nitGates: n?.gates || [],
      dropped: (v.dropped || []).map(d => `${d.issue} — ${d.why}`),
    }))
  },
)

const nitIds = reviews.filter(r => r?.nitsApplied?.length).map(r => r.id)
return {
  reviews,
  // Subject only; the session presenting the result adds its Co-Authored-By trailer.
  nitCommitSubject: nitIds.length ? `review: ${nitIds.join(', ')} — reviewer nit fixes` : null,
  next: 'Architect or owner: confirm each verdict, then write the Review line and suffix, add follow-ups to BACKLOG.md with real IDs, and move approved entries to DONE.md. Nothing in the queue is written yet.',
}
