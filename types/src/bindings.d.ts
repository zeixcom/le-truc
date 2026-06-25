import type { SingleMatchHandlers } from '@zeix/cause-effect';
/**
 * Structural shape of the DOM's `TrustedHTML` type (Trusted Types API).
 * Declared locally because `lib.dom.d.ts` does not yet ship this type in every
 * environment — structural typing means the real DOM `TrustedHTML` (e.g. from
 * `window.trustedTypes.createPolicy(...).createHTML(...)`, or a sanitizer
 * configured with `RETURN_TRUSTED_HTML: true`) satisfies it.
 */
type TrustedHTML = {
    toJSON(): string;
};
type DangerouslyBindInnerHTMLOptions = {
    shadowRootMode?: ShadowRootMode;
    allowScripts?: boolean;
    /**
     * Optional sanitizer applied to the HTML string before it is assigned to
     * `innerHTML`. Use this to plug in an external sanitizer (e.g. DOMPurify)
     * when the content is not fully trusted. Le Truc ships no built-in sanitizer.
     *
     * May return a plain `string` or a `TrustedHTML` instance. Returning
     * `TrustedHTML` is required for the assignment to succeed on a page that
     * enforces `Content-Security-Policy: require-trusted-types-for 'script'` —
     * the DOM rejects a plain string there, no matter how thoroughly it was
     * sanitized. DOMPurify configured with `RETURN_TRUSTED_HTML: true` is the
     * canonical way to produce one. Without a hook that returns `TrustedHTML`,
     * the assignment throws on such a page; that is the browser's own
     * enforcement working as intended — the consumer opted into this sink
     * without producing a trusted value.
     *
     * Note: sanitizing is the *only* reliable defense against XSS here. Setting
     * `innerHTML` fires event-handler attributes on non-`<script>` elements
     * (e.g. `<img onerror>`, `<svg onload>`) even when `allowScripts` is false.
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
 * with optional Shadow DOM, sanitization, and script re-execution support.
 *
 * - `ok(html)` → schedules `element.innerHTML = html` (or `shadowRoot.innerHTML`);
 *   if `sanitize` is provided, it is applied first. If `allowScripts` is true,
 *   `<script>` elements are re-executed after injection (inline `<script>` added
 *   via `innerHTML` does not run on its own).
 * - `nil` (or an empty/falsy `html`) → schedules a reset via
 *   `element.replaceChildren()` (or `shadowRoot.replaceChildren(document.createElement('slot'))`).
 *   Going through the same per-element `schedule()` dedup as the `ok` write
 *   above means whichever of the two fires last in a frame wins — a reset
 *   can't be clobbered by an earlier-scheduled, now-stale write, nor vice versa.
 *   The DOM-mutation approach (rather than `innerHTML = ''`) deliberately
 *   avoids the `innerHTML` sink: under a Trusted-Types-enforcing CSP, *any*
 *   string assignment to `innerHTML` throws — even `''` — so reset is
 *   unaffected by enforcement and needs no `sanitize` hook.
 *
 * **Security — read carefully.** Assigning `innerHTML` is an XSS sink. It does
 * NOT execute inline `<script>`, but it DOES fire event-handler attributes on
 * other elements (e.g. `<img src=x onerror=…>`, `<svg onload=…>`, `<iframe srcdoc>`).
 * Therefore:
 * - `allowScripts: false` (the default) does **not** make untrusted HTML safe.
 *   It only suppresses the explicit `<script>` re-execution step.
 * - All content passed here must be fully trusted or sanitized upstream. Pass a
 *   `sanitize` function (e.g. DOMPurify's `sanitize`) to apply that sanitation
 *   at the sink. Le Truc ships no built-in sanitizer.
 *
 * **Trusted Types.** On a page that enforces
 * `Content-Security-Policy: require-trusted-types-for 'script'`, the
 * `innerHTML` assignment throws unless `html` is a `TrustedHTML` instance — a
 * `sanitize` hook that returns a plain `string` does not satisfy this, no
 * matter how thorough the sanitization. Return `TrustedHTML` from `sanitize`
 * (e.g. DOMPurify with `RETURN_TRUSTED_HTML: true`) to support such pages.
 *
 * @since 2.0
 * @param element - Target element
 * @param [options] - Shadow DOM mode, sanitizer, and script execution options
 * @returns Match handlers that schedule the innerHTML mutation
 */
declare const dangerouslyBindInnerHTML: (element: Element, options?: DangerouslyBindInnerHTMLOptions) => SingleMatchHandlers<string>;
export { bindAttribute, bindClass, bindProperty, bindStyle, bindText, bindVisible, type DangerouslyBindInnerHTMLOptions, dangerouslyBindInnerHTML, escapeHTML, safeSetAttribute, setTextPreservingComments, type TrustedHTML, };
