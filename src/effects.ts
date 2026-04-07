import {
	createComputed,
	createEffect,
	createScope,
	isFunction,
	isMemo,
	isRecord,
	isSignal,
	isSlot,
	type MaybeCleanup,
	type Memo,
	match,
	type Signal,
	untrack,
} from '@zeix/cause-effect'
import type { ComponentProps } from './component'
import { InvalidCustomElementError, InvalidReactivesError } from './errors'
import { getSignals } from './internal'
import { DEV_MODE, elementName, isCustomElement, LOG_WARN } from './util'

/* === Types === */

/**
 * A deferred effect: a thunk that, when called inside a reactive scope, creates
 * a reactive effect and returns an optional cleanup function.
 *
 * Effect descriptors are returned by `run()`, `on()`, `each()`, `pass()`, and
 * `provideContexts()`. They are activated after dependency resolution, not
 * immediately when the factory function runs.
 */
type EffectDescriptor = () => MaybeCleanup

/**
 * The return value of the factory function.
 *
 * A flat array of effect descriptors (and optional falsy guards for conditional
 * effects). Falsy values (`false`, `undefined`) are filtered out before activation,
 * enabling the `element && run(...)` conditional pattern.
 */
type FactoryResult = Array<EffectDescriptor | false | undefined>

/**
 * User-facing handler object for `watch()` with match branches.
 * `ok` receives the resolved value directly (not a tuple) for single-source `watch()`.
 * `err` receives a single Error (not an array) for convenience.
 */
type WatchHandlers<T> = {
	ok: (value: T) => MaybeCleanup | void
	err?: (error: Error) => MaybeCleanup | void
	nil?: () => MaybeCleanup | void
}

/**
 * A single reactive value to pass to a descendant Le Truc component property.
 *
 * Three forms are accepted:
 * - `keyof P` — a string property name on the host
 * - `Signal<T>` — any signal
 * - `(host: HTMLElement & P) => T` — a reader function receiving the host
 */
type PassedProp<T, P extends ComponentProps> =
	| keyof P
	| Signal<T & {}>
	| ((host: HTMLElement & P) => T)

/**
 * A map of child component property names to the reactive values to inject into them.
 * Passed as the second argument to `pass()`. Keys must be property names of the target component `Q`.
 */
type PassedProps<P extends ComponentProps, Q extends ComponentProps> = {
	[K in keyof Q & string]?: PassedProp<Q[K], P>
}

/**
 * The `watch` helper type in `FactoryContext`.
 *
 * Drives a reactive effect from a signal source (property name, Signal, or array).
 * Only the declared sources trigger re-runs — incidental reads inside the handler
 * are not tracked. Returns an `EffectDescriptor`.
 */
type FactoryWatchHelper<P extends ComponentProps> = {
	<K extends keyof P & string>(
		source: K,
		handler: (value: P[K]) => MaybeCleanup | void,
	): EffectDescriptor
	<K extends keyof P & string>(
		source: K,
		handlers: WatchHandlers<P[K]>,
	): EffectDescriptor
	<T extends {}>(
		source: Signal<T>,
		handler: (value: T) => MaybeCleanup | void,
	): EffectDescriptor
	<T extends {}>(
		source: Signal<T>,
		handlers: WatchHandlers<T>,
	): EffectDescriptor
	(
		source: Array<string | Signal<any>>,
		handler: (values: any[]) => MaybeCleanup | void,
	): EffectDescriptor
}

/**
 * The `pass` helper type in `FactoryContext`.
 *
 * Passes reactive values to a descendant Le Truc component's Slot-backed signals.
 * Supports single-element and Memo targets (per-element lifecycle for Memo).
 */
type FactoryPassHelper<P extends ComponentProps> = {
	<Q extends ComponentProps>(
		target: HTMLElement & Q,
		props: PassedProps<P, Q>,
	): EffectDescriptor
	<Q extends ComponentProps>(
		target: Memo<(HTMLElement & Q)[]>,
		props: PassedProps<P, Q>,
	): EffectDescriptor
}

/* === Internal Helpers === */

/**
 * Resolve a `watch` source (string property name or Signal) to a Signal usable by `match`.
 *
 * - String: look up the signal in the component's signal map; fall back to a computed
 *   that reads `host[name]` (covers properties added via `Object.defineProperty`).
 * - Signal/Memo: use directly.
 *
 * @since 2.0
 */
const resolveSignal = <P extends ComponentProps>(
	host: HTMLElement & P,
	source: (keyof P & string) | Signal<any>,
): Signal<any> => {
	if (typeof source === 'string') {
		const sig = getSignals(host)[source]
		if (sig) return sig
		return createComputed(() => (host as any)[source])
	}
	return source as Signal<any>
}

/**
 * Resolve a reactive pass value to a Signal.
 * Handles property name strings, Signal instances, and reader functions.
 *
 * @since 2.0
 */
const toSignal = <P extends ComponentProps>(
	host: HTMLElement & P,
	value: unknown,
): Signal<any> | undefined => {
	if (isSignal(value)) return value
	const fn =
		typeof value === 'string' && value in host
			? () => host[value as keyof typeof host]
			: isFunction(value)
				? (value as (host: HTMLElement & P) => unknown)
				: undefined
	return fn ? createComputed(fn as () => NonNullable<unknown>) : undefined
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
 * @param host - The component host element
 */
const makeWatch = <P extends ComponentProps>(host: HTMLElement & P) => {
	function watch<K extends keyof P & string>(
		source: K,
		handler: (value: P[K]) => MaybeCleanup | void,
	): EffectDescriptor
	function watch<K extends keyof P & string>(
		source: K,
		handlers: WatchHandlers<P[K]>,
	): EffectDescriptor
	function watch<T extends {}>(
		source: Signal<T>,
		handler: (value: T) => MaybeCleanup | void,
	): EffectDescriptor
	function watch<T extends {}>(
		source: Signal<T>,
		handlers: WatchHandlers<T>,
	): EffectDescriptor
	function watch(
		source: Array<(keyof P & string) | Signal<any>>,
		handler: (values: any[]) => MaybeCleanup | void,
	): EffectDescriptor
	function watch(
		source:
			| (keyof P & string)
			| Signal<any>
			| Array<(keyof P & string) | Signal<any>>,
		handlerOrHandlers:
			| ((value: any) => MaybeCleanup | void)
			| WatchHandlers<any>,
	): EffectDescriptor {
		return () => {
			const isArraySource = Array.isArray(source)
			const sources = isArraySource
				? source
				: [source as (keyof P & string) | Signal<any>]
			const signals = sources.map(s => resolveSignal(host, s))

			if (typeof handlerOrHandlers === 'function') {
				const handler = handlerOrHandlers
				return createEffect(() =>
					match(signals as any, {
						ok: (values: readonly any[]) =>
							untrack(() => handler(isArraySource ? values : values[0])),
					}),
				)
			}
			const handlers = handlerOrHandlers as WatchHandlers<any>
			const matchHandlers: any = {
				ok: (values: readonly any[]) =>
					untrack(() => handlers.ok(isArraySource ? values : values[0])),
			}
			if (handlers.err)
				matchHandlers.err = (errs: readonly Error[]) =>
					untrack(() => handlers.err!(errs[0]!))
			if (handlers.nil) matchHandlers.nil = () => untrack(() => handlers.nil!())
			return createEffect(() => match(signals as any, matchHandlers))
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
 * @param host - The component host element
 */
const makePass = <P extends ComponentProps>(host: HTMLElement & P) => {
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
		target: HTMLElement & Q,
		props: PassedProps<P, Q>,
	): EffectDescriptor
	function pass<Q extends ComponentProps>(
		target: Memo<(HTMLElement & Q)[]>,
		props: PassedProps<P, Q>,
	): EffectDescriptor
	function pass<Q extends ComponentProps>(
		target: (HTMLElement & Q) | Memo<(HTMLElement & Q)[]>,
		props: PassedProps<P, Q>,
	): EffectDescriptor {
		return () => {
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
 *
 * @since 2.0
 */
function each<E extends Element>(
	memo: Memo<E[]>,
	callback: (element: E) => FactoryResult,
): EffectDescriptor
function each<E extends Element>(
	memo: Memo<E[]>,
	callback: (element: E) => EffectDescriptor,
): EffectDescriptor
function each<E extends Element>(
	memo: Memo<E[]>,
	callback: (element: E) => FactoryResult | EffectDescriptor,
): EffectDescriptor {
	return () => {
		createEffect(() => {
			for (const element of memo.get()) {
				createScope(() => {
					const result = callback(element)
					if (Array.isArray(result)) {
						for (const descriptor of result) {
							if (descriptor) descriptor()
						}
					} else if (typeof result === 'function') {
						result()
					}
				})
			}
		})
	}
}

export {
	type EffectDescriptor,
	each,
	type FactoryPassHelper,
	type FactoryResult,
	type FactoryWatchHelper,
	makePass,
	makeWatch,
	type PassedProp,
	type PassedProps,
	type WatchHandlers,
}
