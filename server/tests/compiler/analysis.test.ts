/**
 * Independent-pass tests for the analysis split (LT-022, M5): each pass in
 * `server/compiler/analysis/` is a function over an explicitly constructed
 * `AnalysisContext` — no `analyzeClient` orchestration needed. These tests
 * exercise one pass at a time against a hand-built context, the
 * unit-testability the old 2,500-line closure monolith made impossible.
 */
import { describe, expect, test } from 'bun:test'
import { runEffects } from '../../compiler/analysis/effects'
import { runHarvest } from '../../compiler/analysis/harvest'
import {
	type AnalysisContext,
	analyzeClient,
} from '../../compiler/analysis/plan'
import {
	composedShapesFor,
	countForSelector,
	matchesSelector,
	renderedShapesOf,
	resolveSelector,
} from '../../compiler/analysis/selectors'
import { compileSource } from '../../compiler/frontend/tsrx/compiler'
import type { ComponentIR } from '../../compiler/ir'
import type { RegistryEntry } from '../../compiler/registry'

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
		routingSignals: [],
		suppressedSites: [],
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

/**
 * LT-124: class discriminators are TOKEN clauses, and `matchesSelector` — the
 * structural matcher `countForSelector` and per-branch collision rejection
 * both run on — has to recognize the same grammar the synthesizer emits. An
 * unparsed selector returns `false`, which reads as "no match" everywhere, so
 * a drift between the two would be silent in both directions.
 */
describe('class discriminators are token clauses (LT-124)', () => {
	/** The element a `first()`-addressed span lowers to, given a class value. */
	const spanWithClass = (className: string): ComponentIR => {
		const { component } = compileSource(
			`export function C({}: {})
@{
	const el = first('span.label')
	expose({})
	<>
		<c-el>
			<span class="${className}">ok</span>
			<span class="other">x</span>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`,
			'c.tsrx',
		)
		return component as ComponentIR
	}

	const firstSpan = (component: ComponentIR) =>
		(component.root.children as ReadonlyArray<{ kind: string }>).find(
			n => n.kind === 'element',
		) as Extract<ComponentIR['root'], { kind: 'element' }>

	test('a single-token class synthesizes `.token`, not `[class="…"]`', () => {
		const component = spanWithClass('label')
		expect(resolveSelector(component, firstSpan(component))).toEqual({
			selector: 'span.label',
			unique: true,
		})
	})

	test('a multi-token class offers one candidate per token, order-insensitively', () => {
		const component = spanWithClass('label icon')
		// The FIRST unique candidate wins, so the synthesized selector names
		// one token — but either token identifies the element, which is the
		// property exact match did not have.
		const { selector } = resolveSelector(component, firstSpan(component))
		expect(['span.label', 'span.icon']).toContain(selector)
		expect(countForSelector(component.root, 'span.label')).toBe(1)
		expect(countForSelector(component.root, 'span.icon')).toBe(1)
	})

	test('a token clause matches page markup carrying extra classes', () => {
		// The acceptance case: the template renders `class="label"`, the PAGE
		// renders `class="label icon"`. Structurally the same question asked
		// of the matcher — a token clause matches by membership.
		const pageSpan = firstSpan(spanWithClass('label icon'))
		expect(matchesSelector(pageSpan, 'span.label')).toBe(true)
		expect(matchesSelector(pageSpan, 'span.icon')).toBe(true)
		expect(matchesSelector(pageSpan, 'span[class="label"]')).toBe(false)
		expect(matchesSelector(pageSpan, 'span.missing')).toBe(false)
		expect(matchesSelector(pageSpan, 'div.label')).toBe(false)
	})

	test('a token that is not a plain identifier falls back to exact match', () => {
		// `.w-1/2` would be a querySelector SYNTAX error — a throw at
		// activation, not a miss — so those keep the exact-match form.
		const component = spanWithClass('w-1/2')
		expect(resolveSelector(component, firstSpan(component))).toEqual({
			selector: 'span[class="w-1/2"]',
			unique: true,
		})
	})
})

/**
 * LT-124 follow-up (owner, 2026-08-30): `#id` is the canonical spelling of an
 * id discriminator. Unlike the class change this is NOT a widening —
 * `input#name-input` and `input[id="name-input"]` select exactly the same
 * element — so it is pure canonicalization. It is also a new capability:
 * `id` was not among the raw-element discriminator candidates at all, only
 * among the compose-site ones.
 */
describe('id discriminators use the hash form (LT-124)', () => {
	/** Two same-tag inputs — the bare tag is ambiguous, forcing a discriminator. */
	const twoInputs = (idValue: string): ComponentIR => {
		const { component } = compileSource(
			`export function C({}: {})
@{
	const el = first('input#${idValue}')
	expose({})
	<>
		<c-el>
			<input id="${idValue}" />
			<input id="other" />
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`,
			'c.tsrx',
		)
		return component as ComponentIR
	}

	const firstInput = (component: ComponentIR) =>
		(component.root.children as ReadonlyArray<{ kind: string }>).find(
			n => n.kind === 'element',
		) as Extract<ComponentIR['root'], { kind: 'element' }>

	test('an ambiguous tag upgrades to `tag#id`, not `tag[id="…"]`', () => {
		const component = twoInputs('name-input')
		expect(resolveSelector(component, firstInput(component))).toEqual({
			selector: 'input#name-input',
			unique: true,
		})
	})

	test('the matcher recognizes the hash form and stays exact', () => {
		const input = firstInput(twoInputs('name-input'))
		expect(matchesSelector(input, 'input#name-input')).toBe(true)
		expect(matchesSelector(input, '#name-input')).toBe(true)
		// Exact, unlike a class token: no membership, no prefix matching.
		expect(matchesSelector(input, 'input#name')).toBe(false)
		expect(matchesSelector(input, 'span#name-input')).toBe(false)
	})

	test('an id that is not a plain identifier falls back to exact match', () => {
		const component = twoInputs('1st.field')
		expect(resolveSelector(component, firstInput(component))).toEqual({
			selector: 'input[id="1st.field"]',
			unique: true,
		})
	})
})

describe('aria-* discriminators are the last resort (LT-101)', () => {
	/**
	 * module-dialog's shape: an opener told apart by ARIA alone. No `first()`
	 * ref — an authored selector would lead the candidates (LT-316), and this
	 * block pins the synthesizer's own order.
	 */
	const twoButtons = (openerAttrs: string): ComponentIR => {
		const { component } = compileSource(
			`export function C({}: {})
@{
	expose({})
	<>
		<c-el>
			<button type="button" ${openerAttrs}>Open</button>
			<button type="button" class="close" aria-label="Close">x</button>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`,
			'c.tsrx',
		)
		return component as ComponentIR
	}

	const firstButton = (component: ComponentIR) =>
		(component.root.children as ReadonlyArray<{ kind: string }>).find(
			n => n.kind === 'element',
		) as Extract<ComponentIR['root'], { kind: 'element' }>

	test('a button with no other discriminator resolves to its aria clause', () => {
		const component = twoButtons('aria-haspopup="dialog"')
		expect(resolveSelector(component, firstButton(component))).toEqual({
			selector: 'button[aria-haspopup="dialog"]',
			unique: true,
		})
	})

	test('any earlier discriminator still wins', () => {
		const component = twoButtons('class="open" aria-haspopup="dialog"')
		expect(resolveSelector(component, firstButton(component))).toEqual({
			selector: 'button.open',
			unique: true,
		})
	})
})

/**
 * LT-096: a synthesized selector's uniqueness is counted over the OWN
 * template, but the runtime query descends into every composed child's
 * rendered markup. With the children's shapes known, a candidate a child
 * could match is emitted with a `:not(<child-tag> *)` exclusion — the bare
 * `button` module-codeblock's overlay resolved to found the composed
 * basic-button's own `<button>` first.
 */
describe('selectors account for composed children (LT-096)', () => {
	const child = (body: string): ComponentIR =>
		compileSource(
			`export function Child({ size = 'small' }: { size?: string })
@{
	<>
		<child-el>${body}</child-el>
		<style>child-el { color: red }</style>
	</>
}`,
			'child.tsrx',
		).component as ComponentIR

	// No `first()` refs: this block pins synthesis; the authored-selector
	// route has its own block below (LT-316).
	const parent = (withRefs = false): ComponentIR =>
		compileSource(
			`import { Child } from './child.tsrx'
export function P({}: {})
@{
	${withRefs ? "const overlay = first('button.overlay')" : ''}
	expose({})
	<>
		<p-el>
			<code>x</code>
			<Child />
			<button type="button" class="overlay">Go</button>
		</p-el>
		<style>p-el { color: red }</style>
	</>
}`,
			'p.tsrx',
		).component as ComponentIR

	const elementByTag = (component: ComponentIR, tag: string) =>
		(
			component.root.children as ReadonlyArray<{ kind: string; tag?: string }>
		).find(n => n.kind === 'element' && n.tag === tag) as Extract<
			ComponentIR['root'],
			{ kind: 'element' }
		>

	const withChild = (
		childIR: ComponentIR | null,
		withRefs = false,
	): ComponentIR => {
		const component = parent(withRefs)
		const composeSource = (
			component.root.children.find(n => n.kind === 'compose') as {
				source: string
			}
		).source
		const registry = new Map<string, RegistryEntry>(
			childIR
				? [
						[
							composeSource,
							{
								tag: 'child-el',
								renderedShapes: renderedShapesOf(childIR),
							} as RegistryEntry,
						],
					]
				: [],
		)
		component.composedShapes = composedShapesFor(component.root, registry)
		return component
	}

	test('the child renders a button with a dynamic class — every button candidate clashes', () => {
		const component = withChild(
			child('<button type="button" class={size}>in</button>'),
		)
		expect(
			resolveSelector(component, elementByTag(component, 'button')),
		).toEqual({ selector: 'button:not(child-el *)', unique: true })
	})

	test('a static child class leaves a non-clashing discriminator clean', () => {
		const component = withChild(
			child('<button type="button" class="inner">in</button>'),
		)
		expect(
			resolveSelector(component, elementByTag(component, 'button')),
		).toEqual({ selector: 'button.overlay', unique: true })
	})

	test('a tag the child never renders keeps its bare selector', () => {
		const component = withChild(child('<button type="button">in</button>'))
		expect(resolveSelector(component, elementByTag(component, 'code'))).toEqual(
			{
				selector: 'code',
				unique: true,
			},
		)
	})

	test('raw `children` in the child is unknown markup — every candidate clashes', () => {
		const rawChild = compileSource(
			`export function Child({ children }: { children?: string })
@{
	<>
		<child-el>{children}</child-el>
		<style>child-el { color: red }</style>
	</>
}`,
			'child.tsrx',
		).component as ComponentIR
		expect(renderedShapesOf(rawChild)).toContainEqual({ kind: 'any' })
		const component = withChild(rawChild)
		expect(resolveSelector(component, elementByTag(component, 'code'))).toEqual(
			{
				selector: 'code:not(child-el *)',
				unique: true,
			},
		)
	})

	test('an unregistered child cannot be excluded — no candidate is unique', () => {
		const component = withChild(null)
		expect(
			resolveSelector(component, elementByTag(component, 'button')).unique,
		).toBe(false)
	})

	test('without composed shapes (the discovery pass) the single-template view stands', () => {
		const component = parent()
		expect(
			resolveSelector(component, elementByTag(component, 'button')),
		).toEqual({ selector: 'button', unique: true })
	})

	test('an authored selector a child could match keeps its contract, exclusion-wrapped (LT-316)', () => {
		const component = withChild(
			child('<button type="button" class={size}>in</button>'),
			true,
		)
		expect(
			resolveSelector(component, elementByTag(component, 'button')),
		).toEqual({ selector: 'button.overlay:not(child-el *)', unique: true })
	})

	test('an authored selector an unregistered child may match falls back to synthesis (LT-316)', () => {
		const component = withChild(null, true)
		expect(
			resolveSelector(component, elementByTag(component, 'button')).unique,
		).toBe(false)
	})
})

/**
 * LT-316: a `first()` ref's authored selector is the contract page-authored
 * occurrences are addressed by, so it is emitted whenever it is
 * structurally verifiable — in the synthesized grammar and unique over the
 * own template — and synthesis is only the fallback.
 */
describe('authored first() selectors are emitted when verifiable (LT-316)', () => {
	const resolveRef = (template: string, selector: string, tag: string) => {
		const component = compileSource(
			`export function C({}: {})
@{
	const el = first('${selector}')
	expose({})
	<>
		<c-el>
			${template}
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`,
			'c.tsrx',
		).component as ComponentIR
		const element = (
			component.root.children as ReadonlyArray<{ kind: string; tag?: string }>
		).find(n => n.kind === 'element' && n.tag === tag) as Extract<
			ComponentIR['root'],
			{ kind: 'element' }
		>
		return resolveSelector(component, element)
	}

	test('a class selector wins over the role synthesis would pick (splitview)', () => {
		expect(
			resolveRef(
				'<button type="button" role="separator" class="divider">|</button>',
				'button.divider',
				'button',
			),
		).toEqual({ selector: 'button.divider', unique: true })
	})

	test('a class-only selector is not widened to the bare tag (colorinfo)', () => {
		expect(
			resolveRef('<small class="hex">#fff</small>', '.hex', 'small'),
		).toEqual({ selector: '.hex', unique: true })
	})

	test('a selector outside the synthesized grammar falls back to synthesis', () => {
		expect(
			resolveRef(
				'<span class="a b">x</span><span class="a">y</span>',
				'span.a.b',
				'span',
			),
		).toEqual({ selector: 'span.b', unique: true })
	})
})
