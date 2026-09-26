/**
 * The reserved `i18n` parameter and the catalog pipeline (ADR 0030,
 * LT-173): compiler-side units — the inline declaration, the reserved-name
 * guard, the record supply at compose sites, the lang precedence, the
 * root-lang render, `truc:case` pruning — plus the build-side census and
 * the generated record runtime.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { formatCensus, translationCensus } from '../../compiler/census'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileSource } from '../../compiler/frontend/tsrx/compiler'
import type { ComponentRegistry, RegistryEntry } from '../../compiler/registry'
import { compileCorpus } from '../../corpus-compile'
import { collectI18n, writeI18nModule } from '../../effects/i18n'
import { createGeneratedDir } from '../helpers/generated-corpus'
import { loadCorpus } from './corpus-fixture'

const compile = (source: string, path = 'examples/x/c-i18n.tsrx') =>
	compileComponent(source, path, new Set())

const composeRegistryOf = (...entries: RegistryEntry[]) =>
	new Map(entries.map(entry => [entry.source, entry]))

/**
 * Catalog facts injected into `collectI18n` — the census's census-half
 * tests run against synthetic corpora, so the committed `i18n/` files
 * must not leak real keys into their gap sets. Locale facts (the platform
 * plural sets) stay real: they are keyed by locale name, not by file.
 */
const injectedCatalogs = (
	overrides: Record<string, Record<string, string>>,
) => ({
	locales: Object.keys(overrides),
	overrides: new Map(Object.entries(overrides)),
	manifest: new Map<string, Record<string, string>>(),
})

/* === The inline declaration + the untranslated-literal warning (LTC047) === */

describe('LTC008 from the i18n walk carries a line (LT-223)', () => {
	test('a malformed inline i18n declaration reports its line number', () => {
		const { diagnostics } = compile(
			catalogSource(`{t['task.other']}`, `export const i18n = 'task'`),
		)
		const hit = diagnostics.find(d => d.code === 'LTC008')
		expect(hit).toBeDefined()
		expect(hit?.line).toBe(2)
	})
})

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

describe('LTC047 — untranslated literal prose (LT-173 step 5)', () => {
	test('literal prose in a catalog-using component warns', () => {
		const { diagnostics } = compile(catalogSource(`Hello world`))
		const hit = diagnostics.find(d => d.code === 'LTC047')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('warning')
		expect(hit?.line).toBe(7)
	})

	test('a single-letter fragment is page data, not prose — exempt', () => {
		const { diagnostics } = compile(catalogSource(`s`))
		expect(diagnostics.some(d => d.code === 'LTC047')).toBe(false)
	})

	test('literal prose without `export const i18n` is not a catalog concern', () => {
		const { diagnostics } = compile(
			catalogSource(`Hello world`, `export const config = {}`),
		)
		expect(diagnostics.some(d => d.code === 'LTC047')).toBe(false)
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
		const hit = diagnostics.find(d => d.code === 'LTC008')
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
		const hit = diagnostics.find(d => d.code === 'LTC006')
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
		const hit = diagnostics.find(d => d.code === 'LTC005')
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
		const hit = diagnostics.find(d => d.code === 'LTC006')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('CLDR plural category literal')
	})
})

/* === The translation census (ADR 0030 sub-design 5, LT-173 step 4) === */

describe('the translation census', () => {
	test('rides the census channel with missing, stale, and orphaned records', () => {
		const census = translationCensus(
			[
				{ key: 'basic-pluralize.remaining', locale: 'de', status: 'missing' },
				{ key: 'basic-pluralize.task', locale: 'de', status: 'stale' },
				{
					key: 'basic-deleted-component.gone',
					locale: 'cy',
					status: 'orphaned',
				},
			],
			['de', 'cy'],
		)
		expect(census.kind).toBe('translation')
		expect(census.values).toEqual(['cy', 'de'])
		const formatted = formatCensus(census)
		expect(formatted).toContain('Translation census — 3 entries: 2 de, 1 cy')
		expect(formatted).toContain('missing — no entry')
		expect(formatted).toContain('stale — the source string moved')
		expect(formatted).toContain('orphaned — nothing in the corpus declares')
		// Census records never ride the warning channel (census.test.ts's pin,
		// restated for the second kind).
		expect(formatted).not.toContain('⚠️')
	})
})

/* === Census reachability for `<key>.<category>` keys (LT-190) === */

describe('the census skips pruned categories (LT-190)', () => {
	// A synthetic corpus entry — collectI18n reads only tag/i18nMessages/
	// caseType off an entry. The catalogs are INJECTED (empty: the probe
	// declares keys no catalog carries yet), so the synthetic corpus is the
	// walk's whole world; the locale facts are still the platform's own:
	// de's cardinal set is {one, other}, cy's is all six.
	const probe = {
		tag: 'census-probe',
		i18nMessages: { 'label.one': 'one', 'label.two': 'two' },
		caseType: 'cardinal',
	} as unknown as RegistryEntry

	test("a category outside the locale's platform set is not a gap", async () => {
		const { gaps } = await collectI18n(
			[probe],
			injectedCatalogs({ de: {}, cy: {} }),
		)
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

/* === Orphaned catalog keys — the census's inverse walk (LT-196) === */

describe('orphaned catalog keys (LT-196)', () => {
	// The same synthetic probe the LT-190 reachability tests use, with
	// INJECTED catalogs — collectI18n takes the catalog facts as a second
	// argument so the inverse walk is testable without touching the
	// committed files. Locale facts are the platform's own: de's cardinal
	// set is {one, other}, zh's is {other}, cy's is all six.
	const probe = {
		tag: 'census-probe',
		i18nMessages: { 'label.one': 'one', 'label.two': 'two' },
		caseType: 'cardinal',
	} as unknown as RegistryEntry

	test('a catalog key whose component is gone is orphaned', async () => {
		const { gaps } = await collectI18n(
			[probe],
			injectedCatalogs({ de: { 'basic-deleted-component.gone': 'weg' } }),
		)
		expect(gaps.filter(gap => gap.status === 'orphaned')).toEqual([
			{ key: 'basic-deleted-component.gone', locale: 'de', status: 'orphaned' },
		])
	})

	test('a key the component does not declare is orphaned (the translator-typo case)', async () => {
		const { gaps } = await collectI18n(
			[probe],
			injectedCatalogs({ de: { 'census-probe.typo': 'Tippfehler' } }),
		)
		expect(gaps.filter(gap => gap.status === 'orphaned')).toEqual([
			{ key: 'census-probe.typo', locale: 'de', status: 'orphaned' },
		])
	})

	test('a declared key outside the locale’s platform set is legitimate, not orphaned', async () => {
		// The wholesale-translation shape the inversion must not report: a
		// translator carries every DECLARED key over, including categories
		// this locale prunes — `task.one` in an {other}-only locale. The key
		// is unreachable there (no missing record either, LT-190's rule) and
		// declared, so the orphan walk has nothing to say.
		const { gaps } = await collectI18n(
			[probe],
			injectedCatalogs({
				zh: { 'census-probe.label.one': '一', 'census-probe.label.two': '二' },
			}),
		)
		expect(gaps.filter(gap => gap.status === 'orphaned')).toEqual([])
		expect(gaps.filter(gap => gap.key === 'census-probe.label.one')).toEqual([])
	})

	test('the carve-out protects only DECLARED keys — undeclared residue reports everywhere (LT-217)', async () => {
		// The wholesale case keeps its protection: `label.two` in de
		// (cardinal {one, other}) is a DECLARED category form whose span de
		// prunes — a real translation, unreported (and no missing record
		// either, LT-190's declared-walk rule). The UNDECLARED `stray.few`
		// is rename/typo residue no span can ever reference, so no category
		// set shelters it: de lacks `few` even in its union set, and the key
		// reports there anyway — the locale set that hid it before LT-217.
		const de = await collectI18n(
			[probe],
			injectedCatalogs({
				de: {
					'census-probe.stray.few': 'wenige',
					'census-probe.label.two': 'zwei',
				},
			}),
		)
		expect(de.gaps.filter(gap => gap.status === 'orphaned')).toEqual([
			{ key: 'census-probe.stray.few', locale: 'de', status: 'orphaned' },
		])
		expect(de.gaps.filter(gap => gap.key === 'census-probe.label.two')).toEqual(
			[],
		)
		// "Every locale" is the point: cy selects `few`, de does not — both
		// report the undeclared key.
		const cy = await collectI18n(
			[probe],
			injectedCatalogs({ cy: { 'census-probe.stray.few': 'dau' } }),
		)
		expect(cy.gaps.filter(gap => gap.status === 'orphaned')).toEqual([
			{ key: 'census-probe.stray.few', locale: 'cy', status: 'orphaned' },
		])
	})
})

/* === The generated record runtime (ADR 0030 sub-designs 2+5) === */

const generated = createGeneratedDir('i18n')
afterAll(() => generated.cleanup())

const i18nModule = await (async () => {
	await compileCorpus(await loadCorpus(), generated.path)
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
		expect(i18nModule.i18nRecord('form-tokenbox', 'de').t.remove).toBe(
			'Entfernen',
		)
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

	test('the de catalog bakes into the extracted list template (LT-215 fixture)', async () => {
		// The tokenbox remove button is the corpus's first server-static
		// interpolation inside a reactive-list body: the translated label must
		// reach BOTH the initial (server-rendered) pills AND the served
		// `<template>` the client clones for pills added after connect.
		const mod = (await import(
			pathToFileURL(`${generated.path}/form-tokenbox.server.ts`).href
		)) as Record<string, (args: unknown) => string>
		const render = mod.renderFormTokenbox
		if (!render) throw new Error('renderFormTokenbox missing')
		const html = render({
			name: 'tags',
			label: 'Tags',
			value: 'one, two',
			i18n: i18nModule.i18nRecord('form-tokenbox', 'de'),
		})
		// Initial items carry the folded value through the ordinary
		// server-attr path.
		expect(html).toContain('aria-label="Entfernen"')
		const templateStart = html.indexOf('<template>')
		const templateEnd = html.indexOf('</template>')
		expect(templateStart).toBeGreaterThan(-1)
		const template = html.slice(templateStart, templateEnd)
		// The template itself carries the folded value, not a slot for it —
		// cloned pills announce the translation without any client catalog.
		expect(template).toContain('aria-label="Entfernen"')
		expect(template).toContain('<slot></slot>')
	})
})

/* === The committed catalogs against the inverse walk (LT-196) === */

describe('orphaned keys over the real corpus (LT-196)', () => {
	// The falsification that demonstrated the gap (LT-196's context): the
	// two foreign keys planted in de.json reported "0 gap(s)" before the
	// inverse walk existed. Injected here over the REAL catalogs — so this
	// also pins that the committed catalogs carry no orphans of their own:
	// any entry beyond the two plants is a real residue finding.
	const asStringRecord = (value: unknown): Record<string, string> =>
		typeof value === 'object' && value !== null
			? Object.fromEntries(
					Object.entries(value as Record<string, unknown>).map(([k, v]) => [
						k,
						String(v),
					]),
				)
			: {}

	test('the planted falsification keys report orphaned; the committed catalogs report nothing else', async () => {
		const registry = JSON.parse(
			readFileSync(`${generated.path}/registry.json`, 'utf8'),
		) as ComponentRegistry
		const i18nDir = join(import.meta.dir, '../../../i18n')
		const locales: string[] = []
		const overrides = new Map<string, Record<string, string>>()
		for (const file of readdirSync(i18nDir)) {
			if (!file.endsWith('.json') || file === 'manifest.json') continue
			const locale = file.replace(/\.json$/, '')
			locales.push(locale)
			overrides.set(
				locale,
				asStringRecord(JSON.parse(readFileSync(join(i18nDir, file), 'utf8'))),
			)
		}
		const de = overrides.get('de')
		if (!de) throw new Error('the committed de catalog is missing')
		de['basic-deleted-component.gone'] = 'weg'
		de['basic-pluralize.typo-key'] = 'Tippfehler'
		const { gaps } = await collectI18n(Object.values(registry), {
			locales,
			overrides,
			manifest: new Map(),
		})
		expect(gaps.filter(gap => gap.status === 'orphaned')).toEqual([
			{
				key: 'basic-deleted-component.gone',
				locale: 'de',
				status: 'orphaned',
			},
			{ key: 'basic-pluralize.typo-key', locale: 'de', status: 'orphaned' },
		])
	})
})

/* === ICU MessageFormat patterns (LT-250, ADR 0030 s4) === */

const ICU_DECL = `export const i18n = {
	tasks: '{count, plural, one {# task} other {# tasks}}',
	greeting: 'Hello, {name}!',
	done: 'All done',
}`

describe('LTC055 — ICU patterns and their call sites (LT-250)', () => {
	const codes = (template: string, decl = ICU_DECL) =>
		compile(catalogSource(template, decl)).diagnostics.filter(
			d => d.code === 'LTC055',
		)

	test('the extraction result carries every key’s argument signature', () => {
		// The front end's own result — the ComponentIR LT-308 reads.
		const { component, diagnostics } = compileSource(
			catalogSource(`{t.done}`, ICU_DECL),
			'examples/x/c-i18n.tsrx',
		)
		expect(diagnostics).toEqual([])
		expect(component?.i18nArgs).toEqual({
			tasks: [{ name: 'count', kind: 'number' }],
			greeting: [{ name: 'name', kind: 'string' }],
			done: [],
		})
	})

	test('a correct call and a bare argument-less read compile clean', () => {
		expect(
			codes(
				`{t.tasks({ count: 2 })} {t.greeting({ name: 'Ada' })} {t['done']}`,
			),
		).toEqual([])
	})

	test('an unparseable source pattern is an error at its line', () => {
		const [hit, ...rest] = codes(
			`{t.done}`,
			`export const i18n = {\n\tdone: 'All done',\n\tbroken: '{count, plural, one {x}}',\n}`,
		)
		expect(rest).toEqual([])
		expect(hit?.severity).toBe('error')
		expect(hit?.line).toBe(4)
		expect(hit?.message).toContain('`broken`')
		expect(hit?.message).toContain('other')
	})

	test('an unsupported formatter is an error, not a different rendering', () => {
		const [hit] = codes(
			`{t.done}`,
			`export const i18n = { done: '{n, spellout}' }`,
		)
		expect(hit?.message).toContain('spellout')
	})

	test('a missing argument and an extra one are named', () => {
		const [hit, ...rest] = codes(`{t.tasks({ total: 2 })}`)
		expect(rest).toEqual([])
		expect(hit?.severity).toBe('error')
		expect(hit?.line).toBe(11)
		expect(hit?.message).toContain('`t.tasks` is missing `count`')
		expect(hit?.message).toContain('passes `total`')
	})

	test('an argument message read without a call is an error', () => {
		const [hit] = codes(`{t.greeting}`)
		expect(hit?.message).toContain('read without a call')
		expect(hit?.message).toContain('t.greeting({ name })')
	})

	test('calling an argument-less message is an error', () => {
		const [hit] = codes(`{t.done()}`)
		expect(hit?.message).toContain('takes no arguments')
	})

	test('an argument record the build cannot read is an error', () => {
		expect(codes(`{t.tasks(3)}`)[0]?.message).toContain('one object literal')
		expect(codes(`{t.tasks({ ...rest })}`)[0]?.message).toContain('spread')
	})

	test('the whole-record spelling is checked too', () => {
		const { diagnostics } = compile(`
${ICU_DECL}
export function C({ i18n }: { i18n: I18n })
@{
	expose({})
	<>
		<c-el>{i18n.t.tasks({})}</c-el>
		<style>c-el { color: red }</style>
	</>
}`)
		const hit = diagnostics.find(d => d.code === 'LTC055')
		expect(hit?.message).toContain('is missing `count`')
	})

	test('an undeclared key is left to the TypeScript channel (LT-308)', () => {
		expect(codes(`{t.fliter}`)).toEqual([])
	})
})

describe('the server fold of an ICU message (LT-250)', async () => {
	const tag = 'c-icu-fold'
	const source = `
${ICU_DECL}
export function CIcuFold({ count, i18n: { t } }: { count: number; i18n: I18n })
@{
	expose({})
	<>
		<c-icu-fold>
			<span class="literal">{t.tasks({ count: 1 })}</span>
			<span class="arg" title={t.tasks({ count })}>{t.tasks({ count })}</span>
			<span class="done">{t.done}</span>
		</c-icu-fold>
		<style>c-icu-fold { display: block }</style>
	</>
}`
	const { component, diagnostics } = compileComponent(
		source,
		`examples/x/${tag}.tsrx`,
		new Set(),
	)
	if (!component) throw new Error(JSON.stringify(diagnostics))
	const dir = createGeneratedDir('icu-fold')
	afterAll(() => dir.cleanup())
	dir.emit(`${tag}.server.ts`, component.serverCode)
	await writeI18nModule(
		dir.path,
		await collectI18n(
			[component.entry],
			injectedCatalogs({
				de: {
					[`${tag}.tasks`]:
						'{count, plural, one {# Aufgabe} other {# Aufgaben}}',
					[`${tag}.done`]: 'Erledigt',
				},
				// A translator's typo: falls back to the source pattern, never
				// fails the build (ADR 0030 s5).
				cy: { [`${tag}.tasks`]: '{count, plural, one {# tasg}' },
			}),
		),
	)
	const mod = await dir.importModule<Record<string, (args: unknown) => string>>(
		`${tag}.server.ts`,
	)
	const { i18nRecord } = (await import(
		pathToFileURL(`${dir.path}/i18n.ts`).href
	)) as { i18nRecord: (tag: string, lang?: string) => unknown }
	const render = (count: number, lang: string) => {
		const fn = mod.renderCIcuFold
		if (!fn) throw new Error('renderCIcuFold missing')
		return fn({ count, i18n: i18nRecord(tag, lang) })
	}

	test('compiles without diagnostics', () => {
		expect(diagnostics).toEqual([])
	})

	test('server-known arguments fold into text and attributes', () => {
		const html = render(3, 'en')
		expect(html).toContain('<span class="literal">1 task</span>')
		expect(html).toContain('<span title="3 tasks" class="arg">3 tasks</span>')
		expect(html).toContain('<span class="done">All done</span>')
	})

	test('a translation folds through the same evaluator', () => {
		const html = render(1, 'de')
		expect(html).toContain(
			'<span title="1 Aufgabe" class="arg">1 Aufgabe</span>',
		)
		expect(html).toContain('<span class="done">Erledigt</span>')
	})

	test('an unparseable translation falls back to the source pattern', () => {
		expect(render(2, 'cy')).toContain(
			'<span title="2 tasks" class="arg">2 tasks</span>',
		)
	})
})
