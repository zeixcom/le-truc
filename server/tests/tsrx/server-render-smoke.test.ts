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
import { afterAll, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Glob } from 'bun'
import { compileTsrxCorpus } from '../../effects/tsrx'
import type { FileInfo } from '../../file-signals'
import { isVoidElement } from '../../tsrx/core'
import { createGeneratedDir } from '../helpers/generated-tsrx'

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

// The REAL corpus runner writes every generated module; a per-run directory
// keeps that out of the build pipeline's own output (LT-140). Render happens
// through `info.serverModulePath`, so the redirect is transparent.
const generated = createGeneratedDir('render-smoke')
afterAll(() => generated.cleanup())

const compiled = await compileTsrxCorpus(await corpus(), generated.path)

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

/**
 * `reconcile()`'s template root count (LT-157c, ADR 0028 sub-design 5).
 *
 * `InvalidTemplateError` is the one entry in ADR 0028's inventory that gets
 * no diagnostic and needs none: `emit-server.ts`'s `listTemplateLines` calls
 * `shape(loop.output, …)` on a SINGLE element node, so the emitted
 * `<template>` has exactly one root element by construction. There is
 * nothing for a rule to decide — the shape the runtime rejects is not
 * expressible in compiled output.
 *
 * "By construction" is a claim about code that can be edited, though, so it
 * is pinned here rather than only written down. If someone ever teaches
 * `@for` to emit a fragment, this fails before the runtime throw does.
 */
describe('@for templates have exactly one root element (LT-157c)', () => {
	/** Root-level element count of a `<template>`'s content. */
	const rootElementCount = (content: string): number => {
		let depth = 0
		let roots = 0
		const tagPattern = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g
		let match: RegExpExecArray | null = tagPattern.exec(content)
		while (match) {
			const [, slash, tag, rest] = match
			const selfClosing = (rest ?? '').trimEnd().endsWith('/')
			if (slash === '/') depth--
			else {
				if (depth === 0) roots++
				if (!selfClosing && !isVoidElement(tag as string)) depth++
			}
			match = tagPattern.exec(content)
		}
		return roots
	}

	test('the counter agrees with the runtime check it stands in for', () => {
		expect(rootElementCount('<li><span>x</span></li>')).toBe(1)
		expect(rootElementCount('<li>a</li><li>b</li>')).toBe(2)
		expect(rootElementCount('text only')).toBe(0)
		expect(rootElementCount('<li><input name="x"><br>y</li>')).toBe(1)
	})

	for (const info of compiled) {
		test(`${info.tag}'s emitted templates each have one root`, async () => {
			const mod = (await import(info.serverModulePath)) as Record<
				string,
				unknown
			>
			const fn = mod[renderName(info.tag)] as (args: unknown) => string
			const html = fn(ARGS[info.tag] ?? {})
			const templates = [
				...html.matchAll(/<template>([\s\S]*?)<\/template>/g),
			].map(m => m[1] ?? '')
			for (const content of templates) expect(rootElementCount(content)).toBe(1)
		})
	}
})
