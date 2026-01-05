import {
	type Cleanup,
	type Collection,
	type Computed,
	isCollection,
	notifyWatchers,
	subscribeActiveWatcher,
	TYPE_COMPUTED,
	type Watcher,
} from '@zeix/cause-effect'
import type { Component, ComponentProps } from '../component'
import { InvalidUIKeyError } from '../errors'
import { getFallback, type ParserOrFallback } from '../parsers'
import { PASSIVE_EVENTS, schedule } from '../scheduler'
import type { ElementFromKey, UI } from '../ui'

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

/* === Internal Function === */

function getTarget<E extends Element>(
	targets: E | Collection<E>,
	eventTarget: Node,
): E | undefined {
	const elements = isCollection(targets) ? targets.get() : [targets]
	for (const t of elements) if (t.contains(eventTarget)) return t
}

/* === Class === */

class Sensor<
	T extends {},
	U extends UI & { host: HTMLElement },
	E extends Element,
> {
	#watchers = new Set<Watcher>()
	#value: T
	#host: HTMLElement
	#events = new Map<string, EventListener>()
	#cleanup: Cleanup | undefined

	constructor(
		ui: U,
		key: string,
		events: SensorEvents<T, U, E>,
		initialValue: T,
	) {
		if (!ui[key]) throw new InvalidUIKeyError(ui.host, key, 'sensor')

		this.#host = ui.host
		this.#value = initialValue
		const targets = ui[key] as E | Collection<E>

		for (const [type, handler] of Object.entries(events)) {
			this.#events.set(
				type,
				this.#getEventListener(
					type,
					handler as SensorHandler<T, EventType<typeof type>, U, E>,
					ui,
					targets,
				),
			)
		}
	}

	#getEventListener<K extends string>(
		type: K,
		handler: SensorHandler<T, EventType<K>, U, E>,
		ui: U,
		targets: E | Collection<E>,
	) {
		const isPassive = PASSIVE_EVENTS.has(type)

		return (e: Event) => {
			const eventTarget = e.target as Node
			if (!eventTarget) return
			const target = getTarget(targets, eventTarget)
			if (!target) return
			e.stopPropagation()

			const task = () => {
				try {
					const next = handler({
						event: e as EventType<K>,
						ui,
						target,
						prev: this.#value,
					})
					if (next == null || next instanceof Promise) return
					if (!Object.is(next, this.#value)) {
						this.#value = next
						if (this.#watchers.size) notifyWatchers(this.#watchers)
						else if (this.#cleanup) this.#cleanup()
					}
				} catch (error) {
					e.stopImmediatePropagation()
					throw error
				}
			}
			if (isPassive) schedule(this.#host, task)
			else task()
		}
	}

	get [Symbol.toStringTag](): 'Computed' {
		return TYPE_COMPUTED
	}

	/**
	 * Return the memoized value after computing it if necessary.
	 *
	 * @returns {T}
	 */
	get(): T {
		subscribeActiveWatcher(this.#watchers)
		if (this.#watchers.size && !this.#cleanup) {
			for (const [type, listener] of this.#events) {
				const options = { passive: PASSIVE_EVENTS.has(type) }
				this.#host.addEventListener(type, listener, options)
			}
			this.#cleanup = () => {
				for (const [type, listener] of this.#events)
					this.#host.removeEventListener(type, listener)
				this.#cleanup = undefined
			}
		}
		return this.#value
	}
}

/* === Exported Functions === */

/**
 * Create a computed signal from transformed event data
 *
 * @since 0.14.0
 * @param {ParserOrFallback<T, U>} init - Initial value, reader or parser
 * @param {K} key - Name of UI key
 * @param {SensorEvents<T, U, ElementFromKey<U, K>>} events - Transformation functions for events
 * @returns {Extractor<Computed<T>, C>} Extractor function for value from event
 */
const createSensor =
	<
		T extends {},
		P extends ComponentProps,
		U extends UI,
		K extends keyof U & string,
	>(
		init: ParserOrFallback<T, U>,
		key: K,
		events: SensorEvents<T, U, ElementFromKey<U, K>>,
	): ((ui: U & { host: Component<P> }) => Computed<T>) =>
	(ui: U & { host: Component<P> }) => {
		const value: T = getFallback(ui, init)

		return new Sensor(ui, key, events, value)
	}

export { createSensor, type SensorEvents }
