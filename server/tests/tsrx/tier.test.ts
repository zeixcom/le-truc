/**
 * The server-evaluation tier classifier (ADR 0029, LT-165).
 *
 * These tests exercise `tier.ts` directly against parsed expressions and
 * synthetic signal sets, so they pin the ROUTING RULE rather than any
 * particular corpus component's current shape. Corpus-level tier pins live
 * with the compiler's own goldens, where a component moving between tiers
 * shows up as a golden diff.
 */

import { describe, expect, test } from 'bun:test'
import { parseModule } from '../../tsrx/core.ts'
import { CAPABILITY_PATCHES } from '../../tsrx/sim/patch-table.ts'
import {
	classifyTier,
	contaminateComposeReads,
	type RoutingSignal,
	resolutionOf,
	stubbedApiRead,
	type TierClassification,
} from '../../tsrx/tier.ts'

/* === Helpers === */

/** Parse a bare expression to the node the classifier walks. */
const expr = (code: string) =>
	parseModule(`const _ = (${code})`, 'expr.ts') as unknown as Parameters<
		typeof stubbedApiRead
	>[0]

const signal = (
	resolution: RoutingSignal['resolution'],
	detail = 'x',
): RoutingSignal => ({ origin: 'TSRX034', detail, resolution })

const classification = (
	tag: string,
	signals: RoutingSignal[],
): TierClassification => ({ tag, tier: classifyTier(signals), signals })

/* === Tests === */

describe('limb (a) — the patch table decides what the realm cannot answer', () => {
	test('a stubbed global read is unresolvable', () => {
		expect(stubbedApiRead(expr('new ResizeObserver(() => {})'))).toContain(
			'ResizeObserver',
		)
		expect(stubbedApiRead(expr('matchMedia("(min-width: 40rem)")'))).toContain(
			'matchMedia',
		)
	})

	test('a closed network global is unresolvable', () => {
		expect(stubbedApiRead(expr('fetch("/api")'))).toContain('fetch')
	})

	test('a layout read is unresolvable even though the global is real', () => {
		// The case a name-based check cannot see: `HTMLElement` is present and
		// `el.scrollWidth` reads without throwing — it just answers 0. This is
		// the `module-scrollarea` misrouting the capability rows exist for.
		const reason = stubbedApiRead(expr('el.scrollWidth - el.offsetWidth'))
		expect(reason).toContain('scrollWidth')
		expect(reason).toContain('no layout engine')
	})

	test('a receiver-scoped capability row fires only on that receiver', () => {
		expect(stubbedApiRead(expr('internals.states.add("open")'))).toContain(
			'custom-state set',
		)
		// A component's own `states` const is not `ElementInternals.states`.
		expect(stubbedApiRead(expr('states.add("open")'))).toBeNull()
	})

	test('ARIA members are deliberately absent from the capability rows', () => {
		// ADR 0026 §2's amendment: internals is not one unanswerable row. Since
		// LT-177 `bindAria()`'s attribute fallback makes the served HTML carry
		// the value, so ARIA expressions ARE realm-answerable.
		expect(stubbedApiRead(expr('internals.ariaExpanded'))).toBeNull()
		expect(
			CAPABILITY_PATCHES.some(patch => patch.member.startsWith('aria')),
		).toBe(false)
	})

	test('an ordinary DOM read is not a stubbed-API read', () => {
		expect(stubbedApiRead(expr('el.textContent'))).toBeNull()
		expect(stubbedApiRead(expr('host.count + 1'))).toBeNull()
	})
})

describe('limb (b) — inputs that are not server-side facts', () => {
	test('the wall clock and the RNG are unresolvable in every tier', () => {
		for (const code of ['Date.now()', 'new Date()', 'Math.random()']) {
			const resolution = resolutionOf(expr(code), new Set())
			expect(resolution.by).toBe('none')
			if (resolution.by === 'none')
				expect(resolution.limb).toBe('not-a-server-fact')
		}
	})

	test('a server-known locale is resolvable, so Intl does not route away', () => {
		// LT-142's split: the locale decides. A literal or an in-scope server
		// arg keeps the component Folded-tier-eligible.
		expect(
			resolutionOf(expr('new Intl.PluralRules("en").select(n)'), new Set()).by,
		).toBe('realm')
		expect(
			resolutionOf(
				expr('new Intl.NumberFormat(lang).format(n)'),
				new Set(['lang']),
			).by,
		).toBe('realm')
	})

	test('a runtime-default locale is unresolvable', () => {
		const resolution = resolutionOf(
			expr('new Intl.PluralRules().select(n)'),
			new Set(),
		)
		expect(resolution.by).toBe('none')
		if (resolution.by === 'none')
			expect(resolution.limb).toBe('not-a-server-fact')
	})

	test('a DOM-read locale is realm-answerable, not unresolvable', () => {
		// The middle case of LT-142's three-way split: the realm executes the
		// ancestor walk against a real simulated element, so this is a
		// Simulated-tier routing signal rather than limb (b).
		expect(
			resolutionOf(
				expr('new Intl.PluralRules(getLocale(el)).select(el.count)'),
				new Set(),
			).by,
		).toBe('realm')
	})

	test('limb (a) is reported ahead of limb (b) when both apply', () => {
		const resolution = resolutionOf(
			expr('Math.random() * el.offsetWidth'),
			new Set(),
		)
		expect(resolution.by).toBe('none')
		if (resolution.by === 'none') expect(resolution.limb).toBe('stubbed-api')
	})
})

describe('the routing conjunction (sub-design 1)', () => {
	test('no routing signal is the Folded tier', () => {
		expect(classifyTier([])).toBe('folded')
	})

	test('one realm-answerable signal is the Simulated tier', () => {
		expect(classifyTier([signal({ by: 'realm' })])).toBe('simulated')
	})

	test('all-unresolvable is the Static tier', () => {
		const tier = classifyTier([
			signal({ by: 'none', limb: 'stubbed-api', reason: 'layout' }),
			signal({ by: 'none', limb: 'stubbed-api', reason: 'internals' }),
		])
		expect(tier).toBe('static')
	})

	test('a mix routes to the Simulated tier, not the Static tier', () => {
		// `module-ticker`'s shape: `Math.random()` is suppressed per-expression
		// while everything else still simulates. Component-level Static here
		// would discard every answer the realm could give it.
		expect(
			classifyTier([
				signal({ by: 'none', limb: 'not-a-server-fact', reason: 'rng' }),
				signal({ by: 'realm' }),
			]),
		).toBe('simulated')
	})
})

describe('compose contamination is on reads, not containment (sub-design 3)', () => {
	const staticSignal = signal({
		by: 'none',
		limb: 'stubbed-api',
		reason: 'layout',
	})

	test('a parent that merely contains a Simulated child keeps its own tier', () => {
		const before = new Map([
			['parent-el', classification('parent-el', [])],
			['child-el', classification('child-el', [signal({ by: 'realm' })])],
		])
		// No reads: the child's markup is spliced, already rendered.
		const after = contaminateComposeReads(before, () => [])
		expect(after.get('parent-el')?.tier).toBe('folded')
	})

	test('a parent that READS a Simulated child is contaminated', () => {
		const before = new Map([
			['parent-el', classification('parent-el', [])],
			['child-el', classification('child-el', [signal({ by: 'realm' })])],
		])
		const after = contaminateComposeReads(before, tag =>
			tag === 'parent-el' ? ['child-el'] : [],
		)
		expect(after.get('parent-el')?.tier).toBe('simulated')
		expect(after.get('parent-el')?.signals.at(-1)?.origin).toBe('compose-read')
	})

	test('contamination reaches a fixpoint through a read chain', () => {
		// A → B → C, discovered in an order that requires a second pass.
		const before = new Map([
			['a-el', classification('a-el', [])],
			['b-el', classification('b-el', [])],
			['c-el', classification('c-el', [signal({ by: 'realm' })])],
		])
		const reads: Record<string, string[]> = {
			'a-el': ['b-el'],
			'b-el': ['c-el'],
		}
		const after = contaminateComposeReads(before, tag => reads[tag] ?? [])
		expect(after.get('b-el')?.tier).toBe('simulated')
		expect(after.get('a-el')?.tier).toBe('simulated')
	})

	test('reading a Static child contaminates to Simulated, not Static', () => {
		// The parent's read of the rendered site is an ordinary DOM question
		// the realm answers, even though the child's own expressions are not.
		const before = new Map([
			['parent-el', classification('parent-el', [])],
			['child-el', classification('child-el', [staticSignal])],
		])
		const after = contaminateComposeReads(before, tag =>
			tag === 'parent-el' ? ['child-el'] : [],
		)
		expect(after.get('child-el')?.tier).toBe('static')
		expect(after.get('parent-el')?.tier).toBe('simulated')
	})

	test('a Static parent reading a Simulated child moves up to Simulated', () => {
		const before = new Map([
			['parent-el', classification('parent-el', [staticSignal])],
			['child-el', classification('child-el', [signal({ by: 'realm' })])],
		])
		const after = contaminateComposeReads(before, tag =>
			tag === 'parent-el' ? ['child-el'] : [],
		)
		expect(after.get('parent-el')?.tier).toBe('simulated')
	})

	test('a read cycle terminates', () => {
		const before = new Map([
			['a-el', classification('a-el', [signal({ by: 'realm' })])],
			['b-el', classification('b-el', [])],
		])
		const reads: Record<string, string[]> = {
			'a-el': ['b-el'],
			'b-el': ['a-el'],
		}
		const after = contaminateComposeReads(before, tag => reads[tag] ?? [])
		expect(after.get('b-el')?.tier).toBe('simulated')
	})
})
