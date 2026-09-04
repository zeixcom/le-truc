/**
 * Standalone unit tests for `analysis/loops.ts` (`runLoops`, LT-022 M5) and
 * `analysis/naming.ts` (LT-048): the same "hand-build an `AnalysisContext`,
 * call one pass" granularity `analysis.test.ts` already gives
 * `runHarvest`/`runEffects`/the selector engine, extended to loop planning
 * and name allocation so a regression there fails locally instead of only
 * via a golden diff.
 */
import { describe, expect, test } from 'bun:test'
import { runLoops } from '../../tsrx/analysis/loops'
import { addQuery, uniqueName } from '../../tsrx/analysis/naming'
import type { AnalysisContext, QueryPlan } from '../../tsrx/analysis/plan'
import { compileSource } from '../../tsrx/compiler'
import type { ComponentIR } from '../../tsrx/ir'

/** A context assembled by hand — the orchestration-free entry point. */
const contextFor = (component: ComponentIR): AnalysisContext => {
	const queries: AnalysisContext['queries'] = []
	return {
		component,
		source: component.source,
		diagnostics: [],
		routingSignals: [],
		registry: new Set(),
		queries,
		harvests: [],
		effects: [],
		childTags: new Set(),
		ambient: new Set(component.contextRefs),
		usedNames: new Set(['cEl', ...component.signals.map(s => s.name), 'host']),
		refNames: new Set(),
		ambiguousComposeNodes: new Set(),
		forPlans: new Map(),
		reconcilePlans: new Map(),
		addQuery: (base, selector, cardinality) => {
			const existing = queries.find(
				q => q.selector === selector && q.cardinality === cardinality,
			)
			if (existing) return existing.name
			queries.push({
				name: base,
				selector,
				cardinality,
				message: `${component.tag}: ${selector} missing`,
			})
			return base
		},
		collectAmbient: () => {},
		badFreeNames: () => [],
	}
}

describe('runLoops — Pass 1 (server-data @for → each())', () => {
	test('produces one ForClientPlan per server-data loop, keyed by its ForIR', () => {
		const { component } = compileSource(
			`export function C({ tabs }: { tabs: string[] })
			@{
				expose({})
				<>
					<c-el>
						<ul>
							@for (const tab of tabs) {
								<li data-tab>{tab}</li>
							}
						</ul>
					</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		if (!component) throw new Error('component must compile')
		const ctx = contextFor(component)
		runLoops(ctx)

		expect(ctx.diagnostics).toEqual([])
		expect(ctx.reconcilePlans.size).toBe(0)
		expect(ctx.forPlans.size).toBe(1)
		const plan = [...ctx.forPlans.values()][0]
		expect(plan?.itemParam).toBe('tab')
		// The iterable's own free name (`tabs`) is reused as the collection name.
		expect(plan?.collection).toBe('tabs')
		expect(plan?.effects).toEqual([])
		// The loop output got a query registered so the client can find it.
		expect(ctx.queries).toEqual([
			{
				name: 'tabs',
				selector: 'li',
				cardinality: 'many',
				message: 'c-el: li missing',
			},
		])
	})
})

describe('runLoops — Pass 1b (reactive-list @for → reconcile())', () => {
	test('produces one ReconcilePlan for a declared createList loop', () => {
		const { component } = compileSource(
			`export function C({ initial }: { initial?: string[] })
			@{
				const items = createList<string>(initial, { keyConfig: 'item' })
				expose({})
				<>
					<c-el>
						<ul data-container>
							@for (const item of items; key k) {
								<li><span>{item}</span></li>
							}
						</ul>
					</c-el>
					<style>c-el { color: red }</style>
				</>
			}
import { createList } from '@zeix/le-truc'`,
			'c.tsrx',
		)
		if (!component) throw new Error('component must compile')
		const ctx = contextFor(component)
		runLoops(ctx)

		expect(ctx.diagnostics).toEqual([])
		// The reactive list is excluded from Pass 1 (`continue` on `listSignal`).
		expect(ctx.forPlans.size).toBe(0)
		expect(ctx.reconcilePlans.size).toBe(1)
		const plan = [...ctx.reconcilePlans.values()][0]
		expect(plan?.signal).toBe('items')
		expect(plan?.itemParam).toBe('item')
		expect(plan?.keyParam).toBe('k')
		expect(plan?.tag).toBe(component.tag)
	})
})

describe('uniqueName', () => {
	test('returns the base name when free', () => {
		const used = new Set<string>()
		expect(uniqueName(used, 'tabs')).toBe('tabs')
		expect(used.has('tabs')).toBe(true)
	})

	test('suffixes with an incrementing counter starting at 2 on collision', () => {
		const used = new Set(['tabs'])
		expect(uniqueName(used, 'tabs')).toBe('tabs2')
		expect(uniqueName(used, 'tabs')).toBe('tabs3')
		expect([...used].sort()).toEqual(['tabs', 'tabs2', 'tabs3'])
	})

	test('claims the returned name so a second caller cannot reuse it', () => {
		const used = new Set<string>()
		uniqueName(used, 'el')
		expect(used.has('el')).toBe(true)
	})
})

describe('addQuery', () => {
	const component = {
		tag: 'c-el',
		refReasons: new Map(),
		// LT-123: `addQuery` consults this to keep an
		// author-declared optional ref optional.
		optionalRefs: new Set<string>(),
	} as unknown as ComponentIR

	test('registers a new query and returns its variable name', () => {
		const used = new Set<string>()
		const queries: QueryPlan[] = []
		const name = addQuery(
			used,
			queries,
			new Set(),
			component,
			new Set(),
			'span',
			'c-el span',
			'one',
		)
		expect(name).toBe('span')
		expect(queries).toEqual([
			{
				name: 'span',
				selector: 'c-el span',
				cardinality: 'one',
				message: 'c-el: c-el span missing',
			},
		])
	})

	test('deduplicates by selector + cardinality, returning the existing name', () => {
		const used = new Set<string>()
		const queries: QueryPlan[] = []
		const first = addQuery(
			used,
			queries,
			new Set(),
			component,
			new Set(),
			'span',
			'c-el span',
			'one',
		)
		const second = addQuery(
			used,
			queries,
			new Set(),
			component,
			new Set(),
			'ignoredBase',
			'c-el span',
			'one',
		)
		expect(second).toBe(first)
		expect(queries).toHaveLength(1)
	})

	test('same selector with a different cardinality is a distinct query', () => {
		const used = new Set<string>()
		const queries: QueryPlan[] = []
		addQuery(
			used,
			queries,
			new Set(),
			component,
			new Set(),
			'span',
			'c-el span',
			'one',
		)
		addQuery(
			used,
			queries,
			new Set(),
			component,
			new Set(),
			'spans',
			'c-el span',
			'many',
		)
		expect(queries).toHaveLength(2)
	})

	test('registers a registry child tag for type-flow imports, once', () => {
		// addQuery reads the tag from the SELECTOR's own leading token, so a
		// child-tag selector (not one scoped under the parent) is what triggers it.
		const used = new Set<string>()
		const queries: QueryPlan[] = []
		const childTags = new Set<string>()
		const registry = new Set(['child-el'])
		addQuery(
			used,
			queries,
			childTags,
			component,
			registry,
			'childEl',
			'child-el',
			'one',
		)
		addQuery(
			used,
			queries,
			childTags,
			component,
			registry,
			'childEl2',
			'child-el.other',
			'many',
		)
		expect(childTags).toEqual(new Set(['child-el']))
	})

	test('does not register the component itself as a child tag', () => {
		const used = new Set<string>()
		const queries: QueryPlan[] = []
		const childTags = new Set<string>()
		addQuery(
			used,
			queries,
			childTags,
			component,
			new Set(['c-el']),
			'self',
			'c-el',
			'one',
		)
		expect(childTags.size).toBe(0)
	})
})
