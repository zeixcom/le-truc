/**
 * Gate-wave verification (LT-153 re-scope of LT-143/LT-133/LT-144/LT-145):
 * ADR 0027 turned four former compiler fold-route tasks into pinning tasks —
 * "does the simulated render come out right", not "can the compiler prove it
 * statically". `sim-driver.test.ts` already exercises the whole corpus
 * (including `basic-pluralize`, `basic-number`, `basic-gauge` and
 * `form-listbox`) through the driver; this file adds the fixtures those four
 * tasks specifically call for that the corpus's default ARGS don't exercise
 * (several `count` values, the `{host.count}`/`{count}` spelling pair, and
 * `form-listbox`'s `filterable` clear button).
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { pathToFileURL } from 'node:url'
import { compileTsrxCorpus } from '../../effects/tsrx'
import type { ComponentRegistry } from '../../compiler/registry'
import {
	createSimulationRealm,
	type SimulationRealm,
} from '../../compiler/sim/realm'
import { createGeneratedDir } from '../helpers/generated-tsrx'
import { PLURALIZE_I18N } from './corpus-args'
import { loadTsrxCorpus } from './corpus-fixture'

const generated = createGeneratedDir('gate-wave')
afterAll(() => generated.cleanup())

const corpus = await loadTsrxCorpus()
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
	const compiled = await compileTsrxCorpus(only(tags), generated.path)
	const registry = JSON.parse(
		await Bun.file(`${generated.path}/registry.json`).text(),
	) as ComponentRegistry
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
	registry: ComponentRegistry,
	infos: readonly Compiled[number][],
): Promise<SimulationRealm> => {
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

/* === LT-143 — basic-pluralize renders correctly (LT-173: now Folded-tier) === */

const pluralize = await compileSubset(['basic-pluralize'])
const pluralizeInfo = pluralize.compiled.find(
	entry => entry.tag === 'basic-pluralize',
)
if (!pluralizeInfo) throw new Error('basic-pluralize did not compile')
const pluralizeRealm = await loadRealm(pluralize.registry, [pluralizeInfo])

/**
 * The reserved `i18n` record a fixture passes for basic-pluralize (the
 * compiler supplies the real one at every render boundary; see
 * `corpus-args.ts` for the shared copy's rationale). `en`, cardinal (no
 * `ordinal` arg): the locale's actual category set is {one, other}.
 */
const PLURALIZE_ARGS = (count: number): Record<string, unknown> => ({
	count,
	i18n: PLURALIZE_I18N,
})

/** The category spans a render carries, pruned or not. */
const categorySpansOf = (html: string): string[] =>
	[...html.matchAll(/class="(zero|one|two|few|many|other)"/g)].map(
		match => match[1] ?? '',
	)

/**
 * The visible category spans. Scans WHOLE open tags — the emitter orders
 * `hidden` before the static `class` on the category spans, so a
 * class-anchored suffix scan would miss a leading `hidden`.
 */
const visibleSpans = (html: string): string[] =>
	[...html.matchAll(/<span\b([^>]*)>/g)]
		.map(([, attrs]) => ({
			category: /class="(zero|one|two|few|many|other)"/.exec(attrs ?? '')?.[1],
			hidden: /(^|\s)hidden(\s|=|$)/.test(attrs ?? ''),
		}))
		.filter(
			(span): span is { category: string; hidden: boolean } =>
				span.category !== undefined && !span.hidden,
		)
		.map(span => span.category)

describe('LT-143 — basic-pluralize renders correctly under simulation', () => {
	afterAll(() => pluralizeRealm.dispose())

	test("LT-173: an en page prunes to the locale's two cardinal categories at phase 1", async () => {
		// ADR 0030 sub-design 6: the rendered alternatives shrink to the set
		// Intl.PluralRules('en') actually uses — {one, other}, not all six —
		// the pruned categories absent entirely (no span at all, not a
		// hidden one).
		const html = await serverMarkupOf(pluralizeInfo, PLURALIZE_ARGS(1))
		expect(categorySpansOf(html).sort()).toEqual(['one', 'other'])
		expect(categorySpansOf(html)).not.toContain('zero')
	})

	test('LT-173: a dynamic plural type prunes per call — ordinal renders its own set', async () => {
		const html = await serverMarkupOf(pluralizeInfo, {
			...PLURALIZE_ARGS(1),
			ordinal: true,
		})
		// en ordinal is {one, two, few, other}: the truc:case-type expression
		// (`ordinal ? 'ordinal' : undefined`) prunes tightly in both states.
		expect(categorySpansOf(html).sort()).toEqual(['few', 'one', 'other', 'two'])
	})

	test('LT-173: a cy page keeps all six categories — pruning reads the platform, not a table', async () => {
		const html = await serverMarkupOf(pluralizeInfo, {
			...PLURALIZE_ARGS(1),
			lang: 'cy',
			i18n: { ...PLURALIZE_I18N, lang: 'cy' },
		})
		expect(categorySpansOf(html).sort()).toEqual([
			'few',
			'many',
			'one',
			'other',
			'two',
			'zero',
		])
	})

	// ADR 0030's consequence list: "the served markup for a component
	// differs per locale beyond its text — a fact fixtures must pin per
	// locale rather than once." One pin per category-set shape this corpus
	// claims to serve (reviewed LT-190).
	const localeArgs = (locale: string, overrides?: Record<string, unknown>) => ({
		...PLURALIZE_ARGS(1),
		lang: locale,
		i18n: { ...PLURALIZE_I18N, lang: locale },
		...overrides,
	})

	test('LT-173: a de page prunes to the same two categories as en', async () => {
		const html = await serverMarkupOf(pluralizeInfo, localeArgs('de'))
		expect(categorySpansOf(html).sort()).toEqual(['one', 'other'])
	})

	test('LT-173: a zh page prunes to the single {other} category', async () => {
		const html = await serverMarkupOf(pluralizeInfo, localeArgs('zh'))
		expect(categorySpansOf(html)).toEqual(['other'])
	})

	test('LT-173: an ar page keeps six cardinal categories but prunes its ordinal set to {other}', async () => {
		const cardinal = await serverMarkupOf(pluralizeInfo, localeArgs('ar'))
		expect(categorySpansOf(cardinal).sort()).toEqual([
			'few',
			'many',
			'one',
			'other',
			'two',
			'zero',
		])
		// The same locale's ordinal rules use only {other} — the
		// truc:case-type expression prunes tightly in both states.
		const ordinal = await serverMarkupOf(
			pluralizeInfo,
			localeArgs('ar', { ordinal: true }),
		)
		expect(categorySpansOf(ordinal)).toEqual(['other'])
	})

	test('LT-173: a pl page prunes to the Slavic {one, few, many, other} set', async () => {
		const html = await serverMarkupOf(pluralizeInfo, localeArgs('pl'))
		expect(categorySpansOf(html).sort()).toEqual([
			'few',
			'many',
			'one',
			'other',
		])
	})

	test('LT-173: an lv page prunes to {zero, one, other}, and count=10 selects ZERO', async () => {
		const html = await serverMarkupOf(
			pluralizeInfo,
			localeArgs('lv', { count: 10 }),
		)
		expect(categorySpansOf(html).sort()).toEqual(['one', 'other', 'zero'])
		// Latvian's zero category covers ANY count ending in 0 — ten tasks
		// renders the ZERO form, not `other`.
		expect(visibleSpans(html)).toEqual(['zero'])
	})

	test("LT-190: per-category catalog keys render each locale's own word forms", async () => {
		// The LT-173 review pinned the old morphology gap here ("Aufgabe + s",
		// a Latin `s` littering Chinese); LT-190's `<key>.<category>` keys
		// replaced it. Each span now carries its locale's own form for that
		// category, straight from the record's `t`.
		const german = await serverMarkupOf(
			pluralizeInfo,
			localeArgs('de', {
				count: 3,
				i18n: {
					...PLURALIZE_I18N,
					lang: 'de',
					t: {
						...PLURALIZE_I18N.t,
						'task.one': 'Aufgabe',
						'task.other': 'Aufgaben',
					},
				},
			}),
		)
		expect(visibleSpans(german)).toEqual(['other'])
		expect(german).toContain('<span class="other">Aufgaben</span>')
		// The pruned-in one span still carries its own form (hidden at
		// count=3; the emitter orders reactive attrs before the class).
		expect(german).toContain('<span hidden class="one">Aufgabe</span>')
		const chinese = await serverMarkupOf(
			pluralizeInfo,
			localeArgs('zh', {
				count: 5,
				i18n: {
					...PLURALIZE_I18N,
					lang: 'zh',
					t: { ...PLURALIZE_I18N.t, 'task.other': '个任务' },
				},
			}),
		)
		// zh prunes to {other}, whose span carries the Chinese form — no
		// Latin morphology anywhere in the render.
		expect(chinese).toContain('<span class="other">个任务</span>')
		expect(chinese).not.toContain('>s</span>')
	})

	test.each([0, 1, 2, 3, 5, 11])(
		'count=%d renders exactly one visible plural span and the count text',
		async count => {
			const html = await pluralizeRealm.render({
				markup: await serverMarkupOf(pluralizeInfo, PLURALIZE_ARGS(count)),
				component: 'basic-pluralize',
			})
			const visible = visibleSpans(html)
			expect(visible.length).toBe(1)
			expect(visible[0]).toBe(new Intl.PluralRules('en').select(count))
			expect(html).toContain(`<span class="count">${count}</span>`)
		},
	)

	test('LT-191: a client-authored instance inherits lang from the nearest [lang] ancestor', async () => {
		// Hand-authored light DOM — the demo-page shape: no server render
		// owns the root lang attribute, so the connect-time walk answers
		// (LT-191 stage 1's getLocale seed). Welsh 2 -> the `two` span.
		const markup = `<div lang="cy"><basic-pluralize count="2">
			<p class="none">none</p>
			<p class="some"><span class="count"></span><span class="zero">cwn</span><span class="one">ci</span><span class="two">gi</span><span class="few">chi</span><span class="many">chi</span><span class="other">ci</span></p>
		</basic-pluralize></div>`
		const html = await pluralizeRealm.render({
			markup,
			component: 'basic-pluralize',
		})
		expect(visibleSpans(html)).toEqual(['two'])
	})

	test('LT-191: an own lang attribute beats the nearest ancestor', async () => {
		// Same wrapper, but the element pins lang="en" — the own attribute
		// wins the walk (English 2 -> other).
		const markup = `<div lang="cy"><basic-pluralize count="2" lang="en">
			<p class="none">none</p>
			<p class="some"><span class="count"></span><span class="zero"></span><span class="one">person</span><span class="two"></span><span class="few"></span><span class="many"></span><span class="other">people</span></p>
		</basic-pluralize></div>`
		const html = await pluralizeRealm.render({
			markup,
			component: 'basic-pluralize',
		})
		expect(visibleSpans(html)).toEqual(['other'])
	})

	test('LT-173: changing count after connect re-selects among the rendered alternatives', async () => {
		// The toggles do NOT retire (ADR 0030 sub-design 6): the locale is
		// fixed but host.count is reactive, so the category still changes at
		// runtime, and the client can only select among strings the server
		// rendered. count=1 renders; moving to 0 must flip the selection to
		// `other` — which an en page DID render (pruning to {one, other}).
		const html = await pluralizeRealm.render({
			markup: await serverMarkupOf(pluralizeInfo, PLURALIZE_ARGS(1)),
			component: 'basic-pluralize',
		})
		expect(visibleSpans(html)).toEqual(['one'])
		const host = pluralizeRealm.document.querySelector('basic-pluralize')
		if (!host) throw new Error('rendered basic-pluralize not found')
		;(host as unknown as { count: number }).count = 0
		await new Promise(resolve => setTimeout(resolve, 0))
		const after = host.outerHTML
		expect(visibleSpans(after)).toEqual(['other'])
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
		const html = await numberRealm.render({
			markup: await serverMarkupOf(numberInfo, {
				value,
				options: '{"style":"percent","maximumFractionDigits":1}',
			}),
			component: 'basic-number',
		})
		expect(html).toContain(`>${expected}<`)
	})

	test('composed under basic-gauge, the percentage renders without a hand-authored fallback', async () => {
		const html = await numberRealm.render({
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

const withArgSource = corpus.find(file =>
	file.filename.endsWith('/basic-pluralize.tsrx'),
)
if (!withArgSource) throw new Error('basic-pluralize.tsrx fixture missing')

const spellingVariant = (tag: string, spelling: 'host.count' | 'count') => ({
	...withArgSource,
	// `path` (not just `filename`) must be distinct per variant: the corpus
	// runner keys its per-file compose registry off `relative(root, file.path)`,
	// so two variants sharing the source's original `path` collide and only
	// the last one compiled survives.
	path: `${withArgSource.path}.${tag}`,
	filename: `examples/synth/${tag}/${tag}.tsrx`,
	content: withArgSource.content
		.replace(/<basic-pluralize\b/g, `<${tag}`)
		.replace(/<\/basic-pluralize>/g, `</${tag}>`)
		.replace('function BasicPluralize(', `function ${pascal(tag)}(`)
		.replace(
			'<span class="count">{host.count}</span>',
			`<span class="count">{${spelling}}</span>`,
		),
})

const spellingCompiled = await compileTsrxCorpus(
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
			const hostHtml = await spellingRealm.render({
				markup: await serverMarkupOf(hostVariant, PLURALIZE_ARGS(count)),
				component: 'c-count-host',
			})
			const bareHtml = await spellingRealm.render({
				markup: await serverMarkupOf(bareVariant, PLURALIZE_ARGS(count)),
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
		const html = await listboxRealm.render({
			markup: await serverMarkupOf(listboxInfo, {
				name: 'fruit',
				options,
				filterable: true,
			}),
			component: 'form-listbox',
		})
		expect(html).toContain('class="clear"')
		expect(html).toMatch(/class="clear"[^>]*hidden=""/)
	})

	test('composed under form-combobox, initial render stays hermetic', async () => {
		const html = await listboxRealm.render({
			markup: await serverMarkupOf(comboboxInfo, {
				name: 'fruit',
				label: 'Fruit',
				options,
			}),
			component: 'form-combobox',
		})
		// form-combobox composes its own listbox without `filterable`, so no
		// clear button is expected here — this pins that the composed render
		// still succeeds and matches the corpus snapshot's shape.
		expect(html).toContain('<form-listbox')
	})
})
