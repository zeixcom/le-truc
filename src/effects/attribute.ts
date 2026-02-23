import type { ComponentProps } from '../component'
import { type Effect, type Reactive, updateElement } from '../effects'

/* === Internal Functions === */

const isSafeURL = (value: string): boolean => {
	if (/^(mailto|tel):/i.test(value)) return true
	if (value.includes('://')) {
		try {
			const url = new URL(value, window.location.origin)
			return ['http:', 'https:', 'ftp:'].includes(url.protocol)
		} catch {
			return false
		}
	}
	return true
}

const safeSetAttribute = (
	element: Element,
	attr: string,
	value: string,
): void => {
	if (/^on/i.test(attr))
		throw new Error(
			`setAttribute: blocked unsafe attribute name '${attr}' on ${element.localName} — event handler attributes are not allowed`,
		)
	value = String(value).trim()
	if (!isSafeURL(value))
		throw new Error(
			`setAttribute: blocked unsafe value for '${attr}' on <${element.localName}>: '${value}'`,
		)
	element.setAttribute(attr, value)
}

/* === Exported Functions === */

/**
 * Effect for setting an attribute on an element.
 * Sets the specified attribute with security validation for unsafe values.
 *
 * @since 0.8.0
 * @param {string} name - Name of the attribute to set
 * @param {Reactive<string, P, E>} reactive - Reactive value bound to the attribute value (defaults to attribute name)
 * @returns {Effect<P, E>} Effect function that sets the attribute on the element
 */
const setAttribute = <P extends ComponentProps, E extends Element>(
	name: string,
	reactive: Reactive<string, P, E> = name as Reactive<string, P, E>,
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
	reactive: Reactive<boolean, P, E> = name as Reactive<boolean, P, E>,
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
