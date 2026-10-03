/**
 * Tests for the queue parser and readiness engine (scripts/lib/queue.ts).
 *
 * The fixtures are miniature queues in the contract format of
 * .agents/skills/architect/references/task-queue.md; the live queue itself is
 * validated by `bun scripts/queue.ts check`, not here, so these tests stay
 * green while the real queue moves.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import {
	annotateTask,
	claimTask,
	extractCitations,
	isSatisfied,
	loadState,
	mentionedIds,
	parseEntries,
	pick,
	type QueueFileName,
	resetTask,
} from '../scripts/lib/queue.ts'
import {
	buildViews,
	checkStore,
	migrateQueue,
	parseTaskFile,
} from '../scripts/lib/queue-store.ts'

// Fixture roots are random sibling directories; a failed earlier run can leave
// them behind, so the suite sweeps them whatever happened mid-run.
afterAll(() => {
	for (const name of readdirSync(import.meta.dir)) {
		if (name.startsWith('.queue-'))
			rmSync(join(import.meta.dir, name), { recursive: true, force: true })
	}
})

// ── helpers ───────────────────────────────────────────────────────────────────

const TODO_HEADER = `# TODO

**The chain.**
- **A — track one** — the first track. LT-100 → LT-101.
- **Design gates** — Area \`design\`: never picked. LT-102 (a design task).
- **B — track two** — the second track. LT-103.
- **Gate zero — closed (abc123).** ~~LT-104~~ (done ✓).
- **C — parallel** — independent work. LT-105, LT-106.

**Next free task ID: LT-107.**

---

`

function stateFrom(files: Partial<Record<QueueFileName, string>>) {
	return loadState('/unused', file => files[file] ?? '')
}

// ── entry parsing ─────────────────────────────────────────────────────────────

describe('parseEntries', () => {
	test('parses every contract suffix', () => {
		const text = [
			'- [ ] LT-1: Open task',
			'  **Area:** compiler',
			'- [ ] LT-2: Claimed task — in progress ⚙',
			'  **Area:** compiler',
			'- [ ] LT-3: Handed off — done, pending review ⏳',
			'- [x] LT-4: Internal change — done ✓',
			'- [ ] LT-5: Under review — changes requested ↩',
			'- [x] LT-6: Approved — reviewed ✓',
			'- [ ] LT-7: Stopped — blocked ⛔',
		].join('\n')
		const { entries, problems } = parseEntries(text, 'TODO.md')
		expect(problems).toEqual([])
		expect(entries.map(e => e.suffix)).toEqual([
			'open',
			'in-progress',
			'pending-review',
			'done',
			'changes-requested',
			'reviewed',
			'blocked',
		])
	})

	test('an unknown tail parses as other and keeps its text', () => {
		const { entries } = parseEntries(
			'- [ ] LT-1: Kept task — rolled back 2026-10-02, deferred',
			'TODO.md',
		)
		expect(entries[0]!.suffix).toBe('other')
		expect(entries[0]!.suffixOther).toBe('rolled back 2026-10-02, deferred')
		expect(entries[0]!.title).toBe('Kept task')
	})

	test('a checkbox line without an LT id is a problem, not a guess', () => {
		const { entries, problems } = parseEntries(
			'- [ ] Fix the thing\n  **Area:** compiler',
			'TODO.md',
		)
		expect(entries).toEqual([])
		expect(problems).toHaveLength(1)
		expect(problems[0]).toContain('does not match the queue entry format')
	})

	test('the body runs to the next entry, heading or rule, and fields are read from it', () => {
		const text = [
			'- [ ] LT-1: First task',
			'  **Area:** compiler',
			'  **Needs:** LT-2, LT-3',
			'  **Gates:** check:sim, test:variants',
			'  **Context:** the body runs',
			'  - even across sub-bullets',
			'',
			'- [x] LT-2: Second — done ✓',
			'  **Area:** server',
			'---',
			'## A heading',
		].join('\n')
		const { entries, problems } = parseEntries(text, 'TODO.md')
		expect(problems).toEqual([])
		expect(entries).toHaveLength(2)
		expect(entries[0]!.needs).toEqual(['LT-2', 'LT-3'])
		expect(entries[0]!.gates).toEqual(['check:sim', 'test:variants'])
		expect(entries[0]!.area).toBe('compiler')
		expect(entries[0]!.text).toContain('even across sub-bullets')
		expect(entries[0]!.text).not.toContain('LT-2: Second')
		expect(entries[1]!.endLine).toBeLessThanOrEqual(10)
	})

	test('a title may contain an em dash when no suffix follows it', () => {
		const { entries } = parseEntries(
			'- [ ] LT-1: Stand up the package — TSX-only',
			'BACKLOG.md',
		)
		expect(entries[0]!.title).toBe('Stand up the package — TSX-only')
		expect(entries[0]!.suffix).toBe('open')
	})
})

// ── chain parsing ─────────────────────────────────────────────────────────────

describe('chain parsing', () => {
	test('arrows, commas, then and and all order a track; parens never contribute', () => {
		const text = `**The chain.**
- **A — reshapes** — before new sources. LT-1 → LT-2, LT-3 (both need LT-9) → LT-4 and then LT-5.
- **Design gates** — do-task never picks them. LT-6 (owner grilling → ADR 0024 amendments).
- **Gate zero — closed (abc).** ~~LT-7~~ (done ✓).
- **B — parallel slot** — independent work. LT-8 ∥ LT-9.

**Next free task ID: LT-10.**
`
		const { chain } = parseChainForTest(text)
		expect(chain).toHaveLength(4)
		expect(chain[0]!.positions.map(p => p.ids)).toEqual([
			['LT-1'],
			['LT-2', 'LT-3'],
			['LT-4', 'LT-5'],
		])
		expect(chain[1]!.positions.map(p => p.ids)).toEqual([['LT-6']])
		expect(chain[2]!.closed).toBe(true)
		expect(chain[3]!.positions.map(p => p.ids)).toEqual([['LT-8'], ['LT-9']])
	})

	test('a possessive reference is a placeholder, not the task', () => {
		const text = `**The chain.**
- **A — port** — LT-1 → LT-2's implementation tasks → LT-3.

**Next free task ID: LT-4.**
`
		const { chain } = parseChainForTest(text)
		expect(chain[0]!.positions.map(p => p.ids)).toEqual([
			['LT-1'],
			[],
			['LT-3'],
		])
	})
})

function parseChainForTest(text: string) {
	const state = stateFrom({ 'TODO.md': text })
	return { chain: state.chain, state }
}

// ── readiness and pick ────────────────────────────────────────────────────────

describe('pick', () => {
	const todo = (entries: string) => `${TODO_HEADER}${entries}`

	test('an inline struck id does not close its track', () => {
		// Track A of the 2026-10-03 iteration strikes LT-371 mid-sequence while
		// LT-373 stays live; the gate-zero track is all-struck and stays closed.
		const state = stateFrom({
			'TODO.md': [
				'# TODO',
				'',
				'**The chain.**',
				'- **A — struck inline** — live past the strike. ~~LT-371~~ (reviewed ✓) → LT-373.',
				'- **Gate zero — closed (abc123).** ~~LT-104~~ (done ✓).',
				'',
				'**Next free task ID: LT-105.**',
				'',
				'---',
				'',
				'- [x] LT-371: Struck mid-sequence — reviewed ✓',
				'  **Area:** compiler',
				'- [ ] LT-373: Live behind the strike',
				'  **Area:** compiler',
			].join('\n'),
			'BACKLOG.md': '# BACKLOG\n',
			'DONE.md': '# DONE\n',
		})
		const decision = pick(state)
		expect(decision.picked).toBe(true)
		expect(decision.task?.id).toBe('LT-373')
	})

	test('picks the first ready task in track order', () => {
		const state = stateFrom({
			'TODO.md': todo(
				[
					'- [ ] LT-100: One',
					'  **Area:** compiler',
					'- [ ] LT-101: Two',
					'  **Area:** compiler',
					'  **Needs:** LT-100',
					'- [ ] LT-103: Three',
					'  **Area:** server',
				].join('\n'),
			),
		})
		const decision = pick(state)
		expect(decision.picked).toBe(true)
		expect(decision.task!.id).toBe('LT-100')
	})

	test('rework comes first, ahead of the chain', () => {
		const state = stateFrom({
			'TODO.md': todo(
				[
					'- [ ] LT-100: Open at the head of the chain',
					'  **Area:** compiler',
					'- [ ] LT-101: Reworked later in the file — changes requested ↩',
					'  **Area:** compiler',
				].join('\n'),
			),
		})
		const decision = pick(state)
		expect(decision.task!.id).toBe('LT-101')
		expect(decision.reason).toContain('rework')
	})

	test('an open task with unsatisfied Needs blocks the rest of its track, not later tracks', () => {
		const state = stateFrom({
			'TODO.md': todo(
				[
					'- [ ] LT-100: Gated',
					'  **Area:** compiler',
					'  **Needs:** LT-101',
					'- [ ] LT-101: Its own prerequisite',
					'  **Area:** compiler',
					'- [ ] LT-103: Second track',
					'  **Area:** server',
				].join('\n'),
			),
			'BACKLOG.md': '- [ ] LT-101: Declared only here\n  **Area:** compiler',
		})
		const decision = pick(state)
		expect(decision.picked).toBe(true)
		expect(decision.task!.id).toBe('LT-103')
	})

	test('a claimed task blocks the rest of its track', () => {
		const state = stateFrom({
			'TODO.md': todo(
				[
					'- [ ] LT-100: Claimed — in progress ⚙',
					'  **Area:** compiler',
					'- [ ] LT-101: Next in track',
					'  **Area:** compiler',
					'- [ ] LT-103: Second track',
					'  **Area:** server',
				].join('\n'),
			),
		})
		const decision = pick(state)
		expect(decision.picked).toBe(true)
		expect(decision.task!.id).toBe('LT-103')
	})

	test('design tasks neither pick nor block; blocked tasks do not block; done tasks unblock', () => {
		const state = stateFrom({
			'TODO.md': todo(
				[
					'- [ ] LT-102: A design task',
					'  **Area:** design',
					'- [ ] LT-101: Blocked — blocked ⛔',
					'  **Area:** compiler',
					'- [x] LT-105: Already done — done ✓',
					'  **Area:** compiler',
					'- [ ] LT-106: Ready behind all of that',
					'  **Area:** compiler',
				].join('\n'),
			),
		})
		const decision = pick(state)
		expect(decision.picked).toBe(true)
		expect(decision.task!.id).toBe('LT-106')
	})

	test('a Needs prerequisite is satisfied by pending review, reviewed or a DONE mention', () => {
		const state = stateFrom({
			'TODO.md': todo(
				[
					'- [ ] LT-100: Gated three ways',
					'  **Area:** compiler',
					'  **Needs:** LT-101, LT-103, LT-104',
					'- [ ] LT-101: Pending — done, pending review ⏳',
					'  **Area:** compiler',
					'- [x] LT-103: Reviewed already — reviewed ✓',
					'  **Area:** compiler',
				].join('\n'),
			),
			'DONE.md': 'Compacted: LT-227–LT-232 and LT-104 landed.',
		})
		expect(isSatisfied('LT-229', state)).toBe(true)
		const decision = pick(state)
		expect(decision.picked).toBe(true)
		expect(decision.task!.id).toBe('LT-100')
	})

	test('a placeholder position neither picks nor blocks', () => {
		const text = `**The chain.**
- **A — port** — LT-100 → LT-101's implementation tasks → LT-103.

**Next free task ID: LT-104.**

---

- [x] LT-100: One — done ✓
  **Area:** compiler
- [ ] LT-103: Three
  **Area:** server
`
		const state = stateFrom({ 'TODO.md': text })
		const decision = pick(state)
		expect(decision.task!.id).toBe('LT-103')
	})

	test('an other-suffix task stands where the track is and blocks it', () => {
		const state = stateFrom({
			'TODO.md': todo(
				[
					'- [ ] LT-100: Rolled back — rolled back 2026-10-02',
					'  **Area:** compiler',
					'- [ ] LT-101: Behind it',
					'  **Area:** compiler',
					'- [ ] LT-103: Second track',
					'  **Area:** server',
				].join('\n'),
			),
		})
		const decision = pick(state)
		expect(decision.picked).toBe(true)
		expect(decision.task!.id).toBe('LT-103')
	})

	test('with nothing open the pick stops and says the iteration needs planning', () => {
		const state = stateFrom({
			'TODO.md': todo('- [x] LT-100: Done — done ✓\n  **Area:** compiler'),
		})
		const decision = pick(state)
		expect(decision.picked).toBe(false)
		expect(decision.reason).toContain('needs planning')
	})
})

// ── check findings ────────────────────────────────────────────────────────────

describe('loadState findings', () => {
	test('duplicate ids, unresolved needs and a stale next-free id are problems', () => {
		const state = stateFrom({
			'TODO.md': `${TODO_HEADER}- [ ] LT-100: One\n  **Area:** compiler\n  **Needs:** LT-999\n- [ ] LT-100: Twin\n  **Area:** compiler`,
		})
		expect(
			state.problems.some(p => p.includes('LT-100 is declared twice')),
		).toBe(true)
		expect(state.problems.some(p => p.includes('LT-100 needs LT-999'))).toBe(
			true,
		)
		expect(state.problems.some(p => p.includes('does not exceed'))).toBe(false)
	})

	test('the next free id must exceed every declared id', () => {
		const text = `**Next free task ID: LT-104.**

- [ ] LT-104: One
  **Area:** compiler
`
		const state = stateFrom({ 'TODO.md': text })
		expect(
			state.problems.some(p =>
				p.includes('does not exceed the highest declared ID LT-104'),
			),
		).toBe(true)
	})

	test('checkbox and status must agree; an unresolved chain id is a problem; an unchained open entry is a note', () => {
		const text = `**The chain.**
- **A — one** — LT-100 → LT-404.

**Next free task ID: LT-102.**

---

- [x] LT-100: Marked done but open\n  **Area:** compiler
- [ ] LT-101: Outside the chain\n  **Area:** compiler
`
		const state = stateFrom({ 'TODO.md': text })
		expect(
			state.problems.some(p => p.includes('LT-100: checkbox [x] disagrees')),
		).toBe(true)
		expect(state.problems.some(p => p.includes('The chain names LT-404'))).toBe(
			true,
		)
		expect(
			state.notes.some(n =>
				n.includes('LT-101 is open in TODO.md but the chain does not name it'),
			),
		).toBe(true)
	})
})

// ── mentions and citations ────────────────────────────────────────────────────

describe('mentionedIds', () => {
	test('expands DONE.md compaction ranges in both spellings', () => {
		const ids = mentionedIds(
			'Consumed: LT-227–LT-229, LT-394-LT-395, and LT-243 alone.',
		)
		expect(ids.has('LT-227')).toBe(true)
		expect(ids.has('LT-228')).toBe(true)
		expect(ids.has('LT-229')).toBe(true)
		expect(ids.has('LT-394')).toBe(true)
		expect(ids.has('LT-395')).toBe(true)
		expect(ids.has('LT-243')).toBe(true)
		expect(ids.has('LT-230')).toBe(false)
	})
})

describe('extractCitations', () => {
	test('collects ADRs by link and mention, living docs and source paths', () => {
		const citations = extractCitations(
			'See [ADR 0043](adr/0043-the-target-emitter-interface.md) and ADR 0034 s8; HOST_PROFILE.md bullet 6; the fold lives in server/compiler/fold-inputs.ts.',
		)
		expect(citations).toContain('adr/0043')
		expect(citations).toContain('adr/0034')
		expect(citations).toContain('HOST_PROFILE.md')
		expect(citations).toContain('server/compiler/fold-inputs.ts')
	})
})

// ── write operations (against a temp copy, never the live queue) ─────────────

describe('claimTask / annotateTask / resetTask', () => {
	function queueDir(files: Record<string, string>): string {
		const root = join(
			import.meta.dir,
			`.queue-fixture-${Math.floor(Math.random() * 1e9)}`,
		)
		mkdirSync(root, { recursive: true })
		for (const [name, text] of Object.entries(files))
			writeFileSync(join(root, name), text)
		return root
	}

	const base = () => ({
		'TODO.md': `${TODO_HEADER}- [ ] LT-100: The work\n  **Area:** compiler\n  **Context:** do the thing.\n- [ ] LT-101: The rework — changes requested ↩\n  **Area:** compiler\n  **Review:** (1) a finding.\n`,
		'BACKLOG.md': '',
		// The chain names LT-102–LT-106; the compaction record satisfies the reference check.
		'DONE.md': 'Compacted: LT-102–LT-106 landed.\n',
		'NOTES.md':
			'# NOTES\n\nDeviation notes, newest first.\n\n---\n\nOld note stays.\n',
	})

	test('claim flips an open entry to in progress and back', () => {
		const root = queueDir(base())
		expect(claimTask(root, 'LT-100').ok).toBe(true)
		let todo = readFileSync(join(root, 'TODO.md'), 'utf8')
		expect(todo).toContain('- [ ] LT-100: The work — in progress ⚙')
		expect(resetTask(root, 'LT-100').ok).toBe(true)
		todo = readFileSync(join(root, 'TODO.md'), 'utf8')
		expect(todo).toContain('- [ ] LT-100: The work\n')
		expect(todo).not.toContain('in progress')
		rmSync(root, { recursive: true, force: true })
	})

	test('claim rework replaces the changes-requested suffix', () => {
		const root = queueDir(base())
		expect(claimTask(root, 'LT-101').ok).toBe(true)
		const todo = readFileSync(join(root, 'TODO.md'), 'utf8')
		expect(todo).toContain('- [ ] LT-101: The rework — in progress ⚙')
		expect(todo).not.toContain('changes requested')
		rmSync(root, { recursive: true, force: true })
	})

	test('claim refuses a done entry and an unknown id', () => {
		const root = queueDir(base())
		expect(claimTask(root, 'LT-102').ok).toBe(false)
		annotateTaskWrapper(root)
		expect(claimTask(root, 'LT-100').ok).toBe(false)
		rmSync(root, { recursive: true, force: true })
	})

	function annotateTaskWrapper(root: string) {
		claimTask(root, 'LT-100')
		annotateTask(root, 'LT-100', 'done', '  **Changed:** the thing.')
	}

	test('annotate done flips the checkbox, writes the suffix and inserts the prose', () => {
		const root = queueDir(base())
		claimTask(root, 'LT-100')
		expect(
			annotateTask(
				root,
				'LT-100',
				'done',
				'  **Changed:** `src/x.ts` — the thing.',
			),
		).toEqual({ ok: true })
		const todo = readFileSync(join(root, 'TODO.md'), 'utf8')
		expect(todo).toContain('- [x] LT-100: The work — done ✓')
		expect(todo).toContain('  **Changed:** `src/x.ts` — the thing.')
		// The prose lands inside LT-100's block, before LT-101's title line.
		const lt100 = todo.indexOf('- [x] LT-100: The work')
		const prose = todo.indexOf('**Changed:**')
		const lt101 = todo.indexOf('- [ ] LT-101: The rework')
		expect(lt100 < prose && prose < lt101).toBe(true)
		// The queue still parses clean.
		const state = loadState(root)
		expect(state.problems).toEqual([])
		rmSync(root, { recursive: true, force: true })
	})

	test('annotate pending-review carries the handoff shape', () => {
		const root = queueDir(base())
		claimTask(root, 'LT-100')
		const prose = [
			'  **Changed:** `server/compiler/x.ts`.',
			'  **How:** the approach.',
			'  **Check:** where the reviewer should look.',
		].join('\n')
		expect(annotateTask(root, 'LT-100', 'pending-review', prose).ok).toBe(true)
		const todo = readFileSync(join(root, 'TODO.md'), 'utf8')
		expect(todo).toContain('- [x] LT-100: The work — done, pending review ⏳')
		expect(todo).toContain('**Check:** where the reviewer should look.')
		rmSync(root, { recursive: true, force: true })
	})

	test('annotate blocked writes a NOTES.md entry below the separator and leaves the checkbox open', () => {
		const root = queueDir(base())
		claimTask(root, 'LT-100')
		const prose =
			'**LT-100 — Blocked (compiler).**\n**Date:** 2026-10-03 | **Area:** compiler\n**Issue:** The decision the task does not contain.\n'
		expect(annotateTask(root, 'LT-100', 'blocked', prose).ok).toBe(true)
		const notes = readFileSync(join(root, 'NOTES.md'), 'utf8')
		expect(notes.indexOf('LT-100')).toBeLessThan(
			notes.indexOf('Old note stays.'),
		)
		const todo = readFileSync(join(root, 'TODO.md'), 'utf8')
		expect(todo).toContain('- [ ] LT-100: The work — blocked ⛔')
		rmSync(root, { recursive: true, force: true })
	})

	test('annotate refuses an entry that was never claimed', () => {
		const root = queueDir(base())
		expect(annotateTask(root, 'LT-100', 'done', '  **Changed:** x.').ok).toBe(
			false,
		)
		rmSync(root, { recursive: true, force: true })
	})
})

// ── the store: migrate the markdown queue, build the views ───────────────────

describe('queue store (migrate → build)', () => {
	function repo(files: Record<string, string>): string {
		const root = join(
			import.meta.dir,
			`.queue-store-${Math.floor(Math.random() * 1e9)}`,
		)
		mkdirSync(root, { recursive: true })
		for (const [name, text] of Object.entries(files))
			writeFileSync(join(root, name), text)
		return root
	}

	const fixture = () => ({
		'BACKLOG.md': `# BACKLOG

Everything planned out of iteration scope.

## P1 — The release track

The release-gating band.

- [ ] LT-201: Stand up the package
  **Area:** compiler
  **Needs:** LT-202
  **Context:** ship it.

## P2b — Follow-ups

- [ ] LT-205: A follow-up
  **Area:** server
  **Context:** later.
`,
		'TODO.md': `# TODO

**The chain.**
- **A — reshapes** — first. LT-202 → LT-203.
- **B — port** — second. LT-204.

**Next free task ID: LT-206.**

---

- [x] LT-202: The reshapes — reviewed ✓
  **Area:** compiler
  **Changed:** did it.
- [ ] LT-203: The next reshape
  **Area:** compiler
  **Needs:** LT-202
  **Context:** carry on.
- [ ] LT-204: The port
  **Area:** examples
  **Needs:** LT-203
  **Context:** migrate it.
`,
		'DONE.md': 'Compacted: LT-199–LT-200 landed.\n',
		'NOTES.md': '# NOTES\n\n---\n',
	})

	test('migrate splits task files with front matter and strips the headers', () => {
		const root = repo(fixture())
		const { written, problems } = migrateQueue(root)
		expect(problems).toEqual([])
		expect(written.filter(w => /^queue\/LT-/.test(w))).toHaveLength(5)
		const lt203 = parseTaskFile(
			readFileSync(join(root, 'queue/LT-203.md'), 'utf8'),
			'queue/LT-203.md',
		)
		expect(lt203.id).toBe('LT-203')
		expect(lt203.title).toBe('The next reshape')
		expect(lt203.area).toBe('compiler')
		expect(lt203.status).toBe('open')
		expect(lt203.needs).toEqual(['LT-202'])
		expect(lt203.band).toBe('') // TODO entries carry no band
		expect(lt203.body).toBe('**Context:** carry on.')
		const lt201 = parseTaskFile(
			readFileSync(join(root, 'queue/LT-201.md'), 'utf8'),
			'queue/LT-201.md',
		)
		expect(lt201.band).toBe('P1')
		const bands = readFileSync(join(root, 'queue/BANDS.md'), 'utf8')
		expect(bands).toContain('## P1 — The release track')
		expect(bands).not.toContain('LT-201')
		expect(existsSync(join(root, 'queue/ITERATION.md'))).toBe(true)
		rmSync(root, { recursive: true, force: true })
	})

	test('build regenerates the three views from the store', () => {
		const root = repo(fixture())
		migrateQueue(root)
		const { problems } = buildViews(root)
		expect(problems).toEqual([])
		const backlog = readFileSync(join(root, 'BACKLOG.md'), 'utf8')
		expect(backlog).toContain('## P1 — The release track')
		expect(backlog).toContain('- [ ] LT-201: Stand up the package')
		// P2b stays intact next to P2-family headings.
		expect(backlog).toContain('## P2b — Follow-ups')
		expect(backlog).toContain('- [ ] LT-205: A follow-up')
		// The iteration's open tasks render under their chain tracks; the
		// reviewed one does not (it belongs to DONE).
		const todo = readFileSync(join(root, 'TODO.md'), 'utf8')
		expect(todo).toContain('### A — reshapes')
		expect(todo).toContain('- [ ] LT-203: The next reshape')
		expect(todo).toContain('### B — port')
		expect(todo).not.toContain('- [x] LT-202: The reshapes')
		const done = readFileSync(join(root, 'DONE.md'), 'utf8')
		expect(done).toContain('- [x] LT-202: The reshapes — reviewed ✓')
		expect(done).toContain('**Changed:** did it.')
		rmSync(root, { recursive: true, force: true })
	})

	test('build fails loudly on a malformed task file', () => {
		const root = repo(fixture())
		migrateQueue(root)
		writeFileSync(join(root, 'queue/LT-299.md'), 'no front matter\n')
		const { problems } = buildViews(root)
		expect(problems.some(p => p.includes('LT-299'))).toBe(true)
		rmSync(root, { recursive: true, force: true })
	})
})

describe('checkStore', () => {
	function stored(): string {
		const root = join(
			import.meta.dir,
			`.queue-check-${Math.floor(Math.random() * 1e9)}`,
		)
		mkdirSync(root, { recursive: true })
		writeFileSync(
			join(root, 'BACKLOG.md'),
			'# B\n\n## P1 — band\n\n- [ ] LT-201: Stand up\n  **Area:** compiler\n  **Needs:** LT-999\n  **Context:** x.\n',
		)
		writeFileSync(
			join(root, 'TODO.md'),
			'# T\n\n**The chain.**\n- **A — one** — LT-202 → LT-404.\n\n**Next free task ID: LT-203.**\n\n---\n\n- [ ] LT-202: The task\n  **Area:** compiler\n  **Context:** x.\n',
		)
		writeFileSync(join(root, 'DONE.md'), 'Compacted: LT-199–LT-200 landed.\n')
		return root
	}

	test('reports unknown needs and chain references, then goes green after build', () => {
		const root = stored()
		migrateQueue(root)
		const before = checkStore(root)
		expect(before.problems.some(p => p.includes('LT-201 needs LT-999'))).toBe(
			true,
		)
		expect(
			before.problems.some(p => p.includes('The chain names LT-404')),
		).toBe(true)
		expect(before.problems.some(p => p.includes('stale'))).toBe(true)
		buildViews(root)
		const after = checkStore(root)
		// LT-999 is still unknown; LT-404 is still unknown; views now fresh.
		expect(after.problems.some(p => p.includes('stale'))).toBe(false)
		expect(after.problems.some(p => p.includes('LT-201 needs LT-999'))).toBe(
			true,
		)
		rmSync(root, { recursive: true, force: true })
	})

	test('a LEDGER mention satisfies a need and a chain reference', () => {
		const root = stored()
		migrateQueue(root)
		const ledger = readFileSync(join(root, 'queue/LEDGER.md'), 'utf8')
		writeFileSync(
			join(root, 'queue/LEDGER.md'),
			`${ledger}\nCompacted: LT-999 and LT-404 landed.\n`,
		)
		buildViews(root)
		const { problems } = checkStore(root)
		expect(problems.some(p => p.includes('LT-999'))).toBe(false)
		expect(problems.some(p => p.includes('LT-404'))).toBe(false)
		rmSync(root, { recursive: true, force: true })
	})
})
