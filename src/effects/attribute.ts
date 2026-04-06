import type { ComponentProps } from '../component'
import { type Effect, type Reactive, updateElement } from '../effects'
import { safeSetAttribute } from '../safety'

/* === Exported Functions === */

/**
 * Effect for setting an attribute on an element.
 * Sets the specified attribute with security validation for unsafe values.
 *
 * @deprecated Use `run('prop', value => { el.setAttribute(name, value) })` in the v1.1 factory form instead.
 * `safeSetAttribute(el, name, value)` is available for security-validated attribute writes.
 * @since 0.8.0
 * @param {string} name - Name of the attribute to set
 * @param {Reactive<string, P, E>} reactive - Reactive value bound to the attribute value (defaults to attribute name)
 * @returns {Effect<P, E>} Effect function that sets the attribute on the element
 */
const setAttribute = <P extends ComponentProps, E extends Element>(
	name: string,
	reactive: Reactive<string, P, E> = name as keyof P,
): Effect<P, E> =>
	updateElement(reactive, {
		op: 'a',
		name,
		read: el => el.getAttribute(name),
		update: (el, value) => {
			safeSetAttribute(el, name, value)
		},
		delete: el => {
			el.removeAttribute(name)
		},
	})

/**
 * Effect for toggling a boolean attribute on an element.
 * When the reactive value is true, the attribute is present; when false, it's absent.
 *
 * @deprecated Use `run('prop', value => { el.toggleAttribute(name, value) })` in the v1.1 factory form instead.
 * @since 0.8.0
 * @param {string} name - Name of the attribute to toggle
 * @param {Reactive<boolean, P, E>} reactive - Reactive value bound to the attribute presence (defaults to attribute name)
 * @returns {Effect<P, E>} Effect function that toggles the attribute on the element
 */
const toggleAttribute = <
	P extends ComponentProps,
	E extends Element = HTMLElement,
>(
	name: string,
	reactive: Reactive<boolean, P, E> = name as keyof P,
): Effect<P, E> =>
	updateElement(reactive, {
		op: 'a',
		name,
		read: el => el.hasAttribute(name),
		update: (el, value) => {
			el.toggleAttribute(name, value)
		},
	})

export { setAttribute, toggleAttribute }
