/**
 * Unit / Integration Tests for file-watcher.ts
 *
 * Tests for watchFiles: initial scan, glob filtering, and — critically —
 * the debounced batch update that prevents N downstream effect re-runs
 * when N files change at once (e.g. after a TypeDoc regeneration burst).
 *
 * File-system watching is disabled automatically when PLAYWRIGHT is set.
 * These tests write real files to a temp directory, so they are integration
 * tests. On a healthy machine they stay in the low hundreds of ms; the
 * debounce tests budget up to 20 s so a loaded CI runner cannot flake them
 * (see their comments).
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createEffect } from '@zeix/cause-effect'
import { watchFiles } from '../file-watcher'
import { retryUntil } from './helpers/test-utils'

/* === Helpers === */

async function writeTempFile(
	dir: string,
	name: string,
	content = 'content',
): Promise<string> {
	const path = join(dir, name)
	await writeFile(path, content)
	return path
}

/* === §13 watchFiles — initial scan === */

describe('watchFiles — initial scan', () => {
	let dir: string

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'le-truc-fw-'))
	})

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true })
	})

	test('returns a List with all matching files', async () => {
		await writeTempFile(dir, 'a.md')
		await writeTempFile(dir, 'b.md')
		await writeTempFile(dir, 'c.txt') // should be excluded

		const list = await watchFiles(dir, '*.md')
		expect(list.get().length).toBe(2)
	})

	test('returns empty list for empty directory', async () => {
		const list = await watchFiles(dir, '*.md')
		expect(list.get().length).toBe(0)
	})

	test('returns empty list for non-existent directory', async () => {
		const list = await watchFiles(join(dir, 'nonexistent'), '*.md')
		expect(list.get().length).toBe(0)
	})

	test('respects exclude glob', async () => {
		await mkdir(join(dir, 'mocks'))
		await writeTempFile(dir, 'widget.html')
		await writeTempFile(join(dir, 'mocks'), 'mock.html')

		const list = await watchFiles(dir, '**/*.html', '**/mocks/**')
		const paths = list.get().map(f => f.filename)
		expect(paths).toContain('widget.html')
		expect(paths).not.toContain('mock.html')
	})

	test('each FileInfo has path, filename, content, hash, and exists=true', async () => {
		await writeTempFile(dir, 'test.md', '# Hello')

		const list = await watchFiles(dir, '*.md')
		const file = list.get()[0]!

		expect(file.path).toContain('test.md')
		expect(file.filename).toBe('test.md')
		expect(file.content).toBe('# Hello')
		expect(file.hash).toMatch(/^[a-f0-9]{16}$/)
		expect(file.exists).toBe(true)
	})

	test('supports recursive glob **/*.md', async () => {
		await mkdir(join(dir, 'sub'))
		await writeTempFile(dir, 'root.md')
		await writeTempFile(join(dir, 'sub'), 'nested.md')

		const list = await watchFiles(dir, '**/*.md')
		expect(list.get().length).toBe(2)
	})
})

/* === Batching: rapid multi-file changes trigger only one effect run === */

describe('watchFiles — debounced batch updates', () => {
	let dir: string

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'le-truc-fw-batch-'))
		// Ensure PLAYWRIGHT is not set so the watcher actually starts
		delete process.env.PLAYWRIGHT
	})

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true })
	})

	test('writing N files rapidly causes the list to contain all N files', async () => {
		const list = await watchFiles(dir, '*.md')

		// Activate the watcher by subscribing with an effect
		let observed = 0
		const stopEffect = createEffect(() => {
			observed = list.get().length
		})

		expect(observed).toBe(0)

		// Simulate a burst: write 5 files almost simultaneously
		const N = 5
		await Promise.all(
			Array.from({ length: N }, (_, i) =>
				writeTempFile(dir, `file${i}.md`, `content ${i}`),
			),
		)

		// Debounce is 50 ms, but real fs event delivery is not: under load,
		// macOS can lag the watch() arming (dropping pre-arm events) or stall
		// delivery for many seconds. Poll with exponential backoff AND re-kick
		// the watcher about once a second — the flush rescans the whole
		// directory, so ONE delivered post-arm event recovers the entire
		// burst. A genuinely dead watcher still fails at the budget.
		let lastKick = 0
		await retryUntil(
			() => {
				if (Date.now() - lastKick > 1000) {
					lastKick = Date.now()
					return writeTempFile(dir, 'file0.md', `content 0 ${lastKick}`).then(
						() => observed,
					)
				}
				return observed
			},
			{
				condition: value => value === N,
				timeout: 20000,
				interval: 25,
				backoff: 2,
				maxInterval: 500,
			},
		)

		stopEffect()
		expect(observed).toBe(N)
	}, 20000)

	test('list reflects updated content after a file changes', async () => {
		// Pre-populate so we exercise the "update existing" branch
		await writeTempFile(dir, 'doc.md', 'v1')
		const list = await watchFiles(dir, '*.md')

		// Activate the watcher
		let observedContent = ''
		const stopEffect = createEffect(() => {
			observedContent = list.get()[0]?.content ?? ''
		})

		expect(observedContent).toBe('v1')

		await writeTempFile(dir, 'doc.md', 'v2')

		// See the burst test above: backoff polling, periodic re-kick to
		// survive dropped/stalled fs event delivery, budget mirrored by the
		// per-test timeout.
		let lastKick = 0
		await retryUntil(
			() => {
				if (Date.now() - lastKick > 1000) {
					lastKick = Date.now()
					return writeTempFile(dir, 'doc.md', 'v2').then(() => observedContent)
				}
				return observedContent
			},
			{
				condition: value => value === 'v2',
				timeout: 20000,
				interval: 25,
				backoff: 2,
				maxInterval: 500,
			},
		)

		stopEffect()
		expect(observedContent).toBe('v2')
	}, 20000)
})
