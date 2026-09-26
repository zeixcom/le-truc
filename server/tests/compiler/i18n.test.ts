/**
 * The reserved `i18n` parameter and the catalog pipeline (ADR 0030,
 * LT-173): compiler-side units — the inline declaration, the reserved-name
 * guard, the record supply at compose sites, the lang precedence, the
 * root-lang render — plus the build-side census and
 * the generated record runtime.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { formatCensus, translationCensus } from '../../compiler/census'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileSource } from '../../compiler/frontend/tsrx/compiler'
import { messagesRecordType } from '../../compiler/i18n'
import { parseMessage } from '../../compiler/icu/parse'
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

/* === Quoted and dotted keys are ordinary keys (LT-251) === */

describe('quoted message keys', () => {
	test('a dotted key is an ordinary key — no category-suffix rule (LT-251)', () => {
		// The `<key>.<category>` convention retired with the one-ICU-pattern
		// model: any suffix, or none, compiles clean.
		const { component, diagnostics } = compile(
			catalogSource(
				`{t['task.onee']}`,
				`export const i18n = { 'task.onee': 'tasks' }`,
			),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('must compile')
		expect(component.serverCode).toContain(`t['task.onee']`)
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

/* === Every locale carries the same key set (LT-251) === */

describe('the census has no reachability carve-out (LT-251)', () => {
	// A synthetic corpus entry — collectI18n reads only tag/i18nMessages
	// off an entry. The catalogs are INJECTED (empty: the probe declares
	// keys no catalog carries yet), so the synthetic corpus is the walk's
	// whole world.
	const probe = {
		tag: 'census-probe',
		i18nMessages: { 'label.one': 'one', 'label.two': 'two' },
	} as unknown as RegistryEntry

	test('every declared key is missing in every locale that lacks it', async () => {
		// de's cardinal rules never select `two`; under the retired
		// per-category model `label.two` was pruned there. One ICU pattern
		// per key means every locale owes every key.
		const { gaps } = await collectI18n(
			[probe],
			injectedCatalogs({ de: {}, cy: {} }),
		)
		expect(gaps.filter(gap => gap.locale === 'de')).toEqual([
			{ key: 'census-probe.label.one', locale: 'de', status: 'missing' },
			{ key: 'census-probe.label.two', locale: 'de', status: 'missing' },
		])
	})

	test('the committed corpus is gap-free', async () => {
		// The committed catalogs carry every declared key, and i18n:sync
		// keeps the manifest hashes fresh. Any entry here is a real
		// regression.
		const registry = JSON.parse(
			readFileSync(`${generated.path}/registry.json`, 'utf8'),
		) as ComponentRegistry
		const collection = await collectI18n(Object.values(registry))
		expect(collection.gaps).toEqual([])
	})
})

/* === Orphaned catalog keys — the census's inverse walk (LT-196) === */

describe('orphaned catalog keys (LT-196)', () => {
	// A synthetic probe with INJECTED catalogs — collectI18n takes the
	// catalog facts as a second argument so the inverse walk is testable
	// without touching the committed files.
	const probe = {
		tag: 'census-probe',
		i18nMessages: { 'label.one': 'one', 'label.two': 'two' },
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

	test('a declared key is never orphaned', async () => {
		const { gaps } = await collectI18n(
			[probe],
			injectedCatalogs({
				zh: { 'census-probe.label.one': '一', 'census-probe.label.two': '二' },
			}),
		)
		expect(gaps.filter(gap => gap.status === 'orphaned')).toEqual([])
	})

	test('an undeclared key is orphaned in every locale, unconditionally (LT-251)', async () => {
		// No plural-category set shelters a key any more: `stray.few` reports
		// in de (whose rules never select `few`) and in cy (whose do) alike.
		for (const locale of ['de', 'cy']) {
			const { gaps } = await collectI18n(
				[probe],
				injectedCatalogs({ [locale]: { 'census-probe.stray.few': 'x' } }),
			)
			expect(gaps.filter(gap => gap.status === 'orphaned')).toEqual([
				{ key: 'census-probe.stray.few', locale, status: 'orphaned' },
			])
		}
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
		expect(record.t.tasks({ count: 1, type: 'cardinal' })).toBe('task')
		expect(record.t.tasks({ count: 2, type: 'cardinal' })).toBe('tasks')
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
		expect(de.t.tasks({ count: 1, type: 'cardinal' })).toBe('Aufgabe')
		expect(de.t.tasks({ count: 3, type: 'cardinal' })).toBe('Aufgaben')
		// LT-252: the plural arms live inside each locale's ONE pattern, and
		// the record formats under that locale's own rules — Welsh's dual
		// mutation and Arabic's dual come from the catalog value itself.
		const cy = i18nModule.i18nRecord('basic-pluralize', 'cy')
		expect(cy.t.tasks({ count: 2, type: 'cardinal' })).toBe('dasg')
		expect(cy.t.tasks({ count: 4, type: 'cardinal' })).toBe('tasgiau')
		const ar = i18nModule.i18nRecord('basic-pluralize', 'ar')
		expect(ar.t.tasks({ count: 2, type: 'cardinal' })).toBe('مهمتان')
		const zh = i18nModule.i18nRecord('basic-pluralize', 'zh')
		expect(zh.t.tasks({ count: 1, type: 'cardinal' })).toBe('个任务')
		expect(zh.t.tasks({ count: 1, type: 'ordinal' })).toBe('个任务')
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
		// LT-219's event-time messages: argument messages format through the
		// shared evaluator, placeholders preserved in the translation.
		const tokenbox = i18nModule.i18nRecord('form-tokenbox', 'de').t
		expect(tokenbox.added({ token: 'rot' })).toBe('Token hinzugefügt: rot')
		expect(tokenbox.removed({ token: 'rot' })).toBe('Token entfernt: rot')
		expect(tokenbox.duplicate({ token: 'rot' })).toBe(
			'rot ist bereits in der Liste',
		)
		expect(i18nModule.i18nRecord('form-colorgraph', 'de').t.outOfGamut).toBe(
			'Farbe außerhalb des Farbraums',
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

	test('the de catalog rides the client-message attribute as parsed patterns (LT-219 fixture)', async () => {
		// Event-time strings cannot fold: the browser formats them. The de
		// render serializes exactly the client-referenced keys, translated
		// and PARSED — the placeholder survives as an `arg` node, never as
		// pattern text the client would need a parser for.
		const attributeOf = async (tag: string, args: Record<string, unknown>) => {
			const mod = (await import(
				pathToFileURL(`${generated.path}/${tag}.server.ts`).href
			)) as Record<string, (args: unknown) => string>
			const name = `render${tag
				.split('-')
				.map(part => part.charAt(0).toUpperCase() + part.slice(1))
				.join('')}`
			const html = mod[name]?.({
				...args,
				i18n: i18nModule.i18nRecord(tag, 'de'),
			})
			const raw = html?.match(new RegExp(`<${tag}[^>]* i18n="([^"]*)"`))?.[1]
			if (!raw) throw new Error(`${tag} rendered no i18n attribute`)
			return JSON.parse(raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
		}
		expect(
			await attributeOf('form-tokenbox', { name: 'tags', label: 'Tags' }),
		).toEqual({
			added: ['Token hinzugefügt: ', { t: 'arg', a: 'token' }],
			duplicate: [{ t: 'arg', a: 'token' }, ' ist bereits in der Liste'],
			removed: ['Token entfernt: ', { t: 'arg', a: 'token' }],
		})
		expect(await attributeOf('form-colorgraph', {})).toEqual({
			outOfGamut: 'Farbe außerhalb des Farbraums',
		})
		// The retired carrier span (LT-195's interim idiom): the increment
		// label now rides the attribute, and no hidden span carries it.
		expect(await attributeOf('form-spinbutton', { name: 'q' })).toEqual({
			increment: 'Erhöhen',
		})
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

/* === Pattern-integrity walks (ADR 0030 s5, LT-219) === */

describe('the census pattern-integrity walks (LT-219)', () => {
	// A synthetic entry with injected catalogs (LT-196's pattern). `flat` is
	// client-referenced, so its translations answer to the narrowed client
	// evaluator, which carries only `arg` for this component.
	const probe = {
		tag: 'census-probe',
		i18nMessages: {
			greet: 'Hello, {name}!',
			count: '{n, plural, one {# item} other {# items}}',
			flat: '{n} items',
		},
		clientMessageKeys: ['flat'],
	} as unknown as RegistryEntry
	const gapsFor = async (overrides: Record<string, Record<string, string>>) =>
		(await collectI18n([probe], injectedCatalogs(overrides))).gaps.filter(
			gap => gap.status !== 'missing' && gap.status !== 'stale',
		)

	test('an unparseable translation is malformed — reported, and the build goes on', async () => {
		const gaps = await gapsFor({ de: { 'census-probe.greet': 'Hallo, {name' } })
		expect(gaps.map(gap => [gap.key, gap.status])).toEqual([
			['census-probe.greet', 'malformed'],
		])
		expect(gaps[0]?.detail).toBeTruthy()
	})

	test('a translation whose arguments differ from the source is an argument mismatch', async () => {
		const gaps = await gapsFor({
			de: { 'census-probe.greet': 'Hallo, {nom}!' },
		})
		expect(gaps).toEqual([
			{
				key: 'census-probe.greet',
				locale: 'de',
				status: 'argument-mismatch',
				detail: 'expected {name}, found {nom}',
			},
		])
	})

	test("a plural that does not cover the locale's categories is missing arms", async () => {
		// pl's cardinal set is {one, few, many, other}; de's is {one, other}.
		const pattern = '{n, plural, one {# x} other {# y}}'
		expect(
			await gapsFor({
				pl: { 'census-probe.count': pattern },
				de: { 'census-probe.count': pattern },
			}),
		).toEqual([
			{
				key: 'census-probe.count',
				locale: 'pl',
				status: 'missing-arms',
				detail: 'no few, many',
			},
		])
	})

	test('a client-referenced translation using an uncarried construct falls back (LT-350)', async () => {
		const plural = '{n, plural, one {# Ding} other {# Dinge}}'
		expect(
			await gapsFor({
				de: { 'census-probe.flat': plural, 'census-probe.count': plural },
			}),
		).toEqual([
			{ key: 'census-probe.flat', locale: 'de', status: 'client-fallback' },
		])
	})

	test('clean translations and i18n:sync placeholders report nothing', async () => {
		expect(
			await gapsFor({
				de: {
					'census-probe.greet': 'Hallo, {name}!',
					'census-probe.count': '{n, plural, one {# Ding} other {# Dinge}}',
					'census-probe.flat': '{n} Dinge',
				},
				pl: { 'census-probe.greet': '', 'census-probe.flat': '' },
			}),
		).toEqual([])
	})

	test('the census names each finding', () => {
		const formatted = formatCensus(
			translationCensus(
				[
					{ key: 'a.b', locale: 'de', status: 'malformed', detail: 'x' },
					{ key: 'a.c', locale: 'de', status: 'argument-mismatch' },
					{ key: 'a.d', locale: 'de', status: 'missing-arms' },
					{ key: 'a.e', locale: 'de', status: 'client-fallback' },
				],
				['de'],
			),
		)
		expect(formatted).toContain('malformed — ')
		expect(formatted).toContain('(x)')
		expect(formatted).toContain('argument mismatch — ')
		expect(formatted).toContain('missing plural arms — ')
		expect(formatted).toContain('client fallback — ')
		expect(formatted).not.toContain('⚠️')
	})

	test('falsification over the real catalogs: planted findings report, the committed catalogs report none', async () => {
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
				JSON.parse(readFileSync(join(i18nDir, file), 'utf8')),
			)
		}
		const integrity = <G extends { status: string }>(gaps: G[]) =>
			gaps.filter(gap => !['missing', 'stale', 'orphaned'].includes(gap.status))
		const clean = await collectI18n(Object.values(registry), {
			locales,
			overrides,
			manifest: new Map(),
		})
		expect(integrity(clean.gaps)).toEqual([])
		const de = { ...overrides.get('de') }
		de['form-tokenbox.added'] = 'Token hinzugefügt: {tok}'
		de['form-tokenbox.removed'] = 'Token entfernt: {token'
		de['form-tokenbox.duplicate'] =
			'{token, select, rot {Rot ist schon da} other {{token} ist schon da}}'
		de['form-colorgraph.outOfGamut'] =
			'{n, plural, other {Farbe außerhalb des Farbraums}}'
		overrides.set('de', de)
		const planted = await collectI18n(Object.values(registry), {
			locales,
			overrides,
			manifest: new Map(),
		})
		expect(
			integrity(planted.gaps)
				.map(gap => `${gap.key} ${gap.status}`)
				.sort(),
		).toEqual([
			'form-colorgraph.outOfGamut argument-mismatch',
			'form-colorgraph.outOfGamut client-fallback',
			'form-colorgraph.outOfGamut missing-arms',
			'form-tokenbox.added argument-mismatch',
			'form-tokenbox.duplicate client-fallback',
			'form-tokenbox.removed malformed',
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
			greeting: [{ name: 'name', kind: 'plain' }],
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

describe('the generated modules type `t` per key (LT-308)', async () => {
	const typedSource = (name: string, template: string) => `
${ICU_DECL} as const
export function ${name}({ count, i18n: { t } }: { count: number; i18n: I18n<typeof i18n> })
@{
	expose({})
	<>
		<c-el>${template}</c-el>
		<style>c-el { display: block }</style>
	</>
}`
	const build = (name: string, tag: string, template: string) => {
		const { component, diagnostics } = compileComponent(
			typedSource(name, template),
			`examples/x/${tag}.tsrx`,
			new Set(),
		)
		if (!component) throw new Error(JSON.stringify(diagnostics))
		return component
	}
	const good = build(
		'CTyped',
		'c-typed',
		`<span title={t.done}>{t.tasks({ count })}</span>`,
	)
	const typo = build('CTypo', 'c-typo', `<span title={t.fliter}>x</span>`)
	// LT-344: a plain `{x}` takes a string or a number; a select selector
	// stays a string.
	const plain = build(
		'CPlain',
		'c-plain',
		`<span title={t.greeting({ name: 3 })}>{t.greeting({ name: '3' })}</span>`,
	)
	const dir = createGeneratedDir('i18n-typed')
	afterAll(() => dir.cleanup())
	dir.emit('c-typed.server.ts', good.serverCode)
	dir.emit('c-typo.server.ts', typo.serverCode)
	dir.emit('c-plain.server.ts', plain.serverCode)
	await writeI18nModule(
		dir.path,
		await collectI18n(
			[good.entry, typo.entry, plain.entry],
			injectedCatalogs({}),
		),
	)
	const typecheck = (file: string) => {
		const proc = Bun.spawnSync(
			[
				'bunx',
				'tsc',
				'--ignoreConfig',
				'--noEmit',
				'--pretty',
				'false',
				'--strict',
				'--noUncheckedIndexedAccess',
				'--target',
				'esnext',
				'--module',
				'esnext',
				'--moduleResolution',
				'bundler',
				'--allowImportingTsExtensions',
				'--lib',
				'esnext,dom',
				'--skipLibCheck',
				'--types',
				'node',
				join(dir.relativePath, file),
			],
			{ cwd: join(import.meta.dir, '../../..') },
		)
		return `${proc.stdout.toString()}${proc.stderr.toString()}`
	}

	test('the authored annotation becomes the exact inline record', () => {
		expect(good.serverCode).toContain(
			'i18n: I18n<{ tasks: (args: { count: number }) => string; greeting: (args: { name: string | number }) => string; done: string }>',
		)
		expect(good.serverCode).not.toContain('typeof i18n')
	})

	test('a declared key with its exact arguments typechecks', () => {
		expect(typecheck('c-typed.server.ts')).toBe('')
	}, 60_000)

	test('a select selector stays a string, a plain argument widens (LT-344)', () => {
		const parsed = parseMessage('{g, select, a {A} other {O}} {n}')
		if (!parsed.ok) throw new Error(parsed.error)
		expect(messagesRecordType({ k: parsed.args })).toBe(
			'{ k: (args: { g: string; n: string | number }) => string }',
		)
	})

	test('a plain argument takes a number or a string (LT-344)', () => {
		expect(typecheck('c-plain.server.ts')).toBe('')
	}, 60_000)

	test('an undeclared key fails tsc in the generated program', () => {
		expect(typecheck('c-typo.server.ts')).toContain(
			"error TS2339: Property 'fliter' does not exist",
		)
	}, 60_000)
})
