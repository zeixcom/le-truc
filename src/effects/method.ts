import type { ComponentProps } from '../component'
import { type Effect, type Reactive, updateElement } from '../effects'
import { hasMethod } from '../util'

/* === Exported Functions === */

/**
 * Effect for calling a method on an element.
 *
 * @since 0.13.3
 * @param {K} methodName - Name of the method to call
 * @param {Reactive<boolean, P, E>} reactive - Reactive value bound to the method call
 * @param {unknown[]} args - Arguments to pass to the method
 * @returns Effect function that calls the method on the element
 */
const callMethod = <
	P extends ComponentProps,
	K extends keyof E,
	E extends HTMLElement = HTMLElement,
>(
	methodName: K,
	reactive: Reactive<boolean, P>,
	args?: unknown[],
): Effect<P, E> =>
	updateElement(reactive, {
		op: 'm',
		name: String(methodName),
		read: () => null,
		update: (el, value) => {
			if (value && hasMethod(el, methodName)) {
				if (args) el[methodName](...args)
				else el[methodName]()
			}
		},
	})

/**
 * Effect for controlling element focus by calling the 'focus()' method.
 * If the reactive value is true, element will be focussed; when false, nothing happens.
 *
 * @since 0.13.3
 * @param {Reactive<boolean, P, E>} reactive - Reactive value bound to the focus state
 * @returns {Effect<P, E>} Effect function that sets element focus
 */
const focus = <P extends ComponentProps, E extends HTMLElement = HTMLElement>(
	reactive: Reactive<boolean, P>,
): Effect<P, E> =>
	updateElement(reactive, {
		op: 'm',
		name: 'focus',
		read: el => el === document.activeElement,
		update: (el, value) => {
			if (value && hasMethod(el, 'focus')) el.focus()
		},
	})

export { callMethod, focus }
