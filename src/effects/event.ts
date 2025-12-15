import { batch, type Cleanup, isRecord } from '@zeix/cause-effect'
import type { ComponentProps } from '../component'
import { type Effect } from '../effects'
import { PASSIVE_EVENTS, schedule } from '../scheduler'
import { elementName, LOG_ERROR, log } from '../util'

/* === Types === */

type EventType<K extends string> = K extends keyof HTMLElementEventMap
	? HTMLElementEventMap[K]
	: Event

type EventHandler<P extends ComponentProps, Evt extends Event> = (
	event: Evt,
) => { [K in keyof P]?: P[K] } | void | Promise<void>

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
		handler: EventHandler<P, EventType<K>>,
		options: AddEventListenerOptions = {},
	): Effect<P, E> =>
	(host, target): Cleanup => {
		if (!('passive' in options))
			options = { ...options, passive: PASSIVE_EVENTS.has(type) }
		const listener = (e: Event) => {
			const task = () => {
				const result = handler(e as EventType<K>)
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
			if (options.passive) schedule(target, task)
			else task()
		}
		target.addEventListener(type, listener, options)
		return () => target.removeEventListener(type, listener)
	}

export { type EventHandler, type EventType, on }
