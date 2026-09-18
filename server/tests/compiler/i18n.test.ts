/**
 * The reserved `i18n` parameter and the catalog pipeline (ADR 0030,
 * LT-173): compiler-side units — the inline declaration, the reserved-name
 * guard, the record supply at compose sites, the lang precedence, the
 * root-lang render, `truc:case` pruning — plus the build-side census and
 * the generated record runtime.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { compileComponent } from '../../compiler/frontend/tsrx'
import type { ComponentRegistry, RegistryEntry } from '../../compiler/registry'
import { formatCensus, translationCensus } from '../../compiler/sim/report'
import { collectI18n } from '../../effects/i18n'
import { compileTsrxCorpus } from '../../effects/tsrx'
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

/* === The `<key>.<category>` convention (LT-190) === */

describe('dotted message keys (LT-190)', () => {
	test('a category-suffixed key compiles clean', () => {
		const { component, diagnostics } = compile(
			catalogSource(
				`{t['task.other']}`,
				`export const i18n = { 'task.other': 'tasks' }`,
			),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('must compile')
		expect(component.serverCode).toContain(`t['task.other']`)
	})

	test('a dotted key whose suffix is not a CLDR category is a shape error', () => {
		const { diagnostics } = compile(
			catalogSource(`x`, `export const i18n = { 'task.onee': 'tasks' }`),
		)
		const hit = diagnostics.find(d => d.code === 'TSRX008')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('CLDR plural category')
		expect(hit?.message).toContain('task.onee')
	})

	test('a bare (undotted) key is unaffected by the suffix rule', () => {
		const { diagnostics } = compile(catalogSource(`{t.task}`))
		expect(diagnostics).toEqual([])
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

// An i18n-DECLARING parent: its own `lang` binding is the ambient locale at
// its compose sites (LT-191's compose-graph inheritance).
const i18nParentOf = (attrs: string): string => `
import { BasicI18nChild } from '../child/basic-i18n-child.tsrx'

export const i18n = { title: 'Parent' }
export function BasicI18nParent({ lang = 'en', i18n: { t } }: { lang?: string; i18n: I18n })
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

	test("a site without a lang arg inherits the i18n parent's own locale (LT-191)", () => {
		// Compose-graph inheritance: the parent's `lang` binding is the
		// ambient locale at its sites — the SSR analog of the DOM ancestor
		// walk. The child's authored default follows the parent; only a
		// NON-i18n parent leaves the child's default in charge (the test
		// above).
		const child = compileComponent(
			i18nChildSource,
			'examples/child/basic-i18n-child.tsrx',
			new Set(),
		)
		if (!child.component) throw new Error('child must compile')
		const { component } = compileComponent(
			i18nParentOf(''),
			'examples/x/basic-i18n-parent.tsrx',
			new Set(),
			undefined,
			composeRegistryOf(child.component.entry),
		)
		if (!component) throw new Error('parent must compile')
		expect(component.serverCode).toContain(
			'i18n: i18nRecord("basic-i18n-child", lang)',
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

/* === Census reachability for `<key>.<category>` keys (LT-190) === */

describe('the census skips pruned categories (LT-190)', () => {
	// A synthetic corpus entry — collectI18n reads only tag/i18nMessages/
	// caseType off an entry. The catalogs are the COMMITTED ones, so the
	// locale facts are the platform's own: de's cardinal set is {one, other},
	// cy's is all six.
	const probe = {
		tag: 'census-probe',
		i18nMessages: { 'label.one': 'one', 'label.two': 'two' },
		caseType: 'cardinal',
	} as unknown as RegistryEntry

	test("a category outside the locale's platform set is not a gap", async () => {
		const { gaps } = await collectI18n([probe])
		// label.one is reachable everywhere and in no catalog -> one gap per
		// locale. label.two is pruned in de (cardinal de never selects two)
		// -> no de gap for it — the phantom-gap case the filter exists for.
		expect(gaps.filter(gap => gap.locale === 'de')).toEqual([
			{ key: 'census-probe.label.one', locale: 'de', status: 'missing' },
		])
		// cy's cardinal rules use all six categories, so label.two IS
		// reachable there and still reported.
		expect(gaps).toContainEqual({
			key: 'census-probe.label.two',
			locale: 'cy',
			status: 'missing',
		})
	})

	test('the committed corpus is gap-free at its own case types', async () => {
		// basic-pluralize's dynamic case type summarizes to 'union', so the
		// census asks each locale for its full cardinal∪ordinal set — the
		// committed catalogs carry exactly those keys, and i18n:sync keeps
		// the manifest hashes fresh. Any entry here is a real regression.
		const registry = JSON.parse(
			readFileSync(`${generated.path}/registry.json`, 'utf8'),
		) as ComponentRegistry
		const collection = await collectI18n(Object.values(registry))
		expect(collection.gaps).toEqual([])
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
		// The page locale is 'en' — the source locale, which has no override
		// file by construction — so every key resolves to its inline
		// source-locale string (ADR 0030 sub-design 5's fallback).
		const record = i18nModule.i18nRecord('basic-pluralize')
		expect(record.lang).toBe('en')
		expect(record.t['task.one']).toBe('task')
		expect(record.t['task.other']).toBe('tasks')
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

	test('the committed catalogs resolve through the generated module (LT-192 pin)', () => {
		// The end-to-end path the render fixtures bypass: catalog json →
		// OVERRIDES embedded in the generated module → i18nRecord. Dropping
		// the override pipeline (or the de.json catalog) fails here.
		const de = i18nModule.i18nRecord('basic-pluralize', 'de')
		expect(de.t['task.one']).toBe('Aufgabe')
		expect(de.t['task.other']).toBe('Aufgaben')
		// zh carries only its reachable category ({other}); the rest falls
		// back to the SOURCE string — no implicit chain, and the fallback
		// bytes exist because the source locale declares every referenced
		// key (LT-190's no-implicit-fallback rule).
		const zh = i18nModule.i18nRecord('basic-pluralize', 'zh')
		expect(zh.t['task.other']).toBe('个任务')
		expect(zh.t['task.one']).toBe('task')
	})

	test("the corpus's accessibility strings resolve at de (LT-195 fixture)", () => {
		// LT-195 routed the corpus's component-owned aria-labels/placeholder/
		// visually-hidden text through the catalog; the de translations are
		// real (not source echoes) and pinned here per component. A changed
		// expectation here means either a source string moved (re-run
		// `i18n:sync`, check the census) or a translation was reworked.
		expect(i18nModule.i18nRecord('form-combobox', 'de').t.clearInput).toBe(
			'Eingabe leeren',
		)
		expect(i18nModule.i18nRecord('form-listbox', 'de').t.filter).toBe('Filtern')
		expect(i18nModule.i18nRecord('form-listbox', 'de').t.clearFilter).toBe(
			'Filter leeren',
		)
		expect(i18nModule.i18nRecord('form-textbox', 'de').t.clearInput).toBe(
			'Eingabe leeren',
		)
		expect(i18nModule.i18nRecord('form-spinbutton', 'de').t.decrement).toBe(
			'Verringern',
		)
		expect(i18nModule.i18nRecord('form-spinbutton', 'de').t.increment).toBe(
			'Erhöhen',
		)
		expect(i18nModule.i18nRecord('form-colorgraph', 'de').t.drag).toBe('Ziehen')
	})

	test("an i18n:sync placeholder ('' override) resolves the source string (LT-195)", () => {
		// Locales still awaiting a translation carry "" entries for the new
		// keys — the placeholder must fall back to the source string, or an
		// untranslated locale would render EMPTY aria-labels (strictly worse
		// than the English fallback). Pinned at pl, which carries "" for the
		// LT-195 keys; a translator filling it updates this pin with the
		// landed string, exactly like the zh pin above.
		expect(i18nModule.i18nRecord('form-textbox', 'pl').t.clearInput).toBe(
			'Clear input',
		)
	})

	test('the de catalog renders into the served markup (LT-195 fixture)', async () => {
		// The render half of the fixture: the record a page render supplies
		// reaches the emitted attribute — the end-to-end claim "the de build
		// serves Eingabe leeren" rides on this plus the resolution pins.
		const mod = (await import(
			pathToFileURL(`${generated.path}/form-textbox.server.ts`).href
		)) as Record<string, (args: unknown) => string>
		const render = mod.renderFormTextbox
		if (!render) throw new Error('renderFormTextbox missing')
		const html = render({
			name: 'title',
			label: 'Title',
			clearable: true,
			i18n: i18nModule.i18nRecord('form-textbox', 'de'),
		})
		expect(html).toContain('aria-label="Eingabe leeren"')
	})
})
