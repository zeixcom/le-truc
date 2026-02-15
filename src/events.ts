import { createSensor, isMemo, isSensor, type Sensor } from '@zeix/cause-effect'
import type { Component, ComponentProps } from './component'
import { getFallback, type ParserOrFallback } from './parsers'
import { PASSIVE_EVENTS, schedule } from './scheduler'
import type { ElementFromKey, UI } from './ui'

/* === Types === */

type EventType<K extends string> = K extends keyof HTMLElementEventMap
	? HTMLElementEventMap[K]
	: Event

type EventHandler<
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
	[K in keyof HTMLElementEventMap]?: EventHandler<T, EventType<K>, U, E>
}

/* === Exported Functions === */

/**
 * Produce an event-driven sensor from transformed event data
 *
 * @since 0.16.0
 * @param {S} key - name of UI key
 * @param {ParserOrFallback<T>} init - Initial value, reader or parser
 * @param {EventHandlers<T, ElementFromSelector<S>, C>} events - Transformation functions for events
 * @returns {Extractor<Sensor<T>, C>} Extractor function for value from event
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
		const targets = isMemo<ElementFromKey<U, K>[]>(ui[key])
			? ui[key].get()
			: [ui[key] as ElementFromKey<U & { host: Component<P> }, K>]
		const eventMap = new Map<string, EventListener>()

		const getTarget = (eventTarget: Node): ElementFromKey<U, K> | undefined => {
			for (const t of targets)
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
	type EventHandler,
	type EventHandlers,
	type EventType,
}
