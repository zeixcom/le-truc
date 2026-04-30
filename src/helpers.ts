import type { SingleMatchHandlers } from '@zeix/cause-effect'
import { safeSetAttribute, setTextPreservingComments } from './safety'
import { schedule } from './scheduler'

/* === Types === */

type DangerouslyBindInnerHTMLOptions = {
	shadowRootMode?: ShadowRootMode
	allowScripts?: boolean
}

/* === Constants === */

const SCRIPT_ATTRS = [
	'type',
	'src',
	'async',
	'defer',
	'nomodule',
	'crossorigin',
	'integrity',
	'referrerpolicy',
	'fetchpriority',
]

/* === Exported Functions === */

/**
 * Returns a function that sets the text content of an element.
 *
 * When `preserveComments` is `true`, uses `setTextPreservingComments` to retain
 * HTML comment nodes. When `false` (default), sets `el.textContent` directly.
 * Numbers are coerced to strings via `String()`.
 *
 * @since 2.0
 * @param element - Target element
 * @param [preserveComments=false] - Whether to preserve HTML comment nodes
 * @returns Function that sets a text content
 */
const bindText = (
	element: Element,
	preserveComments: boolean = false,
): ((value: string | number) => void) =>
	preserveComments
		? (value: string | number) =>
				setTextPreservingComments(element, String(value))
		: (value: string | number) => {
				element.textContent = String(value)
			}

/**
 * Returns a function that sets a DOM property directly on an element.
 *
 * TypeScript infers `O[K]` from the object type and key, so no explicit type
 * parameters are needed at call sites.
 *
 * @since 2.0
 * @param object - Target object
 * @param key - Property key to set
 * @returns Function that sets a property
 */
const bindProperty =
	<O extends object, K extends keyof O & string>(
		object: O,
		key: K,
	): ((value: O[K]) => void) =>
	(value: O[K]) => {
		object[key] = value
	}

/**
 * Returns a function that toggles a CSS class token on an element.
 *
 * `value=true` adds the token; `value=false` removes it.
 *
 * @since 2.0
 * @param element - Target element
 * @param token - CSS class token to toggle
 * @returns Function that toggles the class token
 */
const bindClass =
	<T = boolean>(element: Element, token: string): ((value: T) => void) =>
	(value: T) => {
		element.classList.toggle(token, Boolean(value))
	}

/**
 * Returns a function that controls element visibility via `el.hidden = !value`.
 *
 * `value=true` makes the element visible; `value=false` hides it.
 *
 * @since 2.0
 * @param element - Target element
 * @returns Function that schedules the visibility update
 */
const bindVisible =
	<T = boolean>(element: HTMLElement): ((value: T) => void) =>
	(value: T) => {
		element.hidden = !value
	}

/**
 * Returns `SingleMatchHandlers` that set or toggle an attribute with security validation.
 *
 * - `ok(string)` → schedules `safeSetAttribute(el, name, value)` (or `el.setAttribute` if `allowUnsafe`)
 * - `ok(boolean)` → schedules `el.toggleAttribute(name, value)` — adds when `true`, removes when `false`
 * - `nil` → schedules `el.removeAttribute(name)`
 *
 * Pass `allowUnsafe: true` only when the value has been validated upstream.
 *
 * @since 2.0
 * @param element - Target element
 * @param name - Attribute name
 * @param [allowUnsafe=false] - Skip security validation for string values
 * @returns Match handlers for the attribute mutation
 */
const bindAttribute = (
	element: Element,
	name: string,
	allowUnsafe: boolean = false,
): SingleMatchHandlers<string | boolean> => ({
	ok: (value: string | boolean) => {
		if (typeof value === 'boolean') {
			element.toggleAttribute(name, value)
		} else if (allowUnsafe) {
			element.setAttribute(name, value)
		} else {
			safeSetAttribute(element, name, value)
		}
	},
	nil: () => {
		element.removeAttribute(name)
	},
})

/**
 * Returns `SingleMatchHandlers<string>` that set or remove an inline style property.
 *
 * - `ok(string)` → schedules `el.style.setProperty(prop, value)`
 * - `nil` → schedules `el.style.removeProperty(prop)`, restoring the CSS cascade value
 *
 * @since 2.0
 * @param element - Target element
 * @param prop - CSS property name (e.g. `'color'`, `'--my-var'`)
 * @returns Match handlers for the style mutation
 */
const bindStyle = (
	element: HTMLElement | SVGElement | MathMLElement,
	prop: string,
): SingleMatchHandlers<string> => ({
	ok: (value: string) => {
		element.style.setProperty(prop, value)
	},
	nil: () => {
		element.style.removeProperty(prop)
	},
})

/**
 * Returns `SingleMatchHandlers<string>` that sets the inner HTML of an element,
 * with optional Shadow DOM and script re-execution support.
 *
 * - `ok(html)` → schedules `element.innerHTML = html` (or `shadowRoot.innerHTML`);
 *   if `allowScripts` is true, re-executes `<script>` elements after injection.
 * - `nil` → resets `innerHTML = ''` (or `<slot></slot>` in shadow root).
 *
 * **Security note:** Only use with trusted or sanitized content. Pass `allowScripts: true`
 * only when the content source is trusted upstream.
 *
 * @since 2.0
 * @param element - Target element
 * @param [options] - Shadow DOM mode and script execution options
 * @returns Match handlers that schedule the innerHTML mutation
 */
const dangerouslyBindInnerHTML = (
	element: Element,
	options: DangerouslyBindInnerHTMLOptions = {},
): SingleMatchHandlers<string> => {
	const reset = () => {
		if (element.shadowRoot) element.shadowRoot.innerHTML = '<slot></slot>'
		else element.innerHTML = ''
	}
	return {
		ok: (html: string) => {
			if (!html) {
				reset()
				return
			}
			const { shadowRootMode, allowScripts } = options
			if (shadowRootMode && !element.shadowRoot)
				element.attachShadow({ mode: shadowRootMode })
			const target = element.shadowRoot || element
			schedule(element, () => {
				target.innerHTML = html
				if (allowScripts) {
					target.querySelectorAll('script').forEach(script => {
						const newScript = document.createElement('script')
						for (const attr of SCRIPT_ATTRS) {
							const attrValue = script.getAttribute(attr)
							if (attrValue !== null) newScript.setAttribute(attr, attrValue)
						}
						if (!script.hasAttribute('src'))
							newScript.appendChild(
								document.createTextNode(script.textContent ?? ''),
							)
						target.appendChild(newScript)
						script.remove()
					})
				}
			})
		},
		nil: reset,
	}
}

export {
	bindAttribute,
	bindClass,
	bindProperty,
	bindStyle,
	bindText,
	bindVisible,
	type DangerouslyBindInnerHTMLOptions,
	dangerouslyBindInnerHTML,
}
