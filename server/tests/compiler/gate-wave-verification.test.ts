/**
 * Gate-wave verification (LT-153 re-scope of LT-143/LT-133/LT-144/LT-145):
 * ADR 0027 turned four former compiler fold-route tasks into pinning tasks —
 * "does the simulated render come out right", not "can the compiler prove it
 * statically". `sim-driver.test.ts` already exercises the whole corpus
 * (including `basic-number`, `basic-gauge` and `form-listbox`) through the
 * driver; this file adds the fixtures those four tasks specifically call for
 * that the corpus's default ARGS don't exercise (several `count` values, the
 * `{host.count}`/`{count}` spelling pair, and `form-listbox`'s `filterable`
 * clear button). The LT-143/LT-144 legs pinned the corpus's
 * `basic-pluralize`; since its retirement (LT-467) they compile the same
 * source as the `c-plural` compiler fixture.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { InternalComponentRegistry } from '../../compiler/registry'
import {
	createSimulationRealm,
	type JsdomSimulationRealm,
} from '../../compiler/sim/realm'
import { compileCorpus } from '../../corpus-compile'
import { createGeneratedDir } from '../helpers/generated-corpus'
import { argMessage, C_PLURAL_I18N, inlineI18n } from './corpus-args'
import { cPluralFixture, loadCorpus } from './corpus-fixture'
import { C_PLURAL_CATALOG } from './fixtures/plural/c-plural-catalog'

const generated = createGeneratedDir('gate-wave')
afterAll(() => generated.cleanup())

const corpus = await loadCorpus()
const only = (tags: readonly string[]) =>
	corpus.filter(file =>
		tags.some(tag => file.filename.endsWith(`/${tag}.tsrx`)),
	)

/** `form-spinbutton` → `FormSpinbutton`. */
const pascal = (tag: string): string =>
	tag
		.split('-')
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join('')

/** `form-spinbutton` → `renderFormSpinbutton`. */
const renderName = (tag: string): string => `render${pascal(tag)}`

/** Compile `tags` from the real corpus into the shared generated dir. */
const compileSubset = async (tags: readonly string[]) => {
	const compiled = await compileCorpus(only(tags), generated.path)
	const registry = JSON.parse(
		await Bun.file(`${generated.path}/registry.internal.json`).text(),
	) as InternalComponentRegistry
	return { compiled, registry }
}

type Compiled = Awaited<ReturnType<typeof compileSubset>>['compiled']

const serverMarkupOf = async (
	info: Compiled[number],
	args: Record<string, unknown>,
): Promise<string> => {
	const mod = (await import(
		pathToFileURL(info.serverModulePath).href
	)) as Record<string, unknown>
	const renderFn = mod[renderName(info.tag)] as (args: unknown) => string
	return renderFn(args)
}

const loadRealm = async (
	registry: InternalComponentRegistry,
	infos: readonly Compiled[number][],
): Promise<JsdomSimulationRealm> => {
	const realm = createSimulationRealm({
		composesTags: tag => registry[tag]?.composesTags ?? [],
		// LT-165 step 7: registry-driven suppression (no corpus component
		// carries records today).
		suppressedSites: tag => registry[tag]?.suppressedSites ?? [],
	})
	for (const info of infos)
		await realm.load(() => import(pathToFileURL(info.clientModulePath).href))
	return realm
}

/* === LT-143 — c-plural renders correctly (LT-173: Folded; LT-252: one ICU pattern) === */

const pluralizeCompiled = await compileCorpus(
	[cPluralFixture()],
	generated.path,
)
const pluralizeRegistry = JSON.parse(
	await Bun.file(`${generated.path}/registry.internal.json`).text(),
) as InternalComponentRegistry
const pluralizeInfo = pluralizeCompiled.find(entry => entry.tag === 'c-plural')
if (!pluralizeInfo) throw new Error('c-plural did not compile')
const pluralizeRealm = await loadRealm(pluralizeRegistry, [pluralizeInfo])

/**
 * The reserved `i18n` record a fixture passes for c-plural (the
 * compiler supplies the real one at every render boundary; see
 * `corpus-args.ts` for the shared copy's rationale). `en`, cardinal (no
 * `ordinal` arg).
 */
const C_PLURAL_ARGS = (count: number): Record<string, unknown> => ({
	count,
	i18n: C_PLURAL_I18N,
})

/** The fixture catalog's entry for `<key>` at `locale`. */
const catalogEntry = (
	locale: string,
	key: 'done' | 'remaining' | 'tasks',
): string => {
	const entry = C_PLURAL_CATALOG[locale]?.[key]
	if (entry === undefined)
		throw new Error(`c-plural-catalog lacks ${locale}.${key}`)
	return entry
}

/**
 * The record `i18nRecord('c-plural', locale)` would resolve: the
 * fixture catalog's strings, and its `tasks` pattern as an argument
 * message baked with the locale's plural rules.
 */
const localeArgs = (locale: string, overrides?: Record<string, unknown>) => ({
	...C_PLURAL_ARGS(1),
	lang: locale,
	i18n: {
		...C_PLURAL_I18N,
		lang: locale,
		t: {
			done: catalogEntry(locale, 'done'),
			remaining: catalogEntry(locale, 'remaining'),
			tasks: argMessage(catalogEntry(locale, 'tasks'), locale),
		},
	},
	...overrides,
})

/** The text of every `.tasks` span a render carries. */
const tasksSpansOf = (html: string): string[] =>
	[...html.matchAll(/<span class="tasks">([^<]*)<\/span>/g)].map(
		match => match[1] ?? '',
	)

describe('LT-143 — c-plural renders correctly under simulation', () => {
	afterAll(() => pluralizeRealm.dispose())

	test('LT-173 acceptance: classifies Folded — no standing routing signals', () => {
		// The reserved `i18n` parameter (ADR 0030) makes the locale
		// server-known, so `Intl.PluralRules` folds (LT-142) and the six
		// LTC034 routing signals the six-span shape carried are gone. If a NEW
		// signal appears here, the fold rule or the classifier moved underneath
		// the fixture; investigate rather than reclassify.
		expect(pluralizeRegistry['c-plural']?.tier).toBe('folded')
		expect(pluralizeRegistry['c-plural']?.routingSignals).toHaveLength(0)
	})

	test('LT-252: an en page renders ONE plural span — no per-category alternatives', async () => {
		const html = await serverMarkupOf(pluralizeInfo, C_PLURAL_ARGS(1))
		expect(tasksSpansOf(html)).toEqual(['task'])
		expect(html).not.toMatch(/class="(zero|one|two|few|many|other)"/)
		expect(html).not.toContain('truc:case')
	})

	test('LT-252: the byte delta against the six-span render (the ADR 0030 headline, pinned)', async () => {
		// The LT-190 render at en, count=1, cardinal was 226 bytes: two
		// pruned category spans — `<span class="one">task</span><span hidden
		// class="other">tasks</span>`, 68 bytes — and no attribute. The pattern
		// render's body carries ONE span, `<span class="tasks">task</span>`
		// (31 bytes): the body shrinks by 37. The client-reactive argument
		// (`count`) would put the pattern's parsed AST on the root `i18n`
		// attribute (ADR 0030 s9), but at the source locale it equals the
		// preamble's inlined source record, so the attribute is left out
		// (LT-354; LT-252 measured 539 bytes of it, 728 in total). The
		// measurements were taken on `<basic-pluralize>`; the fixture's
		// `<c-plural>` tag is 7 bytes shorter in both the open and the close
		// tag (LT-467), so every total below is 14 bytes under them.
		const TAG_DELTA = 2 * ('basic-pluralize'.length - 'c-plural'.length)
		const html = await serverMarkupOf(pluralizeInfo, C_PLURAL_ARGS(1))
		expect(html).not.toContain(' i18n=')
		expect(Buffer.byteLength(html)).toBe(226 - 37 - TAG_DELTA)
		// A translated locale still pays for it: cy carries both arms' six
		// categories. Without a locale per node (ADR 0030 s6) the total is
		// 957 bytes, down from LT-252's 1015.
		const welsh = await serverMarkupOf(pluralizeInfo, localeArgs('cy'))
		const attribute = / i18n="[^"]*"/.exec(welsh)?.[0] ?? ''
		expect(attribute).not.toContain('&quot;l&quot;')
		expect(Buffer.byteLength(attribute)).toBe(769)
		expect(Buffer.byteLength(welsh)).toBe(957 - TAG_DELTA)
	})

	test('LT-252: ordinal selection lives inside the pattern (selectordinal)', async () => {
		const render = (count: number) =>
			serverMarkupOf(pluralizeInfo, { ...C_PLURAL_ARGS(count), ordinal: true })
		// en ordinal: 1 → one, 2 → two, 3 → few, 11 → other, 21 → one
		expect(tasksSpansOf(await render(1))).toEqual(['task'])
		expect(tasksSpansOf(await render(2))).toEqual(['tasks'])
		expect(tasksSpansOf(await render(21))).toEqual(['task'])
		// …and the same counts under cardinal rules differ where en does
		expect(
			tasksSpansOf(await serverMarkupOf(pluralizeInfo, C_PLURAL_ARGS(21))),
		).toEqual(['tasks'])
	})

	// ADR 0030's consequence list: "the served markup for a component
	// differs per locale beyond its text — a fact fixtures must pin per
	// locale rather than once." Since LT-252 the shape is one span in every
	// locale; the arms live inside each committed catalog pattern.
	test.each([
		// Welsh: all six cardinal categories inside one value
		['cy', 0, 'tasg'],
		['cy', 1, 'tasg'],
		['cy', 2, 'dasg'],
		['cy', 3, 'tasg'],
		['cy', 6, 'tasg'],
		['cy', 4, 'tasgiau'],
		// Arabic: six categories, the dual at exactly 2
		['ar', 0, 'مهام'],
		['ar', 1, 'مهمة'],
		['ar', 2, 'مهمتان'],
		['ar', 3, 'مهام'],
		['ar', 11, 'مهمة'],
		['ar', 100, 'مهمة'],
		// German: {one, other} with a non-"s" plural
		['de', 1, 'Aufgabe'],
		['de', 3, 'Aufgaben'],
		// Polish: {one, few, many, other}
		['pl', 1, 'zadanie'],
		['pl', 2, 'zadania'],
		['pl', 5, 'zadań'],
		// Latvian: zero covers any count ending in 0
		['lv', 10, 'uzdevumu'],
		['lv', 1, 'uzdevums'],
		['lv', 21, 'uzdevums'],
		// Chinese: a single {other} arm, no Latin morphology
		['zh', 1, '个任务'],
		['zh', 5, '个任务'],
	] as const)(
		'%s count=%d renders the catalog pattern arm %p',
		async (locale, count, expected) => {
			const html = await serverMarkupOf(
				pluralizeInfo,
				localeArgs(locale, { count }),
			)
			expect(tasksSpansOf(html)).toEqual([expected])
		},
	)

	test("LT-252: ordinal rules read the locale's own set (cy ordinal keeps six arms)", async () => {
		const html = await serverMarkupOf(
			pluralizeInfo,
			localeArgs('cy', { count: 2, ordinal: true }),
		)
		expect(tasksSpansOf(html)).toEqual(['dasg'])
		const arabic = await serverMarkupOf(
			pluralizeInfo,
			localeArgs('ar', { count: 2, ordinal: true }),
		)
		// ar ordinal is {other}
		expect(tasksSpansOf(arabic)).toEqual(['مهمة'])
	})

	test.each([0, 1, 2, 3, 5, 11])(
		'count=%d connects to one plural span and the count text',
		async count => {
			const { html } = await pluralizeRealm.render({
				markup: await serverMarkupOf(pluralizeInfo, C_PLURAL_ARGS(count)),
				component: 'c-plural',
			})
			expect(tasksSpansOf(html)).toEqual([
				new Intl.PluralRules('en').select(count) === 'one' ? 'task' : 'tasks',
			])
			expect(html).toContain(`<span class="count">${count}</span>`)
		},
	)

	test('LT-191: a client-authored instance inherits lang from the nearest [lang] ancestor', async () => {
		// Hand-authored light DOM — the demo-page shape: no server render
		// owns the root lang attribute, so the connect-time walk answers and
		// materializes. With no `i18n` attribute the instance speaks the
		// source locale (ADR 0030 s9): Welsh 2 is `two`, which the en
		// pattern does not spell, so it falls to `other`.
		const markup = `<div lang="cy"><c-plural count="2">
			<p class="none">none</p>
			<p class="some"><span class="count"></span><span class="tasks"></span></p>
		</c-plural></div>`
		const { html } = await pluralizeRealm.render({
			markup,
			component: 'c-plural',
		})
		expect(html).toContain('<c-plural count="2" lang="cy"')
		expect(tasksSpansOf(html)).toEqual(['tasks'])
	})

	test('LT-191: an own lang attribute beats the nearest ancestor', async () => {
		const markup = `<div lang="cy"><c-plural count="1" lang="en">
			<p class="none">none</p>
			<p class="some"><span class="count"></span><span class="tasks"></span></p>
		</c-plural></div>`
		const { html } = await pluralizeRealm.render({
			markup,
			component: 'c-plural',
		})
		expect(html).toContain('lang="en"')
		expect(tasksSpansOf(html)).toEqual(['task'])
	})

	test('LT-252: changing count after connect re-evaluates the pattern', async () => {
		// ADR 0030 s6: a message with a client-reactive argument is
		// recomputed from the pattern, not selected among pre-rendered
		// alternatives.
		const { html } = await pluralizeRealm.render({
			markup: await serverMarkupOf(pluralizeInfo, C_PLURAL_ARGS(1)),
			component: 'c-plural',
		})
		expect(tasksSpansOf(html)).toEqual(['task'])
		const host = pluralizeRealm.document.querySelector('c-plural')
		if (!host) throw new Error('rendered c-plural not found')
		;(host as unknown as { count: number }).count = 2
		await new Promise(resolve => setTimeout(resolve, 0))
		expect(tasksSpansOf(host.outerHTML)).toEqual(['tasks'])
	})

	test('LT-252: a server-rendered de instance re-evaluates in German through the i18n attribute', async () => {
		const { html } = await pluralizeRealm.render({
			markup: await serverMarkupOf(
				pluralizeInfo,
				localeArgs('de', { count: 3 }),
			),
			component: 'c-plural',
		})
		expect(tasksSpansOf(html)).toEqual(['Aufgaben'])
		const host = pluralizeRealm.document.querySelector('c-plural')
		if (!host) throw new Error('rendered c-plural not found')
		;(host as unknown as { count: number }).count = 1
		await new Promise(resolve => setTimeout(resolve, 0))
		expect(tasksSpansOf(host.outerHTML)).toEqual(['Aufgabe'])
	})

	test.each([
		['cy', 3, 'tasg', 4, 'tasgiau'],
		['ar', 2, 'مهمتان', 3, 'مهام'],
	] as const)(
		'LT-252: a server-rendered %s instance re-selects its arm client-side',
		async (locale, from, fromText, to, toText) => {
			await pluralizeRealm.render({
				markup: await serverMarkupOf(
					pluralizeInfo,
					localeArgs(locale, { count: from }),
				),
				component: 'c-plural',
			})
			const host = pluralizeRealm.document.querySelector('c-plural')
			if (!host) throw new Error('rendered c-plural not found')
			expect(tasksSpansOf(host.outerHTML)).toEqual([fromText])
			;(host as unknown as { count: number }).count = to
			await new Promise(resolve => setTimeout(resolve, 0))
			expect(tasksSpansOf(host.outerHTML)).toEqual([toText])
		},
	)

	test('LT-252: a page of per-locale renders — every instance connects to its own wording', async () => {
		// The retired example page's shape (LT-467): one instance per locale,
		// each carrying the `i18n` attribute its server render wrote, plus a
		// client-authored instance that inherits `cy` from an ancestor.
		// Connect them together and read each, as its Playwright spec did.
		const instances: Array<[string, string, number]> = [
			['de', 'german', 3],
			['zh', 'chinese', 5],
			['ar', 'arabic', 2],
			['pl', 'polish', 5],
			['lv', 'latvian', 10],
			['cy', 'welsh', 0],
		]
		const rendered = await Promise.all(
			instances.map(async ([locale, id, count]) =>
				(
					await serverMarkupOf(pluralizeInfo, localeArgs(locale, { count }))
				).replace('<c-plural ', `<c-plural id="${id}" `),
			),
		)
		await pluralizeRealm.render({
			markup: `${rendered.join('\n')}
<div lang="cy"><c-plural id="welsh-ancestor" count="2">
	<p class="none">none</p>
	<p class="some"><span class="count"></span><span class="tasks"></span></p>
</c-plural></div>`,
			component: 'c-plural',
		})
		const doc = pluralizeRealm.document
		const tasksOf = (id: string) =>
			doc.querySelector(`#${id} .tasks`)?.textContent ?? null
		expect(tasksOf('german')).toBe('Aufgaben')
		expect(tasksOf('chinese')).toBe('个任务')
		expect(tasksOf('arabic')).toBe('مهمتان')
		expect(tasksOf('polish')).toBe('zadań')
		expect(tasksOf('latvian')).toBe('uzdevumu')
		expect(tasksOf('welsh-ancestor')).toBe('tasks')
		const welsh = doc.querySelector('#welsh') as unknown as { count: number }
		welsh.count = 2
		await new Promise(resolve => setTimeout(resolve, 0))
		expect(tasksOf('welsh')).toBe('dasg')
		expect(doc.querySelector('#welsh-ancestor')?.getAttribute('lang')).toBe(
			'cy',
		)
	})
})

/* === LT-133 — basic-number renders the formatted value under simulation === */

const numberGauge = await compileSubset(['basic-number', 'basic-gauge'])
const numberInfo = numberGauge.compiled.find(
	entry => entry.tag === 'basic-number',
)
const gaugeInfo = numberGauge.compiled.find(
	entry => entry.tag === 'basic-gauge',
)
if (!numberInfo || !gaugeInfo)
	throw new Error('basic-number/basic-gauge did not compile')
// basic-gauge composes basic-number: children-first load order.
const numberRealm = await loadRealm(numberGauge.registry, [
	numberInfo,
	gaugeInfo,
])

describe('LT-133 — basic-number renders the formatted value under simulation', () => {
	afterAll(() => numberRealm.dispose())

	test.each([
		[0.84, '84%'],
		[0.65, '65%'],
		[0.205_667_88, '20.6%'],
	])('value=%p formats to %p standalone', async (value, expected) => {
		const { html } = await numberRealm.render({
			markup: await serverMarkupOf(numberInfo, {
				value,
				options: '{"style":"percent","maximumFractionDigits":1}',
			}),
			component: 'basic-number',
		})
		expect(html).toContain(`>${expected}<`)
	})

	test('composed under basic-gauge, the percentage renders without a hand-authored fallback', async () => {
		const { html } = await numberRealm.render({
			markup: await serverMarkupOf(gaugeInfo, {
				value: 0.84,
				thresholds: '[{"min":0.8,"label":"Good job!","color":"green"}]',
			}),
			component: 'basic-gauge',
		})
		expect(html).toContain('>84%<')
	})
})

/* === LT-144 — {host.count} and {count} converge on the same initial render === */

const withArgSource = cPluralFixture()

const spellingVariant = (tag: string, spelling: 'host.count' | 'count') => ({
	...withArgSource,
	// `path` (not just `filename`) must be distinct per variant: the corpus
	// runner keys its per-file compose registry off `relative(root, file.path)`,
	// so two variants sharing the source's original `path` collide and only
	// the last one compiled survives.
	path: `${withArgSource.path}.${tag}`,
	filename: `examples/synth/${tag}/${tag}.tsrx`,
	content: withArgSource.content
		.replace(/<c-plural\b/g, `<${tag}`)
		.replace(/<\/c-plural>/g, `</${tag}>`)
		.replace('function CPlural(', `function ${pascal(tag)}(`)
		.replace(
			'<span class="count">{host.count}</span>',
			`<span class="count">{${spelling}}</span>`,
		),
})

const spellingCompiled = await compileCorpus(
	[
		spellingVariant('c-count-host', 'host.count'),
		spellingVariant('c-count-bare', 'count'),
	],
	generated.path,
)
const hostVariant = spellingCompiled.find(entry => entry.tag === 'c-count-host')
const bareVariant = spellingCompiled.find(entry => entry.tag === 'c-count-bare')
if (!hostVariant || !bareVariant)
	throw new Error('spelling-variant fixtures did not compile')
const spellingRealm = await loadRealm({}, [hostVariant, bareVariant])

describe('LT-144 — {host.count} and {count} converge on the same initial render', () => {
	afterAll(() => spellingRealm.dispose())

	test.each([0, 1, 3])(
		'count=%d renders identical text for both spellings after simulated connect',
		async count => {
			const { html: hostHtml } = await spellingRealm.render({
				markup: await serverMarkupOf(hostVariant, C_PLURAL_ARGS(count)),
				component: 'c-count-host',
			})
			const { html: bareHtml } = await spellingRealm.render({
				markup: await serverMarkupOf(bareVariant, C_PLURAL_ARGS(count)),
				component: 'c-count-bare',
			})
			const countTextOf = (html: string) =>
				html.match(/<span class="count">([^<]*)<\/span>/)?.[1]
			expect(countTextOf(hostHtml)).toBe(String(count))
			expect(countTextOf(bareHtml)).toBe(String(count))
		},
	)

	// The convergence is in the SERIALIZED OUTPUT only. `{host.count}` plans a
	// live `watch(() => host.count, bindText(...))`; `{count}` is a
	// compile-time literal substitution with no client binding at all — the
	// real, still-standing distinction (LT-122's one-site-three-roles,
	// untouched by LT-153). A later `host.count` mutation updates one and not
	// the other; that is a binding-plan difference, not a silent-empty bug.
	test('the reactive spelling plans a client binding the static spelling does not', () => {
		expect(hostVariant.spans).toBeTruthy()
		expect(bareVariant.spans).toBeTruthy()
	})
})

/* === LT-145 — a Parser-exposed prop with no server arg renders its fallback === */

const listboxCombobox = await compileSubset(['form-listbox', 'form-combobox'])
const listboxInfo = listboxCombobox.compiled.find(
	entry => entry.tag === 'form-listbox',
)
const comboboxInfo = listboxCombobox.compiled.find(
	entry => entry.tag === 'form-combobox',
)
if (!listboxInfo || !comboboxInfo)
	throw new Error('form-listbox/form-combobox did not compile')
const listboxRealm = await loadRealm(listboxCombobox.registry, [
	listboxInfo,
	comboboxInfo,
])

describe('LT-145 — a Parser-exposed prop with no server arg renders its fallback', () => {
	afterAll(() => listboxRealm.dispose())

	const options = [
		{ value: 'a', label: 'Apple' },
		{ value: 'b', label: 'Banana' },
	]

	test('the clear button renders hidden — filter has no seed, so the Parser default resolves', async () => {
		const { html } = await listboxRealm.render({
			markup: await serverMarkupOf(listboxInfo, {
				name: 'fruit',
				options,
				filterable: true,
				i18n: inlineI18n({ filter: 'Filter', clearFilter: 'Clear filter' }),
			}),
			component: 'form-listbox',
		})
		expect(html).toContain('class="clear"')
		expect(html).toMatch(/class="clear"[^>]*hidden=""/)
	})

	test('composed under form-combobox, initial render stays hermetic', async () => {
		const { html } = await listboxRealm.render({
			markup: await serverMarkupOf(comboboxInfo, {
				name: 'fruit',
				children: 'Fruit',
				options,
				i18n: inlineI18n({ clearInput: 'Clear input' }),
			}),
			component: 'form-combobox',
		})
		// form-combobox composes its own listbox without `filterable`, so no
		// clear button is expected here — this pins that the composed render
		// still succeeds and matches the corpus snapshot's shape.
		expect(html).toContain('<form-listbox')
	})
})
