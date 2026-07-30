import type { SingleMatchHandlers } from '@zeix/cause-effect';
/**
 * Placeholder for the DOM's `TrustedHTML` type (Trusted Types API). Declared
 * locally because `lib.dom.d.ts` does not yet ship this type. Deliberately
 * just `object`, not a structural mirror: the real type is a nominal class
 * with only private members, so a shaped mirror would reject genuine
 * `TrustedHTML` values from DOMPurify or a native `trustedTypes` policy.
 * Exists only to satisfy the `innerHTML` cast below. See ADR-0010.
 */
type TrustedHTML = object;
type DangerouslyBindInnerHTMLOptions = {
    shadowRootMode?: ShadowRootMode;
    allowScripts?: boolean;
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
    sanitize?: (html: string) => string | TrustedHTML;
};
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
declare const safeSetAttribute: (element: Element, attr: string, value: string) => void;
/**
 * Escape HTML entities to prevent XSS when inserting user-supplied text as HTML.
 *
 * Escapes `&`, `<`, `>`, `"`, and `'`.
 *
 * @since 2.0
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
 * @since 2.0
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
declare const bindState: <T = boolean>(internals: ElementInternals | null, token: string) => ((value: T) => void);
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
declare const dangerouslyBindInnerHTML: (element: Element, options?: DangerouslyBindInnerHTMLOptions) => SingleMatchHandlers<string>;
export { bindAttribute, bindClass, bindProperty, bindState, bindStyle, bindText, bindVisible, type DangerouslyBindInnerHTMLOptions, dangerouslyBindInnerHTML, escapeHTML, safeSetAttribute, setTextPreservingComments, };
