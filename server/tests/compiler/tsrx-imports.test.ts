/**
 * Generated `.tsx` → `.tsrx` compose-import typings (LT-312): one ambient
 * `declare module` per compiled `.tsrx` source, keyed by the shortest path
 * suffix no other source shares, typed through the served server module.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
	TSRX_IMPORTS_FILE,
	tsrxImportTypings,
} from '../../compiler/tsrx-imports'
import { compileCorpus } from '../../corpus-compile'
import type { FileInfo } from '../../file-signals'
import { createGeneratedDir } from '../helpers/generated-corpus'

const ROOT = path.resolve(import.meta.dir, '../../..')

const scratch = createGeneratedDir('tsrx-imports')
afterAll(() => scratch.cleanup())

const fileInfo = (rel: string): FileInfo => {
	const full = path.resolve(ROOT, rel)
	const stat = fs.statSync(full)
	return {
		path: full,
		filename: rel,
		content: fs.readFileSync(full, 'utf8'),
		hash: '',
		lastModified: stat.mtimeMs,
		size: stat.size,
		exists: true,
	}
}

const patterns = (text: string): string[] =>
	[...text.matchAll(/declare module '([^']+)'/g)].map(m => m[1] ?? '')

describe('tsrxImportTypings (LT-312)', () => {
	test('one entry per source, typed through its server module', () => {
		const text = tsrxImportTypings([
			{
				source: 'examples/basic/button/basic-button.tsrx',
				name: 'BasicButton',
				serverModule: 'basic-button.server.ts',
			},
		])
		expect(text).toContain(`declare module '*/basic-button.tsrx' {
	export const BasicButton: (
		args: Parameters<
			typeof import('./basic-button.server').renderBasicButton
		>[0],
	) => JSX.Element
}`)
	})

	test("Slot-backed props become the child's truc:pass surface (LT-100)", () => {
		const text = tsrxImportTypings([
			{
				source: 'examples/basic/button/basic-button.tsrx',
				name: 'BasicButton',
				serverModule: 'basic-button.server.ts',
				passProps: ['label', 'badge', 'disabled'],
			},
		])
		expect(text).toContain(`declare module '*/basic-button.tsrx' {
	export const BasicButton: (
		args: Parameters<
			typeof import('./basic-button.server').renderBasicButton
		>[0] & {
			'truc:pass'?: {
				"badge"?: JSX.PassEntry
				"disabled"?: JSX.PassEntry
				"label"?: JSX.PassEntry
			}
		},
	) => JSX.Element
}`)
	})

	test('a shared file name lengthens both keys until they differ', () => {
		const text = tsrxImportTypings([
			{
				source: 'examples/a/button/x-el.tsrx',
				name: 'XA',
				serverModule: 'xa.server.ts',
			},
			{
				source: 'examples/b/button/x-el.tsrx',
				name: 'XB',
				serverModule: 'xb.server.ts',
			},
			{
				source: 'examples/c/y-el.tsrx',
				name: 'YEl',
				serverModule: 'y-el.server.ts',
			},
		])
		// Sorted by pattern: stable across compile orders.
		expect(patterns(text)).toEqual([
			'*/a/button/x-el.tsrx',
			'*/b/button/x-el.tsrx',
			'*/y-el.tsrx',
		])
	})

	test('no sources still yields a script file (the tsconfig never dangles)', () => {
		const text = tsrxImportTypings([])
		expect(patterns(text)).toEqual([])
		expect(text).not.toMatch(/^(import|export)\b/m)
	})
})

describe('the corpus compile writes the typings (LT-312)', () => {
	test('every compiled .tsrx source is listed — a variant set’s unserved member too', async () => {
		const outDir = path.join(scratch.path, 'corpus')
		await compileCorpus(
			[
				fileInfo('examples/basic/button/basic-button.tsrx'),
				fileInfo('examples/basic/counter/basic-counter.tsrx'),
				fileInfo('examples/basic/counter/basic-counter.tsx'),
			],
			outDir,
		)
		const text = fs.readFileSync(path.join(outDir, TSRX_IMPORTS_FILE), 'utf8')
		expect(patterns(text)).toEqual([
			'*/basic-button.tsrx',
			'*/basic-counter.tsrx',
		])
		// basic-counter serves `.tsx`; its `.tsrx` entry types through the
		// served server module — one contract per tag.
		expect(text).toContain(
			"typeof import('./basic-counter.server').renderBasicCounter",
		)
	})
})
