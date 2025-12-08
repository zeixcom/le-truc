import {
	type Computed,
	type MaybeCleanup,
	notify,
	subscribe,
	TYPE_COMPUTED,
	type Watcher,
} from '@zeix/cause-effect'
import type { Component, ComponentProps } from '../component'
import { getFallback, type ParserOrFallback } from '../parsers'
import { PASSIVE_EVENTS, schedule } from '../scheduler'
import type { ElementFromKey, UI } from '../ui'
import { isCollection } from './collection'

/* === Types === */

type EventType<K extends string> = K extends keyof HTMLElementEventMap
	? HTMLElementEventMap[K]
	: Event

type SensorHandler<
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

type SensorEvents<T extends {}, U extends UI, E extends Element> = {
	[K in keyof HTMLElementEventMap]?: SensorHandler<T, EventType<K>, U, E>
}

/* === Exported Functions === */

/**
 * Produce a computed signal from transformed event data
 *
 * @since 0.14.0
 * @param {S} key - name of UI key
 * @param {ParserOrFallback<T>} init - Initial value, reader or parser
 * @param {SensorEvents<T, ElementFromSelector<S>, C>} events - Transformation functions for events
 * @returns {Extractor<Computed<T>, C>} Extractor function for value from event
 */
const createSensor =
	<T extends {}, P extends ComponentProps, U extends UI, K extends keyof U>(
		init: ParserOrFallback<T, U>,
		key: K,
		events: SensorEvents<T, U, ElementFromKey<U, K>>,
	): ((ui: U & { host: Component<P> }) => Computed<T>) =>
	(ui: U & { host: Component<P> }) => {
		const { host } = ui
		const watchers: Set<Watcher> = new Set()
		let value: T = getFallback(ui, init)
		const targets = isCollection(ui[key])
			? ui[key].get()
			: [ui[key] as ElementFromKey<U & { host: Component<P> }, K>]
		const eventMap = new Map<string, EventListener>()
		let cleanup: MaybeCleanup

		const getTarget = (eventTarget: Node): ElementFromKey<U, K> | undefined => {
			for (const t of targets) {
				if (t.contains(eventTarget)) return t as ElementFromKey<U, K>
			}
		}

		const listen = () => {
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
								if (watchers.size) notify(watchers)
								else if (cleanup) cleanup()
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
			cleanup = () => {
				if (eventMap.size) {
					for (const [type, listener] of eventMap)
						host.removeEventListener(type, listener)
					eventMap.clear()
				}
				cleanup = undefined
			}
		}

		const sensor = {} as Computed<T>
		Object.defineProperties(sensor, {
			[Symbol.toStringTag]: {
				value: TYPE_COMPUTED,
			},
			get: {
				value: () => {
					subscribe(watchers)
					if (watchers.size && !eventMap.size) listen()
					return value
				},
			},
		})
		return sensor
	}

export { createSensor }
