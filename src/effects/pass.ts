import {
	type Cleanup,
	createComputed,
	createScope,
	isFunction,
	isRecord,
	isSignal,
	isSlot,
	type Signal,
} from '@zeix/cause-effect'
import type { Component, ComponentProps } from '../component'
import type { Effect, Reactive } from '../effects'
import { InvalidCustomElementError, InvalidReactivesError } from '../errors'
import { getSignals } from '../internal'
import { DEV_MODE, elementName, isCustomElement, LOG_WARN } from '../util'

/* === Types === */

type PassedProp<T, P extends ComponentProps, E extends HTMLElement> = Reactive<
	T,
	P,
	E
>

type PassedProps<P extends ComponentProps, Q extends ComponentProps> = {
	[K in keyof Q & string]?: PassedProp<Q[K], P, Component<Q>>
}

/* === Exported Function === */

/**
 * Effect for passing reactive values to a descendant Le Truc component.
 *
 * Replaces the backing signal of the target's Slot, creating a live
 * parent→child binding. The original signal is captured and restored when the
 * parent disconnects, so the child regains its own independent state after
 * detachment.
 *
 * Scope: Le Truc components only (targets whose properties are Slot-backed).
 * For non-Le Truc custom elements or plain HTML elements, use `setProperty()`
 * instead — it goes through the element's public setter and is always correct
 * regardless of the child's internal framework.
 *
 * @since 0.15.0
 * @param {PassedProps<P, Q>} props - Reactive values to pass
 * @returns {Effect<P, Component<Q>>} Effect function that passes reactive values to the descendant component
 * @throws {InvalidCustomElementError} When the target element is not a valid custom element
 * @throws {InvalidReactivesError} When the provided reactives is not a record of signals, reactive property names or functions
 */
const pass =
	<P extends ComponentProps, Q extends ComponentProps>(
		props: PassedProps<P, Q> | ((target: Component<Q>) => PassedProps<P, Q>),
	): Effect<P, Component<Q>> =>
	(host, target): Cleanup =>
		createScope(() => {
			if (!isCustomElement(target))
				throw new InvalidCustomElementError(
					target,
					`pass from ${elementName(host)}`,
				)
			const reactives = isFunction(props) ? props(target) : props
			if (!isRecord(reactives))
				throw new InvalidReactivesError(host, target, reactives)

			// Resolve a reactive value to a Signal
			const toSignal = (value: unknown): Signal<any> | undefined => {
				if (isSignal(value)) return value
				const fn =
					typeof value === 'string' && value in host
						? () => host[value as keyof typeof host]
						: isFunction(value)
							? value
							: undefined
				return fn ? createComputed(fn as () => NonNullable<unknown>) : undefined
			}

			const signals = getSignals(target)
			const targetName = elementName(target)
			const cleanups: (() => void)[] = []

			for (const [prop, reactive] of Object.entries(reactives)) {
				if (reactive == null) continue
				if (!(prop in target)) {
					if (DEV_MODE)
						console[LOG_WARN](
							`pass(): property '${prop}' does not exist on ${targetName}`,
						)
					continue
				}

				const signal = toSignal(reactive)
				if (!signal) continue

				// Slot-backed (Le Truc component) — replace and restore on cleanup
				const slot = signals[prop]
				if (isSlot(slot)) {
					const original = slot.current()
					slot.replace(signal)
					cleanups.push(() => slot.replace(original))
					continue
				}

				if (DEV_MODE)
					console[LOG_WARN](
						`pass(): property '${prop}' on ${targetName} is not Slot-backed — use setProperty() for non-Le Truc elements`,
					)
			}

			if (cleanups.length)
				return () => {
					for (const c of cleanups) c()
				}
		})

export { type PassedProp, type PassedProps, pass }
