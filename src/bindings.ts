import type { SingleMatchHandlers } from '@zeix/cause-effect'
import { schedule } from './scheduler'

/* === Types === */

/**
 * Placeholder for the DOM's `TrustedHTML` type (Trusted Types API). Declared
 * locally because `lib.dom.d.ts` does not yet ship this type. Deliberately
 * just `object`, not a structural mirror: the real type is a nominal class
 * with only private members, so a shaped mirror would reject genuine
 * `TrustedHTML` values from DOMPurify or a native `trustedTypes` policy.
 * Exists only to satisfy the `innerHTML` cast below. See ADR-0010.
 */
type TrustedHTML = object

type DangerouslyBindInnerHTMLOptions = {
	shadowRootMode?: ShadowRootMode
	allowScripts?: boolean
	/**
	 * Optional sanitizer applied to the HTML string before it is assigned to
	 * `innerHTML`. Plug in an external sanitizer (e.g. DOMPurify) when the
	 * content is not fully trusted. Le Truc ships no built-in sanitizer.
	 *
	 * May return a plain `string` or a `TrustedHTML` instance. On a page
	 * that enforces `Content-Security-Policy: require-trusted-types-for
	 * 'script'`, the DOM rejects a plain string, so return `TrustedHTML`
	 * there (DOMPurify with `RETURN_TRUSTED_TYPE: true` is the canonical way).
	 *
	 * Sanitizing is the only reliable defense against XSS here: `innerHTML`
	 * fires event-handler attributes on non-`<script>` elements (e.g.
	 * `<img onerror>`, `<svg onload>`) even when `allowScripts` is false.
	 */
	sanitize?: (html: string) => string | TrustedHTML
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
	'nonce',
	'referrerpolicy',
	'fetchpriority',
]

/* === Internal Functions === */

/**
 * Check whether a URL string is safe to use as an attribute value.
 *
 * Rejects `javascript:`, `data:`, and `vbscript:` schemes (including variants
 * masked by C0 control characters or whitespace, such as `\x01javascript:` or
 * `java\tscript:`, which browsers strip/canonicalize before parsing the scheme).
 * Rejects protocol-relative URLs (`//host`) and backslash
 * variants (`\\host`), which resolve against the page origin. Allows relative
 * paths, fragments, query strings, `mailto:`, `tel:`, and absolute URLs with
 * `http:`, `https:`, or `ftp:` protocols.
 *
 * @param {string} value - URL string to validate
 * @returns {boolean} `true` if the URL is considered safe, `false` otherwise
 */
const isSafeURL = (value: string): boolean => {
	// Strip the full C0 control + ASCII space range (U+0000–U+0020). Browsers
	// strip leading controls before parsing schemes; internal tab/newline/CR are
	// also ignored — without this, "\x01javascript:" or "java\tscript:" slip past
	// the `^javascript:` check below and execute on activation.
	// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping C0 controls is the point, not a typo
	const stripped = String(value).replace(/[\x00-\x20]/g, '')
	if (/^(javascript|data|vbscript):/i.test(stripped)) return false
	if (/^(mailto|tel):/i.test(stripped)) return true
	// Protocol-relative (//host) and backslash-prefixed (\\host) URLs resolve
	// against the page origin and can route to an attacker-controlled host.
	if (/^[\\/][\\/]/.test(stripped)) return false
	if (stripped.includes('://')) {
		try {
			const url = new URL(stripped)
			return ['http:', 'https:', 'ftp:'].includes(url.protocol)
		} catch {
			return false
		}
	}
	return true
}

/* === Exported Functions === */

/**
 * Set an attribute on an element with security validation.
 *
 * Blocks `on*` event handler attributes and validates URL-like values against
 * a safe-protocol allowlist (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`).
 * Violations throw a descriptive error — they are never silent.
 *
 * @since 2.0
 * @param {Element} element - Target element
 * @param {string} attr - Attribute name to set
 * @param {string} value - Attribute value to set
 */
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

/**
 * Escape HTML entities to prevent XSS when inserting user-supplied text as HTML.
 *
 * Escapes `&`, `<`, `>`, `"`, and `'`.
 *
 * @since 2.0
 * @param {string} text - Plain text to escape
 * @returns {string} HTML-safe string
 */
const escapeHTML = (text: string): string =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')

/**
 * Set the text content of an element while preserving comment nodes.
 *
 * Removes all child nodes except comments, then appends a new text node.
 * Useful when HTML comments are used as markers or server-rendered annotations.
 *
 * @since 2.0
 * @param {Element} element - Target element
 * @param {string} text - Text content to set
 */
const setTextPreservingComments = (element: Element, text: string): void => {
	Array.from(element.childNodes)
		.filter(node => node.nodeType !== Node.COMMENT_NODE)
		.forEach(node => {
			node.remove()
		})
	element.append(document.createTextNode(text))
}

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
 * Returns a function that toggles a custom state on an element's `ElementInternals`.
 *
 * `value=true` adds the state; `value=false` removes it. Consumers match it in
 * CSS with the `:state(token)` pseudo-class. Unlike a class token, a custom
 * state is owned by the component — it cannot be clobbered by author code or
 * frameworks rewriting the host's `class` attribute.
 *
 * Accepts `null` for graceful degradation: the factory context's `internals`
 * is `null` when `attachInternals()` failed, in which case the returned
 * function is a no-op.
 *
 * @since 2.3
 * @param internals - The component's `ElementInternals` (or `null`)
 * @param token - Custom state token to toggle (matched via `:state(token)`)
 * @returns Function that toggles the custom state
 */
const bindState =
	<T = boolean>(
		internals: ElementInternals | null,
		token: string,
	): ((value: T) => void) =>
	(value: T) => {
		if (!internals) return
		if (value) internals.states.add(token)
		else internals.states.delete(token)
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
 * with optional Shadow DOM, sanitization, and script re-execution support.
 *
 * - `ok(html)` → schedules `element.innerHTML = html` (or `shadowRoot.innerHTML`);
 *   if `sanitize` is provided, it is applied first. If `allowScripts` is true,
 *   `<script>` elements are re-executed after injection (inline `<script>` added
 *   via `innerHTML` does not run on its own).
 * - `nil` (or an empty/falsy `html`) → schedules a reset via
 *   `element.replaceChildren()` (or `shadowRoot.replaceChildren(document.createElement('slot'))`).
 *   This goes through the same per-element `schedule()` dedup as the `ok`
 *   write, so whichever fires last in a frame wins. It resets via DOM
 *   mutation rather than `innerHTML = ''` to avoid the `innerHTML` sink
 *   entirely — under a Trusted-Types-enforcing CSP, any string assignment
 *   throws, even `''`.
 *
 * **Security — read carefully.** Assigning `innerHTML` is an XSS sink. It does
 * NOT execute inline `<script>`, but it DOES fire event-handler attributes on
 * other elements (e.g. `<img src=x onerror=…>`, `<svg onload=…>`, `<iframe srcdoc>`).
 * `allowScripts: false` (the default) does not make untrusted HTML safe — it
 * only suppresses the explicit `<script>` re-execution step. All content
 * passed here must be fully trusted or sanitized upstream; pass a `sanitize`
 * function (e.g. DOMPurify's `sanitize`) to sanitize at the sink. Le Truc
 * ships no built-in sanitizer.
 *
 * **Trusted Types.** On a page that enforces
 * `Content-Security-Policy: require-trusted-types-for 'script'`, the
 * `innerHTML` assignment throws unless `html` is a `TrustedHTML` instance.
 * Return `TrustedHTML` from `sanitize` (e.g. DOMPurify with
 * `RETURN_TRUSTED_TYPE: true`) to support such pages.
 *
 * @since 2.0
 * @param element - Target element
 * @param [options] - Shadow DOM mode, sanitizer, and script execution options
 * @returns Match handlers that schedule the innerHTML mutation
 */
const dangerouslyBindInnerHTML = (
	element: Element,
	options: DangerouslyBindInnerHTMLOptions = {},
): SingleMatchHandlers<string> => {
	// Resets via DOM mutation rather than `innerHTML` — see Trusted Types note above.
	const reset = () => {
		if (element.shadowRoot)
			element.shadowRoot.replaceChildren(document.createElement('slot'))
		else element.replaceChildren()
	}
	return {
		ok: (rawHtml: string) => {
			if (!rawHtml) {
				schedule(element, reset)
				return
			}
			const { shadowRootMode, allowScripts, sanitize } = options
			if (shadowRootMode && !element.shadowRoot)
				element.attachShadow({ mode: shadowRootMode })
			const target = element.shadowRoot || element
			const html = sanitize ? sanitize(rawHtml) : rawHtml
			schedule(element, () => {
				try {
					// lib.dom.d.ts types `innerHTML` as `string` only; the DOM itself
					// also accepts `TrustedHTML` under a Trusted-Types-enforcing CSP,
					// so the cast reflects the runtime contract, not a type escape.
					;(target as { innerHTML: string | TrustedHTML }).innerHTML = html
				} catch (e) {
					// A Trusted-Types-enforcing CSP throws here when `html` is a plain
					// string — a missing/insufficient `sanitize` hook, not a recoverable
					// condition. Re-throw from a microtask so it surfaces as an uncaught
					// exception without re-entering the scheduler's try/catch, and later
					// same-frame tasks still run (see ADR-0010).
					queueMicrotask(() => {
						throw e
					})
					return
				}
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
		nil: () => schedule(element, reset),
	}
}

export {
	bindAttribute,
	bindClass,
	bindProperty,
	bindState,
	bindStyle,
	bindText,
	bindVisible,
	type DangerouslyBindInnerHTMLOptions,
	dangerouslyBindInnerHTML,
	escapeHTML,
	safeSetAttribute,
	setTextPreservingComments,
}
