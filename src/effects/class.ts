import type { ComponentProps } from '../component'
import { type Effect, type Reactive, updateElement } from '../effects'

/* === Exported Function === */

/**
 * Effect for toggling a CSS class token on an element.
 * When the reactive value is true, the class is added; when false, it's removed.
 *
 * @since 0.8.0
 * @param {string} token - CSS class token to toggle
 * @param {Reactive<boolean, P, E>} reactive - Reactive value bound to the class presence (defaults to class name)
 * @returns {Effect<P, U, E>} Effect function that toggles the class on the element
 */
const toggleClass = <P extends ComponentProps, E extends Element>(
	token: string,
	reactive: Reactive<boolean, P, E> = token as Reactive<boolean, P, E>,
): Effect<P, E> =>
	updateElement(reactive, {
		op: 'c',
		name: token,
		read: el => el.classList.contains(token),
		update: (el, value) => {
			el.classList.toggle(token, value)
		},
	})

export { toggleClass }
