export const meta = {
  name: 'do-task',
  description: 'Pick the next ready TODO task (or a given LT-ID), implement it, verify gates, review, annotate the suffix',
  whenToUse: 'Work the le-truc queue without hand-offs. Args: "LT-NNN", or { id?: "LT-NNN", max?: number } to run up to max ready tasks in sequence. Ends with a patch for the owner to commit.',
  phases: [
    { title: 'Pick', detail: 'apply the chain contract, claim with in progress' },
    { title: 'Implement', detail: 'contributor skill, area gates' },
    { title: 'Verify', detail: 'independent gate re-run and review lenses' },
    { title: 'Fix', detail: 'address blocking findings, at most 2 rounds' },
    { title: 'Annotate', detail: 'status suffix and handoff in place' },
  ],
}

// ── Contract ────────────────────────────────────────────────────────────────
// The queue format and the chain are defined in
// .agents/skills/architect/references/task-queue.md. This script never moves
// entries between queue files, never edits ARCHITECTURE.md, never commits and
// never stages .agents/. Implementation runs sequentially in the main checkout
// (worktrees start on main and lack node_modules and docs/), so no isolation.

const input = typeof args === 'string' ? { id: args } : (args || {})
const MAX_TASKS = input.id ? 1 : Math.max(1, input.max || 1)
const MAX_FIX_ROUNDS = 2

const PICK = {
  type: 'object',
  properties: {
    picked: { type: 'boolean' },
    rework: { type: 'boolean', description: 'The task carried — changes requested ↩' },
    id: { type: 'string', description: 'LT-NNN' },
    title: { type: 'string' },
    area: { type: 'string', enum: ['runtime', 'compiler', 'server', 'examples', 'docs'] },
    gates: { type: 'array', items: { type: 'string' }, description: 'Extra commands from the entry\'s Gates line' },
    citations: { type: 'array', items: { type: 'string' }, description: 'ADRs, REQUIREMENTS items, ARCHITECTURE sections and LT-IDs the entry cites' },
    reason: { type: 'string', description: 'Why this task is ready, or why nothing is' },
  },
  required: ['picked', 'reason'],
}

const HANDOFF = {
  type: 'object',
  properties: {
    outcome: { type: 'string', enum: ['done', 'blocked'] },
    reviewClass: { type: 'string', enum: ['api', 'internal'], description: 'api = public API, compiler-authored surface semantics, a diagnostic code\'s meaning, or server routes/output (→ ⏳); internal = everything else (→ done ✓)' },
    errorCopyChanged: { type: 'boolean', description: 'An error class in src/errors.ts or a code in diagnostics.ts was added, reworded or retired' },
    mechanical: { type: 'boolean', description: 'No behavior can change: comments, docs, or a rename proven byte-identical by goldens' },
    changed: { type: 'array', items: { type: 'string' }, description: 'path plus what changed, one per entry' },
    how: { type: 'string' },
    check: { type: 'string', description: 'Where a reviewer should look' },
    gates: { type: 'array', items: { type: 'object', properties: { cmd: { type: 'string' }, pass: { type: 'boolean' }, note: { type: 'string' } }, required: ['cmd', 'pass'] } },
    blocker: { type: 'string', description: 'When blocked: the decision the task does not contain' },
  },
  required: ['outcome', 'reviewClass', 'errorCopyChanged', 'changed', 'gates'],
}

const GATES = {
  type: 'object',
  properties: {
    results: { type: 'array', items: { type: 'object', properties: {
      cmd: { type: 'string' },
      pass: { type: 'boolean' },
      unrunnable: { type: 'boolean', description: 'Failed because of the sandbox or environment (port binding, signing, network, missing tool), before any test ran' },
      flaky: { type: 'boolean' },
      tail: { type: 'string', description: 'Last relevant lines of output on failure' },
    }, required: ['cmd', 'pass'] } },
  },
  required: ['results'],
}

const REVIEW = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['blocking', 'minor'] },
      file: { type: 'string' },
      issue: { type: 'string' },
      fix: { type: 'string' },
    }, required: ['severity', 'issue'] } },
    reviewClassAgrees: { type: 'boolean', description: 'Whether the handoff\'s api/internal classification is right' },
  },
  required: ['findings', 'reviewClassAgrees'],
}

const ANNOTATION = {
  type: 'object',
  properties: {
    suffix: { type: 'string' },
    notesEntry: { type: 'boolean' },
    commit: { type: 'string', description: 'The full commit message for this task\'s changes' },
  },
  required: ['suffix', 'notesEntry', 'commit'],
}

// Signing is unreachable from the sandbox, so the owner commits from this message.
const COMMIT_STYLE = [
  'Subject: `<area>: LT-NNN — <what changed>`, at most 72 characters, phrased like `git log --oneline -10`. Use `docs(queue):` when only queue files changed.',
  'Body only when needed, at most 3 lines: what the diff cannot show — a ruling, a deviation, a follow-up LT-ID, a red gate. No file lists, gate transcripts, or restating the subject.',
  'End with a blank line and the Co-Authored-By trailer your session instructions give.',
].join(' ')

const GATE_TABLE = 'the area\'s default gates in the contributor skill\'s Gates table (.agents/skills/contributor/SKILL.md), plus the entry\'s Gates line'
// The gate re-runner runs package.json commands only. The entry's Check line is
// the conformance reviewer's to judge, so a sound, evidenced deviation from it
// is a finding, not a red gate.
const GATE_RULES = 'Run only package.json scripts; the entry\'s Check line is not yours to run. The lint scripts use biome --write, so run their read-only form instead (bunx biome check <same path>) and change no file. Mark a gate unrunnable when it fails before any test runs because of the sandbox or environment (a port it cannot bind or that another server holds, signing, network, a missing tool). Give each gate at most 10 minutes (run it with a timeout); one that hangs waiting on a port or a server that never becomes ready is unrunnable, not something to wait out.'

const describe = t => `${t.id} (${t.title}; Area: ${t.area})`
// An unrunnable gate is not red: no code change fixes the sandbox. It goes to the
// owner in the handoff instead of into a fix round.
const failing = g => (g?.results || []).filter(r => !r.pass && !r.unrunnable)
const unrunnable = g => (g?.results || []).filter(r => !r.pass && r.unrunnable)

const runs = []
for (let n = 0; n < MAX_TASKS; n++) {
  // ── Pick and claim ──────────────────────────────────────────────────────────
  phase('Pick')
  const task = await agent(
    (input.id
      ? `Find ${input.id} in TODO.md. It is pickable if it is in TODO.md (not BACKLOG.md) and either carries "— changes requested ↩", or has no status suffix, its Area is not design, and every LT-ID on its Needs line is done ✓, done, pending review ⏳, changes requested ↩ or reviewed ✓ in any queue file.`
      : `Pick by the contract in .agents/skills/architect/references/task-queue.md → "The chain". First, any TODO.md entry carrying "— changes requested ↩", in file order. Otherwise read TODO.md's "The chain" section and pick the first ready task, tracks in order: no suffix, Area not design, every Needs LT-ID satisfied (done ✓, ⏳, ↩ or reviewed ✓ in TODO.md, BACKLOG.md or DONE.md), and every earlier task in its track satisfied or blocked ⛔. Do not guess an order the chain does not state.`) +
    `\n\nIf a task is pickable, claim it: on its title line in TODO.md, replace "— changes requested ↩" with "— in progress ⚙", or append " — in progress ⚙" when it had no suffix. Change nothing else in any file. Set rework=true for a changes-requested task. Return picked=false with the reason when nothing is pickable; never claim a task that fails the contract.`,
    { label: 'pick', phase: 'Pick', schema: PICK, effort: 'low' },
  )
  if (!task?.picked) {
    log(`Nothing picked: ${task?.reason || 'pick agent failed'}`)
    runs.push({ picked: false, reason: task?.reason })
    break
  }
  log(`Picked ${describe(task)}: ${task.reason}`)

  // ── Implement ───────────────────────────────────────────────────────────────
  phase('Implement')
  let handoff = await agent(
    `Load the contributor skill and implement queue task ${describe(task)} from TODO.md. It is already claimed (— in progress ⚙); leave that suffix in place, the Annotate step replaces it.\n` +
    (task.rework
      ? `This is rework: review requested changes. The numbered findings on the entry's **Review:** line are the work; the rest of the task is done (see its Changed/How lines and git log). Fix each finding in the same task, or rebut one with evidence in "how". Keep dependents' gates green. `
      : `Read the entry, the sources it cites (${(task.citations || []).join(', ') || 'none listed'}) and the area's living docs first. `) +
    `Run ${GATE_TABLE}${task.gates?.length ? ` (${task.gates.join(', ')})` : ''} and report each real result.\n` +
    `If the task needs an architectural decision it does not contain, stop: return outcome=blocked with the blocker, and make no further edits. ` +
    `Do not commit, do not move queue entries, do not edit ARCHITECTURE.md, and do not write the status suffix or handoff fields.`,
    { label: `implement ${task.id}`, phase: 'Implement', schema: HANDOFF },
  )
  if (!handoff) {
    log(`${task.id}: the implement agent failed; the entry is still claimed (— in progress ⚙) and needs a manual reset`)
    runs.push({ id: task.id, outcome: 'agent-failed' })
    break
  }

  // ── Verify, then fix, up to MAX_FIX_ROUNDS ──────────────────────────────────
  let gates = null
  let reviews = []
  for (let round = 0; handoff.outcome === 'done' && round <= MAX_FIX_ROUNDS; round++) {
    phase('Verify')
    const changed = handoff.changed.join('\n- ')
    const lenses = [
      { key: 'conformance', prompt: `Does the change do what ${task.id}'s entry in TODO.md asks, and only that? Check it against the entry's Context, Check/Verification lines and the sources it cites (${(task.citations || []).join(', ') || 'none listed'}), AGENTS.md, and the ADR 0028 channel/tier the entry names. Run the entry's Check line yourself. If it fails but the handoff explains why with evidence and the explanation holds, report a minor finding (the Architect rules on it), not a blocking one. Flag scope creep, a missing regression test for a fix, and docs the change made stale but did not update.` },
      !handoff.mechanical && { key: 'correctness', prompt: `Try to break the change: edge cases, both authored surfaces (.tsx and .tsrx) where the compiler is touched, server/client parity, cleanup on disconnect, silent fallbacks. Report only defects you can tie to a line.` },
    ].filter(Boolean)
    if (handoff.errorCopyChanged) lenses.push({ key: 'copy', prompt: `Review the added, reworded or retired error copy against .agents/skills/writer/references/error-messages.md: three-part message, Tier 2 wording, prefix, the propagation checklist (including skills/le-truc/references/errors.md) and message-substring tests.` })

    const [g, ...r] = await parallel([
      () => agent(
        `Re-run the gates for ${describe(task)} independently in the main checkout: ${GATE_TABLE}${task.gates?.length ? ` (${task.gates.join(', ')})` : ''}. ${GATE_RULES} Re-run a failing gate once to rule out a flake (NOTES.md lists known flakes). Do not edit any file. Report each command's real result.`,
        { label: `gates ${task.id}`, phase: 'Verify', schema: GATES, effort: 'low' },
      ),
      ...lenses.map(l => () => agent(
        `Review the uncommitted change for ${describe(task)}. Read-only: do not edit any file. Use git diff to see it.` +
        (runs.length ? ` The working tree also holds this run's earlier, uncommitted tasks (${runs.map(x => x.id).filter(Boolean).join(', ')}); judge only ${task.id}'s files.` : '') +
        ` The handoff says:\n- ${changed}\nHow: ${handoff.how || '-'}\n\n${l.prompt}\n\nMark a finding blocking only if the task would be wrong to accept as is. Also judge whether the handoff's reviewClass="${handoff.reviewClass}" is right per the contributor skill's rule 3.`,
        { label: `review:${l.key} ${task.id}`, phase: 'Verify', schema: REVIEW },
      )),
    ])
    gates = g
    reviews = r.filter(Boolean)

    const blocking = reviews.flatMap(x => x.findings.filter(f => f.severity === 'blocking'))
    const red = failing(gates)
    if (reviews.some(x => !x.reviewClassAgrees) && handoff.reviewClass === 'internal') {
      log(`${task.id}: a reviewer reads this as an API change; marking for review`)
      handoff = { ...handoff, reviewClass: 'api' }
    }
    if (!blocking.length && !red.length) break
    if (round === MAX_FIX_ROUNDS) {
      log(`${task.id}: still ${blocking.length} blocking finding(s), ${red.length} red gate(s) after ${MAX_FIX_ROUNDS} fix rounds`)
      handoff = { ...handoff, outcome: 'blocked', blocker: `Unresolved after ${MAX_FIX_ROUNDS} fix rounds: ${[...red.map(x => `gate ${x.cmd} red`), ...blocking.map(f => f.issue)].join('; ')}` }
      break
    }

    phase('Fix')
    handoff = await agent(
      `Load the contributor skill. You are continuing ${describe(task)}; the uncommitted change is in the working tree (git diff). Fix these, or rebut a finding with evidence in "how" if it is wrong:\n` +
      [...red.map(x => `- RED GATE ${x.cmd}: ${x.tail || ''}`), ...blocking.map(f => `- ${f.file || ''} ${f.issue}${f.fix ? ` (suggested: ${f.fix})` : ''}`)].join('\n') +
      `\n\nThen re-run the affected gates. Same limits as before: no commit, no queue moves, no ARCHITECTURE.md, no suffix. Return the full updated handoff (all changed files, not only this round's).`,
      { label: `fix ${task.id} r${round + 1}`, phase: 'Fix', schema: HANDOFF },
    ) || { ...handoff, outcome: 'blocked', blocker: 'fix agent failed' }
  }

  // ── Annotate ────────────────────────────────────────────────────────────────
  phase('Annotate')
  const minors = reviews.flatMap(x => x.findings.filter(f => f.severity === 'minor'))
  const suffix = handoff.outcome === 'blocked'
    ? '— blocked ⛔'
    : handoff.reviewClass === 'api' ? '— done, pending review ⏳' : '— done ✓'
  const annotation = await agent(
    `In TODO.md, on ${task.id}'s title line, replace " — in progress ⚙" with " ${suffix}". Do not move the entry or touch any other entry.\n` +
    (handoff.outcome === 'blocked'
      ? `Append a NOTES.md entry in the format of .agents/skills/architect/references/task-queue.md ("NOTES.md entry format"), Area ${task.area}, describing: ${handoff.blocker}. Give options only if they follow from the facts.`
      : handoff.reviewClass === 'api'
        ? `Add under the entry, after its existing fields: **Changed:** (${handoff.changed.join('; ')}), **How:** (${handoff.how || ''}), **Check:** (${handoff.check || ''}${minors.length ? `; minor review notes: ${minors.map(f => f.issue).join('; ')}` : ''}). Keep each to one or two lines in the queue's register.`
        : `Add one line under the entry: **Changed:** summarizing ${handoff.changed.join('; ')}.`) +
    (task.rework && handoff.outcome !== 'blocked'
      ? ` This was rework: instead of new Changed/How/Check lines, add one **Reworked:** line after the **Review:** line, answering each numbered finding briefly (fixed how, or rebutted why).`
      : '') +
    `\nReturn the suffix written, whether you wrote a NOTES.md entry, and a commit message for the uncommitted changes of ${task.id} (git diff, including your queue edits). Style: ${COMMIT_STYLE}`,
    { label: `annotate ${task.id}`, phase: 'Annotate', schema: ANNOTATION, effort: 'low' },
  )

  runs.push({
    id: task.id,
    title: task.title,
    area: task.area,
    suffix: annotation?.suffix || suffix,
    changed: handoff.changed,
    gates: (gates?.results || handoff.gates).map(x => `${x.pass ? '✓' : x.unrunnable ? '⊘' : '✗'} ${x.cmd}`),
    ownerMustRun: unrunnable(gates).map(x => x.cmd),
    minorFindings: minors.map(f => `${f.file || ''} ${f.issue}`.trim()),
    blocker: handoff.blocker,
    commit: annotation?.commit,
  })
  if (handoff.outcome === 'blocked') break
}

return { runs, next: 'Owner: review git diff and commit with each run\'s `commit` message. Nothing is committed or moved between queue files.' }
