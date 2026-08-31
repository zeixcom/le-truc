/**
 * LT-004 harness probe: `bindAria()` contract prototype (ADR 0026 §2).
 * Proves the signature before anything ships in `src/bindings.ts` — this
 * module is throwaway PoC code, not the real implementation. Re-wires
 * LT-002's `poc-hue-slider.ts` and LT-003's `poc-combobox.ts` reactive ARIA
 * writes through it; findings in README.md.
 *
 * Mirrors the real `bindAttribute`/`bindStyle`/`bindState` shape in
 * `src/bindings.ts` (map-form overloads, `SingleMatchHandlers`, DEV_MODE
 * debug-attribution registry) closely enough that landing the real helper
 * should be closer to "move this file" than "redesign it".
 */
import type { SingleMatchHandlers } from '@zeix/cause-effect'

/**
 * Everything `bindAria()`'s `ok()` handler accepts, per ADR 0026 §2's
 * mapping table. Not narrowed per ARIA property name — the ADR's design is
 * deliberately one general coercion table for every `ARIAMixin` property,
 * the same way `bindAttribute`'s `string | boolean` union isn't narrowed
 * per attribute name either.
 *
 * Deliberately excludes `null | undefined` even though `ok()` guards for
 * both at runtime: `SingleMatchHandlers<T>` constrains `T extends {}`, so a
 * union including `null`/`undefined` fails to typecheck as the generic
 * parameter — the same "typed optimistically, guarded defensively"
 * discrepancy `bindAttribute`'s/`bindStyle`'s map-form `ok(map)` already
 * has for absent keys (typed `string | boolean`, guarded with
 * `value == null` since `noUncheckedIndexedAccess` widens real index reads).
 * A signal whose *resolved value* is legitimately `null` (not merely
 * unset/pending — `match()` only routes to `nil` on `UnsetSignalValueError`,
 * confirmed against `@zeix/cause-effect`'s `match()` source) still reaches
 * `ok(null)` at runtime, which is exactly the case this guard exists for.
 */
type AriaValue = boolean | number | string | Element | readonly Element[]

/**
 * PoC-local mirror of `src/bindings.ts`'s `debugBindingTargets` WeakMap
 * (ADR 0022). Deliberately not imported from the library — the real
 * registry is module-private, and re-implementing the same
 * register-`Element`-targets-only branch here is enough to prove the
 * contract without reaching into library internals.
 */
const debugBindingTargets = new WeakMap<object, Element>()

/** PoC equivalent of `getDebugBindingTarget` — read side of the mirror above. */
export const getDebugBindingTarget = (handler: object): Element | undefined =>
	debugBindingTargets.get(handler)

/**
 * Returns `SingleMatchHandlers` that reflect a value onto an `ARIAMixin`
 * target (`Element` or `ElementInternals` — both implement the interface,
 * so one signature covers host reflection and inner-element binding).
 *
 * - `ok(boolean)` → `'true'` / `'false'` — never `toggleAttribute`'s
 *   empty-string form, which is invalid for enumerated ARIA values.
 * - `ok(number)` → decimal string (e.g. `ariaValueNow` from a numeric prop).
 * - `ok(null | undefined)` → assigns `null`, clearing the reflection and
 *   restoring attribute authority (the two-channel policy's override path).
 * - `ok(string | Element | readonly Element[])` → pass-through.
 * - `nil` → assigns `null` (same as an `ok(null)` clear).
 *
 * A nullish `target` (the `attachInternals()`-failed path) makes every
 * handler a no-op — the same graceful degradation `bindState()` established.
 *
 * @param target - `ARIAMixin` target (`Element` or `ElementInternals`), or `null`/`undefined`
 * @param name - Platform `ARIAMixin` property name (e.g. `'ariaExpanded'`, `'role'`)
 * @returns Match handlers for the ARIA reflection
 */
export function bindAria(
	target: ARIAMixin | null | undefined,
	name: keyof ARIAMixin & string,
): SingleMatchHandlers<AriaValue> {
	const assign = (value: string | Element | readonly Element[] | null) => {
		if (!target) return
		;(target as unknown as Record<string, unknown>)[name] = value
	}
	const handlers: SingleMatchHandlers<AriaValue> = {
		ok: (value: AriaValue) => {
			if (value == null) assign(null)
			else if (typeof value === 'boolean') assign(value ? 'true' : 'false')
			else if (typeof value === 'number') assign(String(value))
			else assign(value)
		},
		nil: () => assign(null),
	}
	if (typeof Element !== 'undefined' && target instanceof Element)
		debugBindingTargets.set(handlers, target)
	return handlers
}
