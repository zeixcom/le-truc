import {
	isFunction,
	isMemoCallback,
	isRecord,
	isSignal,
	isString,
	type MaybeCleanup,
	Memo,
	type MemoCallback,
	UNSET,
} from '@zeix/cause-effect'
import type { Component, ComponentProps } from '../component'
import type { Effect, Reactive } from '../effects'
import { InvalidCustomElementError, InvalidReactivesError } from '../errors'
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
 * Effect for passing reactive values to a descendant Le Truc component.
 *
 * @since 0.15.0
 * @param {MutableReactives<Component<Q>, P>} props - Reactive values to pass
 * @returns {Effect<P, Component<Q>>} Effect function that passes reactive values to the descendant component
 * @throws {InvalidCustomElementError} When the target element is not a valid custom element
 * @throws {InvalidReactivesError} When the provided reactives is not a record of signals, reactive property names or functions
 * @throws {Error} When passing signals failed for some other reason
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

		const resetProperties: PropertyDescriptorMap = {}

		// Return getter from signal, reactive property name or function
		const getGetter = (value: unknown) => {
			if (isSignal(value)) return value.get
			const fn =
				isString(value) && value in host
					? ((() => host[value as keyof typeof host]) as MemoCallback<
							unknown & {}
						>)
					: isMemoCallback(value)
						? value
						: undefined
			return fn ? new Memo(fn).get : undefined
		}

		// Iterate through reactives
		for (const [prop, reactive] of Object.entries(reactives)) {
			if (reactive == null) continue

			// Ensure target has configurable property
			const descriptor = Object.getOwnPropertyDescriptor(target, prop)
			if (!(prop in target) || !descriptor?.configurable) continue

			// Determine getter	and setter
			const applied =
				isFunction(reactive) && reactive.length === 1
					? reactive(target)
					: reactive
			const isArray = Array.isArray(applied) && applied.length === 2
			const getter = getGetter(isArray ? applied[0] : applied)
			const setter = isArray && isFunction(applied[1]) ? applied[1] : undefined
			if (!getter) continue

			// Store original descriptor for reset and assign new descriptor
			resetProperties[prop] = descriptor
			Object.defineProperty(target, prop, {
				configurable: true,
				enumerable: true,
				get: getter,
				set: setter,
			})

			// Unset previous value so subscribers are notified
			descriptor.set?.call(target, UNSET)
		}

		// Reset to original descriptors on cleanup
		return () => {
			Object.defineProperties(target, resetProperties)
		}
	}

export { type PassedProp, type PassedProps, pass }
