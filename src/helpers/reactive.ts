import {
	createComputed,
	createEffect,
	createMemo,
	createScope,
	isComputed,
	isFunction,
	isMemo,
	isRecord,
	isSlot,
	type MaybeCleanup,
	type MaybePromise,
	type Memo,
	match,
	type Signal,
	type SingleMatchHandlers,
	type Slot,
	type SlotDescriptor,
	untrack,
} from '@zeix/cause-effect'
import {
	InvalidCustomElementError,
	InvalidPassPropertyError,
	InvalidReactivesError,
} from '../errors'
import { getSignals } from '../internal'
import type {
	ComponentProps,
	EffectDescriptor,
	FactoryResult,
	Falsy,
} from '../types'
import { DEV_MODE, elementName, isCustomElement } from '../util'

/* === Types === */

/**
 * A reactive value that drives a DOM update or a slot injection.
 *
 * Three forms are accepted:
 * - `keyof P` — a string property name on the host; reads `host[name]` and
 *   registers it as a signal dependency automatically.
 * - `Signal<T>` — any signal; `.get()` is called inside the reactive effect.
 * - `() => T | Promise<T> | null | undefined` — a thunk wrapped in `createComputed`;
 *   all signals read inside are tracked in the pure phase. Returning `null` or
 *   `undefined` drives the `nil` path; an async thunk becomes a `Task` signal.
 */
type Reactive<T, P extends ComponentProps> =
	| keyof P
	| Signal<T & {}>
	| (() => T | Promise<T> | null | undefined)

/**
 * A map of child component property names to the reactive values to inject into them.
 * Passed as the second argument to `pass()`. Keys must be property names of the target component `Q`.
 *
 * Prefer the read-only thunk (`() => host.prop`) and the mediated
 * `{ get, set }` descriptor forms. The property-key and bare-writable-signal
 * forms are deprecated; they warn in DEV_MODE and will be removed in the next major.
 */
type PassedProps<P extends ComponentProps, Q extends ComponentProps> = {
	[K in keyof Q & string]?: Reactive<Q[K], P> | SlotDescriptor<Q[K] & {}>
}

/**
 * The `watch` helper type in `FactoryContext`.
 *
 * Drives a reactive effect from a signal source (property name, Signal, thunk,
 * or array). Only the declared sources trigger re-runs — incidental reads inside
 * the handler are not tracked. Returns an `EffectDescriptor`.
 *
 * Thunk form `() => T` is wrapped in `createComputed`, so all signals read inside
 * it are tracked in the pure phase — useful for deriving or transforming values
 * before the side-effectful handler runs.
 */
type WatchHelper<P extends ComponentProps> = {
	<K extends keyof P & string>(
		source: K,
		handler: (value: P[K]) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
	<K extends keyof P & string>(
		source: K,
		handlers: SingleMatchHandlers<P[K]>,
	): EffectDescriptor
	<T extends {}>(
		source: Signal<T>,
		handler: (value: T) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
	<T extends {}>(
		source: Signal<T>,
		handlers: SingleMatchHandlers<T>,
	): EffectDescriptor
	<T extends {}>(
		source: () => T | Promise<T> | null | undefined,
		handler: (value: T) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
	<T extends {}>(
		source: () => T | Promise<T> | null | undefined,
		handlers: SingleMatchHandlers<T>,
	): EffectDescriptor
	(
		source: Array<Reactive<NonNullable<unknown>, P>>,
		handler: (values: any[]) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
}

/**
 * The `pass` helper type in `FactoryContext`.
 *
 * Passes reactive values to a descendant Le Truc component's Slot-backed signals.
 * Supports single-element and Memo targets (per-element lifecycle for Memo).
 *
 * The property-key (`'value'`) and bare-writable-signal (`someState`) forms are
 * deprecated — they hand the child unrestricted `.set()` on the parent's signal
 * (ADR-0012) and warn in DEV_MODE. Migrate to the behavior-preserving descriptor:
 *
 * ```ts
 * // before (deprecated) — child can write freely
 * pass(child, { value: parentSignal })
 * // after — child writes are mediated by the parent
 * pass(child, { value: { get: parentSignal.get, set: parentSignal.set } })
 * ```
 *
 * For read-only access use the thunk: `pass(child, { value: () => host.value })`.
 * Both deprecated forms are removed in the next major.
 */
type PassHelper<P extends ComponentProps> = {
	<Q extends ComponentProps>(
		target: (HTMLElement & Q) | Falsy,
		props: PassedProps<P, Q>,
	): EffectDescriptor
	<Q extends ComponentProps>(
		target: Memo<(HTMLElement & Q)[]> | Falsy,
		props: PassedProps<P, Q>,
	): EffectDescriptor
}

/* === Internal Helpers === */

/**
 * Recursively activate a `FactoryResult` array of effect descriptors.
 *
 * Nested arrays are flattened; falsy values are skipped. Each truthy descriptor
 * is called immediately so its reactive effects register in the current scope.
 *
 * @since 2.0
 * @param {FactoryResult} result - Flat or nested array of effect descriptors to activate
 */
const activateResult = (result: FactoryResult): void => {
	for (const descriptor of result) {
		if (Array.isArray(descriptor)) activateResult(descriptor)
		else if (descriptor) descriptor()
	}
}

/**
 * Drive per-element scopes from a `Memo<E[]>` with element-identity keying.
 *
 * Elements entering the collection get a scope created by `mount`; elements
 * leaving get exactly their own scope disposed. Surviving elements are
 * untouched across re-runs. All remaining scopes are disposed when the
 * enclosing owner (component scope) is disposed.
 *
 * Two ownership details are load-bearing:
 * - Per-element scopes use `{ root: true }` — a plain `createScope` inside the
 *   effect would register its dispose on the effect, which runs all cleanups
 *   before every re-run, silently reproducing wholesale rebuild.
 * - The outer `createScope` wrapper registers on the component scope; its
 *   returned cleanup is the only thing that tears down still-live root-scoped
 *   element scopes on component disconnect.
 *
 * @since 2.2
 * @param {Memo<E[]>} memo - Memo of the current element collection
 * @param {(element: E) => MaybeCleanup} mount - Called once per entering element inside its scope; a returned cleanup registers on that scope
 */
const keyedScopes = <E extends object>(
	memo: Memo<E[]>,
	mount: (element: E) => MaybeCleanup,
): void => {
	const scopes = new Map<E, () => void>()
	createScope(() => {
		createEffect(() => {
			const current = memo.get()
			const currentSet = new Set(current)
			// Dispose leaving elements before mounting entering ones, preserving
			// teardown-before-setup ordering for one-mutation replacements.
			for (const [el, dispose] of Array.from(scopes)) {
				if (!currentSet.has(el)) {
					dispose()
					scopes.delete(el)
				}
			}
			for (const el of current) {
				if (scopes.has(el)) continue
				const dispose = createScope(() => mount(el), { root: true })
				scopes.set(el, dispose)
			}
		})
		return () => {
			for (const dispose of scopes.values()) dispose()
			scopes.clear()
		}
	})
}

/**
 * Resolve a `Reactive` value to a Signal usable by `match`.
 *
 * - String: look up the signal in the component's signal map; fall back to a computed
 *   that reads `host[name]` (covers properties added via `Object.defineProperty`).
 * - Thunk `() => T | Promise<T> | null | undefined`: wrapped in `createComputed`
 *   so all signals read inside are tracked in the pure phase. Async thunks become
 *   Task signals.
 * - Signal: use directly.
 *
 * @since 2.0
 * @param {HTMLElement & P} host - The component host element
 * @param {Reactive<T, P> | { get: () => T; set?: (value: T) => void }} source - Property name string, signal, thunk, or descriptor to resolve
 * @returns {Signal<T>} Resolved signal ready for use with `match()`
 */
const toSignal = <T extends {}, P extends ComponentProps>(
	host: HTMLElement & P,
	source: Reactive<T, P> | SlotDescriptor<T>,
): Signal<T> | SlotDescriptor<T> => {
	if (isFunction<T>(source)) return createComputed(source)
	if (typeof source === 'string') {
		const sig = getSignals(host)[source]
		if (sig) return sig as Signal<T>
		return createMemo(() => (host as any)[source])
	}
	if (
		source &&
		typeof source === 'object' &&
		'get' in source &&
		!(Symbol.toStringTag in source)
	) {
		return source as SlotDescriptor<T>
	}
	return source as Signal<T>
}

/* === Exported Functions === */

/**
 * Create a `watch` helper bound to a specific component host.
 *
 * `watch` wraps `match` to create a reactive effect driven by explicitly declared
 * signal sources. Only the declared source signals trigger re-runs — other reads
 * inside the handler are not tracked. Returns an `EffectDescriptor`.
 *
 * @since 2.0
 * @param {HTMLElement & P} host - The component host element
 * @returns {WatchHelper<P>} Bound `watch` function for the given host
 */
const makeWatch = <P extends ComponentProps>(
	host: HTMLElement & P,
): WatchHelper<P> => {
	function watch<K extends keyof P & string>(
		source: K,
		handler: (value: P[K]) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
	function watch<K extends keyof P & string>(
		source: K,
		handlers: SingleMatchHandlers<P[K]>,
	): EffectDescriptor
	function watch<T extends {}>(
		source: Signal<T>,
		handler: (value: T) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
	function watch<T extends {}>(
		source: Signal<T>,
		handlers: SingleMatchHandlers<T>,
	): EffectDescriptor
	function watch<T extends {}>(
		source: () => T | Promise<T> | null | undefined,
		handler: (value: T) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
	function watch<T extends {}>(
		source: () => T | Promise<T> | null | undefined,
		handlers: SingleMatchHandlers<T>,
	): EffectDescriptor
	function watch(
		source: Array<Reactive<NonNullable<unknown>, P>>,
		handler: (values: any[]) => MaybePromise<MaybeCleanup>,
	): EffectDescriptor
	function watch(
		source:
			| Reactive<NonNullable<unknown>, P>
			| Array<Reactive<NonNullable<unknown>, P>>,
		handlerOrHandlers:
			| ((value: any) => MaybePromise<MaybeCleanup>)
			| SingleMatchHandlers<any>,
	): EffectDescriptor {
		return () => {
			if (Array.isArray(source)) {
				const signals = source.map(s => toSignal(host, s))
				const handler = handlerOrHandlers as (
					values: any[],
				) => MaybePromise<MaybeCleanup>
				return createEffect(() =>
					match(signals, { ok: values => untrack(() => handler(values)) }),
				)
			}
			const signal = toSignal(host, source)
			if (typeof handlerOrHandlers === 'function') {
				return createEffect(() =>
					match(signal, {
						ok: value => untrack(() => handlerOrHandlers(value)),
					}),
				)
			}
			return createEffect(() => match(signal, handlerOrHandlers))
		}
	}
	return watch
}

/**
 * Create a `pass` helper bound to a specific component host.
 *
 * `pass` passes reactive values to a descendant Le Truc component by swapping
 * its Slot-backed signals. The original signals are restored when the component
 * disconnects. Supports both single-element and `Memo<Element[]>` targets.
 *
 * For Memo targets, uses per-element lifecycle: signals are swapped when elements
 * enter the collection and restored when they leave.
 *
 * The property-key and bare-writable-signal short forms are deprecated:
 * They grant the child unrestricted `.set()` on the parent's signal.
 * In DEV_MODE `pass()` emits a warning for each writable binding:
 *
 * > `pass() received a writable signal for '<prop>'. Use () => host.<prop> for read-only access, or { get, set } to mediate writes.`
 *
 * The migration is behavior-preserving:
 * `pass(child, { value: sig })` → `pass(child, { value: { get: sig.get, set: sig.set } })`,
 * or for read-only access `pass(child, { value: () => host.value })`. The
 * deprecated forms are removed in the next major.
 *
 * @since 2.0
 * @param {HTMLElement & P} host - The component host element
 * @returns {PassHelper<P>} Bound `pass` function for the given host
 */
const makePass = <P extends ComponentProps>(
	host: HTMLElement & P,
): PassHelper<P> => {
	/**
	 * Perform the slot-swap for a single target element.
	 * Returns a cleanup that restores all original slot signals.
	 */
	const swapSlots = <Q extends ComponentProps>(
		target: HTMLElement & Q,
		props: PassedProps<P, Q>,
	): (() => void) | undefined =>
		createScope(() => {
			if (!isCustomElement(target))
				throw new InvalidCustomElementError(
					target,
					`pass from ${elementName(host)}`,
				)
			if (!isRecord(props)) throw new InvalidReactivesError(host, target, props)

			const signals = getSignals(target)
			const targetName = elementName(target)

			// Eager validate-then-commit (no mutation until every entry is known to
			// be bindable) — a failure must never leave a partial swap. See ADR 0011.
			const failures = new Map<string, string>()
			const bindings: {
				slot: Slot<unknown & {}>
				signal: Signal<unknown & {}> | SlotDescriptor<unknown & {}>
			}[] = []

			for (const [prop, reactive] of Object.entries(props)) {
				if (reactive == null) continue
				if (!(prop in target)) {
					failures.set(prop, `does not exist on ${targetName}`)
					continue
				}

				const signal = toSignal(host, reactive)
				if (!signal) {
					failures.set(prop, 'could not be resolved to a signal')
					continue
				}

				// ADR-0012: the property-key and bare-writable-signal short forms
				// hand the child unrestricted `.set()` on the parent's signal. Warn
				// in DEV_MODE. Detection is reversed — allow what is provably
				// read-only, warn on everything else.
				if (
					DEV_MODE &&
					!isComputed(signal) &&
					!(
						signal &&
						typeof signal === 'object' &&
						'get' in signal &&
						!(Symbol.toStringTag in signal)
					)
				) {
					console.warn(
						`pass() received a writable signal for '${prop}'. Use () => host.${prop} for read-only access, or { get, set } to mediate writes.`,
					)
				}

				const slot = signals[prop]
				if (!isSlot(slot)) {
					failures.set(
						prop,
						`is not Slot-backed on ${targetName} (read-only property, or target is not a Le Truc component)`,
					)
					continue
				}
				bindings.push({ slot, signal })
			}

			if (failures.size)
				throw new InvalidPassPropertyError(host, target, failures)

			const cleanups = bindings.map(({ slot, signal }) => {
				const original = slot.current()
				slot.replace(signal)
				return () => slot.replace(original)
			})

			if (cleanups.length)
				return () => {
					for (const c of cleanups) c()
				}
		})

	function pass<Q extends ComponentProps>(
		target: (HTMLElement & Q) | Falsy,
		props: PassedProps<P, Q>,
	): EffectDescriptor
	function pass<Q extends ComponentProps>(
		target: Memo<(HTMLElement & Q)[]> | Falsy,
		props: PassedProps<P, Q>,
	): EffectDescriptor
	function pass<Q extends ComponentProps>(
		target: (HTMLElement & Q) | Memo<(HTMLElement & Q)[]> | Falsy,
		props: PassedProps<P, Q>,
	): EffectDescriptor {
		return () => {
			if (!target) return
			if (isMemo<(HTMLElement & Q)[]>(target)) {
				// Memo target: keyed per-element lifecycle
				keyedScopes(target, el => swapSlots(el, props))
			} else {
				// Single element: swap slots directly in current scope
				swapSlots(target, props)
			}
		}
	}
	return pass
}

/**
 * Create per-element reactive effects from a `Memo<Element[]>`.
 *
 * When elements enter the collection, their effects are created in a per-element
 * scope; when they leave, their effects are disposed with that scope.
 *
 * The callback receives a single element and returns a `FactoryResult` (array of
 * `EffectDescriptor`s) or a single `EffectDescriptor` (single-descriptor shortcut).
 * Falsy values can also be returned to skip conditionally.
 *
 * @since 2.0
 */
function each<E extends Element>(
	memo: Memo<E[]>,
	callback: (element: E) => FactoryResult | EffectDescriptor | Falsy,
): EffectDescriptor {
	return () => {
		keyedScopes(memo, element => {
			const result = callback(element)
			if (Array.isArray(result)) activateResult(result)
			else if (typeof result === 'function') result()
		})
	}
}

export {
	activateResult,
	type EffectDescriptor,
	each,
	type FactoryResult,
	type Falsy,
	keyedScopes,
	makePass,
	makeWatch,
	type PassedProps,
	type PassHelper,
	type Reactive,
	type WatchHelper,
}
