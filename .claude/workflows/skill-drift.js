export const meta = {
  name: 'skill-drift',
  description: 'Audit the skills and AGENTS.md against the source and the ADRs; propose protected-file fixes in .agents-proposals/, fix writable ones in place',
  whenToUse: 'Find and fix drift between le-truc\'s agent guidance and the code. Args: none for every unit, or a unit name / list of names (architect, contributor, writer, le-truc, cause-effect, agents-md). Never writes .agents/, the queue or NOTES.md; never commits.',
  phases: [
    { title: 'Inventory', detail: 'files per unit, pending proposals, dirty files, check:skills pre-pass' },
    { title: 'Audit', detail: 'one auditor per unit checks every claim against its source of truth' },
    { title: 'Verify', detail: 'a skeptic per unit tries to refute each finding' },
    { title: 'Write', detail: 'proposals for .agents/, in-place edits for skills/ and AGENTS.md' },
  ],
}

// ── Contract ────────────────────────────────────────────────────────────────
// .agents/** is write-denied by design (owner ruling 2026-10-02: the write
// lock stays).
// A fix to a protected file becomes a full-file proposal at the mirrored path
// under .agents-proposals/ (.agents-proposals/README.md); an unapplied
// proposal already there is the text the audit and the fix start from, so a
// run never discards an earlier one. skills/ ships to users and AGENTS.md
// loads every session; both are writable and fixed in place (owner ruling
// 2026-10-03), except a file with uncommitted changes, whose fixes come back
// unwritten so the owner's diff stays this run's alone. Drift where the
// guidance is right and the code or a living doc is wrong is not fixed here:
// it returns as a draft BACKLOG.md entry for the Architect. Units touch
// disjoint files, so they run as one pipeline with no barrier.

const UNITS = [
  {
    key: 'architect', root: '.agents/skills/architect', protected: true,
    truth: 'the queue store and its tooling (queue/, scripts/queue.ts, scripts/lib/queue-store.ts, the queue:* and check:queue scripts), the workflows in .claude/workflows/, adr/ and adr/adr-index.md, REQUIREMENTS.md, CONTEXT.md, ARCHITECTURE.md',
  },
  {
    key: 'contributor', root: '.agents/skills/contributor', protected: true,
    truth: 'package.json scripts (every gate command must exist and do what the table says), the queue store and scripts/queue.ts, scripts/worktree.ts, .claude/workflows/do-task.js, src/ and its JSDoc, server/compiler/HOST_PROFILE.md, LE_TRUC_COMPILER.md, server/SERVER.md, server/TESTS.md',
  },
  {
    key: 'writer', root: '.agents/skills/writer', protected: true,
    truth: 'the documents and directories its document map names (they must exist where it says), docs-src/ and the Markdoc tags the docs pipeline in server/ actually registers, src/errors.ts and server/compiler/diagnostics.ts for the error-message rules, CHANGELOG.md for the changelog structure, .claude/workflows/release-notes.js',
  },
  {
    key: 'le-truc', root: 'skills/le-truc', protected: false,
    truth: 'index.ts exports and src/ JSDoc, server/compiler/diagnostics.ts (every LTC code: emitted, severity, wording, retired), server/compiler/HOST_PROFILE.md, the ADRs, and the example corpus in examples/. This skill ships to external users: a wrong claim is a product defect, and the .tsx surface is the default',
  },
  {
    key: 'cause-effect', root: 'skills/cause-effect', protected: false,
    truth: 'the installed node_modules/@zeix/cause-effect (its package.json version and its type declarations), and what index.ts re-exports from it',
  },
  {
    key: 'agents-md', root: 'AGENTS.md', protected: false,
    truth: 'src/ and server/compiler/ (each Surprising Behavior must still hold exactly as stated), the ADRs and LT-IDs it cites, server/compiler/HOST_PROFILE.md. AGENTS.md holds non-obvious facts only: an entry the code no longer exhibits, or one that has become the obvious default, is drift too',
  },
]

const only = typeof args === 'string' ? [args] : Array.isArray(args) ? args : []
const unknown = only.filter(k => !UNITS.some(u => u.key === k))
if (unknown.length) return { error: `Unknown unit(s): ${unknown.join(', ')}. Known: ${UNITS.map(u => u.key).join(', ')}` }
const units = only.length ? UNITS.filter(u => only.includes(u.key)) : UNITS

const mirror = path => path.replace(/^\.agents\//, '.agents-proposals/')

const INVENTORY = {
  type: 'object',
  properties: {
    units: { type: 'array', items: { type: 'object', properties: {
      key: { type: 'string' },
      files: { type: 'array', items: { type: 'object', properties: {
        path: { type: 'string', description: 'Repo-relative path of the file under the unit\'s root' },
        lastCommit: { type: 'string', description: 'git log -1 --format="%h %as" -- <path>' },
        proposal: { type: 'boolean', description: 'Protected units only: the mirrored .agents-proposals/ path exists' },
        dirty: { type: 'boolean', description: 'Writable units only: git status --porcelain lists the file' },
      }, required: ['path', 'lastCommit'] } },
    }, required: ['key', 'files'] } },
    checkSkills: { type: 'string', description: 'If package.json defines check:skills: its output (failures only, verbatim). Otherwise empty.' },
  },
  required: ['units', 'checkSkills'],
}

const FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      kind: { type: 'string', enum: ['stale-guidance', 'stale-source', 'duplication'], description: 'stale-guidance: the guidance is wrong or points at something that no longer exists. stale-source: the guidance is right and the code or a living doc is wrong. duplication: the guidance restates a fact that has a writable living home, so it will drift; the fix replaces it with a pointer.' },
      file: { type: 'string', description: 'The guidance file the finding is in' },
      claim: { type: 'string', description: 'The guidance text, quoted exactly' },
      evidence: { type: 'string', description: 'file:line of the source of truth and what it says' },
      fix: { type: 'string', description: 'stale-guidance/duplication: the exact replacement text. stale-source: what the source should say.' },
    }, required: ['kind', 'file', 'claim', 'evidence', 'fix'] } },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    kept: { type: 'array', items: { type: 'object', properties: {
      kind: { type: 'string', enum: ['stale-guidance', 'stale-source', 'duplication'] },
      file: { type: 'string' },
      claim: { type: 'string' },
      evidence: { type: 'string' },
      fix: { type: 'string' },
      backlogEntry: { type: 'string', description: 'For stale-source: a BACKLOG.md entry in the format of .agents/skills/architect/references/task-queue.md, LT-ID left as LT-???' },
    }, required: ['kind', 'file', 'claim', 'fix'] } },
    dropped: { type: 'array', items: { type: 'object', properties: {
      claim: { type: 'string' },
      why: { type: 'string' },
    }, required: ['claim', 'why'] } },
  },
  required: ['kept', 'dropped'],
}

const WRITTEN = {
  type: 'object',
  properties: {
    written: { type: 'array', items: { type: 'object', properties: {
      path: { type: 'string', description: 'The file actually written' },
      summary: { type: 'string', description: 'One line per file: what changed and why' },
    }, required: ['path', 'summary'] } },
    unwritten: { type: 'array', items: { type: 'string' }, description: 'Fixes not applied, each with the reason (dirty file, did not fit, gate went red)' },
    gates: { type: 'array', items: { type: 'string' }, description: 'Each gate run, with its exit code' },
  },
  required: ['written', 'unwritten', 'gates'],
}

// ── Inventory ───────────────────────────────────────────────────────────────
phase('Inventory')
const inventory = await agent(
  'Inventory the agent-guidance files for a drift audit. Read only; change no file except what check:skills itself writes.\n' +
  `Units (key → root): ${units.map(u => `${u.key} → ${u.root}`).join('; ')}.\n` +
  'For each unit list every file under its root (a root that is a file is the unit\'s only file) with git log -1 --format="%h %as" -- <path>. ' +
  `For a unit under .agents/, set proposal when the mirrored path under .agents-proposals/ exists. For any other unit, set dirty when git status --porcelain lists the file. ` +
  'Then, only if package.json defines a check:skills script, run bun run check:skills and return its failures verbatim; otherwise return checkSkills empty.',
  { label: 'inventory', phase: 'Inventory', schema: INVENTORY, effort: 'low' },
)
if (!inventory) return { error: 'Inventory failed; nothing was audited.' }

const work = units.map(u => ({ ...u, files: inventory.units.find(x => x.key === u.key)?.files || [] }))
const empty = work.filter(u => !u.files.length).map(u => u.key)
if (empty.length) log(`No files found for ${empty.join(', ')}; skipped.`)

const readList = u => u.files.map(f =>
  `- ${f.path} (last commit ${f.lastCommit})${f.proposal ? ` — audit ${mirror(f.path)} instead: it is an unapplied proposal for this file` : ''}`).join('\n')

// ── Audit → Verify → Write, per unit, no barrier ────────────────────────────
const results = await pipeline(
  work.filter(u => u.files.length),
  u => agent(
    `Audit the ${u.key} guidance for drift. Its files:\n${readList(u)}\n\n` +
    `Read every file in full. Check each concrete claim (a name, path, script, command, code, default, rule, count, ADR or LT-ID citation, behavior) against its source of truth: ${u.truth}. ` +
    'git log --since=<the file\'s last commit date> on the paths a claim depends on shows where to look first.' +
    `${inventory.checkSkills ? `\n\nThe mechanical check:skills pre-pass reported:\n${inventory.checkSkills}\nInclude the hits that fall in this unit.` : ''}\n\n` +
    'Report only what you can tie to a quoted claim and a file:line of evidence. Style and tone are out of scope unless a rule the unit states is broken. A claim you cannot verify either way is not a finding. Read only; change no file.',
    { label: `audit ${u.key}`, phase: 'Audit', schema: FINDINGS },
  ),
  (a, u) => {
    if (!a) return null
    if (!a.findings.length) return { kept: [], dropped: [] }
    return agent(
      `You are the skeptic for the ${u.key} drift audit (files: ${u.files.map(f => f.path).join(', ')}). The auditor reported:\n` +
      `${a.findings.map((f, i) => `${i + 1}. [${f.kind}] ${f.file}: "${f.claim}" — evidence: ${f.evidence} — fix: ${f.fix}`).join('\n')}\n\n` +
      'Try to refute each one against the source. Drop it, with the reason, if the claim still holds, the evidence is misread, it duplicates another finding, or it is taste. Re-sort what survives: if the source is what is wrong, it is stale-source. Check that each fix is itself correct and keeps the file\'s register. A duplication finding survives only if the living home it points to exists and says the same. For each stale-source finding, draft backlogEntry. Read only; change no file.',
      { label: `verify ${u.key}`, phase: 'Verify', schema: VERDICT },
    )
  },
  async (v, u) => {
    if (!v) return { key: u.key, failed: true }
    const fixes = v.kept.filter(f => f.kind !== 'stale-source')
    if (!fixes.length) return { key: u.key, verdict: v, write: null }
    const target = u.protected
      ? 'This unit is write-protected. For each file with fixes, write the FULL file to its mirrored path under .agents-proposals/ (.agents/skills/x/y.md → .agents-proposals/skills/x/y.md), starting from the existing proposal if there is one, else from the .agents/ file. Never write under .agents/. Gates: none.'
      : `Edit the files in place. Skip every fix in a file git status --porcelain lists as modified (dirty: ${u.files.filter(f => f.dirty).map(f => f.path).join(', ') || 'none'}) and list it as unwritten. Then run bun run check:links and, if package.json defines it, bun run check:skills, and report each exit code; if a gate goes red because of an edit, revert that edit and list it as unwritten.`
    const w = await agent(
      `Apply these verified drift fixes for ${u.key}:\n${fixes.map((f, i) => `${i + 1}. ${f.file}: replace "${f.claim}" — with: ${f.fix}`).join('\n')}\n\n` +
      `${target} Apply each fix as given, adjusting only what the surrounding text needs to stay grammatical; touch nothing else and no other file. Do not stage or commit.`,
      { label: `write ${u.key}`, phase: 'Write', schema: WRITTEN },
    )
    return { key: u.key, verdict: v, write: w }
  },
)

const report = results.filter(Boolean)
const failed = [...report.filter(r => r.failed).map(r => r.key),
  ...work.filter(u => u.files.length && !report.some(r => r.key === u.key)).map(u => u.key)]
if (failed.length) log(`No verified result for ${failed.join(', ')}.`)

const ok = report.filter(r => !r.failed)
// Agents may report absolute paths; classify and report repo-relative.
const written = ok.flatMap(r => r.write?.written || [])
  .map(w => ({ ...w, path: w.path.replace(/^.*?(?=(?:\.agents-proposals|skills|AGENTS\.md)(?:\/|$))/, '') }))
const isProposal = w => w.path.startsWith('.agents-proposals/')
return {
  proposals: written.filter(isProposal),
  inPlace: written.filter(w => !isProposal(w)),
  unwritten: ok.flatMap(r => (r.write?.unwritten || []).map(x => `${r.key}: ${x}`)),
  // A write agent that died leaves its verified fixes unapplied; report them rather than drop them.
  unapplied: ok.filter(r => r.verdict.kept.some(f => f.kind !== 'stale-source') && !r.write)
    .flatMap(r => r.verdict.kept.filter(f => f.kind !== 'stale-source').map(f => `${r.key}: ${f.file}: "${f.claim}" → ${f.fix}`)),
  gates: ok.flatMap(r => (r.write?.gates || []).map(g => `${r.key}: ${g}`)),
  backlog: ok.flatMap(r => r.verdict.kept.filter(f => f.kind === 'stale-source').map(f => f.backlogEntry || `${f.file}: ${f.claim} — ${f.fix}`)),
  dropped: ok.flatMap(r => r.verdict.dropped.map(d => `${r.key}: ${d.claim} — ${d.why}`)),
  clean: ok.filter(r => !r.verdict.kept.length).map(r => r.key),
  failed,
  next: 'Owner: compare each proposal with its .agents/ file and copy it in, then delete the proposal; review the in-place diff (skills/ changes are product — run release-notes after committing). Architect: file the backlog drafts with real IDs. Nothing is staged or committed.',
}
