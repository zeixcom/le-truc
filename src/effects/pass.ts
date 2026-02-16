import {
	createComputed,
	isFunction,
	isRecord,
	isSignal,
	isSlot,
	type MaybeCleanup,
	type Signal,
} from '@zeix/cause-effect'
import type { Component, ComponentProps } from '../component'
import type { Effect, Reactive } from '../effects'
import { InvalidCustomElementError, InvalidReactivesError } from '../errors'
import { getSignals } from '../internal'
import { elementName, isCustomElement } from '../util'

/* === Types === */

type PassedProp<T, P extends ComponentProps, E extends HTMLElement> =
	| Reactive<T, P, E>
	| [Reactive<T, P, E>, (value: T) => void]

type PassedProps<P extends ComponentProps, Q extends ComponentProps> = {
	[K in keyof Q & string]?: PassedProp<Q[K], P, Component<Q>>
}

/* === Exported Function === */

/**
 * Effect for passing reactive values to a descendant Le Truc component
 * by replacing the backing signal of the target's Slot.
 *
 * No cleanup/restore is needed: when the parent unmounts, the child
 * is torn down as well. For re-parenting scenarios, use context instead.
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
	(host, target): MaybeCleanup => {
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

		for (const [prop, reactive] of Object.entries(reactives)) {
			if (reactive == null) continue
			if (!(prop in target)) continue

			// Resolve the reactive to a signal
			const applied =
				isFunction(reactive) && reactive.length === 1
					? reactive(target)
					: reactive
			const isArray = Array.isArray(applied) && applied.length === 2
			const signal = toSignal(isArray ? applied[0] : applied)
			if (!signal) continue

			// Replace the backing signal of the target's Slot
			const slot = signals[prop]
			if (isSlot(slot)) slot.replace(signal)
		}
	}

export { type PassedProp, type PassedProps, pass }
