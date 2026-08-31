/**
 * LT-004 verification: `bindAria()` contract prototype (ADR 0026 §2) against
 * ADR 0026's mapping table, in isolation from any component or DOM harness —
 * unlike LT-002/LT-003, this needs no browser, so it runs under bun:test
 * alongside the library's own unit tests, not Playwright.
 */
import { describe, expect, test } from 'bun:test'
import { bindAria, getDebugBindingTarget } from './poc-bind-aria'

/** Minimal stand-in for `ElementInternals` — only the props bindAria touches. */
class FakeInternals {
	role: string | null = null
	ariaExpanded: string | null = null
	ariaValueNow: string | null = null
	ariaLabel: string | null = null
	ariaDescribedByElements: readonly Element[] | null = null
	ariaActiveDescendantElement: Element | null = null
}

/** Minimal stand-in for `Element` — real `instanceof Element` needs a real DOM. */
class FakeElement {
	role: string | null = null
	ariaExpanded: string | null = null
}

describe('bindAria() — ADR 0026 §2 mapping table', () => {
	test('ok(boolean) → "true"/"false", never toggleAttribute-style empty string', () => {
		const internals = new FakeInternals()
		const handlers = bindAria(internals as unknown as ARIAMixin, 'ariaExpanded')
		handlers.ok(true)
		expect(internals.ariaExpanded).toBe('true')
		handlers.ok(false)
		expect(internals.ariaExpanded).toBe('false')
	})

	test('ok(number) → decimal string', () => {
		const internals = new FakeInternals()
		const handlers = bindAria(internals as unknown as ARIAMixin, 'ariaValueNow')
		handlers.ok(42)
		expect(internals.ariaValueNow).toBe('42')
	})

	test('ok(string) → pass-through', () => {
		const internals = new FakeInternals()
		const handlers = bindAria(internals as unknown as ARIAMixin, 'role')
		handlers.ok('slider')
		expect(internals.role).toBe('slider')
	})

	test('ok(Element) → pass-through', () => {
		const internals = new FakeInternals()
		const handlers = bindAria(
			internals as unknown as ARIAMixin,
			'ariaActiveDescendantElement',
		)
		const option = new FakeElement() as unknown as Element
		handlers.ok(option)
		expect(internals.ariaActiveDescendantElement).toBe(option)
	})

	test('ok(readonly Element[]) → pass-through', () => {
		const internals = new FakeInternals()
		const handlers = bindAria(
			internals as unknown as ARIAMixin,
			'ariaDescribedByElements',
		)
		const description = new FakeElement() as unknown as Element
		handlers.ok([description])
		expect(internals.ariaDescribedByElements).toEqual([description])
	})

	test('ok(null | undefined) → clears (assigns null)', () => {
		// `ok()`'s static type excludes null/undefined (SingleMatchHandlers<T>
		// requires T extends {}) but guards for both at runtime — see the
		// AriaValue docstring in poc-bind-aria.ts. A signal whose *resolved
		// value* is legitimately null (not merely unset) still reaches ok(null)
		// via cause-effect's match(), so this exercises real, reachable
		// behavior, not just a type escape hatch.
		const internals = new FakeInternals()
		internals.ariaExpanded = 'true'
		const handlers = bindAria(internals as unknown as ARIAMixin, 'ariaExpanded')
		handlers.ok(null as never)
		expect(internals.ariaExpanded).toBeNull()
		internals.ariaExpanded = 'true'
		handlers.ok(undefined as never)
		expect(internals.ariaExpanded).toBeNull()
	})

	test('nil → clears (assigns null), same as ok(null)', () => {
		const internals = new FakeInternals()
		internals.ariaExpanded = 'true'
		const handlers = bindAria(internals as unknown as ARIAMixin, 'ariaExpanded')
		handlers.nil?.()
		expect(internals.ariaExpanded).toBeNull()
	})

	test('null target: every handler is a no-op (attachInternals()-failed degradation)', () => {
		const handlers = bindAria(null, 'ariaExpanded')
		expect(() => handlers.ok(true)).not.toThrow()
		expect(() => handlers.nil?.()).not.toThrow()
	})

	test('undefined target: every handler is a no-op', () => {
		const handlers = bindAria(undefined, 'ariaExpanded')
		expect(() => handlers.ok('x')).not.toThrow()
	})
})

describe('bindAria() — debug attribution (ADR 0022)', () => {
	test('Element target is registered', () => {
		const el = new FakeElement() as unknown as Element
		;(globalThis as { Element?: unknown }).Element = FakeElement
		const handlers = bindAria(el as unknown as ARIAMixin, 'ariaExpanded')
		expect(getDebugBindingTarget(handlers)).toBe(el)
		delete (globalThis as { Element?: unknown }).Element
	})

	test('ElementInternals target is not registered (no host reference to attribute to)', () => {
		const internals = new FakeInternals()
		const handlers = bindAria(internals as unknown as ARIAMixin, 'ariaExpanded')
		expect(getDebugBindingTarget(handlers)).toBeUndefined()
	})
})

describe('bindAria() — compile-time rejections (@ts-expect-error pins)', () => {
	test('type-level pins compile only if the errors below are real', () => {
		const internals = new FakeInternals() as unknown as ARIAMixin

		// @ts-expect-error — 'aria-expanded' is the content-attribute name, not
		// the ARIAMixin IDL property ('ariaExpanded'); bindAria is typed off the
		// platform property names, not attribute strings (that's bindAttribute's
		// job, which — unlike bindAria — would toggleAttribute() a boolean into
		// an invalid empty-string ARIA value; ADR 0026 §2 exists to avoid that).
		bindAria(internals, 'aria-expanded')

		// @ts-expect-error — not an ARIAMixin property at all.
		bindAria(internals, 'textContent')

		const handlers = bindAria(internals, 'ariaExpanded')
		// @ts-expect-error — a plain object is not a valid AriaValue (not
		// boolean/number/string/Element/Element[]/null/undefined).
		handlers.ok({ not: 'a valid aria value' })

		// @ts-expect-error — a symbol is not a valid AriaValue either.
		handlers.ok(Symbol('nope'))

		expect(true).toBe(true)
	})
})
