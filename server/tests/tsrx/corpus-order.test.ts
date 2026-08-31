/**
 * Corpus compile-order invariance.
 *
 * `compileTsrxCorpus` discovers tags in a first pass that grows the
 * registry AS IT VISITS FILES. A raw-tag `truc:pass={{ … }}` target that
 * was fully migrated to .tsrx (no hand-written .ts twin left to seed the
 * registry — e.g. basic-button, cutover LT-117) only becomes
 * "registry-known" once its own file has been visited. In the CI
 * runner's glob order module-list.tsrx came FIRST, its `pass` target
 * <basic-button> failed the registry check ([TSRX012], error severity),
 * and the whole file was silently dropped from pass 2 — 21 of 22
 * components compiled, exit code 0, and verify:cem failed much later
 * with a misleading "the tsrx compile probably did not run" message.
 *
 * These tests pin the invariant: the compiled tag set is independent of
 * the input file order.
 */
import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { compileTsrxCorpus } from '../../effects/tsrx'
import type { FileInfo } from '../../file-signals'
import { loadTsrxCorpus } from './corpus-fixture'

const ROOT = path.resolve(import.meta.dir, '../../..')

describe('corpus compile order invariance', () => {
	test('module-list compiles even when it precedes its pass() target', async () => {
		const files = await loadTsrxCorpus()
		const first = files.filter(f => f.filename.endsWith('module-list.tsrx'))
		const rest = files.filter(f => !f.filename.endsWith('module-list.tsrx'))
		const compiled = await compileTsrxCorpus([...first, ...rest])
		const tags = compiled.map(info => info.tag)
		expect(tags).toContain('module-list')
		expect(tags).toContain('basic-button')
	})

	test('every corpus file compiles in reverse order too', async () => {
		const files = await loadTsrxCorpus()
		const compiled = await compileTsrxCorpus([...files].reverse())
		const tags = new Set(compiled.map(info => info.tag))
		for (const file of files) {
			// Component files are named for their tag (repo convention, the
			// same one handwrittenExampleModules relies on).
			const tag = (file.filename.split('/').pop() ?? '').replace(/\.tsrx$/, '')
			expect(tags.has(tag)).toBeTrue()
		}
	})
})

describe('corpus error policy', () => {
	// The runner's header promises "errors fail the build run", and the
	// build-effect wrapper it runs under treats a throw as the failure
	// signal. Logging the ❌ and returning normally instead is what let a
	// silently dropped component reach `cem analyze` and only fail in
	// verify:cem, far from the real diagnostic.
	test('an error-severity diagnostic fails the run', async () => {
		const files = await loadTsrxCorpus()
		const bad: FileInfo = {
			path: path.join(ROOT, 'examples', 'module', 'bad-pass.tsrx'),
			filename: 'examples/module/bad-pass.tsrx',
			content: `export function C()
@{
	expose({})
	<>
		<c-el>
			<div truc:pass={{ disabled: () => false }}></div>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`,
			hash: '',
			lastModified: 0,
			size: 0,
			exists: true,
		}
		expect(compileTsrxCorpus([...files, bad])).rejects.toThrow(
			/examples\/module\/bad-pass\.tsrx[\s\S]*TSRX012/,
		)
	})
})
