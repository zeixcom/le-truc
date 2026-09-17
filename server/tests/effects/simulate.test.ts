/**
 * The docs build's simulation pass (ADR 0027 stage 2, LT-169).
 *
 * The pass is driven through its seams (`createRealm`, `readMarkup`) rather
 * than against the real corpus: the driver's own corpus behavior is pinned
 * by `server/tests/tsrx/sim-driver.test.ts`, and re-loading the same
 * generated client modules in a second place in the same process is exactly
 * what the load-once assertion forbids (ADR 0027 sub-design 10). What is
 * tested here is the wiring the build adds around the driver — WHICH
 * components reach it, when a realm is opened at all, when it is disposed,
 * and what fails the build.
 *
 * Both directions are pinned throughout. A test that only asserts "the
 * Folded tag was not rendered" passes just as well when nothing is rendered
 * at all (the vacuous-assertion trap LT-177 documented), so every negative
 * here is paired with the positive that proves the pass ran.
 */

import { describe, expect, test } from 'bun:test'
import { JSDOM } from 'jsdom'
import { LOCALES } from '../../config'
import {
	assertSimulatedTier,
	gateOnSimReport,
	simulateTsrxCorpus,
} from '../../effects/simulate'
import type { ComponentRegistry, RegistryEntry } from '../../tsrx/registry'
import type { SimDiagnostic, SimulationRealm } from '../../tsrx/sim/realm'
import { reportDiagnostics } from '../../tsrx/sim/report'
import type { EvaluationTier } from '../../tsrx/tier'

/* === Fixtures === */

const entry = (tag: string, tier: EvaluationTier): RegistryEntry =>
	({
		tag,
		name: tag,
		source: `examples/fake/${tag}/${tag}.tsrx`,
		serverModule: `${tag}.server.ts`,
		clientModule: `${tag}.client.ts`,
		css: `${tag}.css`,
		propsType: null,
		exposedProps: {},
		composesTags: [],
		tier,
		routingSignals: [],
		suppressedSites: [],
	}) as unknown as RegistryEntry

const registryOf = (...entries: RegistryEntry[]): ComponentRegistry =>
	Object.fromEntries(entries.map(e => [e.tag, e]))

/**
 * A realm that records what the pass asked it to do, in order.
 */
const fakeRealm = (diagnostics: SimDiagnostic[] = []) => {
	const log: string[] = []
	const definitions: Array<{ name: string }> = []
	const realm = {
		runtime: 'bun',
		window: undefined,
		document: new JSDOM('').window.document,
		diagnostics,
		definitions,
		async load() {
			log.push('load')
			definitions.push({ name: `def-${definitions.length}` })
		},
		async render({
			markup,
			component,
		}: {
			markup: string
			component: string
			locale?: string
		}) {
			log.push(`render:${component}`)
			return markup
		},
		dispose() {
			log.push('dispose')
		},
	} as unknown as SimulationRealm
	return { realm, log }
}

/* === Tests === */

describe('the tier invariant (ADR 0029 — a realm is opened for the Simulated tier only)', () => {
	test('assertSimulatedTier passes the Simulated tier and refuses the other two', () => {
		expect(() => assertSimulatedTier('x-a', 'simulated')).not.toThrow()
		expect(() => assertSimulatedTier('x-a', 'folded')).toThrow(/folded tier/)
		expect(() => assertSimulatedTier('x-a', 'static')).toThrow(/static tier/)
		// The message names the component — the build report's whole job.
		expect(() => assertSimulatedTier('x-a', 'folded')).toThrow(/<x-a>/)
	})

	test('the pass renders Simulated-tier components and only those', async () => {
		const { realm, log } = fakeRealm()
		const result = await simulateTsrxCorpus({
			registry: registryOf(
				entry('x-folded', 'folded'),
				entry('x-sim', 'simulated'),
				entry('x-static', 'static'),
			),
			createRealm: () => realm,
			readMarkup: async subject => `<${subject.tag}></${subject.tag}>`,
			log: () => {},
		})
		// Positive first: the pass really did run.
		expect(result.simulated).toEqual(['x-sim'])
		// One occurrence per locale — the pass renders the whole matrix (LT-174)
		expect(result.occurrences).toBe(LOCALES.length)
		expect(result.locales).toEqual(LOCALES)
		expect(log).toContain('render:x-sim')
		// Negative: neither other tier reached the realm, and both are
		// accounted for rather than silently dropped.
		expect(log.some(step => step.startsWith('render:x-folded'))).toBe(false)
		expect(log.some(step => step.startsWith('render:x-static'))).toBe(false)
		expect(result.skipped).toEqual([
			{ tag: 'x-folded', tier: 'folded' },
			{ tag: 'x-static', tier: 'static' },
		])
		// One load, for the one Simulated-tier component.
		expect(log.filter(step => step === 'load').length).toBe(1)
	})

	test('a corpus with no Simulated-tier component opens no realm at all', async () => {
		let created = 0
		const result = await simulateTsrxCorpus({
			registry: registryOf(entry('x-folded', 'folded'), entry('x-s', 'static')),
			createRealm: () => {
				created++
				return fakeRealm().realm
			},
			readMarkup: async () => '<x/>',
			log: () => {},
		})
		expect(created).toBe(0)
		expect(result.realmOpened).toBe(false)
		expect(result.skipped.length).toBe(2)
	})
})

describe('disposal is end-of-build (LT-152 review, obligation 1)', () => {
	test('dispose runs once, after every render, never between them', async () => {
		const { realm, log } = fakeRealm()
		await simulateTsrxCorpus({
			registry: registryOf(
				entry('x-a', 'simulated'),
				entry('x-b', 'simulated'),
			),
			createRealm: () => realm,
			readMarkup: async subject =>
				`<${subject.tag}>1</${subject.tag}><${subject.tag}>2</${subject.tag}>`,
			log: () => {},
		})
		expect(log.filter(step => step === 'dispose').length).toBe(1)
		expect(log.at(-1)).toBe('dispose')
		expect(log.indexOf('dispose')).toBeGreaterThan(
			log.lastIndexOf('render:x-b'),
		)
	})

	test('a failing gate still disposes — the realm never outlives the pass', async () => {
		const { realm, log } = fakeRealm([
			{ kind: 'component-throw', component: 'x-a', message: 'boom' },
		])
		await expect(
			simulateTsrxCorpus({
				registry: registryOf(entry('x-a', 'simulated')),
				createRealm: () => realm,
				readMarkup: async () => '<x-a></x-a>',
				log: () => {},
			}),
		).rejects.toThrow(/x-a/)
		expect(log.at(-1)).toBe('dispose')
	})
})

describe('the build report is the gate (LT-163 baseline, now the build’s own)', () => {
	test('an unclassified entry fails the build and names the component', () => {
		const report = reportDiagnostics([
			{ kind: 'component-throw', component: 'x-a', message: 'boom' },
		])
		expect(report.unclassified.length).toBe(1)
		expect(() => gateOnSimReport(report)).toThrow(/<x-a>/)
	})

	test('a clean report does not fail the build', () => {
		expect(() => gateOnSimReport(reportDiagnostics([]))).not.toThrow()
	})

	test('the pass surfaces the report it gated on', async () => {
		const { realm } = fakeRealm()
		const result = await simulateTsrxCorpus({
			registry: registryOf(entry('x-a', 'simulated')),
			createRealm: () => realm,
			readMarkup: async () => '<x-a></x-a>',
			log: () => {},
		})
		expect(result.report.unclassified).toEqual([])
	})
})

describe('occurrence scope', () => {
	test('each top-level occurrence renders, once per locale', async () => {
		const { realm, log } = fakeRealm()
		const result = await simulateTsrxCorpus({
			registry: registryOf(entry('x-a', 'simulated')),
			createRealm: () => realm,
			// Three occurrences, two of them byte-identical.
			readMarkup: async () =>
				'<x-a>one</x-a><p>chrome</p><x-a>two</x-a><x-a>one</x-a>',
			log: () => {},
		})
		// Three occurrences per locale, two of the three byte-identical —
		// every occurrence renders fresh (LT-193 removed the render cache).
		expect(result.occurrences).toBe(3 * LOCALES.length)
		expect(log.filter(step => step === 'render:x-a').length).toBe(
			3 * LOCALES.length,
		)
	})

	test('a nested occurrence renders with its outer one, not on its own', async () => {
		const { realm, log } = fakeRealm()
		const result = await simulateTsrxCorpus({
			registry: registryOf(entry('x-a', 'simulated')),
			createRealm: () => realm,
			readMarkup: async () => '<x-a><div><x-a>inner</x-a></div></x-a>',
			log: () => {},
		})
		expect(result.occurrences).toBe(LOCALES.length)
		expect(log.filter(step => step === 'render:x-a').length).toBe(
			LOCALES.length,
		)
	})

	test('a Simulated-tier component with no authored markup is reported, not skipped silently', async () => {
		const { realm } = fakeRealm()
		const result = await simulateTsrxCorpus({
			registry: registryOf(entry('x-a', 'simulated')),
			createRealm: () => realm,
			readMarkup: async () => null,
			log: () => {},
		})
		expect(result.withoutMarkup).toEqual(['x-a'])
		expect(result.simulated).toEqual([])
	})
})
