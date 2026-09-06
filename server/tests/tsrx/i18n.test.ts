/**
 * The reserved `i18n` parameter and the catalog pipeline (ADR 0030,
 * LT-173): compiler-side units — the inline declaration, the reserved-name
 * guard, the record supply at compose sites, the lang precedence, the
 * root-lang render, `truc:case` pruning — plus the build-side census and
 * the generated record runtime.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { pathToFileURL } from 'node:url'
import { compileTsrxCorpus } from '../../effects/tsrx'
import { compileComponent } from '../../tsrx'
import type { RegistryEntry } from '../../tsrx/registry'
import { formatCensus, translationCensus } from '../../tsrx/sim/report'
import { createGeneratedDir } from '../helpers/generated-tsrx'
import { loadTsrxCorpus } from './corpus-fixture'

const compile = (source: string, path = 'examples/x/c-i18n.tsrx') =>
	compileComponent(source, path, new Set())

const composeRegistryOf = (...entries: RegistryEntry[]) =>
	new Map(entries.map(entry => [entry.source, entry]))

/* === The inline declaration + the untranslated-literal warning (TSRX047) === */

const catalogSource = (
	template: string,
	decl = `export const i18n = { task: 'task' }`,
) => `
${decl}
export function C({ i18n: { t } }: { i18n: I18n })
@{
	expose({})
	<>
		<c-el>${template}</c-el>
		<style>c-el { color: red }</style>
	</>
}`

describe('TSRX047 — untranslated literal prose (LT-173 step 5)', () => {
	test('literal prose in a catalog-using component warns', () => {
		const { diagnostics } = compile(catalogSource(`Hello world`))
		const hit = diagnostics.find(d => d.code === 'TSRX047')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('warning')
		expect(hit?.line).toBe(7)
	})

	test('a single-letter fragment is page data, not prose — exempt', () => {
		const { diagnostics } = compile(catalogSource(`s`))
		expect(diagnostics.some(d => d.code === 'TSRX047')).toBe(false)
	})

	test('literal prose without `export const i18n` is not a catalog concern', () => {
		const { diagnostics } = compile(
			catalogSource(`Hello world`, `export const config = {}`),
		)
		expect(diagnostics.some(d => d.code === 'TSRX047')).toBe(false)
	})
})

/* === The reserved parameter: callers never pass it (ADR 0030 s2) === */

const i18nChildSource = `
export const i18n = { task: 'task' }
export function BasicI18nChild({ lang = 'en', i18n: { t } }: { lang?: string; i18n: I18n })
@{
	expose({})
	<>
		<basic-i18n-child {lang}>{t.task}</basic-i18n-child>
		<style>basic-i18n-child { display: block }</style>
	</>
}`

const parentOf = (attrs: string): string => `
import { BasicI18nChild } from '../child/basic-i18n-child.tsrx'

export function BasicI18nParent({}: {})
@{
	expose({})
	<>
		<basic-i18n-parent>
			<BasicI18nChild ${attrs} />
		</basic-i18n-parent>
		<style>basic-i18n-parent { display: block }</style>
	</>
}`

describe('the reserved `i18n` parameter (ADR 0030 sub-design 2)', () => {
	test('a caller-authored `i18n` attribute is rejected', () => {
		const child = compileComponent(
			i18nChildSource,
			'examples/child/basic-i18n-child.tsrx',
			new Set(),
		)
		if (!child.component) throw new Error('child must compile')
		const { diagnostics } = compileComponent(
			parentOf('i18n="de"'),
			'examples/x/basic-i18n-parent.tsrx',
			new Set(),
			undefined,
			composeRegistryOf(child.component.entry),
		)
		const hit = diagnostics.find(d => d.code === 'TSRX006')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('reserved parameter')
		expect(hit?.message).toContain('never pass it')
	})

	test('the compiler supplies the record at the compose site', () => {
		const child = compileComponent(
			i18nChildSource,
			'examples/child/basic-i18n-child.tsrx',
			new Set(),
		)
		if (!child.component) throw new Error('child must compile')
		const { component } = compileComponent(
			parentOf(''),
			'examples/x/basic-i18n-parent.tsrx',
			new Set(),
			undefined,
			composeRegistryOf(child.component.entry),
		)
		if (!component) throw new Error('parent must compile')
		expect(component.serverCode).toContain(
			"import { i18nRecord } from './i18n'",
		)
		// No `lang` authored at the site, so the child's authored default
		// (ADR 0030 sub-design 3's precedence) is the record's locale.
		expect(component.serverCode).toContain(
			'i18n: i18nRecord("basic-i18n-child", "en")',
		)
	})

	test('an authored `lang` at the compose site overrides the record (ADR 0030 sub-design 3)', () => {
		const child = compileComponent(
			i18nChildSource,
			'examples/child/basic-i18n-child.tsrx',
			new Set(),
		)
		if (!child.component) throw new Error('child must compile')
		const { component } = compileComponent(
			parentOf('lang="de"'),
			'examples/x/basic-i18n-parent.tsrx',
			new Set(),
			undefined,
			composeRegistryOf(child.component.entry),
		)
		if (!component) throw new Error('parent must compile')
		expect(component.serverCode).toContain(
			'i18n: i18nRecord("basic-i18n-child", "de")',
		)
	})
})

/* === The effective locale renders onto the root `lang` attribute === */

describe('the root `lang` attribute (ADR 0030 sub-design 3)', () => {
	const langBindingSource = `
export function C({ i18n: { lang } }: { i18n: I18n })
@{
	expose({})
	<>
		<c-el>ok</c-el>
		<style>c-el { color: red }</style>
	</>
}`

	test('an i18n component that binds `lang` but does not render it gets the compiler render', () => {
		const { component } = compile(langBindingSource)
		if (!component) throw new Error('must compile')
		expect(component.serverCode).toContain(`attr('lang', lang)`)
	})

	test('a component that renders `lang` itself is not duplicated', () => {
		const { component } = compile(`
export function C({ lang = 'en', i18n: { t } }: { lang?: string; i18n: I18n })
@{
	expose({})
	<>
		<c-el {lang}>ok</c-el>
		<style>c-el { color: red }</style>
	</>
}`)
		if (!component) throw new Error('must compile')
		// Exactly ONE lang render — the authored root attribute.
		expect(component.serverCode.match(/attr\('lang', lang\)/g)).toHaveLength(1)
	})
})

/* === truc:case — per-locale pruning (ADR 0030 sub-design 6) === */

const caseSource = (paramPattern: string, paramType: string) => `
export function C({ count, ${paramPattern} }: { count: number; ${paramType} })
@{
	const cat = (locale: string, n: number) => new Intl.PluralRules(locale).select(n)
	expose({})
	<>
		<c-el {count}>
			<span class="one" truc:case="one" hidden={() => cat(host.lang, host.count) !== 'one'}>x</span>
			<span class="other" truc:case="other" hidden={() => cat(host.lang, host.count) !== 'other'}></span>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`

describe('truc:case pruning (LT-173 step 7)', () => {
	test("each case element is pruned by the locale's platform category set", () => {
		const { component, diagnostics } = compile(
			caseSource(`lang = 'en', i18n: { t }`, `lang?: string; i18n: I18n`),
		)
		if (!component) throw new Error(JSON.stringify(diagnostics))
		expect(component.serverCode).toContain(
			`if (pluralCategories(lang).has('one')) {`,
		)
		expect(component.serverCode).toContain(
			`if (pluralCategories(lang).has('other')) {`,
		)
	})

	test('a case element without a bound locale is an error', () => {
		const { diagnostics } = compile(caseSource(``, ``))
		const hit = diagnostics.find(d => d.code === 'TSRX005')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('needs a locale')
	})

	test('a non-category literal is rejected at classification', () => {
		const source = `
export function C({ lang = 'en' }: { lang?: string })
@{
	expose({})
	<>
		<c-el {lang}>
			<span class="one" truc:case="several" hidden={() => host.lang !== 'one'}>x</span>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`
		const { diagnostics } = compile(source)
		const hit = diagnostics.find(d => d.code === 'TSRX006')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('CLDR plural category literal')
	})
})

/* === The translation census (ADR 0030 sub-design 5, LT-173 step 4) === */

describe('the translation census', () => {
	test('rides the census channel with missing and stale records', () => {
		const census = translationCensus(
			[
				{ key: 'basic-pluralize.remaining', locale: 'de', status: 'missing' },
				{ key: 'basic-pluralize.task', locale: 'de', status: 'stale' },
			],
			['de', 'fr'],
		)
		expect(census.kind).toBe('translation')
		expect(census.values).toEqual(['de', 'fr'])
		const formatted = formatCensus(census)
		expect(formatted).toContain('Translation census — 2 entries: 2 de, 0 fr')
		expect(formatted).toContain('missing — no entry')
		expect(formatted).toContain('stale — the source string moved')
		// Census records never ride the warning channel (census.test.ts's pin,
		// restated for the second kind).
		expect(formatted).not.toContain('⚠️')
	})
})

/* === The generated record runtime (ADR 0030 sub-designs 2+5) === */

const generated = createGeneratedDir('i18n')
afterAll(() => generated.cleanup())

const i18nModule = await (async () => {
	await compileTsrxCorpus(await loadTsrxCorpus(), generated.path)
	return await import(pathToFileURL(`${generated.path}/i18n.ts`).href)
})()

describe('the generated i18n module', () => {
	test('a key resolves in exactly one place: source fallback first', () => {
		// No committed catalogs exist yet, so every key resolves to its
		// inline source-locale string (ADR 0030 sub-design 5's fallback).
		const record = i18nModule.i18nRecord('basic-pluralize')
		expect(record.lang).toBe('en')
		expect(record.t.task).toBe('task')
		expect(record.t.remaining).toBe('remaining')
		expect(record.timeZone).toBe('UTC')
		expect(record.dir).toBe('ltr')
	})

	test("the record carries the component's own catalog only", () => {
		const record = i18nModule.i18nRecord('basic-counter')
		expect(record.t).toEqual({})
	})

	test('`dir` derives from the lang override', () => {
		expect(i18nModule.i18nRecord('basic-pluralize', 'ar').dir).toBe('rtl')
		expect(i18nModule.i18nRecord('basic-pluralize', 'de').dir).toBe('ltr')
		expect(i18nModule.i18nRecord('basic-pluralize', 'ar').lang).toBe('ar')
	})
})
