/**
 * The docs build's simulation pass (ADR 0027 stage 2, LT-169).
 *
 * The pass is driven through its seams (`createRealm`, `readMarkup`) rather
 * than against the real corpus: the driver's own corpus behavior is pinned
 * by `server/tests/compiler/sim-driver.test.ts`, and re-loading the same
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
import { reportDiagnostics } from '../../compiler/build-report'
import type { ComponentRegistry, RegistryEntry } from '../../compiler/registry'
import type {
	SimDiagnostic,
	SimulationRealm,
} from '../../compiler/simulation/contract'
import type { EvaluationTier } from '../../compiler/tier'
import { LOCALES } from '../../config'
import {
	assertSimulatedTier,
	gateOnSimReport,
	simulateCorpus,
} from '../../effects/simulate'

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
 *
 * Note what it does NOT need since LT-263: a document. The seam is
 * `(markup, component, locale, options) → (html, diagnostics)`, so a fake
 * that satisfies it is plain data — which is the cheapest available proof
 * that no DOM crosses the boundary (ADR 0035 sub-design 3 limb 3).
 */
const fakeRealm = (diagnostics: SimDiagnostic[] = []) => {
	const log: string[] = []
	const loadedTags: string[] = []
	const realm: SimulationRealm = {
		runtime: 'bun',
		diagnostics,
		loadedTags,
		async load() {
			log.push('load')
			loadedTags.push(`def-${loadedTags.length}`)
		},
		async render({ markup, component }) {
			log.push(`render:${component}`)
			return { html: markup, diagnostics: [] }
		},
		dispose() {
			log.push('dispose')
		},
	}
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
		const result = await simulateCorpus({
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
		const result = await simulateCorpus({
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

describe('an absent substrate routes Static (ADR 0034 s5, LT-256)', () => {
	test('the pass reroutes the Simulated subjects, records why, and rewrites the registry', async () => {
		const written: ComponentRegistry[] = []
		const log: string[] = []
		const result = await simulateCorpus({
			registry: registryOf(
				entry('x-folded', 'folded'),
				entry('x-sim', 'simulated'),
			),
			resolveProvider: async () => null,
			writeRegistry: async reg => {
				written.push(reg)
			},
			readMarkup: async () => {
				throw new Error('no substrate means no realm, so no render call')
			},
			log: message => log.push(message),
		})
		// The routing outcome: rerouted, realm never opened, nothing rendered.
		expect(result.rerouted).toEqual(['x-sim'])
		expect(result.realmOpened).toBe(false)
		expect(result.simulated).toEqual([])
		// The census row names the component and the reason — a census record,
		// not a warning, so it rides the plain log.
		expect(log.join('\n')).toContain('x-sim')
		expect(log.join('\n')).toContain('unavailable-substrate')
		// The registry rewrite is what the tier census later reads.
		expect(written).toHaveLength(1)
		const simEntry = written[0]?.['x-sim']
		expect(simEntry?.tier).toBe('static')
		expect(simEntry?.routingSignals).toHaveLength(1)
		expect(simEntry?.routingSignals?.[0]?.origin).toBe('unavailable-substrate')
		expect(simEntry?.routingSignals?.[0]?.resolution.by).toBe(
			'substrate-unavailable',
		)
		// The Folded entry rides along untouched — the reroute is scoped to
		// the components the classifier routed Simulated.
		expect(written[0]?.['x-folded']?.tier).toBe('folded')
		expect(written[0]?.['x-folded']?.routingSignals).toEqual([])
	})

	test('a substrate present never touches the registry and reroutes nothing', async () => {
		const { realm } = fakeRealm()
		const written: ComponentRegistry[] = []
		const result = await simulateCorpus({
			registry: registryOf(entry('x-sim', 'simulated')),
			createRealm: () => realm,
			// The seam realm means the substrate IS present: the pass must not
			// resolve (or consult) the provider at all, even though it would
			// answer null.
			resolveProvider: async () => null,
			writeRegistry: async reg => {
				written.push(reg)
			},
			readMarkup: async () => '<x-sim></x-sim>',
			log: () => {},
		})
		expect(result.rerouted).toEqual([])
		expect(written).toHaveLength(0)
		expect(result.simulated).toEqual(['x-sim'])
	})

	test('rerouted components are accounted in rerouted, not in skipped', async () => {
		const result = await simulateCorpus({
			registry: registryOf(
				entry('x-folded', 'folded'),
				entry('x-static', 'static'),
				entry('x-sim', 'simulated'),
			),
			resolveProvider: async () => null,
			writeRegistry: async () => {},
			log: () => {},
		})
		expect(result.skipped).toEqual([
			{ tag: 'x-folded', tier: 'folded' },
			{ tag: 'x-static', tier: 'static' },
		])
		expect(result.rerouted).toEqual(['x-sim'])
	})
})

describe('disposal is end-of-build (LT-152 review, obligation 1)', () => {
	test('dispose runs once, after every render, never between them', async () => {
		const { realm, log } = fakeRealm()
		await simulateCorpus({
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
			simulateCorpus({
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
		const report = reportDiagnostics(
			[{ kind: 'component-throw', component: 'x-a', message: 'boom' }],
			[],
		)
		expect(report.unclassified.length).toBe(1)
		expect(() => gateOnSimReport(report)).toThrow(/<x-a>/)
	})

	test('a clean report does not fail the build', () => {
		expect(() => gateOnSimReport(reportDiagnostics([], []))).not.toThrow()
	})

	test('the pass surfaces the report it gated on', async () => {
		const { realm } = fakeRealm()
		const result = await simulateCorpus({
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
		const result = await simulateCorpus({
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
		const result = await simulateCorpus({
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
		const result = await simulateCorpus({
			registry: registryOf(entry('x-a', 'simulated')),
			createRealm: () => realm,
			readMarkup: async () => null,
			log: () => {},
		})
		expect(result.withoutMarkup).toEqual(['x-a'])
		expect(result.simulated).toEqual([])
	})
})
