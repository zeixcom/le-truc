import {
	batch,
	type Cleanup,
	effect,
	isRecord,
	UNSET,
} from '@zeix/cause-effect'
import type { Component, ComponentProps } from '../component'
import { type Effect, RESET, type Reactive, resolveReactive } from '../effects'
import { elementName, LOG_ERROR, log } from '../util'

/* === Types === */

type EventType<K extends string> = K extends keyof HTMLElementEventMap
	? HTMLElementEventMap[K]
	: Event

type EventHandler<
	P extends ComponentProps,
	E extends Element,
	Evt extends Event,
> = (context: {
	event: Evt
	host: Component<P>
	target: E
}) => { [K in keyof P]?: P[K] } | void | Promise<void>

/* === Exported Function === */

/**
 * Effect for attaching an event listener to an element.
 * Provides proper cleanup when the effect is disposed.
 *
 * @since 0.14.0
 * @param {K} type - Event type
 * @param {EventHandler<P, E, EventType<K>>} handler - Event handler function
 * @param {AddEventListenerOptions | boolean} options - Event listener options
 * @returns {Effect<ComponentProps, E>} Effect function that manages the event listener
 */
const on =
	<
		K extends keyof HTMLElementEventMap | string,
		P extends ComponentProps,
		E extends Element = HTMLElement,
	>(
		type: K,
		handler: EventHandler<P, E, EventType<K>>,
		options: AddEventListenerOptions | boolean = false,
	): Effect<P, E> =>
	(host, target): Cleanup => {
		const listener = (e: Event) => {
			const result = handler({ host, target, event: e as EventType<K> })
			if (!isRecord(result)) return
			batch(() => {
				for (const [key, value] of Object.entries(result)) {
					try {
						host[key as keyof P] = value
					} catch (error) {
						log(
							error,
							`Reactive property "${key}" on ${elementName(host)} from event ${type} on ${elementName(target)} could not be set, because it is read-only.`,
							LOG_ERROR,
						)
					}
				}
			})
		}
		target.addEventListener(type, listener, options)
		return () => target.removeEventListener(type, listener)
	}

/**
 * Effect for emitting custom events with reactive detail values.
 * Creates and dispatches CustomEvent instances with bubbling enabled by default.
 *
 * @since 0.13.3
 * @param {string} type - Event type to emit
 * @param {Reactive<T, P, E>} reactive - Reactive value bound to the event detail
 * @returns {Effect<P, E>} Effect function that emits custom events
 */
const emit =
	<T extends {}, P extends ComponentProps, E extends Element>(
		type: string,
		reactive: Reactive<T, P, E>,
	): Effect<P, E> =>
	(host, target): Cleanup =>
		effect((): undefined => {
			const value = resolveReactive(
				reactive,
				host,
				target,
				`custom event "${type}" detail`,
			)
			if (value === RESET || value === UNSET) return
			target.dispatchEvent(
				new CustomEvent(type, {
					detail: value,
					bubbles: true,
				}),
			)
		})

export { type EventHandler, type EventType, emit, on }
