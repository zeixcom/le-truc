import {
	createComputed,
	createEffect,
	createMemo,
	createScope,
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
	type SlotDescriptor,
	untrack,
} from '@zeix/cause-effect'
import type { ComponentProps } from './component'
import { InvalidCustomElementError, InvalidReactivesError } from './errors'
import { getSignals } from './internal'
import { DEV_MODE, elementName, isCustomElement, LOG_WARN } from './util'

/* === Types === */

type Falsy = false | null | undefined | '' | 0 | 0n

/**
 * A deferred effect: a thunk that, when called inside a reactive scope, creates
 * a reactive effect and returns an optional cleanup function.
 *
 * Effect descriptors are returned by `watch()`, `on()`, `each()`, `pass()`, and
 * `provideContexts()`. They are activated after dependency resolution, not
 * immediately when the factory function runs.
 */
type EffectDescriptor = () => MaybeCleanup

/**
 * The return value of the factory function.
 *
 * An array of effect descriptors (and optional falsy guards for conditional
 * effects). Nested arrays are automatically flattened. Falsy values (`false`,
 * `undefined`, `null`, `""`, `0`) are filtered out before activation, enabling the
 * `element && [watch(...)]` conditional pattern.
 */
type FactoryResult = Array<EffectDescriptor | FactoryResult | Falsy>

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
		if (sig) return sig
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
			const cleanups: (() => void)[] = []

			for (const [prop, reactive] of Object.entries(props)) {
				if (reactive == null) continue
				if (!(prop in target)) {
					if (DEV_MODE)
						console[LOG_WARN](
							`pass(): property '${prop}' does not exist on ${targetName}`,
						)
					continue
				}

				const signal = toSignal(host, reactive)
				if (!signal) continue

				// Slot-backed (Le Truc component) — replace and restore on cleanup
				const slot = signals[prop]
				if (isSlot(slot)) {
					const original = slot.current()
					slot.replace(signal)
					cleanups.push(() => slot.replace(original))
					continue
				}

				if (DEV_MODE)
					console[LOG_WARN](
						`pass(): property '${prop}' on ${targetName} is not Slot-backed — use setProperty() for non-Le Truc elements`,
					)
			}

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
				// Memo target: per-element lifecycle via createEffect
				createEffect(() => {
					for (const el of target.get()) {
						createScope(() => swapSlots(el, props))
					}
				})
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
	callback: (element: E) => FactoryResult | EffectDescriptor | Falsy | void,
): EffectDescriptor {
	return () => {
		createEffect(() => {
			for (const element of memo.get()) {
				createScope(() => {
					const result = callback(element)
					if (Array.isArray(result)) activateResult(result)
					else if (typeof result === 'function') result()
				})
			}
		})
	}
}

export {
	activateResult,
	type EffectDescriptor,
	each,
	type FactoryResult,
	type Falsy,
	makePass,
	makeWatch,
	type PassedProps,
	type PassHelper,
	type Reactive,
	type WatchHelper,
}
