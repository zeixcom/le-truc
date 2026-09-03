/**
 * Server-Simulation driver: patch table, realm application, and the
 * synchronous serialization boundary (ADR 0027 sub-designs 2 and 9, LT-151).
 *
 * These tests define their components inline through the realm's recording
 * registry rather than importing generated modules, so they exercise the
 * DRIVER without depending on `server/generated/` (the LT-140 race). The
 * cross-runtime equivalence of a real generated component is
 * `scripts/sim-portability-check.ts`.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import {
	runSynchronously,
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
	createSimulationRealm,
	type SimulationRealm,
} from '../../tsrx/sim/realm.ts'

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
	test('fetch rejects and is reported, without reaching the network', async () => {
		const realm = withRealm()
		await expect(
			(globalRecord.fetch as (input: string) => Promise<unknown>)(
				'https://example.com',
			),
		).rejects.toThrow(/Network access from a simulated connect/)
		expect(realm.diagnostics.some(entry => entry.kind === 'network')).toBe(true)
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
		realm.render({
			markup: '<probe-fetcher></probe-fetcher>',
			component: 'probe-fetcher',
		})
		const network = realm.diagnostics.filter(entry => entry.kind === 'network')
		expect(network.length).toBe(1)
		expect(network[0]?.message).toContain('sub-design 2d')
	})

	test('XMLHttpRequest throws on construction', () => {
		withRealm()
		expect(
			() => new (globalRecord.XMLHttpRequest as new () => unknown)(),
		).toThrow(/Network access from a simulated connect/)
	})
})

describe('serialization boundary (sub-design 9)', () => {
	test('passes synchronous work through', () => {
		expect(runSynchronously(() => 'sync', 'probe')).toBe('sync')
	})

	test('refuses a promise-returning window', () => {
		expect(() => runSynchronously(async () => 'async', 'probe')).toThrow(
			SimulationBoundaryError,
		)
	})

	test('names the component and the rule it broke', () => {
		try {
			runSynchronously(async () => 'async', 'basic-counter')
			throw new Error('expected a SimulationBoundaryError')
		} catch (error) {
			expect((error as Error).message).toContain('basic-counter')
			expect((error as Error).message).toContain('sub-design 9')
		}
	})

	test('render() runs under the assertion', () => {
		const realm = withRealm()
		expect(() =>
			realm.render({ markup: '<p>plain</p>', component: 'p' }),
		).not.toThrow()
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
		const html = realm.render({
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
		realm.render({
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
		const html = realm.render({ markup, component: 'probe-thrower' })
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
		const html = realm.render({ markup, component: 'probe-holder' })
		expect(html).toBe(markup)
		const contained = realm.diagnostics.find(
			entry => entry.kind === 'component-throw',
		)
		expect(contained?.component).toBe('probe-holder')
	})

	test('reports work that lands after the boundary', async () => {
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
		const html = realm.render({
			markup: '<probe-deferred></probe-deferred>',
			component: 'probe-deferred',
		})
		expect(html).not.toContain('data-late')
		await realm.checkDeferredActivation('probe-deferred', html)
		expect(
			realm.diagnostics.some(entry => entry.kind === 'deferred-activation'),
		).toBe(true)
	})
})
