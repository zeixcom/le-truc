export const meta = {
  name: 'release-notes',
  description: 'Record reviewed DONE.md entries and unticketed commits as CHANGELOG.md [Unreleased] entries in writer style',
  whenToUse: 'Bring the le-truc changelog up to date before a release or a DONE.md prune. Args: none (diff base = the last commit that touched CHANGELOG.md), or { since: "<git ref>" }. Writes CHANGELOG.md only; DONE.md and the queue stay untouched.',
  phases: [
    { title: 'Collect', detail: 'reviewed DONE.md entries, unticketed commits, the diff base' },
    { title: 'Draft', detail: 'per source: covered, internal, or new bullets; script lint' },
    { title: 'Verify', detail: 'a skeptic checks each bullet against the change' },
    { title: 'Write', detail: 'merge the surviving bullets into [Unreleased]' },
  ],
}

// ── Contract ────────────────────────────────────────────────────────────────
// Style and sources: .agents/skills/writer/references/changelog.md. DONE.md
// is read only: it is a view built from queue/, and the Architect prunes the
// store after this run, from `consumed`.
// The run appends bullets under CHANGELOG.md [Unreleased] and never rewrites
// an existing bullet. It refuses to write when CHANGELOG.md already has
// uncommitted changes, so the owner's diff is exactly this run's output.
// Nothing is committed.

const input = typeof args === 'string' ? { since: args } : (args || {})
const CATEGORIES = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security']
const MAX_CHARS = 300
const MAX_SENTENCES = 4

const COLLECTED = {
  type: 'object',
  properties: {
    base: { type: 'string', description: 'The resolved diff base, as a short hash' },
    changelogDirty: { type: 'boolean', description: 'git status shows uncommitted changes to CHANGELOG.md' },
    entries: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      entry: { type: 'string', description: 'The full entry text, verbatim' },
      commits: { type: 'array', items: { type: 'string' }, description: 'Hashes from git log --grep="<LT-ID>" --format=%h, oldest first' },
    }, required: ['id', 'title', 'entry', 'commits'] } },
    loose: { type: 'array', items: { type: 'object', properties: {
      hash: { type: 'string' },
      subject: { type: 'string' },
    }, required: ['hash', 'subject'] }, description: 'Commits base..HEAD touching the source paths whose subject names no LT-ID' },
  },
  required: ['base', 'changelogDirty', 'entries', 'loose'],
}

const BULLETS = {
  type: 'array',
  items: { type: 'object', properties: {
    category: { type: 'string', enum: CATEGORIES },
    text: { type: 'string', description: 'The bullet without the leading "- ": **Bold lead**: body' },
  }, required: ['category', 'text'] },
}

const DRAFT = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['record', 'covered', 'internal'], description: 'record: a user-visible change no [Unreleased] bullet states yet. covered: an existing bullet already states it. internal: nothing an integrator, author or skill reader can observe (byte-identical refactor, test, queue or harness-only change).' },
    reason: { type: 'string', description: 'For covered: quote the covering bullet\'s bold lead. For internal: one line on why nothing is observable.' },
    bullets: BULLETS,
  },
  required: ['verdict', 'reason', 'bullets'],
}

const VERIFIED = {
  type: 'object',
  properties: {
    kept: BULLETS,
    dropped: { type: 'array', items: { type: 'object', properties: {
      text: { type: 'string' },
      why: { type: 'string' },
    }, required: ['text', 'why'] } },
  },
  required: ['kept', 'dropped'],
}

const WRITTEN = {
  type: 'object',
  properties: {
    added: { type: 'number', description: 'Bullets inserted' },
    merged: { type: 'array', items: { type: 'string' }, description: 'Drafts folded into another draft because they state the same change' },
    deletions: { type: 'number', description: 'Deleted lines in git diff --numstat CHANGELOG.md' },
  },
  required: ['added', 'merged', 'deletions'],
}

// The writer's ceilings, checked by the script so no agent can talk past them.
function lint(b) {
  const problems = []
  const lead = /^\*\*[^*]+\*\*:\s/.exec(b.text)
  if (!lead) problems.push('does not open with a bold lead and a colon')
  if (b.text.length > MAX_CHARS) problems.push(`${b.text.length} characters (ceiling ${MAX_CHARS})`)
  const prose = b.text.replace(/`[^`]*`/g, 'x').replace(/\([^)]*\)/g, 'x')
  const sentences = prose.split(/[.!?](?:\s|$)/).filter(s => s.trim()).length
  if (sentences > MAX_SENTENCES) problems.push(`${sentences} sentences (ceiling ${MAX_SENTENCES})`)
  if (b.category === 'Fixed' && !/\bpreviously\b/i.test(b.text)) problems.push('a Fixed entry needs "Previously, X. Now, Y."')
  return problems
}

const STYLE = 'Follow .agents/skills/writer/references/changelog.md → Entry style exactly: one behavior change per bullet, a bold lead (API name or short summary) and a colon, at most 4 sentences and 300 characters including the lead, only rationale the user sees, "Previously, X. Now, Y." for Fixed, a migration note on a Changed or Removed entry that breaks compatibility, backticks around every API name, flag and file name. A change to skills/ is product: name the skill and file. A .agents/skills/ change counts only when it changes how contributors work.'

const sourceOf = s => s.kind === 'entry'
  ? `${s.id} (${s.title}). Its commits: ${s.commits.length ? `git show ${s.commits.join(' ')}` : 'none found; judge from the entry and the current source'}. The DONE.md entry:\n\n${s.entry}`
  : `the commits since ${s.base} that name no task:\n${s.commits.map(c => `${c.hash} ${c.subject}`).join('\n')}\n\nRead each with git show. Judge each commit on its own; merge commits and "review: … nit fixes" commits are covered by their task.`

// ── Collect ─────────────────────────────────────────────────────────────────
phase('Collect')
const collected = await agent(
  'Collect the inputs for a changelog pass. Read only; change no file.\n' +
  `1. The diff base: ${input.since ? `resolve ${input.since}` : 'git log -1 --format=%h -- CHANGELOG.md'}.\n` +
  '2. changelogDirty: does git status --porcelain list CHANGELOG.md?\n' +
  '3. entries: every DONE.md entry (a "- [x] LT-NNN: …" line and its indented lines) whose title line ends with "— reviewed ✓" or "— done ✓". Skip "pending review ⏳", "changes requested ↩" and every other suffix. Copy each entry verbatim and find its commits with git log --grep="<LT-ID>" --format=%h --reverse.\n' +
  '4. loose: git log --format="%h %s" --no-merges <base>..HEAD -- src/ index.ts server/compiler/ skills/ .agents/skills/ package.json, keeping only commits whose subject names no LT-ID.',
  { label: 'collect', phase: 'Collect', schema: COLLECTED, effort: 'low' },
)
if (!collected) return { error: 'Collect failed; nothing was written.' }

const sources = [
  ...collected.entries.map(e => ({ kind: 'entry', ...e })),
  ...(collected.loose.length ? [{ kind: 'loose', id: 'unticketed', title: `${collected.loose.length} commits`, base: collected.base, commits: collected.loose }] : []),
]
if (!sources.length) {
  log('No reviewed DONE.md entries and no unticketed commits.')
  return { base: collected.base, written: 0 }
}
log(`Base ${collected.base}: ${collected.entries.length} DONE.md entries, ${collected.loose.length} unticketed commits`)

// ── Draft → lint → Verify, per source, no barrier ───────────────────────────
const results = await pipeline(
  sources,
  s => agent(
    `Decide whether ${sourceOf(s)}\n\nneeds a CHANGELOG.md [Unreleased] entry. Read CHANGELOG.md [Unreleased] first: a change an existing bullet already states is covered, even when the wording differs. ` +
    `If the verdict is record, draft the bullets. ${STYLE} Leave bullets empty for covered and internal. Read only; change no file.`,
    { label: `draft ${s.id}`, phase: 'Draft', schema: DRAFT },
  ),
  async (d, s) => {
    if (!d || d.verdict !== 'record' || !d.bullets.length) return d
    const failing = d.bullets.map(b => ({ b, problems: lint(b) })).filter(x => x.problems.length)
    if (!failing.length) return d
    const redo = await agent(
      `These changelog bullets for ${s.id} break the style ceilings:\n${failing.map(x => `- [${x.b.category}] ${x.b.text}\n  → ${x.problems.join('; ')}`).join('\n')}\n\n` +
      `Rewrite each one so it passes; split a bullet that mixes behaviors, cut mechanics that belong in ADRs or commits. Return every bullet for ${s.id}, the passing ones unchanged:\n${d.bullets.filter(b => !lint(b).length).map(b => `- [${b.category}] ${b.text}`).join('\n') || '(none)'}\n\n${STYLE} Read only; change no file.`,
      { label: `redraft ${s.id}`, phase: 'Draft', schema: { type: 'object', properties: { bullets: BULLETS }, required: ['bullets'] } },
    )
    return redo ? { ...d, bullets: redo.bullets } : d
  },
  async (d, s) => {
    if (!d) return null
    if (d.verdict !== 'record' || !d.bullets.length) return { ...d, kept: [], dropped: [] }
    const v = await agent(
      `You are the skeptic for the changelog bullets drafted from ${sourceOf(s)}\n\nDrafts:\n${d.bullets.map((b, i) => `${i + 1}. [${b.category}] ${b.text}`).join('\n')}\n\n` +
      'Check each against the code: drop a bullet whose claim the change does not support, that an existing CHANGELOG.md [Unreleased] bullet already states, or that describes nothing a user can observe. Fix a wrong category, API name or migration note in place, keeping the wording otherwise. Read only; change no file.',
      { label: `verify ${s.id}`, phase: 'Verify', schema: VERIFIED },
    )
    if (!v) return { ...d, kept: [], dropped: [], unverified: true }
    // The skeptic may have rewritten a bullet: lint again, and report rather than write a failure.
    const rejected = v.kept.filter(b => lint(b).length).map(b => ({ text: b.text, why: lint(b).join('; ') }))
    return { ...d, kept: v.kept.filter(b => !lint(b).length), dropped: [...v.dropped, ...rejected] }
  },
)

const report = sources.map((s, i) => ({ id: s.id, r: results[i] }))
const bullets = report.flatMap(({ id, r }) => (r?.kept || []).map(b => ({ id, ...b })))
const failed = report.filter(({ r }) => !r || r.unverified).map(({ id }) => id)
if (failed.length) log(`No verified result for ${failed.join(', ')}; they are left out of this run.`)

// ── Write ───────────────────────────────────────────────────────────────────
phase('Write')
let written = null
if (!bullets.length) {
  log('Nothing new to record.')
} else if (collected.changelogDirty) {
  log('CHANGELOG.md has uncommitted changes; the bullets are returned unwritten.')
} else {
  written = await agent(
    `Insert these bullets into CHANGELOG.md under ## [Unreleased]:\n${bullets.map(b => `- [${b.category}] (${b.id}) ${b.text}`).join('\n')}\n\n` +
    `Rules: put each at the end of its ### category, creating a missing heading in the order ${CATEGORIES.join(', ')}, and create ## [Unreleased] directly below # Changelog if it is missing (.agents/skills/writer/references/changelog.md → Structure). Write each bullet as "- " plus its text; drop the [category] and (LT-ID) tags. ` +
    'If two bullets state the same change, keep the better one and list the other as merged. Change no existing line and no other file. Then run git diff --numstat CHANGELOG.md and report its deletions.',
    { label: 'write', phase: 'Write', schema: WRITTEN, effort: 'low' },
  )
  if (written?.deletions) log(`Warning: the write deleted ${written.deletions} line(s) from CHANGELOG.md; check the diff.`)
}

const ids = verdict => report.filter(({ id, r }) => r?.verdict === verdict && id !== 'unticketed').map(({ id, r }) => `${id}: ${r.reason}`)
const recordedIds = [...new Set(bullets.map(b => b.id))].filter(id => id !== 'unticketed')
return {
  base: collected.base,
  written: written ? written.added : 0,
  unwritten: written ? [] : bullets.map(b => `[${b.category}] ${b.text}`),
  merged: written?.merged || [],
  recorded: recordedIds,
  covered: ids('covered'),
  internal: ids('internal'),
  dropped: report.flatMap(({ id, r }) => (r?.dropped || []).map(d => `${id}: ${d.text} — ${d.why}`)),
  failed,
  // DONE.md entries whose changelog obligation is met; the Architect prunes from this list.
  consumed: report.filter(({ id, r }) => id !== 'unticketed' && r && !r.unverified).map(({ id }) => id),
  // Subject only; the session presenting the result adds its Co-Authored-By trailer.
  commitSubject: written?.added ? `docs(changelog): record ${recordedIds.length ? recordedIds.join(', ') : 'unticketed changes'}` : null,
  next: 'Owner: review git diff CHANGELOG.md and commit. Architect: prune the consumed entries in the queue store, not DONE.md (a built view): delete each queue/LT-NNN.md, carry any ruling with no other home and a prune note into queue/LEDGER.md, then bun run queue:build && bun run check:queue.',
}
