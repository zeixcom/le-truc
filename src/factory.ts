import {
	batch,
	createComputed,
	createEffect,
	createMemo,
	createScope,
	isFunction,
	isMemo,
	isRecord,
	type MaybeCleanup,
	type Memo,
	match,
	type Signal,
	untrack,
} from '@zeix/cause-effect'
import type { ComponentProps } from './component'
import {
	CONTEXT_REQUEST,
	type Context,
	ContextRequestEvent,
	type UnknownContext,
} from './context'
import type { EffectDescriptor } from './effects'
import type { PassedProps } from './effects/pass'
import { pass as effectPass } from './effects/pass'
import { getSignals } from './internal'
import { PASSIVE_EVENTS, schedule } from './scheduler'
import { DEV_MODE, elementName, LOG_WARN } from './util'

/* === Types === */

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

/* === Constants === */

/**
 * Events that do not bubble. When used as the `type` argument to `on()` with a Memo target,
 * event delegation cannot be used — per-element listeners are set up as a fallback instead.
 * In DEV_MODE, a warning is logged pointing toward the `each()` + `on()` pattern.
 */
const NON_BUBBLING_EVENTS = new Set([
	'focus',
	'blur',
	'scroll',
	'resize',
	'load',
	'unload',
	'error',
	'toggle',
	'mouseenter',
	'mouseleave',
	'pointerenter',
	'pointerleave',
	'abort',
	'canplay',
	'canplaythrough',
	'durationchange',
	'emptied',
	'ended',
	'loadeddata',
	'loadedmetadata',
	'loadstart',
	'pause',
	'play',
	'playing',
	'progress',
	'ratechange',
	'seeked',
	'seeking',
	'stalled',
	'suspend',
	'timeupdate',
	'volumechange',
	'waiting',
])

/* === Internal Helpers === */

/**
 * Resolve a `watch` source (string property name or Signal) to a Signal usable by `match`.
 *
 * - String: look up the signal in the component's signal map; fall back to a computed
 *   that reads `host[name]` (covers properties added via `Object.defineProperty`).
 * - Signal/Memo: use directly.
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
 * Attach a single event listener to an element and return the cleanup function.
 * Handles passive scheduling and the `{ prop: value }` return → `batch()` host update.
 */
const attachListener = <P extends ComponentProps, E extends Element>(
	host: HTMLElement & P,
	target: E,
	type: string,
	handler: (event: Event, element: E) => { [K in keyof P]?: P[K] } | void,
	options: AddEventListenerOptions,
): (() => void) => {
	const listener = (e: Event) => {
		const task = () => {
			const result = handler(e, target)
			if (!isRecord(result)) return
			batch(() => {
				for (const [key, value] of Object.entries(result)) {
					;(host as any)[key] = value
				}
			})
		}
		if (options.passive) schedule(target, task)
		else task()
	}
	target.addEventListener(type, listener, options)
	return () => target.removeEventListener(type, listener)
}

/* === Factory Creators === */

/**
 * Create a `watch` helper bound to a specific component host.
 *
 * `watch` wraps `match` to create a reactive effect driven by explicitly declared
 * signal sources. Only the declared source signals trigger re-runs — other reads
 * inside the handler are not tracked. Returns an `EffectDescriptor`.
 *
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
 * Create an `on` helper bound to a specific component host.
 *
 * `on` attaches an event listener to an element or a `Memo<Element[]>` collection.
 * The handler always receives `(event, element)` — a unified signature regardless
 * of target type. Returns an `EffectDescriptor`.
 *
 * For Memo targets, uses event delegation (single listener on the query root).
 * Non-bubbling events with Memo targets fall back to per-element listeners;
 * in DEV_MODE a warning is logged pointing toward `each()` + `on()`.
 *
 * @param host - The component host element
 */
const makeOn = <P extends ComponentProps>(host: HTMLElement & P) => {
	type OnHandler<E extends Element, Evt extends Event> = (
		event: Evt,
		element: E,
	) => { [K in keyof P]?: P[K] } | void

	function on<E extends Element, T extends keyof HTMLElementEventMap>(
		target: E,
		type: T,
		handler: OnHandler<E, HTMLElementEventMap[T]>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	function on<E extends Element>(
		target: E,
		type: string,
		handler: OnHandler<E, Event>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	function on<E extends Element, T extends keyof HTMLElementEventMap>(
		target: Memo<E[]>,
		type: T,
		handler: OnHandler<E, HTMLElementEventMap[T]>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	function on<E extends Element>(
		target: Memo<E[]>,
		type: string,
		handler: OnHandler<E, Event>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	function on(
		target: Element | Memo<Element[]>,
		type: string,
		handler: OnHandler<Element, Event>,
		options: AddEventListenerOptions = {},
	): EffectDescriptor {
		return () => {
			if (!('passive' in options)) {
				options = { ...options, passive: PASSIVE_EVENTS.has(type) }
			}

			if (isMemo<Element[]>(target)) {
				// Memo target: check whether this event type bubbles
				if (NON_BUBBLING_EVENTS.has(type)) {
					if (DEV_MODE) {
						console[LOG_WARN](
							`on(): '${type}' does not bubble — prefer each() + on() for per-element listeners in ${elementName(host)}`,
						)
					}
					// Fall back to per-element listeners with per-element lifecycle
					return createEffect(() => {
						for (const el of target.get()) {
							createScope(() => {
								return attachListener(host, el, type, handler, options)
							})
						}
					})
				}

				// Event delegation: one listener on the query root
				const root = host.shadowRoot ?? (host as unknown as Element)
				const listener = (e: Event) => {
					for (const el of target.get()) {
						if (el === e.target || el.contains(e.target as Node)) {
							const task = () => {
								const result = handler(e, el)
								if (!isRecord(result)) return
								batch(() => {
									for (const [key, value] of Object.entries(result)) {
										;(host as any)[key] = value
									}
								})
							}
							if (options.passive) schedule(el, task)
							else task()
							break
						}
					}
				}
				root.addEventListener(type, listener, options)
				return () => root.removeEventListener(type, listener)
			}

			// Single Element target
			return attachListener(host, target as Element, type, handler, options)
		}
	}
	return on
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
 * @param host - The component host element
 */
const makePass = <P extends ComponentProps>(host: HTMLElement & P) => {
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
						// effectPass(props)(host, el) calls createScope internally —
						// that scope is owned by this createEffect and is disposed on re-run
						effectPass(props)(host as any, el)
					}
				})
			} else {
				// Single element: delegate to the v1.0 pass effect directly
				effectPass(props)(host as any, target)
			}
		}
	}
	return pass
}

/**
 * Create a `provideContexts` helper bound to a specific component host.
 *
 * Returns a function that takes a `contexts` array and returns an `EffectDescriptor`.
 * When activated, attaches a `context-request` listener to `host`; provides a
 * getter `() => host[context]` for each matching context key.
 *
 * @param host - The component host element
 */
const makeProvideContexts =
	<P extends ComponentProps>(host: HTMLElement & P) =>
	(contexts: Array<keyof P>): EffectDescriptor =>
	() =>
		createScope(() => {
			const listener = (e: ContextRequestEvent<UnknownContext>) => {
				const { context, callback } = e
				if (
					typeof context === 'string' &&
					contexts.includes(context as unknown as Extract<keyof P, string>) &&
					isFunction(callback)
				) {
					e.stopImmediatePropagation()
					callback(() => host[context as keyof P])
				}
			}
			host.addEventListener(CONTEXT_REQUEST, listener)
			return () => host.removeEventListener(CONTEXT_REQUEST, listener)
		})

/**
 * Create a `requestContext` helper bound to a specific component host.
 *
 * Returns a function that dispatches a `context-request` event from `host`
 * and wraps the resolved getter in a `Memo<T>`. If no provider responds,
 * the Memo returns `fallback`. For use inside `expose()` as a property initializer.
 *
 * @param host - The component host element
 */
const makeRequestContext =
	<P extends ComponentProps>(host: HTMLElement & P) =>
	<T extends {}>(context: Context<string, () => T>, fallback: T): Memo<T> => {
		let consumed: () => T = () => fallback
		host.dispatchEvent(
			new ContextRequestEvent(context, (getter: () => T) => {
				consumed = getter
			}),
		)
		return createMemo(consumed)
	}

export {
	makeOn,
	makePass,
	makeProvideContexts,
	makeRequestContext,
	makeWatch,
	NON_BUBBLING_EVENTS,
	type WatchHandlers,
}
