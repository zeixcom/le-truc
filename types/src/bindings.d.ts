import type { SingleMatchHandlers } from '@zeix/cause-effect';
type DangerouslyBindInnerHTMLOptions = {
    shadowRootMode?: ShadowRootMode;
    allowScripts?: boolean;
};
/**
 * Set an attribute on an element with security validation.
 *
 * Blocks `on*` event handler attributes and validates URL-like values against
 * a safe-protocol allowlist (`http:`, `https:`, `ftp:`, `mailto:`, `tel:`).
 * Violations throw a descriptive error — they are never silent.
 *
 * @since 1.1
 * @param {Element} element - Target element
 * @param {string} attr - Attribute name to set
 * @param {string} value - Attribute value to set
 */
declare const safeSetAttribute: (element: Element, attr: string, value: string) => void;
/**
 * Escape HTML entities to prevent XSS when inserting user-supplied text as HTML.
 *
 * Escapes `&`, `<`, `>`, `"`, and `'`.
 *
 * @since 1.1
 * @param {string} text - Plain text to escape
 * @returns {string} HTML-safe string
 */
declare const escapeHTML: (text: string) => string;
/**
 * Set the text content of an element while preserving comment nodes.
 *
 * Removes all child nodes except comments, then appends a new text node.
 * Useful when HTML comments are used as markers or server-rendered annotations.
 *
 * @since 1.1
 * @param {Element} element - Target element
 * @param {string} text - Text content to set
 */
declare const setTextPreservingComments: (element: Element, text: string) => void;
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
declare const bindText: (element: Element, preserveComments?: boolean) => ((value: string | number) => void);
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
declare const bindProperty: <O extends object, K extends keyof O & string>(object: O, key: K) => ((value: O[K]) => void);
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
declare const bindClass: <T = boolean>(element: Element, token: string) => ((value: T) => void);
/**
 * Returns a function that controls element visibility via `el.hidden = !value`.
 *
 * `value=true` makes the element visible; `value=false` hides it.
 *
 * @since 2.0
 * @param element - Target element
 * @returns Function that schedules the visibility update
 */
declare const bindVisible: <T = boolean>(element: HTMLElement) => ((value: T) => void);
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
declare const bindAttribute: (element: Element, name: string, allowUnsafe?: boolean) => SingleMatchHandlers<string | boolean>;
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
declare const bindStyle: (element: HTMLElement | SVGElement | MathMLElement, prop: string) => SingleMatchHandlers<string>;
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
declare const dangerouslyBindInnerHTML: (element: Element, options?: DangerouslyBindInnerHTMLOptions) => SingleMatchHandlers<string>;
export { bindAttribute, bindClass, bindProperty, bindStyle, bindText, bindVisible, type DangerouslyBindInnerHTMLOptions, dangerouslyBindInnerHTML, escapeHTML, safeSetAttribute, setTextPreservingComments, };
