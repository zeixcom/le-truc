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
import { DEV_MODE, elementName, isCustomElement, LOG_WARN } from '../util'

/* === Types === */

type PassedProp<T, P extends ComponentProps, E extends HTMLElement> =
	| Reactive<T, P, E>
	| [Reactive<T, P, E>, (value: T) => void]

type PassedProps<P extends ComponentProps, Q extends ComponentProps> = {
	[K in keyof Q & string]?: PassedProp<Q[K], P, Component<Q>>
}

/* === Exported Function === */

/**
 * Effect for passing reactive values to a descendant component.
 *
 * **Le Truc targets (Slot-backed properties):** Replaces the backing signal of the
 * target's Slot, creating a live parent→child binding. The original signal is restored
 * on cleanup so the child can be safely detached and reattached.
 *
 * **Other custom elements (Object.defineProperty fallback):** Overrides the property
 * descriptor on the target instance with a reactive getter (and optional setter for
 * two-way binding). The original descriptor is restored on cleanup. In DEV_MODE, logs
 * a warning if the descriptor is non-configurable and the binding cannot be installed.
 *
 * Scope: custom elements only (elements whose `localName` contains a hyphen).
 * For plain HTML elements, use `setProperty()` instead.
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

			// Resolve the reactive to a signal
			const applied =
				isFunction(reactive) && reactive.length === 1
					? reactive(target)
					: reactive
			const isArray = Array.isArray(applied) && applied.length === 2
			const signal = toSignal(isArray ? applied[0] : applied)
			if (!signal) continue

			// Path A: Slot-backed (Le Truc component) — replace and restore on cleanup
			const slot = signals[prop]
			if (isSlot(slot)) {
				const original = slot.current()
				slot.replace(signal)
				cleanups.push(() => slot.replace(original))
				continue
			}

			// Path B: Object.defineProperty fallback for other custom elements
			const descriptor =
				Object.getOwnPropertyDescriptor(target, prop) ??
				Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), prop)

			if (!descriptor) continue

			if (!descriptor.configurable) {
				if (DEV_MODE)
					console[LOG_WARN](
						`pass(): property '${prop}' on ${targetName} has a non-configurable descriptor — binding skipped`,
					)
				continue
			}

			// Install reactive getter (and optional setter for two-way binding)
			const setter = isArray
				? (applied[1] as (value: unknown) => void)
				: undefined
			Object.defineProperty(target, prop, {
				get: () => signal.get(),
				set: setter,
				configurable: true,
				enumerable: descriptor.enumerable ?? true,
			})

			// Restore original descriptor on cleanup
			cleanups.push(() => Object.defineProperty(target, prop, descriptor))
		}

		if (cleanups.length)
			return () => {
				for (const c of cleanups) c()
			}
	}

export { type PassedProp, type PassedProps, pass }
