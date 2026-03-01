import type { ComponentProps } from '../component'
import { type Effect, type Reactive, updateElement } from '../effects'

/* === Exported Functions === */

/**
 * Effect for setting a property on an element.
 * Sets the specified property directly on the element object.
 *
 * @since 0.8.0
 * @param {K} key - Name of the property to set
 * @param {Reactive<E[K], P, E>} reactive - Reactive value bound to the property value (defaults to property name)
 * @returns {Effect<P, E>} Effect function that sets the property on the element
 */
const setProperty = <
	P extends ComponentProps,
	E extends Element,
	K extends keyof E & string,
>(
	key: K,
	reactive: Reactive<E[K] & {}, P, E> = key as keyof P,
): Effect<P, E> =>
	updateElement<E[K] & {}, P, E>(reactive, {
		op: 'p',
		name: key,
		read: el => (key in el ? (el[key] ?? null) : null),
		update: (el, value) => {
			el[key] = value
		},
	})

/**
 * Effect for controlling element visibility by setting the 'hidden' property.
 * When the reactive value is true, the element is shown; when false, it's hidden.
 *
 * @since 0.13.1
 * @param {Reactive<boolean, P, E>} reactive - Reactive value bound to the visibility state
 * @returns {Effect<P, E>} Effect function that controls element visibility
 */
const show = <P extends ComponentProps, E extends HTMLElement = HTMLElement>(
	reactive: Reactive<boolean, P, E>,
): Effect<P, E> =>
	updateElement(reactive, {
		op: 'p',
		name: 'hidden',
		read: el => !el.hidden,
		update: (el, value) => {
			el.hidden = !value
		},
	})

export { setProperty, show }
