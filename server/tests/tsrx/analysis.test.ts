/**
 * Independent-pass tests for the analysis split (LT-022, M5): each pass in
 * `server/tsrx/analysis/` is a function over an explicitly constructed
 * `AnalysisContext` — no `analyzeClient` orchestration needed. These tests
 * exercise one pass at a time against a hand-built context, the
 * unit-testability the old 2,500-line closure monolith made impossible.
 */
import { describe, expect, test } from 'bun:test'
import { runEffects } from '../../tsrx/analysis/effects'
import { runHarvest } from '../../tsrx/analysis/harvest'
import { type AnalysisContext, analyzeClient } from '../../tsrx/analysis/plan'
import {
	countForSelector,
	resolveSelector,
} from '../../tsrx/analysis/selectors'
import { compileSource } from '../../tsrx/compiler'
import type { ComponentIR } from '../../tsrx/ir'

const source = `export function C({}: {})
@{
	const color = createCell('red')
	expose({})
	<>
		<c-el>
			<span title={() => color.get() + '!'}>ok</span>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}
import { createCell } from '@zeix/le-truc'`

/** A minimal honest component IR: the front end's own output, not the facade's emitted artifacts. */
const realComponent = (): ComponentIR => {
	const { component } = compileSource(source, 'c.tsrx')
	return component as ComponentIR
}

/** A context assembled by hand — the orchestration-free entry point. */
const contextFor = (component: ComponentIR): AnalysisContext => {
	const queries: AnalysisContext['queries'] = []
	return {
		component,
		source: component.source,
		diagnostics: [],
		registry: new Set(),
		queries,
		harvests: [],
		effects: [],
		childTags: new Set(),
		ambient: new Set(component.contextRefs),
		usedNames: new Set(['cEl', ...component.signals.map(s => s.name), 'host']),
		refNames: new Set(),
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
				message: `c-el: ${selector} missing`,
			})
			return base
		},
		collectAmbient: () => {},
		badFreeNames: () => [],
	}
}

describe('analysis passes over a constructed context (LT-022)', () => {
	test('runHarvest alone seeds a map-thunk/computed-thunk signal (LT-036 route)', () => {
		const component = realComponent()
		const ctx = contextFor(component)
		runHarvest(ctx)
		expect(ctx.harvests).toHaveLength(1)
		expect(ctx.harvests[0]).toEqual({
			kind: 'substitute',
			signal: 'color',
			expr: "'red'",
		})
	})

	test('runEffects alone registers the reactive attribute effect and query', () => {
		const component = realComponent()
		const ctx = contextFor(component)
		runEffects(ctx)
		expect(ctx.queries.map(q => q.selector)).toEqual(['span'])
		expect(ctx.effects).toHaveLength(1)
		expect(ctx.effects[0]?.kind).toBe('watch-attr')
	})

	test('full orchestration agrees with the composed passes', () => {
		const component = realComponent()
		const plan = analyzeClient(component, new Set(), [])
		const ctx = contextFor(component)
		runHarvest(ctx)
		expect(ctx.harvests).toEqual(plan.harvests)
	})

	test('selector engine counts are independently computable', () => {
		const component = realComponent()
		const span = component.root.children.find(
			n => n.kind === 'element',
		) as Extract<ComponentIR['root'], { kind: 'element' }>
		expect(countForSelector(component.root, 'span')).toBe(1)
		expect(resolveSelector(component, span)).toEqual({
			selector: 'span',
			unique: true,
		})
	})
})
