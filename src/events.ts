import {
	batch,
	createEffect,
	createScope,
	isMemo,
	isRecord,
	type Memo,
} from '@zeix/cause-effect'
import type { ComponentProps } from './component'
import type { EffectDescriptor, Falsy } from './effects'
import { throttle } from './scheduler'
import { DEV_MODE, elementName, LOG_WARN } from './util'

/* === Types === */

type EventType<K extends string> = K extends keyof HTMLElementEventMap
	? HTMLElementEventMap[K]
	: Event

/**
 * Handler for `on()`. Receives `(event, element)`.
 *
 * Return `{ prop: value }` to batch-apply updates to host properties (sync only).
 * Return `Promise<void>` for fire-and-forget side effects — the Promise is not awaited
 * and its value cannot update host properties.
 */
type OnEventHandler<
	P extends ComponentProps,
	Evt extends Event,
	E extends Element,
> = (
	event: Evt,
	element: E,
) => { [K in keyof P]?: P[K] } | Falsy | void | Promise<void>

/**
 * `on` helper bound to a component host. Accepts a single element or `Memo<E[]>` target
 * and typed event names. Returns an `EffectDescriptor`.
 */
type OnHelper<P extends ComponentProps> = {
	<E extends Element, T extends keyof HTMLElementEventMap>(
		target: Memo<E[]> | Falsy,
		type: T,
		handler: OnEventHandler<P, HTMLElementEventMap[T], E>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	<E extends Element>(
		target: Memo<E[]> | Falsy,
		type: string,
		handler: OnEventHandler<P, Event, E>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	<E extends Element, T extends keyof HTMLElementEventMap>(
		target: E | Falsy,
		type: T,
		handler: OnEventHandler<P, HTMLElementEventMap[T], E>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	<E extends Element>(
		target: E | Falsy,
		type: string,
		handler: OnEventHandler<P, Event, E>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
}

/* === Constants === */

// High-frequency events that are passive by default and should be scheduled
const PASSIVE_EVENTS = new Set([
	'scroll',
	'resize',
	'mousewheel',
	'touchstart',
	'touchmove',
	'wheel',
])

// Events that do not bubble — `on()` with a Memo target falls back to per-element listeners.
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
 * Attach an event listener and return the cleanup function.
 * Passive events are throttled to one call per animation frame.
 * Sync `{ prop: value }` returns are batch-applied to host; Promise returns are not awaited.
 */
const attachListener = <P extends ComponentProps, E extends Element>(
	host: HTMLElement & P,
	target: E,
	type: string,
	handler: OnEventHandler<P, Event, E>,
	options: AddEventListenerOptions,
): EffectDescriptor => {
	const rawListener = (e: Event) => {
		const result = handler(e, target)
		if (!isRecord(result)) return
		batch(() => {
			for (const [key, value] of Object.entries(result)) {
				;(host as any)[key] = value
			}
		})
	}
	const listener = options.passive ? throttle(rawListener) : rawListener
	target.addEventListener(type, listener, options)
	return () => {
		target.removeEventListener(type, listener)
		;(listener as any).cancel?.()
	}
}

/* === Exported Functions === */

/**
 * Create an `on` helper bound to a component host.
 *
 * The returned `on` attaches a typed event listener to a single element or `Memo<E[]>`
 * collection. Handlers receive `(event, element)`. Returning `{ prop: value }` synchronously
 * batch-applies those updates to host properties; returning `Promise<void>` is valid for
 * fire-and-forget side effects. For async state updates use a trigger-state + `Task`:
 *
 * ```ts
 * const trigger = createState<FormData | null>(null)
 * return [
 *   on(form, 'submit', e => { e.preventDefault(); trigger.set(new FormData(form)) }),
 *   watch(createTask(async () => { ... trigger.get() ... }), { ok: ..., err: ... }),
 * ]
 * ```
 *
 * For `Memo<E[]>` targets, uses event delegation (one listener on the shadow root or host).
 * Non-bubbling events fall back to per-element listeners; a DEV_MODE warning points toward
 * `each()` + `on()`.
 *
 * @since 2.0
 * @param {HTMLElement & P} host - The component host element
 * @returns {OnHelper<P>} Bound `on` function for the given host
 */
const makeOn = <P extends ComponentProps>(
	host: HTMLElement & P,
): OnHelper<P> => {
	function on<E extends Element, T extends keyof HTMLElementEventMap>(
		target: Memo<E[]> | Falsy,
		type: T,
		handler: OnEventHandler<P, HTMLElementEventMap[T], E>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	function on<E extends Element>(
		target: Memo<E[]> | Falsy,
		type: string,
		handler: OnEventHandler<P, Event, E>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	function on<E extends Element, T extends keyof HTMLElementEventMap>(
		target: E | Falsy,
		type: T,
		handler: OnEventHandler<P, HTMLElementEventMap[T], E>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	function on<E extends Element>(
		target: E | Falsy,
		type: string,
		handler: OnEventHandler<P, Event, E>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	function on(
		target: Element | Memo<Element[]> | Falsy,
		type: string,
		handler: OnEventHandler<P, Event, Element>,
		options: AddEventListenerOptions = {},
	): EffectDescriptor {
		return () => {
			if (!target) return

			if (!('passive' in options)) {
				options = { ...options, passive: PASSIVE_EVENTS.has(type) }
			}

			if (isMemo(target)) {
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
				const root = host.shadowRoot ?? host
				const rawListener = (e: Event) => {
					const path = e.composedPath()
					for (const el of target.get()) {
						if (path.includes(el)) {
							const result = handler(e, el)
							if (!isRecord(result)) break
							batch(() => {
								for (const [key, value] of Object.entries(result)) {
									;(host as any)[key] = value
								}
							})
							break
						}
					}
				}
				const listener = options.passive ? throttle(rawListener) : rawListener
				root.addEventListener(type, listener, options)
				return () => {
					root.removeEventListener(type, listener)
					;(listener as any).cancel?.()
				}
			}

			// Single Element target
			return attachListener(host, target, type, handler, options)
		}
	}
	return on
}

export { type EventType, makeOn, type OnEventHandler, type OnHelper }
