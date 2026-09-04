import { type SingleMatchHandlers } from '@zeix/cause-effect';
/**
 * Low-level DOM-mutation primitives behind the `bind*` helpers. Each
 * `bind*` function returns a setter (or `SingleMatchHandlers`) that a
 * caller wires to a signal via `watch()` or `match()`.
 *
 * `dangerouslyBindInnerHTML()` is an XSS sink. Pass a `sanitize` option
 * (e.g. DOMPurify) for untrusted input, or register a module-level default
 * with `configureHtmlSanitizer()`. Le Truc ships no sanitizer.
 */
/**
 * Placeholder for the DOM's `TrustedHTML` type (Trusted Types API).
 * `lib.dom.d.ts` does not ship this type yet. See ADR-0010.
 */
type TrustedHTML = object;
/** A sanitizer function: raw HTML in, a safe `string` or `TrustedHTML` out. */
type Sanitizer = (html: string) => string | TrustedHTML;
type DangerouslyBindInnerHTMLOptions = {
    shadowRootMode?: ShadowRootMode;
    allowScripts?: boolean;
    /**
     * Sanitizer applied to the HTML string before assignment to `innerHTML`.
     * Return a `TrustedHTML` instance on pages that enforce Trusted Types.
     * Omit to fall back to the module-level default set by
     * `configureHtmlSanitizer()`, if any.
     */
    sanitize?: Sanitizer;
};
/**
 * Configure the module-level default sanitizer that `dangerouslyBindInnerHTML()`
 * falls back to when a call site omits its own `sanitize` option. Purely
 * opt-in — call once, e.g. at app startup; every `dangerouslyBindInnerHTML()`
 * call site keeps working exactly as before unless it left `sanitize` unset.
 * A call site's own `sanitize` option still takes precedence.
 *
 * Le Truc ships no sanitizer implementation of its own (ADR-0010) — this
 * only registers a hook. DOMPurify is the recommended choice; configure it
 * with `RETURN_TRUSTED_TYPE: true` for Trusted-Types-enforcing pages (see the
 * Trusted Types note on `dangerouslyBindInnerHTML` below).
 *
 * @since 2.6
 * @param sanitize - Default sanitizer, or `undefined` to clear it
 */
declare const configureHtmlSanitizer: (sanitize: Sanitizer | undefined) => void;
/**
 * Values `bindAria()`'s `ok()` handler accepts. See ADR 0026 §2 for the
 * mapping table and for why `null | undefined` are excluded from the type
 * but still guarded at runtime.
 */
type AriaValue = boolean | number | string | Element | readonly Element[];
/**
 * Look up the element a `bind*`-produced closure was registered against.
 * Returns `undefined` for a handler not produced by a `bind*` helper. See
 * ADR 0022.
 */
declare const getDebugBindingTarget: (handler: object) => Element | undefined;
/**
 * Set an attribute on an element with security validation.
 *
 * Blocks `on*` event handler attribute names and rejects unsafe URL values.
 *
 * @since 2.0
 * @param element - Target element
 * @param attr - Attribute name to set
 * @param value - Attribute value to set
 * @throws {UnsafeAttributeError} If the attribute name or value is unsafe
 */
declare const safeSetAttribute: (element: Element, attr: string, value: string) => void;
/**
 * Escape HTML entities in text.
 *
 * Escapes `&`, `<`, `>`, `"`, and `'`.
 *
 * @since 2.0
 * @param text - Plain text to escape
 * @returns HTML-safe string
 */
declare const escapeHTML: (text: string) => string;
/**
 * Set the text content of an element while preserving comment nodes.
 *
 * @since 2.0
 * @param element - Target element
 * @param text - Text content to set
 */
declare const setTextPreservingComments: (element: Element, text: string) => void;
/**
 * Returns a function that sets the text content of an element.
 *
 * With `preserveComments`, HTML comment nodes are kept.
 *
 * @since 2.0
 * @param element - Target element
 * @param [preserveComments=false] - Keep HTML comment nodes
 * @returns Function that sets the text content
 */
declare const bindText: (element: Element, preserveComments?: boolean) => ((value: string | number) => void);
/**
 * Returns a function that sets a DOM property directly on an element.
 *
 * @since 2.0
 * @param object - Target object
 * @param key - Property key to set
 * @returns Function that sets a property
 */
declare function bindProperty<O extends object, K extends keyof O & string>(object: O, key: K): (value: O[K]) => void;
/**
 * Returns a function that patches several DOM properties from one map.
 *
 * A key absent from the value is left untouched, not cleared.
 *
 * @since 2.6
 * @param object - Target object
 * @param keys - Property keys the returned setter may patch
 * @returns Function that patches the given properties from a partial map
 */
declare function bindProperty<O extends object, K extends keyof O & string>(object: O, keys: readonly K[]): (value: Partial<Pick<O, K>>) => void;
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
declare function bindClass<T = boolean>(element: Element, token: string): (value: T) => void;
/**
 * Returns a function that toggles several CSS class tokens on an element
 * from one map.
 *
 * `tokens` is the complete set of tokens this binding owns. A token absent
 * from the map is treated as `false` (off).
 *
 * @since 2.6
 * @param element - Target element
 * @param tokens - CSS class tokens the returned setter may toggle
 * @returns Function that toggles the given class tokens from a partial map
 */
declare function bindClass<Tk extends string>(element: Element, tokens: readonly Tk[]): (value: Partial<Record<Tk, boolean>>) => void;
/**
 * Returns a function that toggles a custom state on an element's `ElementInternals`.
 *
 * Consumers match the state in CSS with the `:state(token)` pseudo-class.
 * Unlike a class token, a custom state cannot be overwritten by author code
 * or frameworks rewriting the host's `class` attribute.
 *
 * If `internals` is `null` (`attachInternals()` failed) or has no usable
 * `states`, the returned function is a no-op. Custom states have no
 * attribute channel to fall back to.
 *
 * @since 2.3
 * @param internals - The component's `ElementInternals` (or `null`)
 * @param token - Custom state token to toggle (matched via `:state(token)`)
 * @returns Function that toggles the custom state
 */
declare function bindState<T = boolean>(internals: ElementInternals | null, token: string): (value: T) => void;
/**
 * Returns a function that toggles several custom states on an element's
 * `ElementInternals` from one map.
 *
 * `tokens` is the complete set of states this binding owns. A token absent
 * from the map is treated as `false` (off). Degrades the same way as the
 * single-token form when `internals` is `null` or has no usable `states`.
 *
 * @since 2.6
 * @param internals - The component's `ElementInternals` (or `null`)
 * @param tokens - Custom state tokens the returned setter may toggle
 * @returns Function that toggles the given custom states from a partial map
 */
declare function bindState<Tk extends string>(internals: ElementInternals | null, tokens: readonly Tk[]): (value: Partial<Record<Tk, boolean>>) => void;
/**
 * Returns a function that controls element visibility via `el.hidden = !value`.
 *
 * @since 2.0
 * @param element - Target element
 * @returns Function that schedules the visibility update
 */
declare const bindVisible: <T = boolean>(element: HTMLElement) => ((value: T) => void);
/**
 * Returns `SingleMatchHandlers` that set or toggle an attribute with security validation.
 *
 * - `ok(string)` → sets the attribute (validated, unless `allowUnsafe`)
 * - `ok(boolean)` → toggles the attribute
 * - `nil` → removes the attribute
 *
 * Pass `allowUnsafe: true` only when the value has been validated upstream.
 *
 * @since 2.0
 * @param element - Target element
 * @param name - Attribute name
 * @param [allowUnsafe=false] - Skip security validation for string values
 * @returns Match handlers for the attribute mutation
 */
declare function bindAttribute(element: Element, name: string, allowUnsafe?: boolean): SingleMatchHandlers<string | boolean>;
/**
 * Returns `SingleMatchHandlers` that set, toggle, or remove several
 * attributes with security validation, from one map.
 *
 * `names` is the complete set of attributes this binding owns.
 *
 * - `ok(map)` — for each declared name: string value → sets it (validated
 *   unless `allowUnsafe`); boolean → toggles it; absent or nullish → removes it.
 * - `nil` → removes every declared attribute.
 *
 * @since 2.6
 * @param element - Target element
 * @param names - Attribute names the returned handlers may set/toggle/remove
 * @param [allowUnsafe=false] - Skip security validation for string values
 * @returns Match handlers for the attribute mutations
 */
declare function bindAttribute<N extends string>(element: Element, names: readonly N[], allowUnsafe?: boolean): SingleMatchHandlers<Partial<Record<N, string | boolean>>>;
/**
 * Returns `SingleMatchHandlers` that reflect a value onto an `ARIAMixin`
 * target (an `Element` or an `ElementInternals`) via the platform's ARIA
 * reflection properties.
 *
 * - `ok(boolean)` → assigns `'true'` / `'false'`
 * - `ok(number)` → assigns the decimal string
 * - `ok(string | Element | readonly Element[])` → pass-through
 * - `ok(null | undefined)` or `nil` → assigns `null`, clearing the reflection
 *
 * For an `ElementInternals` target, a pre-existing host content attribute
 * for the same property is removed once, on that property's first
 * value-bearing `ok()` — see the stale-attribute rule in ADR 0026 §1.
 *
 * The target's capabilities are probed once, at bind time (ADR 0026 §2,
 * *Capability fallback*). An `ElementInternals` whose reflection does not
 * reach the platform binds the host's **content attribute** with the same
 * coercion, and never removes a stale attribute — there the attribute is
 * the live channel. The eight element-reference properties have no
 * attribute form and stay no-ops on that path. A nullish target makes
 * every handler a no-op.
 *
 * @since 2.6
 * @param target - `ARIAMixin` target (`Element` or `ElementInternals`), or `null`/`undefined`
 * @param name - Platform `ARIAMixin` property name (e.g. `'ariaExpanded'`, `'ariaValueNow'`, `'role'`)
 * @returns Match handlers for the ARIA reflection
 */
declare function bindAria(target: ARIAMixin | null | undefined, name: keyof ARIAMixin & string): SingleMatchHandlers<AriaValue>;
/**
 * Returns `SingleMatchHandlers` that reflect several ARIA properties onto an
 * `ARIAMixin` target from one map.
 *
 * `names` is the complete set of properties this binding owns.
 *
 * - `ok(map)` — for each declared name: present and non-nullish → assign
 *   per the single-form coercion; absent or nullish → assign `null`.
 * - `nil` → assigns `null` to every declared name.
 *
 * The stale-attribute rule (see the single form) applies per property.
 *
 * @since 2.6
 * @param target - `ARIAMixin` target (`Element` or `ElementInternals`), or `null`/`undefined`
 * @param names - `ARIAMixin` property names the returned handlers may reflect (e.g. `['ariaValueNow', 'ariaValueText']`)
 * @returns Match handlers for the ARIA reflections
 */
declare function bindAria<N extends keyof ARIAMixin & string>(target: ARIAMixin | null | undefined, names: readonly N[]): SingleMatchHandlers<Partial<Record<N, AriaValue>>>;
/**
 * Returns `SingleMatchHandlers<string>` that set or remove an inline style property.
 *
 * - `ok(string)` → sets the property
 * - `nil` → removes the property, restoring the CSS cascade value
 *
 * @since 2.0
 * @param element - Target element
 * @param prop - CSS property name (e.g. `'color'`, `'--my-var'`)
 * @returns Match handlers for the style mutation
 */
declare function bindStyle(element: HTMLElement | SVGElement | MathMLElement, prop: string): SingleMatchHandlers<string>;
/**
 * Returns `SingleMatchHandlers` that set or remove several inline style
 * properties from one map.
 *
 * `props` is the complete set of properties this binding owns.
 *
 * - `ok(map)` — for each declared property: present and non-nil → sets it;
 *   absent or nullish → removes it.
 * - `nil` → removes every declared property.
 *
 * @since 2.6
 * @param element - Target element
 * @param props - CSS property names the returned handlers may set/remove
 * @returns Match handlers for the style mutations
 */
declare function bindStyle<P extends string>(element: HTMLElement | SVGElement | MathMLElement, props: readonly P[]): SingleMatchHandlers<Partial<Record<P, string | null>>>;
/**
 * Returns `SingleMatchHandlers<string>` that set the inner HTML of an element,
 * with optional Shadow DOM, sanitization, and script re-execution support.
 *
 * - `ok(html)` → sets `innerHTML` (sanitized first, by `sanitize` or the
 *   module-level default from `configureHtmlSanitizer()`). With
 *   `allowScripts`, `<script>` elements are re-executed after injection.
 * - `nil` (or an empty/falsy `html`) → resets via `replaceChildren()`, not
 *   `innerHTML = ''`, which a Trusted-Types CSP would reject.
 *
 * **Security.** `allowScripts: false` (the default) does not make untrusted
 * HTML safe: `innerHTML` still fires event-handler attributes on other
 * elements (e.g. `<img src=x onerror=…>`). Pass a `sanitize` function for
 * any content that is not fully trusted.
 *
 * **Trusted Types.** Under a `require-trusted-types-for 'script'` CSP, the
 * `innerHTML` assignment throws unless `html` is a `TrustedHTML` instance —
 * return one from `sanitize` (e.g. DOMPurify with `RETURN_TRUSTED_TYPE: true`).
 *
 * @since 2.0
 * @param element - Target element
 * @param [options] - Shadow DOM mode, sanitizer, and script execution options
 * @returns Match handlers that schedule the innerHTML mutation
 */
declare const dangerouslyBindInnerHTML: (element: Element, options?: DangerouslyBindInnerHTMLOptions) => SingleMatchHandlers<string>;
export { type AriaValue, bindAria, bindAttribute, bindClass, bindProperty, bindState, bindStyle, bindText, bindVisible, configureHtmlSanitizer, type DangerouslyBindInnerHTMLOptions, dangerouslyBindInnerHTML, escapeHTML, getDebugBindingTarget, type Sanitizer, safeSetAttribute, setTextPreservingComments, };
