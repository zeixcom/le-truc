/**
 * The queue store: one file per task under queue/, with the kanban files as
 * generated views (Phase 3 of the 2026-10-03 queue reorganization).
 *
 * Source files (hand-edited):
 *   queue/LT-NNN.md   One task. YAML front matter carries the machine fields;
 *                     the body is the entry prose, dedented.
 *   queue/BANDS.md    The BACKLOG view's prose: the static explainer and the
 *                     band preambles, one `## <band>` section each.
 *   queue/ITERATION.md  The TODO view's prose: the header, rulings, the chain,
 *                     ending in an `<!-- entries -->` marker.
 *   queue/LEDGER.md   The DONE view's prose: compaction policy, rulings
 *                     carried, open obligations, standing notes.
 *
 * Generated views (committed, by `bun scripts/queue.ts build`):
 *   BACKLOG.md  BANDS.md with each band's open, unchained entries appended.
 *   TODO.md     ITERATION.md with the chain's tasks grouped under their tracks.
 *   DONE.md     LEDGER.md with every reviewed/done/pending-review task.
 *
 * A task's view is derived, never stored: the chain names the iteration, the
 * status names the shelf. `check` fails when a view is stale or a task file
 * is malformed. IDs are unique by construction (the filename is the ID).
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type TaskStatus =
	| 'open'
	| 'in-progress'
	| 'pending-review'
	| 'done'
	| 'changes-requested'
	| 'reviewed'
	| 'blocked'
	| 'note'

export interface QueueTask {
	id: string
	title: string
	area: string
	status: TaskStatus
	/** The raw tail when status is `note` ("parked 2026-10-01, demand-gated only"). */
	note?: string | undefined
	needs: string[]
	gates: string[]
	/** The BACKLOG band the task belongs to (P1…P7); iteration tasks keep their origin band. */
	band: string
	/** Body prose, dedented. Empty when the entry has none. */
	body: string
	/** Source path, for problem messages. */
	path: string
}

const STATUSES: TaskStatus[] = [
	'open',
	'in-progress',
	'pending-review',
	'done',
	'changes-requested',
	'reviewed',
	'blocked',
	'note',
]

/** The ` — suffix` text each status renders as on a title line. */
export const STATUS_TAILS: Record<TaskStatus, string | null> = {
	open: null,
	'in-progress': 'in progress ⚙',
	'pending-review': 'done, pending review ⏳',
	done: 'done ✓',
	'changes-requested': 'changes requested ↩',
	reviewed: 'reviewed ✓',
	blocked: 'blocked ⛔',
	note: null, // rendered from `note:` instead
}

const AREAS = ['runtime', 'compiler', 'server', 'examples', 'docs', 'design']

// ── Front matter ──────────────────────────────────────────────────────────────

function parseFrontMatter(
	text: string,
	path: string,
): { fields: Map<string, string>; body: string } {
	const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
	if (!match || !match[1] || match[2] === undefined)
		throw new StoreError(path, 'no YAML front matter block')
	const fields = new Map<string, string>()
	for (const line of match[1].split('\n')) {
		const field = /^([a-z]+):\s*(.*)$/.exec(line)
		if (!field || !field[1] || field[2] === undefined)
			throw new StoreError(
				path,
				'front matter line is not "key: value" — ' + JSON.stringify(line),
			)
		fields.set(field[1], field[2].trim())
	}
	return { fields, body: match[2].replace(/^\n+/, '').replace(/\n$/, '') }
}

export class StoreError extends Error {
	constructor(path: string, message: string) {
		super(`${path}: ${message}`)
	}
}

export function parseTaskFile(text: string, path: string): QueueTask {
	const { fields, body } = parseFrontMatter(text, path)
	const id = fields.get('id')
	const title = fields.get('title')
	const area = fields.get('area')
	const status = fields.get('status') as TaskStatus | undefined
	if (!id || !/^LT-\d+$/.test(id))
		throw new StoreError(path, 'front matter has no `id: LT-NNN`')
	if (!title) throw new StoreError(path, 'front matter has no `title:`')
	if (!area || !AREAS.includes(area)) {
		throw new StoreError(
			path,
			`front matter has no known \`area:\` (${AREAS.join(', ')}); got ${JSON.stringify(area ?? '')}`,
		)
	}
	if (!status || !STATUSES.includes(status)) {
		throw new StoreError(
			path,
			`front matter has no known \`status:\` (${STATUSES.join(', ')}); got ${JSON.stringify(status ?? '')}`,
		)
	}
	const note = fields.get('note')
	if (status === 'note' && !note)
		throw new StoreError(
			path,
			'status `note` needs a `note:` field with the raw tail',
		)
	const list = (key: string): string[] => {
		const raw = fields.get(key)
		if (!raw) return []
		const inner = /^\[(.*)\]$/.exec(raw)
		if (!inner || inner[1] === undefined)
			throw new StoreError(
				path,
				`\`${key}:\` must be a bracketed list — ${JSON.stringify(raw)}`,
			)
		return inner[1]
			.split(',')
			.map(s => s.trim())
			.filter(Boolean)
	}
	return {
		id,
		title,
		area,
		status,
		note,
		needs: list('needs'),
		gates: list('gates'),
		band: fields.get('band') ?? '',
		body,
		path,
	}
}

export function renderTaskFile(task: QueueTask): string {
	const fields = [
		`id: ${task.id}`,
		`title: ${task.title}`,
		`area: ${task.area}`,
		`status: ${task.status}`,
		...(task.note ? [`note: ${task.note}`] : []),
		`needs: [${task.needs.join(', ')}]`,
		`gates: [${task.gates.join(', ')}]`,
		`band: ${task.band}`,
	]
	return `---\n${fields.join('\n')}\n---\n\n${task.body ? `${task.body}\n` : ''}`
}

// ── The store ─────────────────────────────────────────────────────────────────

export interface Store {
	tasks: Map<string, QueueTask>
	/** queue/BANDS.md, queue/ITERATION.md, queue/LEDGER.md — raw text. */
	bands: string
	iteration: string
	ledger: string
	problems: string[]
}

export function loadStore(root: string): Store {
	const dir = join(root, 'queue')
	const tasks = new Map<string, QueueTask>()
	const problems: string[] = []
	for (const name of readdirSync(dir).sort()) {
		if (!/^LT-\d+\.md$/.test(name)) continue
		const path = join(dir, name)
		try {
			const task = parseTaskFile(readFileSync(path, 'utf8'), `queue/${name}`)
			if (task.id !== name.replace(/\.md$/, '')) {
				problems.push(
					`queue/${name}: front matter id ${task.id} does not match the filename`,
				)
			}
			const existing = tasks.get(task.id)
			if (existing)
				problems.push(
					`${task.id} is stored twice: ${existing.path} and queue/${name}`,
				)
			else tasks.set(task.id, task)
		} catch (e) {
			problems.push(String(e))
		}
	}
	const read = (name: string): string => {
		try {
			return readFileSync(join(dir, name), 'utf8')
		} catch {
			problems.push(`queue/${name} is missing`)
			return ''
		}
	}
	return {
		tasks,
		bands: read('BANDS.md'),
		iteration: read('ITERATION.md'),
		ledger: read('LEDGER.md'),
		problems,
	}
}

// ── Views ─────────────────────────────────────────────────────────────────────

const byIdNumber = (a: QueueTask, b: QueueTask): number =>
	Number(a.id.slice(3)) - Number(b.id.slice(3))

/** `- [x] LT-410: Title — done ✓` — the title line exactly as the markdown queue writes it. */
export function renderTitleLine(task: QueueTask): string {
	const settled =
		task.status === 'pending-review' ||
		task.status === 'done' ||
		task.status === 'reviewed'
	const tail = task.status === 'note' ? task.note : STATUS_TAILS[task.status]
	return `- [${settled ? 'x' : ' '}] ${task.id}: ${task.title}${tail ? ` — ${tail}` : ''}`
}

/** The entry block as it appears in a kanban file (body indented two spaces). */
export function renderEntry(task: QueueTask): string {
	const body = task.body
		? task.body
				.split('\n')
				.map(line => (line.trim() === '' ? '' : `  ${line}`))
				.join('\n')
		: ''
	return body ? `${renderTitleLine(task)}\n${body}` : renderTitleLine(task)
}

const TERMINAL: TaskStatus[] = ['pending-review', 'done', 'reviewed']

/** The chain's bare LT-IDs in pick order: parentheticals, possessive citations and
 * `∥`/`→` structure reduced to one flat sequence per track. */
export function chainOrder(iteration: string): {
	tracks: { name: string; ids: string[] }[]
	closed: Set<string>
} {
	const lines = iteration.split('\n')
	const start = lines.findIndex(l => /^\*\*The chain\.\*\*/.test(l))
	const tracks: { name: string; ids: string[] }[] = []
	const closed = new Set<string>()
	if (start === -1) return { tracks, closed }
	let raw: string | null = null
	let name = ''
	const flush = () => {
		if (raw === null) return
		const rest = raw
		raw = null
		if (/~~\s*LT-\d+/.test(rest)) {
			for (const m of rest.matchAll(/~~\s*(LT-\d+)/g)) if (m[1]) closed.add(m[1])
			return
		}
		let flat = rest
		let prev = ''
		while (flat !== prev) {
			prev = flat
			flat = flat.replace(/\([^()]*\)/g, ' ').replace(/~~.*?~~/g, ' ')
		}
		const ids: string[] = []
		for (const segment of flat.split(/\s*[→∥]\s*/)) {
			for (const m of segment.matchAll(/LT-\d+/g)) {
				const after = segment.slice((m.index ?? 0) + m[0].length)
				if (/^'s|^’s/.test(after) || /^\s+step\s+\d+['’]s/.test(after)) continue
				ids.push(m[0])
			}
		}
		tracks.push({ name, ids })
	}
	for (let i = start + 1; i < lines.length; i++) {
		const line = lines[i] ?? ''
		if (line.trim() === '') continue
		const bullet = /^- \*\*(.+?)\*\*(.*)$/.exec(line)
		if (bullet) {
			flush()
			name = bullet[1] ?? ''
			raw = bullet[2] ?? ''
		} else if (raw !== null && /^\s/.test(line)) {
			raw += ` ${line.trim()}`
		} else break
	}
	flush()
	return { tracks, closed }
}

export function renderBacklog(store: Store): string {
	const chainIds = new Set(
		chainOrder(store.iteration).tracks.flatMap(t => t.ids),
	)
	const open = [...store.tasks.values()]
		.filter(t => !TERMINAL.includes(t.status) && !chainIds.has(t.id))
		.sort(byIdNumber)
	// Insert each band's tasks at the end of its `##` section. A task matches its
	// band by whole-word prefix, so P2 does not swallow a P2b heading.
	const sections = [...store.bands.matchAll(/^## (.+)$/gm)].map(m => m[1] ?? '')
	const inBand = (task: QueueTask, section: string): boolean =>
		Boolean(task.band) &&
		(section === task.band || section.startsWith(`${task.band} `))
	let out = store.bands.replace(/\n?$/, '\n')
	for (const section of sections) {
		const members = open.filter(t => inBand(t, section))
		if (members.length) {
			out = insertUnderHeading(
				out,
				section,
				members.map(renderEntry).join('\n'),
			)
		}
	}
	const unbanded = open.filter(
		t => !sections.some(section => inBand(t, section)),
	)
	if (unbanded.length) {
		out += `\n## Unbanded\n\n${unbanded.map(renderEntry).join('\n')}\n`
	}
	return out
}

function insertUnderHeading(
	markdown: string,
	heading: string,
	block: string,
): string {
	const at = markdown.indexOf(`## ${heading}`)
	if (at === -1) return markdown
	let end = markdown.length
	for (const m of markdown.slice(at + 3).matchAll(/^## /gm)) {
		end = at + 3 + (m.index ?? 0)
		break
	}
	const before = markdown.slice(0, end).replace(/\n?$/, '\n')
	return `${before}\n${block}\n${markdown.slice(end).replace(/^\n+/, '\n')}`
}

export function renderTodo(store: Store): string {
	const marker = '<!-- entries -->'
	const at = store.iteration.indexOf(marker)
	if (at === -1) {
		throw new StoreError(
			'queue/ITERATION.md',
			`has no ${marker} marker for the generated entries`,
		)
	}
	const { tracks } = chainOrder(store.iteration)
	const sections: string[] = []
	for (const track of tracks) {
		const members = track.ids.flatMap(id => {
			const task = store.tasks.get(id)
			return task && !TERMINAL.includes(task.status) ? [task] : []
		})
		if (members.length) {
			sections.push(
				`### ${track.name}\n\n${members.map(renderEntry).join('\n')}`,
			)
		}
	}
	// The TODO view is exactly the chain: an open task the chain does not name is
	// a BACKLOG task and renders there. Store `check` reports misfilings.
	const head = store.iteration.slice(0, at + marker.length)
	return `${head}\n\n${sections.join('\n\n')}\n`
}

export function renderDone(store: Store): string {
	const done = [...store.tasks.values()]
		.filter(t => TERMINAL.includes(t.status))
		.sort(byIdNumber)
	const base = store.ledger.replace(/\n?$/, '\n')
	if (!done.length) return base
	return `${base}\n${done.map(renderEntry).join('\n')}\n`
}

// ── Migration (markdown queue → store) ────────────────────────────────────────

import { mkdirSync, writeFileSync } from 'node:fs'
import { loadState, mentionedIds, parseEntries } from './queue.ts'

const stripEntries = (text: string): string => {
	const { entries } = parseEntries(text, 'BACKLOG.md')
	const lines = text.split('\n')
	const drop = new Set<number>()
	for (const entry of entries) {
		for (let n = entry.startLine; n <= entry.endLine; n++) drop.add(n)
	}
	return lines.filter((_, i) => !drop.has(i + 1)).join('\n')
}

const bandOf = (backlog: string, id: string): string => {
	const at = backlog.indexOf(`- [ ] ${id}:`)
	if (at === -1) return ''
	const before = backlog.slice(0, at)
	const headings = [...before.matchAll(/^## (.+)$/gm)]
	const last = headings[headings.length - 1]
	return last?.[1]?.split(/[\s—]/)[0] ?? ''
}

const toBody = (entryText: string): string =>
	entryText
		.split('\n')
		.slice(1)
		.map(line => (line.startsWith('  ') ? line.slice(2) : line))
		// The machine fields move to front matter; keeping them in the body
		// too would double-render them in the views and invite drift.
		.filter(line => !/^\*\*(Area|Needs|Gates):\*\*/.test(line))
		.join('\n')
		.replace(/^\n+/, '')

/** Split the three markdown queue files into queue/LT-NNN.md task files and seed
 * BANDS.md / ITERATION.md / LEDGER.md from their headers. One-off; the views
 * come out of `build`. */
export function migrateQueue(root: string): {
	written: string[]
	problems: string[]
} {
	const problems: string[] = []
	const written: string[] = []
	const state = loadState(root)
	problems.push(...state.problems)
	const backlog = readFileSync(join(root, 'BACKLOG.md'), 'utf8')
	const todo = readFileSync(join(root, 'TODO.md'), 'utf8')
	const ledger = readFileSync(join(root, 'DONE.md'), 'utf8')

	mkdirSync(join(root, 'queue'), { recursive: true })
	for (const entry of state.entries) {
		// The queue sometimes decorates the area ("design (then compiler)"); the
		// store carries the closed vocabulary and the decoration stays in prose.
		const area = (entry.area ?? '').split(/[\s(]/)[0] ?? ''
		const task: QueueTask = {
			id: entry.id,
			title: entry.title,
			area,
			status:
				entry.suffix === 'other'
					? 'note'
					: entry.suffix === 'changes-requested'
						? 'changes-requested'
						: entry.suffix,
			note: entry.suffixOther,
			needs: entry.needs,
			gates: entry.gates,
			band: entry.file === 'BACKLOG.md' ? bandOf(backlog, entry.id) : '',
			body: toBody(entry.text),
			path: `queue/${entry.id}.md`,
		}
		if (!task.area)
			problems.push(`${entry.id}: no **Area:** line; the store requires one`)
		const path = join(root, 'queue', `${entry.id}.md`)
		writeFileSync(path, renderTaskFile(task))
		written.push(`queue/${entry.id}.md`)
	}

	const todoHeader = todo.slice(0, todo.search(/^-\ \[.\]\ LT-\d+/m))
	writeFileSync(
		join(root, 'queue', 'ITERATION.md'),
		`${todoHeader.replace(/\n+$/, '\n')}\n<!-- entries -->\n`,
	)
	written.push('queue/ITERATION.md')
	writeFileSync(
		join(root, 'queue', 'BANDS.md'),
		stripEntries(backlog).replace(/\n{3,}/g, '\n\n'),
	)
	written.push('queue/BANDS.md')
	writeFileSync(
		join(root, 'queue', 'LEDGER.md'),
		stripEntries(ledger).replace(/\n{3,}/g, '\n\n'),
	)
	written.push('queue/LEDGER.md')
	return { written, problems }
}

/** Regenerate the three kanban views from the store. `outDir` defaults to the
 * repo root (the real build); tests pass a scratch directory. */
export function buildViews(
	root: string,
	outDir: string = root,
): { written: string[]; problems: string[] } {
	const store = loadStore(root)
	const problems = [...store.problems]
	if (problems.length) return { written: [], problems }
	const views: [string, string][] = [
		['BACKLOG.md', renderBacklog(store)],
		['TODO.md', renderTodo(store)],
		['DONE.md', renderDone(store)],
	]
	for (const [name, text] of views) {
		writeFileSync(join(outDir, name), text)
	}
	return { written: views.map(([name]) => name), problems }
}

// ── Store validation (the `check` meaning once queue/ exists) ─────────────────

export function checkStore(root: string): {
	problems: string[]
	notes: string[]
} {
	const store = loadStore(root)
	const problems = [...store.problems]
	const notes: string[] = []
	const ids = new Set(store.tasks.keys())
	const ledgerMentions = mentionedIds(store.ledger)

	for (const task of store.tasks.values()) {
		for (const need of task.needs) {
			if (!ids.has(need) && !ledgerMentions.has(need)) {
				problems.push(
					`${task.id} needs ${need}, which no task file declares or LEDGER.md mentions`,
				)
			}
		}
		if (
			!task.band &&
			task.status === 'open' &&
			!chainOrder(store.iteration).tracks.some(t => t.ids.includes(task.id))
		) {
			notes.push(
				`${task.id} is open, unbanded and unchained — give it a band or a chain position`,
			)
		}
	}
	for (const track of chainOrder(store.iteration).tracks) {
		for (const id of track.ids) {
			if (!ids.has(id) && !ledgerMentions.has(id)) {
				problems.push(
					`The chain names ${id} (${track.name}), which no task file declares or LEDGER.md mentions`,
				)
			}
		}
	}
	let stale: Record<string, string>
	try {
		stale = {
			'BACKLOG.md': renderBacklog(store),
			'TODO.md': renderTodo(store),
			'DONE.md': renderDone(store),
		}
	} catch (e) {
		problems.push(String(e))
		return { problems, notes }
	}
	for (const [name, rendered] of Object.entries(stale)) {
		try {
			const current = readFileSync(join(root, name), 'utf8')
			if (current !== rendered)
				problems.push(
					`${name} is stale against queue/ — run bun run queue:build`,
				)
		} catch {
			problems.push(`${name} is missing — run bun run queue:build`)
		}
	}
	return { problems, notes }
}
