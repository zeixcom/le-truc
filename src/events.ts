import {
	batch,
	createEffect,
	createScope,
	createSensor,
	isMemo,
	isRecord,
	type Memo,
	type Sensor,
} from '@zeix/cause-effect'
import type { ComponentProps } from './component'
import type { EffectDescriptor, Falsy } from './effects'
import { PASSIVE_EVENTS, schedule } from './scheduler'
import { DEV_MODE, elementName, LOG_WARN } from './util'

/* === Types === */

type EventType<K extends string> = K extends keyof HTMLElementEventMap
	? HTMLElementEventMap[K]
	: Event

/**
 * Handler for a single event type inside `createEventsSensor`.
 *
 * Receives a context object with:
 * - `event` — the original DOM event (typed to the specific event type)
 * - `target` — the matched element (properly typed, unlike `event.target`)
 * - `prev` — the current sensor value before this event
 *
 * Return the new sensor value to update it, or `void` / `Promise<void>` to
 * leave the value unchanged.
 */
type SensorEventHandler<
	T extends {},
	Evt extends Event,
	E extends Element,
> = (context: { event: Evt; target: E; prev: T }) => T | void | Promise<void>

/**
 * Map of event type names to `SensorEventHandler` functions.
 * Each handler derives the new sensor value from the event, or returns `void` to leave it unchanged.
 */
type EventHandlers<T extends {}, E extends Element> = {
	[K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, E>
}

/**
 * The `on` helper type in `FactoryContext`.
 *
 * Attaches an event listener. The handler always receives `(event, element)`.
 * For Memo targets, uses event delegation (or per-element fallback for non-bubbling events).
 */
type OnHelper<P extends ComponentProps> = {
	<E extends Element, T extends keyof HTMLElementEventMap>(
		target: E | Falsy,
		type: T,
		handler: (
			event: HTMLElementEventMap[T],
			element: E,
		) => { [K in keyof P]?: P[K] } | void | Falsy,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	<E extends Element>(
		target: E | Falsy,
		type: string,
		handler: (
			event: Event,
			element: E,
		) => { [K in keyof P]?: P[K] } | void | Falsy,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	<E extends Element, T extends keyof HTMLElementEventMap>(
		target: Memo<E[]> | Falsy,
		type: T,
		handler: (
			event: HTMLElementEventMap[T],
			element: E,
		) => { [K in keyof P]?: P[K] } | void | Falsy,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	<E extends Element>(
		target: Memo<E[]> | Falsy,
		type: string,
		handler: (
			event: Event,
			element: E,
		) => { [K in keyof P]?: P[K] } | void | Falsy,
		options?: AddEventListenerOptions,
	): EffectDescriptor
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
 * Attach a single event listener to an element and return the cleanup function.
 * Handles passive scheduling and the `{ prop: value }` return → `batch()` host update.
 *
 * @since 2.0
 */
const attachListener = <P extends ComponentProps, E extends Element>(
	host: HTMLElement & P,
	target: E,
	type: string,
	handler: (
		event: Event,
		element: E,
	) => { [K in keyof P]?: P[K] } | void | Falsy,
	options: AddEventListenerOptions,
): EffectDescriptor => {
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

/* === Exported Functions === */

/**
 * Create a `Sensor<T>` driven by DOM events on a target element.
 *
 * Use this inside `expose()` as a property initializer when a single reactive
 * value should be derived from events on a specific element. The listener is
 * attached directly to `target`; the handler receives `{ event, target, prev }`.
 *
 * @since 2.0
 * @param {E} target - The element to listen on
 * @param {T} init - Initial value of the sensor
 * @param {EventHandlers<T, E>} events - Map of event type to handler function
 * @returns {Sensor<T>} Sensor that updates when matching events fire on target
 */
function createEventsSensor<T extends {}, E extends Element>(
	target: E,
	init: T,
	events: EventHandlers<T, E>,
): Sensor<T> {
	let value = init
	const eventMap = new Map<string, EventListener>()

	return createSensor<T>(
		set => {
			for (const [type, handler] of Object.entries(events)) {
				const options = { passive: PASSIVE_EVENTS.has(type) }
				const listener = (e: Event) => {
					const eventTarget = e.target as Node
					if (!eventTarget || !target.contains(eventTarget)) return

					const task = () => {
						try {
							const next = (handler as SensorEventHandler<T, Event, Element>)({
								event: e,
								target,
								prev: value,
							})
							if (next == null || next instanceof Promise) return
							if (!Object.is(next, value)) {
								value = next
								set(next)
							}
						} catch (error) {
							e.stopImmediatePropagation()
							throw error
						}
					}
					if (options.passive) schedule(target, task)
					else task()
				}
				eventMap.set(type, listener)
				target.addEventListener(type, listener, options)
			}
			return () => {
				if (eventMap.size) {
					for (const [type, listener] of eventMap)
						target.removeEventListener(type, listener)
					eventMap.clear()
				}
			}
		},
		{ value },
	)
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
 * @since 2.0
 * @param {HTMLElement & P} host - The component host element
 * @returns {OnHelper<P>} Bound `on` function for the given host
 */
const makeOn = <P extends ComponentProps>(
	host: HTMLElement & P,
): OnHelper<P> => {
	type OnHandler<E extends Element, Evt extends Event> = (
		event: Evt,
		element: E,
	) => { [K in keyof P]?: P[K] } | void | Falsy

	function on<E extends Element, T extends keyof HTMLElementEventMap>(
		target: E | Falsy,
		type: T,
		handler: OnHandler<E, HTMLElementEventMap[T]>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	function on<E extends Element>(
		target: E | Falsy,
		type: string,
		handler: OnHandler<E, Event>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	function on<E extends Element, T extends keyof HTMLElementEventMap>(
		target: Memo<E[]> | Falsy,
		type: T,
		handler: OnHandler<E, HTMLElementEventMap[T]>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	function on<E extends Element>(
		target: Memo<E[]> | Falsy,
		type: string,
		handler: OnHandler<E, Event>,
		options?: AddEventListenerOptions,
	): EffectDescriptor
	function on(
		target: Element | Memo<Element[]> | Falsy,
		type: string,
		handler: OnHandler<Element, Event>,
		options: AddEventListenerOptions = {},
	): EffectDescriptor {
		return () => {
			if (!target) return

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
					const path = e.composedPath()
					for (const el of target.get()) {
						if (path.includes(el)) {
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

export {
	createEventsSensor,
	type EventHandlers,
	type EventType,
	makeOn,
	type OnHelper,
	type SensorEventHandler,
}
