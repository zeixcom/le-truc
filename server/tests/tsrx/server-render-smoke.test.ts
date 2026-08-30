/**
 * Server-render smoke gate (LT-121).
 *
 * `server.golden.test.ts` asserts byte-exact markup, but only for the
 * six tags it names — so a generated `render*()` that THROWS the
 * moment it is called shipped unnoticed for the whole corpus. It did:
 * every component following the children-are-data rule
 * (TSRX-HOST-PROFILE § data account bullet 2) seeds its props by
 * reading a `first()`-bound ref inside `expose()`, and `emit-server.ts`
 * used to declare those refs as `undefined` — so `renderFormSpinbutton()`
 * and `renderFormColorgraph()` both threw `undefined is not an object`
 * at HEAD (fixed by the `refStub` null-object; see runtime.ts).
 *
 * This gate is deliberately NOT a snapshot: it compiles the corpus the
 * way the build does, calls every generated render function, and
 * asserts only that it returns markup for its own tag without
 * throwing. A new component therefore joins the coverage by existing,
 * rather than by someone remembering to add an expectation.
 *
 * A component whose args are required (`name: string`) may legitimately
 * need a value to render at all — `ARGS` carries those; everything else
 * renders from `{}`, which is also what proves the defaults work.
 */
import { describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Glob } from 'bun'
import { compileTsrxCorpus } from '../../effects/tsrx'
import type { FileInfo } from '../../file-signals'

const ROOT = path.resolve(import.meta.dir, '../../..')

/** `form-spinbutton` → `renderFormSpinbutton`. */
const renderName = (tag: string): string =>
	`render${tag
		.split('-')
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join('')}`

/**
 * Args for the components whose contract has genuinely required
 * fields. Everything absent here renders from `{}` on purpose.
 */
const ARGS: Record<string, Record<string, unknown>> = {
	'form-spinbutton': { name: 'quantity' },
	'form-checkbox': { name: 'agree', label: 'I agree' },
	'form-radiogroup': {
		name: 'choice',
		label: 'Pick one',
		options: [
			{ value: 'a', label: 'A' },
			{ value: 'b', label: 'B' },
		],
	},
	'form-textbox': { name: 'title', label: 'Title' },
	'form-combobox': {
		name: 'fruit',
		label: 'Fruit',
		options: [
			{ value: 'a', label: 'Apple' },
			{ value: 'b', label: 'Banana' },
		],
	},
	'form-tokenbox': { name: 'tags', label: 'Tags' },
	'form-listbox': {
		name: 'fruit',
		options: [
			{ value: 'a', label: 'Apple' },
			{ value: 'b', label: 'Banana' },
		],
	},
	'module-tabgroup': {
		tabs: [
			{ id: 'one', label: 'One', content: 'First' },
			{ id: 'two', label: 'Two', content: 'Second' },
		],
	},
	'card-blogpost': { title: 'Title', href: '#' },
	'card-callout': { title: 'Heads up' },
	'card-collapsible': { title: 'Details' },
	'basic-button': { label: 'Add' },
}

const corpus = async (): Promise<FileInfo[]> => {
	const files: FileInfo[] = []
	const glob = new Glob('examples/**/*.tsrx')
	for (const rel of glob.scanSync({ cwd: ROOT, onlyFiles: true })) {
		const full = path.join(ROOT, rel)
		const stat = fs.statSync(full)
		files.push({
			path: full,
			filename: rel,
			content: fs.readFileSync(full, 'utf8'),
			hash: '',
			lastModified: stat.mtimeMs,
			size: stat.size,
			exists: true,
		})
	}
	return files
}

const compiled = await compileTsrxCorpus(await corpus())

describe('server render smoke — every corpus tag renders (LT-121)', () => {
	test('the corpus compiled at all', () => {
		expect(compiled.length).toBeGreaterThan(0)
	})

	for (const info of compiled) {
		test(`${renderName(info.tag)}() does not throw`, async () => {
			const mod = (await import(info.serverModulePath)) as Record<
				string,
				unknown
			>
			const fn = mod[renderName(info.tag)]
			expect(typeof fn).toBe('function')
			const html = (fn as (args: unknown) => string)(ARGS[info.tag] ?? {})
			expect(typeof html).toBe('string')
			expect(html).toContain(`<${info.tag}`)
		})
	}
})
