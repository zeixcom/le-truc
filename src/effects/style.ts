import type { ComponentProps } from '../component'
import { type Effect, type Reactive, updateElement } from '../effects'

/* === Exported Function === */

/**
 * Effect for setting a CSS style property on an element.
 * Sets the specified style property with support for deletion via UNSET.
 *
 * @since 0.8.0
 * @param {string} prop - Name of the CSS style property to set
 * @param {Reactive<string, P, E>} reactive - Reactive value bound to the style property value (defaults to property name)
 * @returns {Effect<P, E>} Effect function that sets the style property on the element
 */
const setStyle = <
	P extends ComponentProps,
	E extends HTMLElement | SVGElement | MathMLElement = HTMLElement,
>(
	prop: string,
	reactive: Reactive<string, P> = prop as Reactive<string, P>,
): Effect<P, E> =>
	updateElement(reactive, {
		op: 's',
		name: prop,
		read: el => el.style.getPropertyValue(prop),
		update: (el, value) => {
			el.style.setProperty(prop, value)
		},
		delete: el => {
			el.style.removeProperty(prop)
		},
	})

export { setStyle }
