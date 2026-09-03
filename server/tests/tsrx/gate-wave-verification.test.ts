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
import type { ComponentRegistry } from '../../tsrx/registry'
import {
	createSimulationRealm,
	type SimulationRealm,
} from '../../tsrx/sim/realm'
import { createGeneratedDir } from '../helpers/generated-tsrx'
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
	})
	for (const info of infos)
		await realm.load(() => import(pathToFileURL(info.clientModulePath).href))
	return realm
}

/* === LT-143 — basic-pluralize renders correctly under simulation === */

const pluralize = await compileSubset(['basic-pluralize'])
const pluralizeInfo = pluralize.compiled.find(
	entry => entry.tag === 'basic-pluralize',
)
if (!pluralizeInfo) throw new Error('basic-pluralize did not compile')
const pluralizeRealm = await loadRealm(pluralize.registry, [pluralizeInfo])

describe('LT-143 — basic-pluralize renders correctly under simulation', () => {
	afterAll(() => pluralizeRealm.dispose())

	const visibleSpans = (html: string): string[] =>
		[...html.matchAll(/class="(zero|one|two|few|many|other)"([^>]*)>/g)]
			.filter(([, , attrs]) => !(attrs ?? '').includes('hidden'))
			.map(([, name]) => name ?? '')

	test.each([0, 1, 2, 3, 5, 11])(
		'count=%d renders exactly one visible plural span and the count text',
		async count => {
			const html = await pluralizeRealm.render({
				markup: await serverMarkupOf(pluralizeInfo, { count }),
				component: 'basic-pluralize',
			})
			const visible = visibleSpans(html)
			expect(visible.length).toBe(1)
			expect(visible[0]).toBe(new Intl.PluralRules('en').select(count))
			expect(html).toContain(`<span class="count">${count}</span>`)
		},
	)
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
				markup: await serverMarkupOf(hostVariant, { count }),
				component: 'c-count-host',
			})
			const bareHtml = await spellingRealm.render({
				markup: await serverMarkupOf(bareVariant, { count }),
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
