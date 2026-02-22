import type { ComponentProps } from '../component'
import { type Effect, type Reactive, updateElement } from '../effects'

/* === Exported Function === */

/**
 * Effect for setting a CSS custom property or inline style on an element.
 *
 * When the reactive value is `null`, the style property is removed via
 * `el.style.removeProperty(prop)`. Otherwise it is set via `el.style.setProperty(prop, value)`.
 *
 * @since 0.8.0
 * @param {string} prop - CSS property name (e.g. `'color'`, `'--my-var'`)
 * @param {Reactive<string, P, E>} [reactive] - Reactive value for the style value (defaults to property name)
 * @returns {Effect<P, E>} Effect that sets or removes the style property on the element
 */
const setStyle = <
	P extends ComponentProps,
	E extends HTMLElement | SVGElement | MathMLElement,
>(
	prop: string,
	reactive: Reactive<string, P, E> = prop as Reactive<string, P, E>,
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
