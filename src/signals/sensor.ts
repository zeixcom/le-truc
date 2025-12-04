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
import type { ElementFromKey, UI } from '../ui'
import { isCollection } from './collection'

/* === Types === */

type EventType<K extends string> = K extends keyof HTMLElementEventMap
	? HTMLElementEventMap[K]
	: Event

type SensorEvent<
	T extends {},
	Evt extends Event,
	U extends UI,
	E extends Element,
> = (context: {
	event: Evt
	ui: U
	target: E
	value: T
}) => T | void | Promise<void>

type SensorEvents<T extends {}, U extends UI, E extends Element> = {
	[K in keyof HTMLElementEventMap]?: SensorEvent<T, EventType<K>, U, E>
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
		key: K,
		init: ParserOrFallback<T, U>,
		events: SensorEvents<T, U, ElementFromKey<U, K>>,
	): ((ui: U & { host: Component<P> }) => Computed<T>) =>
	(ui: U & { host: Component<P> }) => {
		const watchers: Set<Watcher> = new Set()
		let value: T = getFallback(ui, init)
		const targets = isCollection(ui[key])
			? (ui[key].get() as ElementFromKey<U, K>[])
			: ([ui[key]] as ElementFromKey<U & { host: Component<P> }, K>[])
		const eventMap = new Map<string, EventListener>()
		let cleanup: MaybeCleanup

		const listen = () => {
			for (const [type, transform] of Object.entries(events)) {
				const listener = (e: Event) => {
					const target = e.target as ElementFromKey<U, K>
					if (!target || !targets.includes(target)) return

					e.stopPropagation()
					try {
						const newValue = transform({
							event: e as any,
							ui,
							target,
							value,
						})
						if (newValue == null || newValue instanceof Promise)
							return
						if (!Object.is(newValue, value)) {
							value = newValue
							if (watchers.size) notify(watchers)
							else if (cleanup) cleanup()
						}
					} catch (error) {
						e.stopImmediatePropagation()
						throw error
					}
				}
				eventMap.set(type, listener)
				ui.host.addEventListener(type, listener)
			}
			cleanup = () => {
				if (eventMap.size) {
					for (const [type, listener] of eventMap)
						ui.host.removeEventListener(type, listener)
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
