/**
 * Server-Simulation driver: patch table, realm application, and the
 * hermetic-quiescence serialization boundary (ADR 0027 sub-designs 2, 9 and
 * 10, LT-151, amended LT-154).
 *
 * These tests define their components inline through the realm's recording
 * registry rather than importing generated modules, so they exercise the
 * DRIVER without depending on `server/generated/` (the LT-140 race). The
 * cross-runtime equivalence of a real generated component is
 * `scripts/sim-portability-check.ts`.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import {
	assertSynchronousWindow,
	SimulationBoundaryError,
} from '../../tsrx/sim/boundary.ts'
import {
	detectRuntime,
	NETWORK_GLOBALS,
	PROTOTYPE_PATCHES,
	patchesFor,
	REALM_GLOBALS,
	SIM_PATCH_TABLE,
	STUB_GLOBALS,
} from '../../tsrx/sim/patch-table.ts'
import {
	childrenFirstOrder,
	createSimulationRealm,
	type SimDiagnostic,
	type SimulationRealm,
} from '../../tsrx/sim/realm.ts'
import {
	type ClassifiedDiagnostic,
	classifyDiagnostic,
	formatSimDiagnostic,
	formatSimReport,
	reportDiagnostics,
} from '../../tsrx/sim/report.ts'

/* === Helpers === */

let active: SimulationRealm | null = null

/** Create a realm that is disposed after the test, whatever happens. */
const withRealm = (): SimulationRealm => {
	active = createSimulationRealm()
	return active
}

afterEach(() => {
	active?.dispose()
	active = null
})

const globalRecord = globalThis as unknown as Record<string, unknown>

/* === Tests === */

describe('patch table', () => {
	test('is declarative data, not behaviour', () => {
		for (const patch of SIM_PATCH_TABLE) {
			for (const value of Object.values(patch))
				expect(typeof value).not.toBe('function')
			expect(['realm', 'stub', 'network', 'prototype']).toContain(patch.kind)
		}
	})

	test('names are unique within each column', () => {
		for (const column of [REALM_GLOBALS, STUB_GLOBALS, NETWORK_GLOBALS]) {
			const names = column.map(patch => patch.name)
			expect(new Set(names).size).toBe(names.length)
		}
	})

	test('covers the globals ADR 0027 sub-design 2 names', () => {
		const realm = REALM_GLOBALS.map(patch => patch.name)
		for (const name of ['HTMLElement', 'customElements', 'document', 'Event'])
			expect(realm).toContain(name)

		const stubs = STUB_GLOBALS.map(patch => patch.name)
		for (const name of [
			'ResizeObserver',
			'matchMedia',
			'IntersectionObserver',
			'requestAnimationFrame',
		])
			expect(stubs).toContain(name)

		expect(NETWORK_GLOBALS.map(patch => patch.name)).toContain('fetch')
		expect(PROTOTYPE_PATCHES.map(patch => patch.method)).toContain(
			'attachInternals',
		)
	})

	test('patchesFor keeps unscoped entries for every runtime', () => {
		for (const runtime of ['bun', 'node', 'deno', 'unknown'] as const)
			expect(patchesFor(REALM_GLOBALS, runtime).length).toBe(
				REALM_GLOBALS.length,
			)
	})

	test('detects the host runtime', () => {
		expect(detectRuntime()).toBe('bun')
	})
})

describe('realm application', () => {
	test('forces the realm classes over whatever the host runtime had', () => {
		const before = globalRecord.Event
		const realm = withRealm()
		expect(globalRecord.HTMLElement).toBe(
			realm.window.HTMLElement as unknown as object,
		)
		expect(globalRecord.document).toBe(realm.document as unknown as object)
		expect(globalRecord.customElements).toBe(
			realm.window.customElements as unknown as object,
		)
		// The de-shadowing case: Bun and Deno both ship a native Event.
		expect(globalRecord.Event).toBe(realm.window.Event as unknown as object)
		expect(globalRecord.Event).not.toBe(before)
	})

	test('restores every touched global on dispose', () => {
		const before = new Map(
			['HTMLElement', 'document', 'customElements', 'Event', 'fetch'].map(
				name => [name, globalRecord[name]],
			),
		)
		const realm = createSimulationRealm()
		realm.dispose()
		for (const [name, value] of before)
			expect(globalRecord[name]).toBe(value as never)
	})

	test('stubs absent constructors inert', () => {
		withRealm()
		const observer = new (
			globalRecord.ResizeObserver as new () => {
				observe: () => void
				disconnect: () => void
			}
		)()
		expect(() => {
			observer.observe()
			observer.disconnect()
		}).not.toThrow()

		const media = (
			globalRecord.matchMedia as (query: string) => {
				matches: boolean
				media: string
			}
		)('(min-width: 40rem)')
		expect(media.matches).toBe(false)
		expect(media.media).toBe('(min-width: 40rem)')
	})

	test('forces requestAnimationFrame to a never-calling stub', () => {
		withRealm()
		let called = false
		const handle = (
			globalRecord.requestAnimationFrame as (callback: () => void) => number
		)(() => {
			called = true
		})
		expect(handle).toBe(0)
		expect(called).toBe(false)
	})

	test('normalizes attachInternals to throw', () => {
		const realm = withRealm()
		const element = realm.document.createElement('div')
		expect(() =>
			(element as unknown as { attachInternals: () => void }).attachInternals(),
		).toThrow()
	})
})

describe('closed network (sub-design 2d)', () => {
	test('fetch never settles and is reported, without reaching the network', async () => {
		const realm = withRealm()
		const pending = (globalRecord.fetch as (input: string) => Promise<unknown>)(
			'https://example.com',
		)
		expect(realm.diagnostics.some(entry => entry.kind === 'network')).toBe(true)
		// Never settles (amended sub-design 2d): a rejection would route a
		// fetching component to `@catch` under the quiescence drain; the honest
		// state is `@pending`, so the stub must never resolve OR reject.
		const settled = await Promise.race([
			pending.then(
				() => 'resolved',
				() => 'rejected',
			),
			new Promise(resolve => setTimeout(() => resolve('pending'), 10)),
		])
		expect(settled).toBe('pending')
	})

	test('a component fetching at connect fails loudly', async () => {
		const realm = withRealm()
		await realm.load(async () => {
			customElements.define(
				'probe-fetcher',
				class extends HTMLElement {
					connectedCallback() {
						void (
							globalThis as unknown as { fetch: (u: string) => unknown }
						).fetch('https://example.com/data.json')
						this.setAttribute('data-connected', '')
					}
				},
			)
		})
		await realm.render({
			markup: '<probe-fetcher></probe-fetcher>',
			component: 'probe-fetcher',
		})
		const network = realm.diagnostics.filter(entry => entry.kind === 'network')
		expect(network.length).toBe(1)
		expect(network[0]?.message).toContain('sub-design 2d')
		// The fetch happened inside probe-fetcher's connect window, so the
		// build warning names it (LT-163's attribution criterion).
		expect(network[0]?.component).toBe('probe-fetcher')
	})

	test('XMLHttpRequest throws on construction', () => {
		withRealm()
		expect(
			() => new (globalRecord.XMLHttpRequest as new () => unknown)(),
		).toThrow(/network access from a simulated connect/)
	})

	test('an unhandled rejection is contained and attributed (LT-163)', async () => {
		const realm = withRealm()
		await realm.load(async () => {
			customElements.define(
				'probe-rejector',
				class extends HTMLElement {
					connectedCallback() {
						this.setAttribute('data-connected', '')
					}
				},
			)
		})
		await realm.render({
			markup: '<probe-rejector></probe-rejector>',
			component: 'probe-rejector',
		})
		// A REAL connect-time rejection cannot be provoked under bun:test: the
		// runner fails the file on any rejection still unhandled when the host
		// delivers the `unhandledRejection` event, even though the realm's own
		// process-level handler has already recorded it (the end-to-end path —
		// reject at connect, event arrives in a macrotask after render()
		// returns, attributed via the render-window convention — was verified
		// against plain `bun`). Emitting the exact event the host delivers
		// exercises the same handler and attribution wiring.
		process.emit(
			'unhandledRejection',
			new Error('boom, unhandled'),
			Promise.resolve(),
		)
		const rejections = realm.diagnostics.filter(
			entry => entry.kind === 'unhandled-rejection',
		)
		expect(rejections.length).toBe(1)
		expect(rejections[0]?.component).toBe('probe-rejector')
		expect(rejections[0]?.message).toContain('boom, unhandled')
	})
})

describe('serialization boundary (sub-design 9)', () => {
	test('passes synchronous work through', () => {
		expect(assertSynchronousWindow(() => 'sync', 'probe')).toBe('sync')
	})

	test('refuses a promise-returning window', () => {
		expect(() => assertSynchronousWindow(async () => 'async', 'probe')).toThrow(
			SimulationBoundaryError,
		)
	})

	test('names the component and the rule it broke', () => {
		try {
			assertSynchronousWindow(async () => 'async', 'basic-counter')
			throw new Error('expected a SimulationBoundaryError')
		} catch (error) {
			expect((error as Error).message).toContain('basic-counter')
			expect((error as Error).message).toContain('sub-design 9')
		}
	})

	test('render() runs under the assertion', async () => {
		const realm = withRealm()
		const html = await realm.render({ markup: '<p>plain</p>', component: 'p' })
		expect(html).toBe('<p>plain</p>')
	})
})

describe('children-first replay order (sub-design 2/10)', () => {
	// `childrenFirstOrder` only reads `.name` — no realm or real HTMLElement
	// needed, so a bare class stands in for the constructor.
	const def = (name: string) => ({
		name,
		elementConstructor: class {} as unknown as CustomElementConstructor,
	})

	test('orders composed children before their composing ancestor', () => {
		const definitions = [def('probe-parent'), def('probe-child')]
		const composesTags = (tag: string) =>
			tag === 'probe-parent' ? ['probe-child'] : []
		expect(
			childrenFirstOrder(definitions, composesTags).map(entry => entry.name),
		).toEqual(['probe-child', 'probe-parent'])
	})

	test('leaves unrelated entries in recorded order', () => {
		const definitions = [def('probe-a'), def('probe-b')]
		expect(
			childrenFirstOrder(definitions, () => []).map(entry => entry.name),
		).toEqual(['probe-a', 'probe-b'])
	})

	test('resolves a transitive chain (grandchild before child before parent)', () => {
		const definitions = [def('probe-root'), def('probe-mid'), def('probe-leaf')]
		const composesTags = (tag: string) =>
			tag === 'probe-root'
				? ['probe-mid']
				: tag === 'probe-mid'
					? ['probe-leaf']
					: []
		expect(
			childrenFirstOrder(definitions, composesTags).map(entry => entry.name),
		).toEqual(['probe-leaf', 'probe-mid', 'probe-root'])
	})
})

describe('two-phase load and render', () => {
	test('load records definitions instead of performing them', async () => {
		const realm = withRealm()
		await realm.load(async () => {
			customElements.define('probe-plain', class extends HTMLElement {})
		})
		expect(realm.definitions.map(entry => entry.name)).toEqual(['probe-plain'])
		// Not yet in the real registry: the upgrade belongs to the sync window.
		expect(realm.window.customElements.get('probe-plain')).toBeUndefined()
	})

	test('connect-time writes land in the serialized HTML', async () => {
		const realm = withRealm()
		await realm.load(async () => {
			customElements.define(
				'probe-writer',
				class extends HTMLElement {
					connectedCallback() {
						const span = this.querySelector('span')
						if (span) span.textContent = String(this.getAttribute('count'))
						this.setAttribute('data-upgraded', '')
					}
				},
			)
		})
		const html = await realm.render({
			markup: '<probe-writer count="7"><span></span></probe-writer>',
			component: 'probe-writer',
		})
		expect(html).toContain('data-upgraded')
		expect(html).toContain('<span>7</span>')
	})

	test('a child defined before its parent connects first', async () => {
		const realm = withRealm()
		const order: string[] = []
		await realm.load(async () => {
			// Generated clients import their children before calling
			// defineComponent, so the child's definition is recorded first.
			customElements.define(
				'probe-child',
				class extends HTMLElement {
					connectedCallback() {
						order.push('child')
					}
				},
			)
			customElements.define(
				'probe-parent',
				class extends HTMLElement {
					connectedCallback() {
						order.push('parent')
					}
				},
			)
		})
		await realm.render({
			markup: '<probe-parent><probe-child></probe-child></probe-parent>',
			component: 'probe-parent',
		})
		expect(order).toEqual(['child', 'parent'])
	})

	test('a connect throw is contained and attributed, never fatal', async () => {
		const realm = withRealm()
		await realm.load(async () => {
			customElements.define(
				'probe-thrower',
				class extends HTMLElement {
					connectedCallback() {
						throw new Error('boom at connect')
					}
				},
			)
		})
		const markup = '<probe-thrower>fallback</probe-thrower>'
		// jsdom's own CEReactions wrapper contains a connectedCallback throw and
		// routes it to the virtualConsole, so the build continues and the element
		// serializes with whatever it wrote before throwing.
		const html = await realm.render({ markup, component: 'probe-thrower' })
		expect(html).toContain('fallback')
		const contained = realm.diagnostics.find(entry =>
			entry.message.includes('boom at connect'),
		)
		expect(contained?.kind).toBe('jsdom-error')
		expect(contained?.component).toBe('probe-thrower')
	})

	test('a throw that escapes jsdom degrades to the plain SSR output', async () => {
		const realm = withRealm()
		await realm.load(async () => {
			// A name without a dash: `define()` itself throws, outside any
			// CEReactions wrapper — sub-design 2c's containment is the only guard.
			customElements.define('probeinvalid', class extends HTMLElement {})
		})
		const markup = '<probe-holder>fallback</probe-holder>'
		const html = await realm.render({ markup, component: 'probe-holder' })
		expect(html).toBe(markup)
		const contained = realm.diagnostics.find(
			entry => entry.kind === 'component-throw',
		)
		expect(contained?.component).toBe('probe-holder')
	})

	test('microtask-deferred connect writes land in the shipped HTML (amended sub-design 9)', async () => {
		const realm = withRealm()
		await realm.load(async () => {
			customElements.define(
				'probe-deferred',
				class extends HTMLElement {
					connectedCallback() {
						queueMicrotask(() => {
							this.setAttribute('data-late', '')
						})
					}
				},
			)
		})
		const html = await realm.render({
			markup: '<probe-deferred></probe-deferred>',
			component: 'probe-deferred',
		})
		// The quiescence drain is what makes composition render at all
		// (form-colorgraph's resolveDependencies deferral) — a strictly
		// synchronous window would drop this write entirely.
		expect(html).toContain('data-late')
	})

	test('a non-quiescent component ships its last observed state and reports, never hangs', async () => {
		const realm = withRealm()
		await realm.load(async () => {
			customElements.define(
				'probe-looping',
				class extends HTMLElement {
					connectedCallback() {
						this.#tick()
					}
					#tick() {
						const n = Number(this.getAttribute('data-n') ?? '0')
						this.setAttribute('data-n', String(n + 1))
						// Bounded well past `maxTurns` below so the drain's own bound is
						// what stops it, not this cap — but still terminates, so an
						// infinite self-rescheduling microtask chain never starves the
						// test runner's own event loop.
						if (n < 20) queueMicrotask(() => this.#tick())
					}
				},
			)
		})
		const html = await realm.render({
			markup: '<probe-looping></probe-looping>',
			component: 'probe-looping',
			maxTurns: 3,
		})
		expect(typeof html).toBe('string')
		const nonQuiescent = realm.diagnostics.find(
			entry => entry.kind === 'non-quiescent',
		)
		expect(nonQuiescent?.component).toBe('probe-looping')
	})
})

describe('build report (LT-163)', () => {
	const diagnostic = (overrides: Partial<SimDiagnostic>): SimDiagnostic => ({
		kind: 'jsdom-error',
		message: 'Not implemented: something',
		...overrides,
	})

	test('format names the component, the condition, and the decision', () => {
		const text = formatSimDiagnostic(
			diagnostic({
				kind: 'component-throw',
				component: 'probe-x',
				message: 'boom',
			}),
		)
		expect(text).toContain('probe-x')
		expect(text).toContain('boom')
		// Tier 2, Contained: the wording says the component keeps its
		// server-rendered markup — it does not say the page broke (ADR 0028
		// sub-design 4, error-message-lifecycle criterion 3).
		expect(text).toContain('server-rendered markup')
		expect(text).not.toMatch(/broken|crashed|failed to render/)
	})

	test('format survives a diagnostic no render window owns', () => {
		const text = formatSimDiagnostic(diagnostic({ component: undefined }))
		expect(text).toContain('outside any render window')
	})

	test('classification matches kind, component, and message', () => {
		const classification: ClassifiedDiagnostic = {
			kind: 'jsdom-error',
			component: 'probe-x',
			message: /not implemented/i,
			reason: 'jsdom does not implement it.',
		}
		expect(
			classifyDiagnostic(diagnostic({ component: 'probe-x' }), classification),
		).toBe(true)
		expect(
			classifyDiagnostic(diagnostic({ component: 'probe-y' }), classification),
		).toBe(false)
		expect(
			classifyDiagnostic(
				diagnostic({ kind: 'console', component: 'probe-x' }),
				classification,
			),
		).toBe(false)
		expect(
			classifyDiagnostic(
				diagnostic({ component: 'probe-x', message: 'other' }),
				classification,
			),
		).toBe(false)
	})

	test('the report partitions, and the formatted output explains its classifications', () => {
		const known = diagnostic({
			component: 'form-colorgraph',
			message: "Not implemented: HTMLCanvasElement's getContext() method",
		})
		const report = reportDiagnostics([
			known,
			diagnostic({ component: 'probe-new', message: 'surprise' }),
		])
		expect(report.classified.length).toBe(1)
		expect(report.unclassified.length).toBe(1)
		const text = formatSimReport(report)
		expect(text).toContain('surprise')
		expect(text).toContain('classified (standing)')
		expect(text).toContain('jsdom does not implement canvas')
	})
})

describe('load-once assertion (sub-design 10)', () => {
	test('load() throws when an import records no new definitions', async () => {
		const realm = withRealm()
		let alreadyImported = false
		const importer = async () => {
			if (alreadyImported) return
			alreadyImported = true
			customElements.define('probe-once', class extends HTMLElement {})
		}
		await realm.load(importer)
		await expect(realm.load(importer)).rejects.toThrow(
			/recorded no element definitions/,
		)
	})
})
