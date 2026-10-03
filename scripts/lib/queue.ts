/**
 * Queue parser and readiness engine for the le-truc task queue.
 *
 * Parses BACKLOG.md, TODO.md and DONE.md against the entry format and chain
 * grammar of .agents/skills/architect/references/task-queue.md, and answers
 * the one question the do-task workflow must decide deterministically: which
 * task is picked next. Parsing is strict — anything outside the documented
 * grammar is a problem, never a guess.
 *
 * Entry: `- [ ] LT-410: Title — suffix` plus the indented body until the next
 * entry, heading or horizontal rule. Suffixes are the seven statuses of the
 * contract; an unknown ` — text` tail parses as kind `other` (never pickable)
 * and is surfaced by check as a normalization note.
 *
 * Chain: the `**The chain.**` bullets in TODO.md. Each bullet is a track;
 * `→` and `∥` split it into ordered positions, and within a position the bare
 * `LT-NNN` references are the pick order. Parenthetical content and
 * `~~strikethrough~~` never contribute order; a possessive reference
 * ("LT-280's implementation tasks") is a placeholder position that neither
 * picks nor blocks — the real dependency rides the task's Needs line. A
 * bullet containing a struck-through ID is a closed track (gate zero).
 *
 * Readiness (task-queue.md → "The chain"): rework first (any TODO entry with
 * `— changes requested ↩`, in file order); otherwise the first ready task,
 * tracks in order — no suffix, Area not design, every Needs ID satisfied
 * (done ✓, pending review ⏳, changes requested ↩ or reviewed ✓ anywhere in
 * the queue, or the ID compacted into DONE.md), and every earlier pickable
 * open task in the same track satisfied or blocked ⛔. Design-area tasks and
 * placeholders neither pick nor block.
 *
 * CLI: scripts/queue.ts. Tests: test/queue.test.ts.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export const QUEUE_FILES = ['BACKLOG.md', 'TODO.md', 'DONE.md'] as const
export type QueueFileName = (typeof QUEUE_FILES)[number]

export type SuffixKind =
	| 'open'
	| 'in-progress'
	| 'pending-review'
	| 'done'
	| 'changes-requested'
	| 'reviewed'
	| 'blocked'
	| 'other'

/** Canonical ` — suffix` text of each status, as written on an entry's title line. */
export const SUFFIX_LABELS: Record<
	Exclude<SuffixKind, 'open' | 'other'>,
	string
> = {
	'in-progress': 'in progress ⚙',
	'pending-review': 'done, pending review ⏳',
	done: 'done ✓',
	'changes-requested': 'changes requested ↩',
	reviewed: 'reviewed ✓',
	blocked: 'blocked ⛔',
}

const KNOWN_SUFFIXES: [SuffixKind, string][] = Object.entries(
	SUFFIX_LABELS,
) as [SuffixKind, string][]

/** Suffixes that satisfy a `**Needs:**` prerequisite (task-queue.md → field table). */
const SATISFYING: SuffixKind[] = [
	'pending-review',
	'done',
	'changes-requested',
	'reviewed',
]

export interface QueueEntry {
	id: string
	/** `[x]` on the title line. */
	checkbox: boolean
	/** Title text without the status suffix. */
	title: string
	suffix: SuffixKind
	/** The raw tail for kind `other` ("rolled back 2026-10-02, deferred to …"). */
	suffixOther?: string | undefined
	area?: string | undefined
	needs: string[]
	gates: string[]
	/** 1-based lines of the entry block (title line through last body line). */
	startLine: number
	endLine: number
	/** The full entry block, lines joined with `\n`. */
	text: string
	file: QueueFileName
}

export interface ChainPosition {
	/** Bare LT-IDs in pick order; empty means a placeholder ("…'s implementation tasks"). */
	ids: string[]
}

export interface ChainTrack {
	name: string
	positions: ChainPosition[]
	/** Closed track (gate zero): contributes no positions, never blocks. */
	closed: boolean
}

export interface QueueState {
	entries: QueueEntry[]
	byId: Map<string, QueueEntry>
	chain: ChainTrack[]
	/** The `Next free task ID` line in TODO.md, e.g. `LT-415`. */
	nextFreeId: string | null
	/** LT-IDs mentioned in DONE.md prose, `LT-a–LT-b` ranges expanded. Compacted done work. */
	doneMentions: Set<string>
	/** Fatal problems (a gate fails on these). */
	problems: string[]
	/** Non-fatal notes (`other` suffixes; TODO entries outside the chain). */
	notes: string[]
}

// ── Entry parsing ─────────────────────────────────────────────────────────────

const ENTRY_LINE = /^- \[([ x])\] (LT-\d+): (.*)$/
const ENTRY_START = /^- \[.\] /
const BODY_TERMINATOR = /^(?:- \[.\] |#{1,6} |---)/
const FIELD_LINE = /^\s{1,6}\*\*(Area|Needs|Gates):\*\*\s*(.*)$/

function parseSuffix(title: string): {
	title: string
	suffix: SuffixKind
	other?: string
} {
	for (const [kind, label] of KNOWN_SUFFIXES) {
		if (title.endsWith(` — ${label}`)) {
			return {
				title: title.slice(0, -(label.length + 3)).trimEnd(),
				suffix: kind,
			}
		}
	}
	const at = title.lastIndexOf(' — ')
	if (at !== -1) {
		const tail = title.slice(at + 3)
		// A tail is a status note only when its prose (markdown stripped) starts with
		// the closed status vocabulary. Anything else — "— the census names the
		// re-routing edge." — is the title's own punctuation and stays in the title.
		const plain = tail.replace(/\*\*|`/g, '')
		const statusLike = STATUS_TAILS.some(verb =>
			new RegExp(`^${verb}(\\b|[,;:(]|\\s|\\d)`).test(plain),
		)
		if (statusLike) {
			return {
				title: title.slice(0, at).trimEnd(),
				suffix: 'other',
				other: tail,
			}
		}
	}
	return { title, suffix: 'open' }
}

function splitIds(value: string): string[] {
	return [...value.matchAll(/LT-\d+/g)].map(m => m[0])
}

export function parseEntries(
	text: string,
	file: QueueFileName,
): { entries: QueueEntry[]; problems: string[] } {
	const lines = text.split('\n')
	const entries: QueueEntry[] = []
	const problems: string[] = []

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? ''
		if (!ENTRY_START.test(line)) continue
		const match = ENTRY_LINE.exec(line)
		if (!match || !match[2] || match[3] === undefined) {
			problems.push(
				`${file}:${i + 1} — checkbox line does not match the queue entry format`,
			)
			continue
		}
		const box = match[1]
		const id = match[2]
		const rest = match[3]
		const { title, suffix, other } = parseSuffix(rest)
		const body: string[] = []
		let j = i + 1
		while (j < lines.length && !BODY_TERMINATOR.test(lines[j] ?? '')) {
			body.push(lines[j] ?? '')
			j++
		}
		let area: string | undefined
		const needs: string[] = []
		const gates: string[] = []
		for (const bodyLine of body) {
			const field = FIELD_LINE.exec(bodyLine)
			if (!field || !field[1] || field[2] === undefined) continue
			if (field[1] === 'Area') area = field[2].trim()
			else if (field[1] === 'Needs') needs.push(...splitIds(field[2]))
			else
				gates.push(
					...field[2]
						.split(',')
						.map(g => g.trim())
						.filter(Boolean),
				)
		}
		entries.push({
			id,
			checkbox: box === 'x',
			title,
			suffix,
			suffixOther: other,
			area,
			needs,
			gates,
			startLine: i + 1,
			endLine: j,
			text: [line, ...body].join('\n'),
			file,
		})
		i = j - 1
	}
	return { entries, problems }
}

// ── Chain parsing ─────────────────────────────────────────────────────────────

const CHAIN_HEADER = /^\*\*The chain\.\*\*/
const TRACK_BULLET = /^- \*\*(.+?)\*\*(.*)$/

/** Status-vocabulary starters: a ` — ` tail beginning with one of these is a status
 * note (kind `other`), never title prose. Closed on purpose — the contract defines
 * seven suffixes, and anything else a title says stays in the title. */
const STATUS_TAILS = [
	'rolled back',
	'parked',
	'closed',
	'superseded',
	'deferred',
	'withdrawn',
	'reverted',
	'reopened',
	'merged',
	'struck',
	'returned',
	'on hold',
	'obsolete',
	'declined',
]

/** A bare LT-ID, skipping possessive citations ("LT-280's implementation tasks",
 * "LT-165 step 7's corpus pin") — references to a task, not positions in the order. */
function bareIds(segment: string): string[] {
	const ids: string[] = []
	for (const match of segment.matchAll(/LT-\d+/g)) {
		const after = segment.slice(match.index! + match[0].length)
		if (/^'s|^’s/.test(after) || /^\s+step\s+\d+['’]s/.test(after)) continue
		ids.push(match[0])
	}
	return ids
}

/** Remove parenthetical groups (nested included) — their content never contributes order. */
function stripParens(text: string): string {
	let out = text
	let prev = ''
	while (out !== prev) {
		prev = out
		out = out.replace(/\([^()]*\)/g, ' ')
	}
	return out.replace(/~~.*?~~/g, ' ')
}

function parseChain(
	text: string,
	file: QueueFileName,
): { chain: ChainTrack[]; problems: string[] } {
	const lines = text.split('\n')
	const start = lines.findIndex(l => CHAIN_HEADER.test(l))
	const problems: string[] = []
	if (start === -1) return { chain: [], problems }

	const chain: ChainTrack[] = []
	let raw: string | null = null
	let name = ''
	const flush = () => {
		if (raw === null) return
		const rest = raw
		raw = null
		const closed = /~~\s*LT-\d+/.test(rest)
		if (closed) {
			chain.push({ name, positions: [], closed: true })
			return
		}
		const positions: ChainPosition[] = []
		for (const segment of stripParens(rest).split(/\s*[→∥]\s*/)) {
			positions.push({ ids: bareIds(segment) })
		}
		chain.push({ name, positions, closed: false })
	}
	for (let i = start + 1; i < lines.length; i++) {
		const line = lines[i] ?? ''
		if (line.trim() === '') continue
		const bullet = TRACK_BULLET.exec(line)
		if (bullet) {
			flush()
			name = bullet[1] ?? ''
			raw = bullet[2] ?? ''
		} else if (raw !== null && /^\s/.test(line)) {
			// Chain bullets wrap: join the continuation into the track's text.
			raw += ` ${line.trim()}`
		} else {
			break
		}
	}
	flush()
	return { chain, problems }
}

// ── Whole-queue state ─────────────────────────────────────────────────────────

/** LT-IDs mentioned in prose, `LT-a–LT-b` ranges expanded (DONE.md compaction writes ranges). */
export function mentionedIds(text: string): Set<string> {
	const ids = new Set<string>()
	for (const m of text.matchAll(/LT-(\d+)\s*[–—-]\s*(?:LT-)?(\d+)/g)) {
		const lo = Number(m[1])
		const hi = Number(m[2])
		if (lo < hi && hi - lo < 100)
			for (let n = lo; n <= hi; n++) ids.add(`LT-${n}`)
	}
	for (const m of text.matchAll(/LT-(\d+)/g)) ids.add(`LT-${m[1]}`)
	return ids
}

export function loadState(
	root: string = ROOT,
	read: (file: QueueFileName) => string = file =>
		readFileSync(join(root, file), 'utf8'),
): QueueState {
	const texts = new Map<QueueFileName, string>()
	const entries: QueueEntry[] = []
	const problems: string[] = []

	for (const file of QUEUE_FILES) {
		const text = read(file)
		texts.set(file, text)
		const parsed = parseEntries(text, file)
		entries.push(...parsed.entries)
		problems.push(...parsed.problems)
	}

	const todoText = texts.get('TODO.md')!
	const { chain } = parseChain(todoText, 'TODO.md')

	const nextFreeMatch = /Next free task ID:\s*(LT-\d+)/.exec(todoText)
	const nextFreeId = nextFreeMatch?.[1] ?? null

	const byId = new Map<string, QueueEntry>()
	for (const entry of entries) {
		const existing = byId.get(entry.id)
		if (existing) {
			problems.push(
				`${entry.id} is declared twice: ${existing.file}:${existing.startLine} and ${entry.file}:${entry.startLine}`,
			)
		} else {
			byId.set(entry.id, entry)
		}
	}

	const doneMentions = mentionedIds(texts.get('DONE.md')!)
	const state: QueueState = {
		entries,
		byId,
		chain,
		nextFreeId,
		doneMentions,
		problems,
		notes: [],
	}
	collectFindings(state)
	return state
}

function collectFindings(state: QueueState): void {
	const { entries, byId, chain, nextFreeId, doneMentions } = state

	const maxDeclared = entries.reduce(
		(max, e) => Math.max(max, Number(e.id.slice(3))),
		0,
	)
	if (nextFreeId === null) {
		state.problems.push('TODO.md has no "Next free task ID" line')
	} else if (maxDeclared >= Number(nextFreeId.slice(3))) {
		state.problems.push(
			`Next free task ID ${nextFreeId} does not exceed the highest declared ID LT-${maxDeclared}`,
		)
	}

	for (const entry of entries) {
		if (!entry.area)
			state.problems.push(
				`${entry.file}:${entry.startLine} ${entry.id} has no **Area:** line`,
			)
		if (entry.suffix === 'other') {
			state.notes.push(
				`${entry.id} carries a non-contract suffix "— ${entry.suffixOther}" — normalize to a contract status`,
			)
		}
		const doneLike =
			entry.suffix === 'reviewed' ||
			entry.suffix === 'done' ||
			entry.suffix === 'pending-review'
		if (entry.checkbox !== doneLike && entry.suffix !== 'other') {
			state.problems.push(
				`${entry.id}: checkbox ${entry.checkbox ? '[x]' : '[ ]'} disagrees with its "${SUFFIX_LABELS[entry.suffix as Exclude<SuffixKind, 'open' | 'other'>] ?? entry.suffixOther}" status`,
			)
		}
		for (const need of entry.needs) {
			const target = byId.get(need)
			const known = target || doneMentions.has(need)
			if (!known)
				state.problems.push(
					`${entry.id} needs ${need}, which no queue file declares or DONE.md mentions`,
				)
		}
	}

	const chained = new Set<string>()
	for (const track of chain) {
		if (track.closed) continue
		for (const position of track.positions) {
			for (const id of position.ids) {
				chained.add(id)
				// A chain position may name work that is done and compacted (the
				// architect prunes the chain at planning, not on every landing);
				// only an id known nowhere is a problem.
				if (!byId.has(id) && !doneMentions.has(id)) {
					state.problems.push(
						`The chain names ${id} (${track.name}), which no queue file declares`,
					)
				}
			}
		}
	}
	for (const entry of entries) {
		if (entry.file !== 'TODO.md' || entry.suffix !== 'open' || isDesign(entry))
			continue
		if (!chained.has(entry.id)) {
			state.notes.push(
				`${entry.id} is open in TODO.md but the chain does not name it`,
			)
		}
	}
}

// ── Readiness and pick ────────────────────────────────────────────────────────

export function isSatisfied(id: string, state: QueueState): boolean {
	const entry = state.byId.get(id)
	if (entry) return SATISFYING.includes(entry.suffix)
	return state.doneMentions.has(id)
}

const isDesign = (entry: QueueEntry): boolean =>
	entry.area?.startsWith('design') ?? false

export interface Pick {
	picked: boolean
	/** The picked task; null when nothing is pickable. */
	task: QueueEntry | null
	/** Why this task was picked, or why nothing was. */
	reason: string
}

export function pick(state: QueueState): Pick {
	// Rework first: any TODO entry with changes requested, in file order.
	for (const entry of state.entries) {
		if (entry.file === 'TODO.md' && entry.suffix === 'changes-requested') {
			return {
				picked: true,
				task: entry,
				reason: 'rework: the entry carries — changes requested ↩',
			}
		}
	}

	// First ready task, tracks in order. A stalled task (open/claimed/other,
	// not ready, not blocked) ends its own track — everything behind it in that
	// track waits — and the scan falls through to the next track.
	let firstStall: string | null = null
	for (const track of state.chain) {
		if (track.closed) continue
		const scan = scanTrack(track, state)
		if (!scan) continue
		if (scan.kind === 'pick') {
			return {
				picked: true,
				task: scan.entry,
				reason: `first ready task in track "${track.name}"`,
			}
		}
		firstStall ??= `${scan.id} (${track.name}) stands first and ${scan.why}`
	}

	const openCount = state.entries.filter(
		e => e.file === 'TODO.md' && e.suffix === 'open' && !isDesign(e),
	).length
	return {
		picked: false,
		task: null,
		reason: firstStall
			? `no ready task: ${firstStall}`
			: openCount > 0
				? `no ready task: ${openCount} open non-design TODO entr${openCount === 1 ? 'y' : 'ies'} and none is first-ready in its track`
				: 'no open non-design TODO entries: the iteration needs planning',
	}
}

type TrackScan =
	| { kind: 'pick'; entry: QueueEntry }
	| { kind: 'stall'; id: string; why: string }
	| null

function scanTrack(track: ChainTrack, state: QueueState): TrackScan {
	for (const position of track.positions) {
		for (const id of position.ids) {
			const entry = state.byId.get(id)
			// Only a TODO-declared task picks or blocks here; backlog entries,
			// compacted ids and placeholders ride the task's Needs line instead.
			if (!entry || entry.file !== 'TODO.md') continue
			if (isDesign(entry)) continue
			if (SATISFYING.includes(entry.suffix) || entry.suffix === 'blocked')
				continue
			const notReady =
				entry.suffix !== 'open'
					? entry.suffix === 'in-progress'
						? 'it is in progress ⚙ (claimed by a running session)'
						: `it is not on a contract status ("— ${entry.suffixOther}")`
					: unsatisfiedNeeds(entry, state)
			if (notReady) return { kind: 'stall', id, why: notReady }
			return { kind: 'pick', entry }
		}
	}
	return null
}

/** Pick a named task instead of the chain's first ready one (the workflow's
 * `id` argument): in TODO.md, claimable, not design, and its Needs satisfied.
 * The chain position is not consulted — naming the task is the override. */
export function pickById(id: string, state: QueueState): Pick {
	const entry = state.byId.get(id)
	if (!entry)
		return {
			picked: false,
			task: null,
			reason: `${id} is declared by no queue file`,
		}
	if (entry.file !== 'TODO.md')
		return {
			picked: false,
			task: null,
			reason: `${id} is in ${entry.file}, not TODO.md`,
		}
	if (entry.suffix === 'changes-requested')
		return {
			picked: true,
			task: entry,
			reason: 'named task carrying — changes requested ↩ (rework)',
		}
	if (entry.suffix !== 'open')
		return {
			picked: false,
			task: null,
			reason: `${id} is not open (suffix: ${entry.suffix})`,
		}
	if (isDesign(entry))
		return {
			picked: false,
			task: null,
			reason: `${id} is Area: design; do-task never picks it`,
		}
	const notReady = unsatisfiedNeeds(entry, state)
	if (notReady)
		return {
			picked: false,
			task: null,
			reason: `${id} is not ready: ${notReady}`,
		}
	return {
		picked: true,
		task: entry,
		reason: 'named task, ready per the contract',
	}
}

function unsatisfiedNeeds(entry: QueueEntry, state: QueueState): string | null {
	const missing = entry.needs.filter(id => !isSatisfied(id, state))
	if (!missing.length) return null
	const detail = missing
		.map(id => {
			const target = state.byId.get(id)
			if (!target) return `${id} (compacted record absent from DONE.md)`
			return `${id} is ${target.suffix === 'open' ? 'open' : (SUFFIX_LABELS[target.suffix as Exclude<SuffixKind, 'open' | 'other'>] ?? `"— ${target.suffixOther}"`)}`
		})
		.join('; ')
	return `its Needs are unsatisfied: ${detail}`
}

// ── Citations ─────────────────────────────────────────────────────────────────

/** ADRs, living docs and source paths the entry cites — the reviewer's reading list. */
export function extractCitations(entryText: string): string[] {
	const citations = new Set<string>()
	for (const m of entryText.matchAll(/adr\/(\d{4})[a-z0-9-]*\.md/g))
		citations.add(`adr/${m[1]}`)
	for (const m of entryText.matchAll(/ADR (\d{4})/g))
		citations.add(`adr/${m[1]}`)
	const KNOWN_DOCS = new Set([
		'HOST_PROFILE',
		'LE_TRUC_COMPILER',
		'COMPILER_SPEC',
		'ARCHITECTURE',
		'REQUIREMENTS',
		'CONTEXT',
		'SERVER',
		'AGENTS',
		'CHANGELOG',
		'TODO',
		'BACKLOG',
		'DONE',
		'NOTES',
	])
	for (const m of entryText.matchAll(/\b([A-Z][A-Z_a-z]{3,})\.md\b/g)) {
		if (m[1] && KNOWN_DOCS.has(m[1])) citations.add(`${m[1]}.md`)
	}
	for (const m of entryText.matchAll(
		/\b((?:server|src|scripts|skills|spike|docs|examples|\.agents)\/[\w./-]+)/g,
	)) {
		if (m[1]) citations.add(m[1].replace(/[.,;)]+$/, ''))
	}
	return [...citations]
}

// ── Write operations (the do-task workflow's only queue writes) ──────────────
// Every write re-parses the target file first and edits exactly the entry's
// title line (suffix, checkbox) or inserts prose after its body. BACKLOG.md and
// DONE.md are never written — moving entries between files stays the
// Architect's hand (task-queue.md → Moves).

import { writeFileSync } from 'node:fs'

const WRITE_SUFFIXES = [
	'in-progress',
	'pending-review',
	'done',
	'blocked',
] as const
export type WriteSuffix = (typeof WRITE_SUFFIXES)[number]

function writeSuffixLabel(kind: WriteSuffix): string {
	return kind === 'in-progress'
		? SUFFIX_LABELS['in-progress']
		: kind === 'pending-review'
			? SUFFIX_LABELS['pending-review']
			: kind === 'done'
				? SUFFIX_LABELS.done
				: SUFFIX_LABELS.blocked
}

export interface WriteResult {
	ok: boolean
	error?: string
}

function editEntryLine(
	root: string,
	file: QueueFileName,
	id: string,
	edit: (titleLine: string) => string,
): WriteResult {
	const path = join(root, file)
	const text = readFileSync(path, 'utf8')
	const { entries } = parseEntries(text, file)
	const entry = entries.find(e => e.id === id)
	if (!entry) return { ok: false, error: `${id} is not declared in ${file}` }
	const lines = text.split('\n')
	const index = entry.startLine - 1
	if (lines[index] !== entry.text.split('\n')[0]) {
		return {
			ok: false,
			error: `${file}:${entry.startLine} changed under us; refusing to edit ${id}`,
		}
	}
	lines[index] = edit(lines[index] ?? '')
	writeFileSync(path, lines.join('\n'))
	return { ok: true }
}

/** Claim an open or changes-requested TODO entry: its suffix becomes `in progress ⚙`. */
export function claimTask(root: string, id: string): WriteResult {
	const state = loadState(root)
	const entry = state.byId.get(id)
	if (!entry) return { ok: false, error: `${id} is declared by no queue file` }
	if (entry.file !== 'TODO.md')
		return {
			ok: false,
			error: `${id} is in ${entry.file}; only TODO.md entries are pickable`,
		}
	if (entry.suffix !== 'open' && entry.suffix !== 'changes-requested') {
		return {
			ok: false,
			error: `${id} carries "${entry.suffix}"; only open or changes-requested entries are claimable`,
		}
	}
	return editEntryLine(root, 'TODO.md', id, line => {
		const stripped = line.replace(/ — (in progress ⚙|changes requested ↩)$/, '')
		return `${stripped} — ${SUFFIX_LABELS['in-progress']}`
	})
}

/**
 * Write the run's outcome: flip the claimed suffix to a terminal one and, for
 * pending-review/done, insert the handoff prose lines after the entry's body;
 * for blocked, insert the prose into NOTES.md below its first `---` separator.
 */
export function annotateTask(
	root: string,
	id: string,
	suffix: Exclude<WriteSuffix, 'in-progress'>,
	prose: string,
): WriteResult {
	const state = loadState(root)
	const entry = state.byId.get(id)
	if (!entry) return { ok: false, error: `${id} is declared by no queue file` }
	if (entry.file !== 'TODO.md')
		return { ok: false, error: `${id} is in ${entry.file}, not TODO.md` }
	if (entry.suffix !== 'in-progress') {
		return {
			ok: false,
			error: `${id} carries "${entry.suffix}"; annotate only a claimed (— in progress ⚙) entry`,
		}
	}
	const checkbox =
		suffix === 'pending-review' || suffix === 'done' ? '[x]' : '[ ]'
	const flipped = editEntryLine(root, 'TODO.md', id, line => {
		const stripped = line.replace(/ — in progress ⚙$/, '')
		return `${stripped.replace('- [ ]', `- ${checkbox}`)} — ${writeSuffixLabel(suffix)}`
	})
	if (!flipped.ok) return flipped

	if (suffix === 'blocked') {
		const notesPath = join(root, 'NOTES.md')
		const notes = readFileSync(notesPath, 'utf8')
		const separator = notes.indexOf('\n---\n')
		if (separator === -1)
			return {
				ok: false,
				error: 'NOTES.md has no `---` separator to insert below',
			}
		const insertAt = separator + '\n---\n'.length
		writeFileSync(
			notesPath,
			`${notes.slice(0, insertAt)}\n${prose.trim()}\n${notes.slice(insertAt)}`,
		)
		return { ok: true }
	}

	if (!prose.trim()) return { ok: true }
	const todoPath = join(root, 'TODO.md')
	const todo = readFileSync(todoPath, 'utf8')
	const fresh = parseEntries(todo, 'TODO.md')
	const freshEntry = fresh.entries.find(e => e.id === id)
	if (!freshEntry)
		return { ok: false, error: `${id} vanished from TODO.md mid-annotate` }
	const lines = todo.split('\n')
	lines.splice(freshEntry.endLine, 0, ...prose.trimEnd().split('\n'))
	writeFileSync(todoPath, lines.join('\n'))
	return { ok: true }
}

/** Return a claimed entry to open (the recover path when an implement agent dies). */
export function resetTask(root: string, id: string): WriteResult {
	return editEntryLine(root, 'TODO.md', id, line => {
		const stripped = line.replace(/ — in progress ⚙$/, '')
		return `${stripped.replace('- [x]', '- [ ]')}`
	})
}
