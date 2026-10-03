export const meta = {
  name: 'do-task',
  description: 'Pick the next ready TODO task (or a given LT-ID), implement it in its own git worktree, verify gates, review, annotate the suffix',
  whenToUse: 'Work the le-truc queue without hand-offs. Args: "LT-NNN", or { id?: "LT-NNN", max?: number } to run up to max ready tasks in sequence. Ends with one task branch per task in its own worktree, waiting for the owner to commit and merge.',
  phases: [
    { title: 'Pick', detail: 'queue script pick+claim, worktree bootstrap' },
    { title: 'Implement', detail: 'contributor skill, area gates, in the worktree' },
    { title: 'Verify', detail: 'independent gate re-run and review lenses' },
    { title: 'Fix', detail: 'address blocking findings, at most 2 rounds' },
    { title: 'Annotate', detail: 'queue script annotate, prose + commit message' },
  ],
}

// ── Contract ────────────────────────────────────────────────────────────────
// The queue lives only in the main checkout and is written exclusively by
// scripts/queue.ts — deterministic pick/claim/annotate under `bun test`
// (contract: .agents/skills/architect/references/task-queue.md). Code work
// happens in a per-task git worktree (.worktrees/LT-NNN, branch task/LT-NNN,
// bootstrapped by scripts/worktree.ts), so two runs — or a run and a human —
// cannot collide in one tree, and a task's diff is exactly its worktree's
// diff. The ZCode twin (.zcode/workflows/do-task.dwf.ts) drives the same
// queue script with real command primitives; here low-effort agents relay the
// commands. Nothing is ever committed by this run: patches wait on the task
// branch for the owner. This script never moves entries between queue files,
// never edits ARCHITECTURE.md and never stages .agents/.

const input = typeof args === 'string' ? { id: args } : (args || {})
const MAX_TASKS = input.id ? 1 : Math.max(1, input.max || 1)
const MAX_FIX_ROUNDS = 2

const QUEUE_SETUP = {
  type: 'object',
  properties: {
    picked: { type: 'boolean', description: 'The pick JSON said picked=true' },
    claimed: { type: 'boolean', description: 'The claim command exited 0' },
    bootstrapped: { type: 'boolean', description: 'The worktree bootstrap exited 0 (after which the claim was NOT reset)' },
    reason: { type: 'string', description: 'Why this task is ready, or why nothing is, or which command refused with its stderr' },
    id: { type: 'string', description: 'LT-NNN' },
    title: { type: 'string' },
    area: { type: 'string' },
    rework: { type: 'boolean', description: 'The task carried — changes requested ↩' },
    gates: { type: 'array', items: { type: 'string' }, description: 'Extra commands from the entry\'s Gates line' },
    citations: { type: 'array', items: { type: 'string' }, description: 'ADRs, REQUIREMENTS items, ARCHITECTURE sections and LT-IDs the entry cites' },
    entryText: { type: 'string', description: 'The full entry text from the pick JSON, verbatim' },
    worktree: { type: 'string', description: 'Absolute worktree path from the scripts/worktree.ts JSON' },
    branch: { type: 'string', description: 'The task branch name from the scripts/worktree.ts JSON' },
  },
  required: ['picked', 'claimed', 'bootstrapped', 'reason'],
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
    blocker: { type: 'string', description: 'When blocked: the decision the task does not contain' },
  },
  required: ['outcome', 'reviewClass', 'errorCopyChanged', 'changed'],
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
    annotated: { type: 'boolean', description: 'The queue annotate command exited 0' },
    commit: { type: 'string', description: 'The full commit message for this task\'s changes' },
  },
  required: ['annotated', 'commit'],
}

// Signing is unreachable from the sandbox, so the owner commits from this message.
const COMMIT_STYLE = [
  'Subject: `<area>: LT-NNN — <what changed>`, at most 72 characters, phrased like `git log --oneline -10`. Use `docs(queue):` when only queue files changed.',
  'Body only when needed, at most 3 lines: what the diff cannot show — a ruling, a deviation, a follow-up LT-ID, a red gate. No file lists, gate transcripts, or restating the subject.',
  'End with a blank line and the Co-Authored-By trailer your session instructions give.',
].join(' ')

const GATE_TABLE = 'the area\'s default gates in the contributor skill\'s Gates table (.agents/skills/contributor/SKILL.md), plus the entry\'s Gates line'
// Gates run inside the task's worktree, via flags AFTER the subcommand:
// `bun run --cwd <wt> <script>` and `bun test --cwd <wt> <paths>`. NEVER
// `bun --cwd <wt> run <script>` — bun 1.4.2 silently ignores that form (usage
// on stderr, exit 0, nothing runs), so a gate would report green without
// executing. The entry's Check line is the conformance reviewer's to judge, so
// a sound, evidenced deviation from it is a finding, not a red gate.
const GATE_RULES = 'Run gates inside the worktree with `bun run --cwd <worktree> <script>` (never `bun --cwd <worktree> run <script>` — that form silently runs nothing) or `bun test --cwd <worktree> <paths>`; only package.json scripts otherwise. Report a gate only when it names a package.json script or is an explicit `bun test <paths>` form — never prose from the entry\'s Verification line ("diagnostic parity" is not a gate). The lint scripts use biome --write, so run their read-only form instead (bunx biome check <same path>) and change no file. Mark a gate unrunnable when it fails before any test runs because of the sandbox or environment (a port it cannot bind or that another server holds, signing, network, a missing tool). Give each gate at most 10 minutes (run it with a timeout); one that hangs waiting on a port or a server that never becomes ready is unrunnable, not something to wait out.'

const describe = t => `${t.id} (${t.title}; Area: ${t.area})`
// An unrunnable gate is not red: no code change fixes the sandbox. It goes to the
// owner in the handoff instead of into a fix round.
const failing = g => (g?.results || []).filter(r => !r.pass && !r.unrunnable)
const unrunnable = g => (g?.results || []).filter(r => !r.pass && r.unrunnable)

const runs = []
for (let n = 0; n < MAX_TASKS; n++) {
  // ── Pick, claim, bootstrap the worktree ──────────────────────────────────────
  phase('Pick')
  const setup = await agent(
    `Relay three commands with Bash, from the repository root, and report their JSON. Do not apply the queue contract yourself — scripts/queue.ts owns it.\n` +
    `1. \`bun run scripts/queue.ts pick${input.id ? ` ${input.id}` : ''}\` — prints the pick decision as JSON.\n` +
    `2. When picked=true: \`bun run scripts/queue.ts claim <id>\` — must exit 0; on nonzero, report its stderr as reason and stop.\n` +
    `3. When the claim exited 0: \`bun run scripts/worktree.ts <id>\` — prints the worktree as JSON. If it exits nonzero, run \`bun run scripts/queue.ts reset <id>\` to release the claim, report the bootstrap stderr as reason, and set bootstrapped=false.\n` +
    `Return the pick JSON's fields verbatim (picked, reason, and task.id/title/area/suffix/rework/needs/gates/citations/entryText), plus claimed=true only when step 2 exited 0, and bootstrapped/worktree/branch from step 3's JSON.`,
    { label: 'pick', phase: 'Pick', schema: QUEUE_SETUP, effort: 'low' },
  )
  if (!setup?.picked) {
    log(`Nothing picked: ${setup?.reason || 'queue relay failed'}`)
    runs.push({ picked: false, reason: setup?.reason })
    break
  }
  if (!setup.claimed) {
    log(`${setup.id}: the queue refused the claim: ${setup.reason}`)
    runs.push({ id: setup.id, outcome: 'claim-failed' })
    break
  }
  if (!setup.bootstrapped) {
    log(`${setup.id}: worktree bootstrap failed: ${setup.reason} — the claim was reset`)
    runs.push({ id: setup.id, outcome: 'bootstrap-failed' })
    break
  }
  log(`Picked ${describe(setup)}: ${setup.reason} — ${setup.branch} in ${setup.worktree}`)

  // ── Implement ───────────────────────────────────────────────────────────────
  phase('Implement')
  let handoff = await agent(
    `Work ONLY inside the git worktree ${setup.worktree} (branch ${setup.branch}). Load the contributor skill there and follow its conventions.\n` +
    `Implement queue task ${describe(setup)}. Its full queue entry:\n---\n${setup.entryText}\n---\n` +
    `Sources it cites: ${(setup.citations || []).join(', ') || 'none listed'} — read them, plus the area's living docs, before coding.` +
    (setup.rework
      ? `\nThis is rework: review requested changes. The numbered findings on the entry's **Review:** line are the work; the rest of the task is done (see its Changed/How lines and git log of the main checkout). Fix each finding in the same task, or rebut one with evidence in "how". Keep dependents' gates green.`
      : '') +
    `\nLeave your work green: run the gates you judge relevant (${GATE_TABLE}${setup.gates?.length ? `, plus the entry's (${setup.gates.join(', ')})` : ''}) and fix failures before handoff — from inside the worktree. Lint gates use biome --write, so run their read-only form instead (bunx biome check <same path>) and change no file. The worktree contains no .agents/, .claude/, .vscode/ or .zcode/ — the bootstrap excludes those agent-config dirs (sandboxed hosts like yours block writes under them) and no task targets them; never create or edit them in the worktree. The gates agent verifies the full list independently after your turn, so report no gate results.\n` +
    `If the task needs an architectural decision it does not contain, stop: return outcome=blocked with the blocker, and make no further edits. ` +
    `Boundaries: the worktree's BACKLOG.md, TODO.md, DONE.md, NOTES.md and the excluded agent-config dirs are out of reach — the queue is managed in the main checkout, so never edit those files here, and never stage or commit anything (the owner commits). Do not write the status suffix or handoff fields.`,
    { label: `implement ${setup.id}`, phase: 'Implement', schema: HANDOFF },
  )
  if (!handoff) {
    log(`${setup.id}: the implement agent failed; resetting the claim`)
    await agent(
      `Run \`bun run scripts/queue.ts reset ${setup.id}\` with Bash and report whether it exited 0.`,
      { label: `reset ${setup.id}`, phase: 'Pick', effort: 'low' },
    )
    runs.push({ id: setup.id, outcome: 'agent-failed' })
    break
  }

  // ── Verify, then fix, up to MAX_FIX_ROUNDS ──────────────────────────────────
  let gates = null
  let reviews = []
  for (let round = 0; handoff.outcome === 'done' && round <= MAX_FIX_ROUNDS; round++) {
    phase('Verify')
    const changed = handoff.changed.join('\n- ')
    const lenses = [
      { key: 'conformance', prompt: `Does the change do what ${setup.id} asks, and only that? The full queue entry is your contract:\n---\n${setup.entryText}\n---\nCheck the change against that entry's Context, Check/Verification lines and the sources it cites (${(setup.citations || []).join(', ') || 'none listed'}), AGENTS.md, and the ADR 0028 channel/tier the entry names. Run the entry's Check line yourself, inside the worktree. If it fails but the handoff explains why with evidence and the explanation holds, report a minor finding (the Architect rules on it), not a blocking one. Flag scope creep, a missing regression test for a fix, and docs the change made stale but did not update.` },
      !handoff.mechanical && { key: 'correctness', prompt: `Try to break the change: edge cases, both authored surfaces (.tsx and .tsrx) where the compiler is touched, server/client parity, cleanup on disconnect, silent fallbacks. Report only defects you can tie to a line.` },
    ].filter(Boolean)
    if (handoff.errorCopyChanged) lenses.push({ key: 'copy', prompt: `Review the added, reworded or retired error copy against .agents/skills/writer/references/error-messages.md: three-part message, Tier 2 wording, prefix, the propagation checklist (including skills/le-truc/references/errors.md) and message-substring tests.` })

    const [g, ...r] = await parallel([
      () => agent(
        `Re-run the gates for ${describe(setup)} independently inside the git worktree ${setup.worktree}. The gate list is deterministic — do not judge it: the area's defaults from the contributor skill's Gates table, the entry's Gates line (${setup.gates?.join(', ') || 'none'}), plus these path rules over \`git -C ${setup.worktree} diff --name-only HEAD\` and \`git -C ${setup.worktree} status --porcelain\` — src/** → check:size; any .tsrx file → test:variants; server/compiler/ or docs-src/ → build:docs + check:links; examples/ → bun run test (Playwright); and Playwright too when the area is runtime and src/ changed. ${GATE_RULES} Re-run a failing gate once to rule out a flake (NOTES.md lists known flakes). Do not edit any file. Report each command's real result.`,
        { label: `gates ${setup.id}`, phase: 'Verify', schema: GATES, effort: 'low' },
      ),
      ...lenses.map(l => () => agent(
        `Review the change for ${describe(setup)}, isolated in the git worktree ${setup.worktree} (branch ${setup.branch}) — nothing else is in progress there. Read-only: do not edit any file. See it with \`git -C ${setup.worktree} diff HEAD\` plus \`git -C ${setup.worktree} status --porcelain\` for untracked files.` +
        ` The handoff says:\n- ${changed}\nHow: ${handoff.how || '-'}\n\n${l.prompt}\n\nMark a finding blocking only if the task would be wrong to accept as is. Also judge whether the handoff's reviewClass="${handoff.reviewClass}" is right per the contributor skill's rule 3.`,
        { label: `review:${l.key} ${setup.id}`, phase: 'Verify', schema: REVIEW },
      )),
    ])
    gates = g
    reviews = r.filter(Boolean)

    const blocking = reviews.flatMap(x => x.findings.filter(f => f.severity === 'blocking'))
    const red = failing(gates)
    if (reviews.some(x => !x.reviewClassAgrees) && handoff.reviewClass === 'internal') {
      log(`${setup.id}: a reviewer reads this as an API change; marking for review`)
      handoff = { ...handoff, reviewClass: 'api' }
    }
    if (!blocking.length && !red.length) break
    if (round === MAX_FIX_ROUNDS) {
      log(`${setup.id}: still ${blocking.length} blocking finding(s), ${red.length} red gate(s) after ${MAX_FIX_ROUNDS} fix rounds`)
      handoff = { ...handoff, outcome: 'blocked', blocker: `Unresolved after ${MAX_FIX_ROUNDS} fix rounds: ${[...red.map(x => `gate ${x.cmd} red`), ...blocking.map(f => f.issue)].join('; ')}` }
      break
    }

    phase('Fix')
    handoff = await agent(
      `Load the contributor skill. You are continuing ${describe(setup)}; the uncommitted change is in your worktree ${setup.worktree} (git -C ${setup.worktree} diff HEAD). Fix these, or rebut a finding with evidence in "how" if it is wrong:\n` +
      [...red.map(x => `- RED GATE ${x.cmd}: ${x.tail || ''}`), ...blocking.map(f => `- ${f.file || ''} ${f.issue}${f.fix ? ` (suggested: ${f.fix})` : ''}`)].join('\n') +
      `\n\nThen re-run the affected gates (read-only lint form) inside the worktree. Same limits as before: queue files, .agents/ and .vscode/ stay untouched, no staging, no commit. Return the full updated handoff (all changed files, not only this round's).`,
      { label: `fix ${setup.id} r${round + 1}`, phase: 'Fix', schema: HANDOFF },
    ) || { ...handoff, outcome: 'blocked', blocker: 'fix agent failed' }
  }

  // ── Annotate ────────────────────────────────────────────────────────────────
  phase('Annotate')
  const minors = reviews.flatMap(x => x.findings.filter(f => f.severity === 'minor'))
  const suffix = handoff.outcome === 'blocked'
    ? '— blocked ⛔'
    : handoff.reviewClass === 'api' ? '— done, pending review ⏳' : '— done ✓'
  const statusKey = handoff.outcome === 'blocked' ? 'blocked' : handoff.reviewClass === 'api' ? 'pending-review' : 'done'
  const prosePath = `.zcode/workflow-drafts/queue-annotate/${setup.id}.md`
  const annotation = await agent(
    `Compose the queue annotation for ${setup.id} and write it to ${prosePath} (create the directory if needed). The queue script inserts it after the entry; you write only the prose.\n` +
    (handoff.outcome === 'blocked'
      ? `The run blocked: ${handoff.blocker}. Write a NOTES.md entry in the format of .agents/skills/architect/references/task-queue.md ("NOTES.md entry format"), Area ${setup.area}, describing the blocker. Give options only if they follow from the facts.`
      : handoff.reviewClass === 'api'
        ? `Write Changed/How/Check lines in the queue's register, one or two lines each: **Changed:** (${handoff.changed.join('; ')}), **How:** (${handoff.how || ''}), **Check:** (${handoff.check || ''}${minors.length ? `; minor review notes: ${minors.map(f => f.issue).join('; ')}` : ''}).`
        : `Write one line: **Changed:** summarizing ${handoff.changed.join('; ')}.`) +
    (setup.rework && handoff.outcome !== 'blocked'
      ? ` This was rework: instead of new Changed/How/Check lines, write one **Reworked:** line answering each numbered finding on the entry's **Review:** line briefly (fixed how, or rebutted why).`
      : '') +
    `\nThe handoff for context: outcome=${handoff.outcome}, reviewClass=${handoff.reviewClass}, changed=${JSON.stringify(handoff.changed)}.\n` +
    `Then run \`bun run scripts/queue.ts annotate ${setup.id} ${statusKey} ${prosePath}\` with Bash — it must exit 0 (it flips the suffix in the main checkout's queue). ` +
    `Finally return a commit message for the task's changes (\`git -C ${setup.worktree} diff HEAD\` and \`git -C ${setup.worktree} status --porcelain\`). Style: ${COMMIT_STYLE}`,
    { label: `annotate ${setup.id}`, phase: 'Annotate', schema: ANNOTATION, effort: 'low' },
  )

  runs.push({
    id: setup.id,
    title: setup.title,
    area: setup.area,
    suffix: annotation?.annotated ? suffix : '— in progress ⚙ (annotation failed)',
    branch: setup.branch,
    worktree: setup.worktree,
    changed: handoff.changed,
    gates: (gates?.results || []).map(x => `${x.pass ? '✓' : x.unrunnable ? '⊘' : '✗'} ${x.cmd}`),
    ownerMustRun: unrunnable(gates).map(x => x.cmd),
    minorFindings: minors.map(f => `${f.file || ''} ${f.issue}`.trim()),
    blocker: handoff.blocker,
    commit: annotation?.commit,
  })
  if (handoff.outcome === 'blocked') break
}

return {
  runs,
  next: [
    'Owner, per task branch (nothing is committed; the queue suffix edits stay uncommitted in the main checkout for a separate docs(queue) commit):',
    '1. Review: git -C <worktree> diff HEAD  ·  git -C <worktree> status --porcelain',
    '2. Commit in the worktree. First check status against the handoff\'s Changed list — a build gate run inside the worktree can churn a committed bundle (e.g. index.js gets a ../../ banner through the node_modules symlink); restore such files (git -C <worktree> checkout -- <path>) and mind the minor review findings. Then: git -C <worktree> add -A && git -C <worktree> commit -m "<the run\'s commit message>"',
    '3. Merge from v3 (task branches never touch queue files, so the dirty queue merges clean): git merge task/<id>',
    '4. Clean up: git worktree remove --force <worktree> && git branch -d task/<id>',
  ].join('\n'),
}
