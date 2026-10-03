/**
 * Tests for the queue store's pick and write operations
 * (scripts/lib/queue-store.ts → pickStore/claimTaskStore/annotateTaskStore/
 * resetTaskStore) — the do-task contract in its store dialect. The views must
 * come out of every write fresh, because `check` compares them byte for byte.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import {
	annotateTaskStore,
	buildViews,
	chainOrder,
	checkStore,
	claimTaskStore,
	pickByIdStore,
	pickStore,
	type QueueTask,
	renderTaskFile,
	resetTaskStore,
} from '../scripts/lib/queue-store.ts'

afterAll(() => {
	for (const name of readdirSync(import.meta.dir)) {
		if (name.startsWith('.queue-store-'))
			rmSync(join(import.meta.dir, name), { recursive: true, force: true })
	}
})

// ── fixture ───────────────────────────────────────────────────────────────────

let seq = 0

const ITERATION = `# TODO

**The chain.**
- **A — track one** — the first track. LT-200 → LT-201.
- **B — track two** — the second track. LT-202.
- **D — design** — needs the Architect. LT-203.

**Next free task ID: LT-204.**

<!-- entries -->
`

const task = (over: Partial<QueueTask> & { id: string }): QueueTask => ({
	title: `Task ${over.id}`,
	area: 'compiler',
	status: 'open',
	needs: [],
	gates: [],
	band: '',
	body: `**Context:** Do ${over.id}.`,
	...over,
	path: `queue/${over.id}.md`,
})

/** A store root with the standard chain (LT-200 → LT-201, LT-202, LT-203
 * design) and whatever task overrides each test passes. Every chain-named task
 * gets a file — checkStore treats a dangling chain name as a problem — so a
 * test only names the tasks whose overrides matter. */
const CHAIN_IDS = ['LT-200', 'LT-201', 'LT-202', 'LT-203']

function storeFrom(
	tasks: (Partial<QueueTask> & { id: string })[],
	ledger = '# DONE\n\nCompacted records live here.\n',
): string {
	const root = join(import.meta.dir, `.queue-store-${++seq}`)
	mkdirSync(join(root, 'queue'), { recursive: true })
	const given = new Map(tasks.map(t => [t.id, t]))
	const all: (Partial<QueueTask> & { id: string })[] = CHAIN_IDS.map(
		id =>
			given.get(id) ??
			(id === 'LT-203' ? { id, area: 'design' as const } : { id }),
	)
	for (const t of tasks) if (!CHAIN_IDS.includes(t.id)) all.push(t)
	for (const t of all)
		writeFileSync(join(root, 'queue', `${t.id}.md`), renderTaskFile(task(t)))
	writeFileSync(join(root, 'queue', 'ITERATION.md'), ITERATION)
	writeFileSync(
		join(root, 'queue', 'BANDS.md'),
		'# BACKLOG\n\nEverything planned but out of iteration scope.\n\n## P1\n\nNext-up work.\n',
	)
	writeFileSync(join(root, 'queue', 'LEDGER.md'), ledger)
	writeFileSync(join(root, 'NOTES.md'), '# NOTES\n\n---\n\n')
	const built = buildViews(root)
	expect(built.problems).toEqual([])
	return root
}

const statuses = (root: string): Record<string, string> => {
	const out: Record<string, string> = {}
	for (const name of readdirSync(join(root, 'queue')).sort()) {
		if (!/^LT-\d+\.md$/.test(name)) continue
		const text = readFileSync(join(root, 'queue', name), 'utf8')
		out[name.replace(/\.md$/, '')] = /^status: (.+)$/m.exec(text)?.[1] ?? ''
	}
	return out
}

// ── pick ──────────────────────────────────────────────────────────────────────

describe('pickStore', () => {
	test('picks the first ready chain task', () => {
		const root = storeFrom([
			{ id: 'LT-200' },
			{ id: 'LT-201' },
			{ id: 'LT-202' },
		])
		const p = pickStore(root)
		expect(p.picked).toBe(true)
		expect(p.task?.id).toBe('LT-200')
		expect(p.reason).toContain('track "A — track one"')
	})

	test('a claimed task stalls its track and the scan falls through', () => {
		const root = storeFrom([
			{ id: 'LT-200', status: 'in-progress' },
			{ id: 'LT-201' },
			{ id: 'LT-202' },
		])
		const p = pickStore(root)
		expect(p.picked).toBe(true)
		expect(p.task?.id).toBe('LT-202')
		expect(p.reason).toContain('track "B — track two"')
	})

	test('rework is picked before everything, in chain order', () => {
		const root = storeFrom([
			{ id: 'LT-200' },
			{ id: 'LT-201', status: 'changes-requested' },
			{ id: 'LT-202' },
		])
		const p = pickStore(root)
		expect(p.task?.id).toBe('LT-201')
		expect(p.reason).toContain('rework')
	})

	test('blocked tasks never stall their track', () => {
		const root = storeFrom([
			{ id: 'LT-200', status: 'blocked' },
			{ id: 'LT-201' },
			{ id: 'LT-202' },
		])
		expect(pickStore(root).task?.id).toBe('LT-201')
	})

	test('satisfied statuses never stall their track', () => {
		// changes-requested is satisfying for Needs but is rework, so it picks
		// first instead of letting the track pass — covered by the rework test.
		for (const status of ['pending-review', 'done', 'reviewed'] as const) {
			const root = storeFrom([{ id: 'LT-200', status }, { id: 'LT-201' }])
			expect(pickStore(root).task?.id).toBe('LT-201')
		}
	})

	test('unsatisfied needs stall', () => {
		const root = storeFrom([
			{ id: 'LT-200', needs: ['LT-199'] },
			{ id: 'LT-202' },
		])
		const p = pickStore(root)
		expect(p.task?.id).toBe('LT-202')
	})

	test('a LEDGER mention satisfies a compacted need', () => {
		const root = storeFrom(
			[{ id: 'LT-200', needs: ['LT-199'] }, { id: 'LT-201' }],
			'# DONE\n\nLT-199 was compacted into the changelog.\n',
		)
		expect(pickStore(root).task?.id).toBe('LT-200')
	})

	test('design tasks are never picked', () => {
		// The other chain tasks are settled so LT-203 design stands first.
		const root = storeFrom([
			{ id: 'LT-200', status: 'done' },
			{ id: 'LT-201', status: 'done' },
			{ id: 'LT-202', status: 'done' },
			{ id: 'LT-203', area: 'design' },
		])
		const p = pickStore(root)
		expect(p.picked).toBe(false)
	})

	test('an invalid store refuses to pick', () => {
		const root = storeFrom([{ id: 'LT-200' }])
		writeFileSync(join(root, 'queue', 'LT-201.md'), 'no front matter\n')
		const p = pickStore(root)
		expect(p.picked).toBe(false)
		expect(p.reason).toContain('the store is invalid')
	})
})

describe('pickByIdStore', () => {
	test('a named ready task picks regardless of chain position', () => {
		const root = storeFrom([{ id: 'LT-200' }, { id: 'LT-201' }])
		const p = pickByIdStore('LT-201', root)
		expect(p.picked).toBe(true)
		expect(p.task?.id).toBe('LT-201')
	})

	test('an unchained task is refused as BACKLOG', () => {
		const root = storeFrom([{ id: 'LT-200' }, { id: 'LT-205', band: 'P1' }])
		const p = pickByIdStore('LT-205', root)
		expect(p.picked).toBe(false)
		expect(p.reason).toContain('BACKLOG')
	})

	test('rework picks by name', () => {
		const root = storeFrom([{ id: 'LT-200', status: 'changes-requested' }])
		expect(pickByIdStore('LT-200', root).picked).toBe(true)
	})
})

// ── writes ────────────────────────────────────────────────────────────────────

describe('store writes', () => {
	test('claim flips to in-progress and rebuilds the views', () => {
		const root = storeFrom([{ id: 'LT-200' }, { id: 'LT-202' }])
		expect(claimTaskStore(root, 'LT-200')).toEqual({ ok: true })
		expect(statuses(root)['LT-200']).toBe('in-progress')
		const todo = readFileSync(join(root, 'TODO.md'), 'utf8')
		expect(todo).toContain('in progress ⚙')
		expect(checkStore(root).problems).toEqual([])
	})

	test('claim refuses an already-claimed task', () => {
		const root = storeFrom([{ id: 'LT-200', status: 'in-progress' }])
		const r = claimTaskStore(root, 'LT-200')
		expect(r.ok).toBe(false)
		expect(r.error).toContain('claimable')
	})

	test('claim refuses an unchained task', () => {
		const root = storeFrom([{ id: 'LT-205', band: 'P1' }])
		const r = claimTaskStore(root, 'LT-205')
		expect(r.ok).toBe(false)
		expect(r.error).toContain('chain')
	})

	test('annotate appends prose and flips to pending-review', () => {
		const root = storeFrom([{ id: 'LT-200' }])
		claimTaskStore(root, 'LT-200')
		const r = annotateTaskStore(
			root,
			'LT-200',
			'pending-review',
			'**Changed:** src/x.ts\n**How:** Straightforwardly.\n**Check:** the new pin.',
		)
		expect(r).toEqual({ ok: true })
		expect(statuses(root)['LT-200']).toBe('pending-review')
		const file = readFileSync(join(root, 'queue', 'LT-200.md'), 'utf8')
		expect(file).toContain('**Check:** the new pin.')
		expect(checkStore(root).problems).toEqual([])
		// pending-review is a terminal status: the task's view moves to DONE.md,
		// where the Architect reviews it — TODO renders only open work.
		const todo = readFileSync(join(root, 'TODO.md'), 'utf8')
		expect(todo).not.toContain('LT-200: Task LT-200')
		const done = readFileSync(join(root, 'DONE.md'), 'utf8')
		expect(done).toContain('- [x] LT-200:')
	})

	test('annotate refuses a task that is not claimed', () => {
		const root = storeFrom([{ id: 'LT-200' }])
		const r = annotateTaskStore(root, 'LT-200', 'done', '**Changed:** x')
		expect(r.ok).toBe(false)
		expect(r.error).toContain('claimed')
	})

	test('annotate blocked writes a NOTES.md entry and keeps the checkbox open', () => {
		const root = storeFrom([{ id: 'LT-200' }])
		claimTaskStore(root, 'LT-200')
		const r = annotateTaskStore(
			root,
			'LT-200',
			'blocked',
			'## LT-200 — Blocked\n**Date:** 2026-10-03 | **Area:** compiler\n**Issue:** needs a ruling.',
		)
		expect(r).toEqual({ ok: true })
		expect(statuses(root)['LT-200']).toBe('blocked')
		const notes = readFileSync(join(root, 'NOTES.md'), 'utf8')
		expect(notes).toContain('needs a ruling')
		const todo = readFileSync(join(root, 'TODO.md'), 'utf8')
		expect(todo).toContain('- [ ] LT-200:')
		expect(todo).toContain('blocked ⛔')
	})

	test('reset returns a claimed task to open and refuses the rest', () => {
		const root = storeFrom([{ id: 'LT-200' }, { id: 'LT-202' }])
		claimTaskStore(root, 'LT-200')
		expect(resetTaskStore(root, 'LT-200')).toEqual({ ok: true })
		expect(statuses(root)['LT-200']).toBe('open')
		const r = resetTaskStore(root, 'LT-202')
		expect(r.ok).toBe(false)
	})

	test('a write keeps the whole cycle green: claim, annotate, re-pick', () => {
		const root = storeFrom([
			{ id: 'LT-200' },
			{ id: 'LT-201' },
			{ id: 'LT-202' },
		])
		claimTaskStore(root, 'LT-200')
		annotateTaskStore(root, 'LT-200', 'done', '**Changed:** one line.')
		expect(pickStore(root).task?.id).toBe('LT-201')
		expect(checkStore(root).problems).toEqual([])
	})
})

describe('chainOrder', () => {
	test('reads the ITERATION chain into ordered tracks', () => {
		const root = storeFrom([{ id: 'LT-200' }])
		const { tracks } = chainOrder(
			readFileSync(join(root, 'queue', 'ITERATION.md'), 'utf8'),
		)
		expect(tracks.map(t => t.name)).toEqual([
			'A — track one',
			'B — track two',
			'D — design',
		])
		expect(tracks[0]?.ids).toEqual(['LT-200', 'LT-201'])
	})

	test('an inline struck id does not close its track', () => {
		// The live chain strikes LT-371 mid-sequence in track A while LT-375,
		// LT-373 and LT-387 stay live; only an all-struck track is closed.
		const { tracks, closed } = chainOrder(
			[
				'**The chain.**',
				'- **Gate zero — closed 2026-10-02.** ~~LT-335~~ (done ✓) and ~~LT-370~~ (reviewed ✓).',
				'- **A — struck inline** — live past the strike. ~~LT-371~~ (reviewed ✓) → LT-375 → LT-373.',
			].join('\n'),
		)
		expect(closed.has('LT-371')).toBe(true)
		expect(tracks.map(t => t.name)).toEqual(['A — struck inline'])
		expect(tracks[0]?.ids).toEqual(['LT-375', 'LT-373'])
	})
})
