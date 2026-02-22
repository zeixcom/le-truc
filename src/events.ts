import { createSensor, isMemo, type Sensor } from '@zeix/cause-effect'
import type { Component, ComponentProps } from './component'
import { getFallback, type ParserOrFallback } from './parsers'
import { PASSIVE_EVENTS, schedule } from './scheduler'
import type { ElementFromKey, UI } from './ui'

/* === Types === */

type EventType<K extends string> = K extends keyof HTMLElementEventMap
	? HTMLElementEventMap[K]
	: Event

type SensorEventHandler<
	T extends {},
	Evt extends Event,
	U extends UI,
	E extends Element,
> = (context: {
	event: Evt
	ui: U
	target: E
	prev: T
}) => T | void | Promise<void>

type EventHandlers<T extends {}, U extends UI, E extends Element> = {
	[K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, U, E>
}

/* === Exported Functions === */

/**
 * Create a `Reader` that produces a `Sensor<T>` driven by DOM events on the host.
 *
 * Use this as a reactive property initializer when a single state value should be
 * derived from multiple event types (e.g. combining `click` and `keyup` into a
 * `selected` value), instead of updating host properties imperatively via `on()`.
 *
 * Event listeners are attached to the host element using event delegation.
 * Each handler receives `{ event, ui, target, prev }` and returns the new value,
 * or `void`/`Promise<void>` to leave the value unchanged. Passive events are
 * deferred via `schedule()`.
 *
 * @since 0.16.0
 * @param {ParserOrFallback<T, U>} init - Initial value, static fallback, or reader function
 * @param {K} key - Key of the UI object whose element(s) to listen on
 * @param {EventHandlers<T, U, ElementFromKey<U, K>>} events - Map of event type to handler function
 * @returns {(ui: U & { host: Component<P> }) => Sensor<T>} Reader that creates and returns the sensor
 */
const createEventsSensor =
	<T extends {}, P extends ComponentProps, U extends UI, K extends keyof U>(
		init: ParserOrFallback<T, U>,
		key: K,
		events: EventHandlers<T, U, ElementFromKey<U, K>>,
	): ((ui: U & { host: Component<P> }) => Sensor<T>) =>
	(ui: U & { host: Component<P> }) => {
		const { host } = ui
		let value: T = getFallback(ui, init)
		const memo = isMemo<ElementFromKey<U, K>[]>(ui[key]) ? ui[key] : null
		const single = memo
			? null
			: (ui[key] as ElementFromKey<U & { host: Component<P> }, K>)
		const eventMap = new Map<string, EventListener>()

		const getTarget = (eventTarget: Node): ElementFromKey<U, K> | undefined => {
			if (single) {
				return single.contains(eventTarget)
					? (single as ElementFromKey<U, K>)
					: undefined
			}
			for (const t of memo!.get())
				if (t.contains(eventTarget)) return t as ElementFromKey<U, K>
		}

		return createSensor<T>(
			set => {
				for (const [type, handler] of Object.entries(events)) {
					const options = { passive: PASSIVE_EVENTS.has(type) }
					const listener = (e: Event) => {
						const eventTarget = e.target as Node
						if (!eventTarget) return
						const target = getTarget(eventTarget)
						if (!target) return
						e.stopPropagation()

						const task = () => {
							try {
								const next = handler({
									event: e as any,
									ui,
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
						if (options.passive) schedule(host, task)
						else task()
					}
					eventMap.set(type, listener)
					host.addEventListener(type, listener, options)
				}
				return () => {
					if (eventMap.size) {
						for (const [type, listener] of eventMap)
							host.removeEventListener(type, listener)
						eventMap.clear()
					}
				}
			},
			{ value },
		)
	}

export {
	createEventsSensor,
	type SensorEventHandler,
	type EventHandlers,
	type EventType,
}
