import type { WatchHandlers } from './effects'
import { safeSetAttribute, setTextPreservingComments } from './safety'
import { schedule } from './scheduler'

/* === Exported Functions === */

/**
 * Returns a function that sets the text content of an element.
 *
 * When `preserveComments` is `true`, uses `setTextPreservingComments` to retain
 * HTML comment nodes. When `false` (default), sets `el.textContent` directly.
 * Numbers are coerced to strings via `String()`.
 *
 * @since 2.0
 * @param {Element} element - Target element
 * @param {boolean} [preserveComments=false] - Whether to preserve HTML comment nodes
 * @returns {(value: string | number) => void} Function that sets the text content
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
 * TypeScript infers `E[K]` from the element type and key, so no explicit type
 * parameters are needed at call sites.
 *
 * @since 2.0
 * @param {E} element - Target element
 * @param {K} key - Property key to set
 * @returns {(value: E[K]) => void} Function that sets the property
 */
const bindProperty =
	<E extends Element, K extends keyof E & string>(
		element: E,
		key: K,
	): ((value: E[K]) => void) =>
	(value: E[K]) => {
		element[key] = value
	}

/**
 * Returns a function that toggles a CSS class token on an element.
 *
 * `value=true` adds the token; `value=false` removes it.
 * If `transform` is provided, it converts the incoming value to a boolean first.
 *
 * @since 2.0
 * @param {Element} element - Target element
 * @param {string} token - CSS class token to toggle
 * @param {(value: T) => boolean} [transform] - Optional function to derive a boolean from the value
 * @returns {(value: T) => void} Function that toggles the class
 */
const bindClass =
	<T = boolean>(
		element: Element,
		token: string,
		transform?: (value: T) => boolean,
	): ((value: T) => void) =>
	(value: T) => {
		element.classList.toggle(
			token,
			transform ? transform(value) : Boolean(value),
		)
	}

/**
 * Returns a function that controls element visibility via `el.hidden = !value`.
 *
 * `value=true` makes the element visible; `value=false` hides it.
 * Matches the direction of the v1.0 `show()` effect.
 * If `transform` is provided, it converts the incoming value to a boolean first.
 *
 * @since 2.0
 * @param {HTMLElement} element - Target element
 * @param {(value: T) => boolean} [transform] - Optional function to derive a boolean from the value
 * @returns {(value: T) => void} Function that sets element visibility
 */
const bindVisible =
	<T = boolean>(
		element: HTMLElement,
		transform?: (value: T) => boolean,
	): ((value: T) => void) =>
	(value: T) => {
		element.hidden = !(transform ? transform(value) : Boolean(value))
	}

/**
 * Returns `RunHandlers` that set or toggle an attribute with security validation.
 *
 * - `ok(string)` → `safeSetAttribute(el, name, value)` (or `el.setAttribute` if `allowUnsafe`)
 * - `ok(boolean)` → `el.toggleAttribute(name, value)` — adds (without value) when `true`, removes when `false`
 * - `nil` → `el.removeAttribute(name)`
 *
 * Pass `allowUnsafe: true` only when the value has been validated upstream.
 *
 * @since 2.0
 * @param {Element} element - Target element
 * @param {string} name - Attribute name
 * @param {boolean} [allowUnsafe=false] - Skip security validation for string values
 * @returns {WatchHandlers<string | boolean>} Watch handlers for the attribute
 */
const bindAttribute = (
	element: Element,
	name: string,
	allowUnsafe: boolean = false,
): WatchHandlers<string | boolean> => ({
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
 * Returns `RunHandlers` that set or remove an inline style property.
 *
 * - `ok(string)` → `el.style.setProperty(prop, value)`
 * - `nil` → `el.style.removeProperty(prop)`, restoring the CSS cascade value
 *
 * @since 2.0
 * @param {HTMLElement | SVGElement | MathMLElement} element - Target element
 * @param {string} prop - CSS property name (e.g. `'color'`, `'--my-var'`)
 * @returns {WatchHandlers<string>} Watch handlers for the style property
 */
const bindStyle = (
	element: HTMLElement | SVGElement | MathMLElement,
	prop: string,
): WatchHandlers<string> => ({
	ok: (value: string) => {
		element.style.setProperty(prop, value)
	},
	nil: () => {
		element.style.removeProperty(prop)
	},
})

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

/* === Exported Types === */

type DangerouslySetInnerHTMLOptions = {
	shadowRootMode?: ShadowRootMode
	allowScripts?: boolean
}

/* === More Exported Functions === */

/**
 * Returns `WatchHandlers<string>` that sets the inner HTML of an element,
 * with optional Shadow DOM and script re-execution support.
 *
 * - `ok(html)` → schedules `element.innerHTML = html` (or `shadowRoot.innerHTML`);
 *   if `allowScripts` is true, re-executes `<script>` elements after injection.
 * - `nil` → sets `innerHTML = ''` (or restores `<slot></slot>` in shadow root).
 *
 * **Security note:** Setting innerHTML bypasses XSS protections. Only use with
 * trusted or sanitized content. Pass `allowScripts: true` only when the content
 * source is trusted upstream.
 *
 * @since 2.0
 * @param {Element} element - Target element
 * @param {DangerouslySetInnerHTMLOptions} [options] - Shadow DOM mode and script execution options
 * @returns {WatchHandlers<string>} Watch handlers that set the element's inner HTML
 */
const dangerouslySetInnerHTML = (
	element: Element,
	options: DangerouslySetInnerHTMLOptions = {},
): WatchHandlers<string> => ({
	ok: (html: string) => {
		const { shadowRootMode, allowScripts } = options
		if (!html) {
			if (element.shadowRoot) element.shadowRoot.innerHTML = '<slot></slot>'
			else element.innerHTML = ''
			return
		}
		if (shadowRootMode && !element.shadowRoot)
			element.attachShadow({ mode: shadowRootMode })
		const target = element.shadowRoot || element
		schedule(element, () => {
			target.innerHTML = html
			if (allowScripts) {
				target.querySelectorAll('script').forEach(script => {
					const newScript = document.createElement('script')
					for (const attr of SCRIPT_ATTRS) {
						if (script.hasAttribute(attr))
							newScript.setAttribute(attr, script.getAttribute(attr)!)
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
	nil: () => {
		if (element.shadowRoot) element.shadowRoot.innerHTML = '<slot></slot>'
		else element.innerHTML = ''
	},
})

export {
	bindAttribute,
	bindClass,
	bindProperty,
	bindStyle,
	bindText,
	bindVisible,
	type DangerouslySetInnerHTMLOptions,
	dangerouslySetInnerHTML,
}
