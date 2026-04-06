import type { WatchHandlers } from './factory';
/**
 * Returns a function that sets the text content of an element.
 *
 * When `preserveComments` is `true`, uses `setTextPreservingComments` to retain
 * HTML comment nodes. When `false` (default), sets `el.textContent` directly.
 * Numbers are coerced to strings via `String()`.
 *
 * @since 1.1
 * @param {Element} element - Target element
 * @param {boolean} [preserveComments=false] - Whether to preserve HTML comment nodes
 * @returns {(value: string | number) => void} Function that sets the text content
 */
declare const bindText: (element: Element, preserveComments?: boolean) => ((value: string | number) => void);
/**
 * Returns a function that sets a DOM property directly on an element.
 *
 * TypeScript infers `E[K]` from the element type and key, so no explicit type
 * parameters are needed at call sites.
 *
 * @since 1.1
 * @param {E} element - Target element
 * @param {K} key - Property key to set
 * @returns {(value: E[K]) => void} Function that sets the property
 */
declare const bindProperty: <E extends Element, K extends keyof E & string>(element: E, key: K) => ((value: E[K]) => void);
/**
 * Returns a function that toggles a CSS class token on an element.
 *
 * `value=true` adds the token; `value=false` removes it.
 *
 * @since 1.1
 * @param {Element} element - Target element
 * @param {string} token - CSS class token to toggle
 * @returns {(value: boolean) => void} Function that toggles the class
 */
declare const bindClass: (element: Element, token: string) => ((value: boolean) => void);
/**
 * Returns a function that controls element visibility via `el.hidden = !value`.
 *
 * `value=true` makes the element visible; `value=false` hides it.
 * Matches the direction of the v1.0 `show()` effect.
 *
 * @since 1.1
 * @param {HTMLElement} element - Target element
 * @returns {(value: boolean) => void} Function that sets element visibility
 */
declare const bindVisible: (element: HTMLElement) => ((value: boolean) => void);
/**
 * Returns `RunHandlers` that set or toggle an attribute with security validation.
 *
 * - `ok(string)` → `safeSetAttribute(el, name, value)` (or `el.setAttribute` if `allowUnsafe`)
 * - `ok(boolean)` → `el.toggleAttribute(name, value)` — adds (without value) when `true`, removes when `false`
 * - `nil` → `el.removeAttribute(name)`
 *
 * Pass `allowUnsafe: true` only when the value has been validated upstream.
 *
 * @since 1.1
 * @param {Element} element - Target element
 * @param {string} name - Attribute name
 * @param {boolean} [allowUnsafe=false] - Skip security validation for string values
 * @returns {RunHandlers<string | boolean>} Watch handlers for the attribute
 */
declare const bindAttribute: (element: Element, name: string, allowUnsafe?: boolean) => WatchHandlers<string | boolean>;
/**
 * Returns `RunHandlers` that set or remove an inline style property.
 *
 * - `ok(string)` → `el.style.setProperty(prop, value)`
 * - `nil` → `el.style.removeProperty(prop)`, restoring the CSS cascade value
 *
 * @since 1.1
 * @param {HTMLElement | SVGElement | MathMLElement} element - Target element
 * @param {string} prop - CSS property name (e.g. `'color'`, `'--my-var'`)
 * @returns {RunHandlers<string>} Watch handlers for the style property
 */
declare const bindStyle: (element: HTMLElement | SVGElement | MathMLElement, prop: string) => WatchHandlers<string>;
export { bindAttribute, bindClass, bindProperty, bindStyle, bindText, bindVisible, };
