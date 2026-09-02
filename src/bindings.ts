import type { SingleMatchHandlers } from '@zeix/cause-effect'
import { internalsHosts } from './internal'
import { schedule } from './scheduler'

/**
 * Low-level DOM-mutation primitives behind the `bind*` helpers. Each
 * `bind*` function returns a setter (or `SingleMatchHandlers`) that a
 * caller wires to a signal via `watch()` or `match()`.
 *
 * `dangerouslyBindInnerHTML()` is an XSS sink. Pass a `sanitize` option
 * (e.g. DOMPurify) for untrusted input, or register a module-level default
 * with `configureHtmlSanitizer()`. Le Truc ships no sanitizer.
 */

/* === Types === */

/**
 * Placeholder for the DOM's `TrustedHTML` type (Trusted Types API).
 * `lib.dom.d.ts` does not ship this type yet. See ADR-0010.
 */
type TrustedHTML = object

/** A sanitizer function: raw HTML in, a safe `string` or `TrustedHTML` out. */
type Sanitizer = (html: string) => string | TrustedHTML

type DangerouslyBindInnerHTMLOptions = {
	shadowRootMode?: ShadowRootMode
	allowScripts?: boolean
	/**
	 * Sanitizer applied to the HTML string before assignment to `innerHTML`.
	 * Return a `TrustedHTML` instance on pages that enforce Trusted Types.
	 * Omit to fall back to the module-level default set by
	 * `configureHtmlSanitizer()`, if any.
	 */
	sanitize?: Sanitizer
}

/* === Default HTML Sanitizer (ADR 0010 amendment) === */

/**
 * Module-level fallback `sanitize` function for every `dangerouslyBindInnerHTML()`
 * call site that omits its own `options.sanitize` — `undefined` until
 * `configureHtmlSanitizer()` is called. Le Truc still ships no sanitizer of
 * its own: this is a consumer-configured hook, not a library default, and an
 * unconfigured `dangerouslyBindInnerHTML()` call behaves exactly as it always
 * has (raw passthrough).
 */
let defaultSanitize: Sanitizer | undefined

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
const configureHtmlSanitizer = (sanitize: Sanitizer | undefined): void => {
	defaultSanitize = sanitize
}

/**
 * Values `bindAria()`'s `ok()` handler accepts. See ADR 0026 §2 for the
 * mapping table and for why `null | undefined` are excluded from the type
 * but still guarded at runtime.
 */
type AriaValue = boolean | number | string | Element | readonly Element[]

/* === DEV_MODE Debug Attribution (ADR 0022) === */

/**
 * DEV_MODE-only registry mapping a `bind*` helper's returned setter back to
 * the element it closes over. `watch()`'s debug instrumentation uses this
 * to attribute a closure to a DOM element. Empty in production.
 */
const debugBindingTargets = new WeakMap<object, Element>()

/**
 * Register a `bind*` helper's returned closure against the element it
 * closes over. No-op outside `DEV_MODE`.
 */
const registerDebugBindingTarget = (target: object, element: Element): void => {
	if (process.env.DEV_MODE === 'true') debugBindingTargets.set(target, element)
}

/**
 * Look up the element a `bind*`-produced closure was registered against.
 * Returns `undefined` for a handler not produced by a `bind*` helper. See
 * ADR 0022.
 */
const getDebugBindingTarget = (handler: object): Element | undefined =>
	debugBindingTargets.get(handler)

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
 * Rejects `javascript:`, `data:`, and `vbscript:` schemes, and
 * protocol-relative or backslash-prefixed URLs. Allows relative paths,
 * fragments, query strings, `mailto:`, `tel:`, and absolute `http:`,
 * `https:`, or `ftp:` URLs.
 *
 * @param value - URL string to validate
 * @returns `true` if the URL is safe
 */
const isSafeURL = (value: string): boolean => {
	// Strip C0 controls/whitespace first: browsers ignore them before parsing
	// the scheme, so "\x01javascript:" would otherwise slip past the check below.
	// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping C0 controls is the point, not a typo
	const stripped = String(value).replace(/[\x00-\x20]/g, '')
	if (/^(javascript|data|vbscript):/i.test(stripped)) return false
	if (/^(mailto|tel):/i.test(stripped)) return true
	// Protocol-relative and backslash-prefixed URLs resolve against the page
	// origin and can route to an attacker-controlled host.
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
 * Blocks `on*` event handler attribute names and rejects unsafe URL values.
 *
 * @since 2.0
 * @param element - Target element
 * @param attr - Attribute name to set
 * @param value - Attribute value to set
 * @throws {Error} If the attribute name or value is unsafe
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
 * Escape HTML entities in text.
 *
 * Escapes `&`, `<`, `>`, `"`, and `'`.
 *
 * @since 2.0
 * @param text - Plain text to escape
 * @returns HTML-safe string
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
 * @since 2.0
 * @param element - Target element
 * @param text - Text content to set
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
 * With `preserveComments`, HTML comment nodes are kept.
 *
 * @since 2.0
 * @param element - Target element
 * @param [preserveComments=false] - Keep HTML comment nodes
 * @returns Function that sets the text content
 */
const bindText = (
	element: Element,
	preserveComments: boolean = false,
): ((value: string | number) => void) => {
	const setter = preserveComments
		? (value: string | number) =>
				setTextPreservingComments(element, String(value))
		: (value: string | number) => {
				element.textContent = String(value)
			}
	registerDebugBindingTarget(setter, element)
	return setter
}

/**
 * Returns a function that sets a DOM property directly on an element.
 *
 * @since 2.0
 * @param object - Target object
 * @param key - Property key to set
 * @returns Function that sets a property
 */
function bindProperty<O extends object, K extends keyof O & string>(
	object: O,
	key: K,
): (value: O[K]) => void
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
function bindProperty<O extends object, K extends keyof O & string>(
	object: O,
	keys: readonly K[],
): (value: Partial<Pick<O, K>>) => void
function bindProperty(
	object: any,
	keyOrKeys: string | readonly string[],
): (value: any) => void {
	if (typeof keyOrKeys === 'string') {
		const key = keyOrKeys
		const setter = (value: unknown) => {
			object[key] = value
		}
		if (typeof Element !== 'undefined' && object instanceof Element)
			registerDebugBindingTarget(setter, object)
		return setter
	}
	const keys = keyOrKeys
	const setter = (value: Record<string, unknown>) => {
		for (const key of keys) {
			if (Object.hasOwn(value, key)) object[key] = value[key]
		}
	}
	if (typeof Element !== 'undefined' && object instanceof Element)
		registerDebugBindingTarget(setter, object)
	return setter
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
function bindClass<T = boolean>(
	element: Element,
	token: string,
): (value: T) => void
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
function bindClass<Tk extends string>(
	element: Element,
	tokens: readonly Tk[],
): (value: Partial<Record<Tk, boolean>>) => void
function bindClass(
	element: Element,
	tokenOrTokens: string | readonly string[],
): (value: any) => void {
	if (typeof tokenOrTokens === 'string') {
		const token = tokenOrTokens
		const setter = (value: unknown) => {
			element.classList.toggle(token, Boolean(value))
		}
		registerDebugBindingTarget(setter, element)
		return setter
	}
	const tokens = tokenOrTokens
	const setter = (value: Record<string, unknown>) => {
		for (const token of tokens)
			element.classList.toggle(token, Boolean(value[token]))
	}
	registerDebugBindingTarget(setter, element)
	return setter
}

/**
 * Returns a function that toggles a custom state on an element's `ElementInternals`.
 *
 * Consumers match the state in CSS with the `:state(token)` pseudo-class.
 * Unlike a class token, a custom state cannot be overwritten by author code
 * or frameworks rewriting the host's `class` attribute.
 *
 * If `internals` is `null` (`attachInternals()` failed), the returned
 * function is a no-op.
 *
 * @since 2.3
 * @param internals - The component's `ElementInternals` (or `null`)
 * @param token - Custom state token to toggle (matched via `:state(token)`)
 * @returns Function that toggles the custom state
 */
function bindState<T = boolean>(
	internals: ElementInternals | null,
	token: string,
): (value: T) => void
/**
 * Returns a function that toggles several custom states on an element's
 * `ElementInternals` from one map.
 *
 * `tokens` is the complete set of states this binding owns. A token absent
 * from the map is treated as `false` (off). Degrades the same way as the
 * single-token form when `internals` is `null`.
 *
 * @since 2.6
 * @param internals - The component's `ElementInternals` (or `null`)
 * @param tokens - Custom state tokens the returned setter may toggle
 * @returns Function that toggles the given custom states from a partial map
 */
function bindState<Tk extends string>(
	internals: ElementInternals | null,
	tokens: readonly Tk[],
): (value: Partial<Record<Tk, boolean>>) => void
function bindState(
	internals: ElementInternals | null,
	tokenOrTokens: string | readonly string[],
): (value: any) => void {
	if (typeof tokenOrTokens === 'string') {
		const token = tokenOrTokens
		return (value: unknown) => {
			if (!internals) return
			if (value) internals.states.add(token)
			else internals.states.delete(token)
		}
	}
	const tokens = tokenOrTokens
	return (value: Record<string, unknown>) => {
		if (!internals) return
		for (const token of tokens) {
			if (value[token]) internals.states.add(token)
			else internals.states.delete(token)
		}
	}
}

/**
 * Returns a function that controls element visibility via `el.hidden = !value`.
 *
 * @since 2.0
 * @param element - Target element
 * @returns Function that schedules the visibility update
 */
const bindVisible = <T = boolean>(
	element: HTMLElement,
): ((value: T) => void) => {
	const setter = (value: T) => {
		element.hidden = !value
	}
	registerDebugBindingTarget(setter, element)
	return setter
}

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
function bindAttribute(
	element: Element,
	name: string,
	allowUnsafe?: boolean,
): SingleMatchHandlers<string | boolean>
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
function bindAttribute<N extends string>(
	element: Element,
	names: readonly N[],
	allowUnsafe?: boolean,
): SingleMatchHandlers<Partial<Record<N, string | boolean>>>
function bindAttribute(
	element: Element,
	nameOrNames: string | readonly string[],
	allowUnsafe: boolean = false,
): SingleMatchHandlers<any> {
	if (typeof nameOrNames === 'string') {
		const name = nameOrNames
		const handlers: SingleMatchHandlers<string | boolean> = {
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
		}
		registerDebugBindingTarget(handlers, element)
		return handlers
	}
	const names = nameOrNames
	const handlers: SingleMatchHandlers<Record<string, string | boolean>> = {
		ok: (map: Record<string, string | boolean>) => {
			for (const name of names) {
				const value = map[name]
				if (value == null) {
					element.removeAttribute(name)
				} else if (typeof value === 'boolean') {
					element.toggleAttribute(name, value)
				} else if (allowUnsafe) {
					element.setAttribute(name, value)
				} else {
					safeSetAttribute(element, name, value)
				}
			}
		},
		nil: () => {
			for (const name of names) element.removeAttribute(name)
		},
	}
	registerDebugBindingTarget(handlers, element)
	return handlers
}

/* === ARIA Reflection (ADR 0026) === */

/**
 * Convert an IDL property name to its content attribute name.
 *
 * ARIA attribute names carry no inner hyphens, so this strips a trailing
 * `Element`/`Elements`, strips the `aria` prefix, lowercases the rest, and
 * prepends `aria-` (e.g. `ariaDescribedByElements` → `aria-describedby`).
 * `role` maps to itself.
 */
const ariaAttributeName = (idlName: string): string => {
	if (idlName === 'role') return 'role'
	let base = idlName.startsWith('aria') ? idlName.slice('aria'.length) : idlName
	if (base.endsWith('Elements')) base = base.slice(0, -'Elements'.length)
	else if (base.endsWith('Element')) base = base.slice(0, -'Element'.length)
	return `aria-${base.toLowerCase()}`
}

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
 * value-bearing `ok()` — see the stale-attribute rule in ADR 0026 §1. A
 * nullish target makes every handler a no-op.
 *
 * @since 2.6
 * @param target - `ARIAMixin` target (`Element` or `ElementInternals`), or `null`/`undefined`
 * @param name - Platform `ARIAMixin` property name (e.g. `'ariaExpanded'`, `'ariaValueNow'`, `'role'`)
 * @returns Match handlers for the ARIA reflection
 */
function bindAria(
	target: ARIAMixin | null | undefined,
	name: keyof ARIAMixin & string,
): SingleMatchHandlers<AriaValue>
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
function bindAria<N extends keyof ARIAMixin & string>(
	target: ARIAMixin | null | undefined,
	names: readonly N[],
): SingleMatchHandlers<Partial<Record<N, AriaValue>>>
function bindAria(
	target: ARIAMixin | null | undefined,
	nameOrNames:
		| (keyof ARIAMixin & string)
		| readonly (keyof ARIAMixin & string)[],
): SingleMatchHandlers<any> {
	// `Element` targets skip the stale-attribute rule: their IDL writes
	// mirror into the attribute natively, so there is nothing shadowing.
	const isElementTarget =
		target != null &&
		typeof Element !== 'undefined' &&
		target instanceof Element
	const host =
		target != null && !isElementTarget
			? internalsHosts.get(target as ElementInternals)
			: undefined
	// Tracks which properties have had their shadowing attribute removed,
	// so removal fires once per property, not on every `ok()`.
	const cleared = new Set<keyof ARIAMixin & string>()
	const assign = (
		name: keyof ARIAMixin & string,
		value: AriaValue | undefined,
	): void => {
		if (!target) return
		if (value == null) {
			;(target as unknown as Record<string, unknown>)[name] = null
			return
		}
		if (host && !cleared.has(name)) {
			cleared.add(name)
			host.removeAttribute(ariaAttributeName(name))
		}
		;(target as unknown as Record<string, unknown>)[name] =
			typeof value === 'boolean'
				? value
					? 'true'
					: 'false'
				: typeof value === 'number'
					? String(value)
					: value
	}
	const clear = (name: keyof ARIAMixin & string): void => {
		if (target) (target as unknown as Record<string, unknown>)[name] = null
	}
	if (typeof nameOrNames === 'string') {
		const name = nameOrNames
		const handlers: SingleMatchHandlers<AriaValue> = {
			ok: (value: AriaValue) => {
				assign(name, value)
			},
			nil: () => {
				clear(name)
			},
		}
		if (isElementTarget) registerDebugBindingTarget(handlers, target)
		return handlers
	}
	const names = nameOrNames
	const handlers: SingleMatchHandlers<Record<string, AriaValue>> = {
		ok: (map: Record<string, AriaValue>) => {
			for (const name of names) assign(name, map[name])
		},
		nil: () => {
			for (const name of names) clear(name)
		},
	}
	if (isElementTarget) registerDebugBindingTarget(handlers, target)
	return handlers
}

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
function bindStyle(
	element: HTMLElement | SVGElement | MathMLElement,
	prop: string,
): SingleMatchHandlers<string>
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
function bindStyle<P extends string>(
	element: HTMLElement | SVGElement | MathMLElement,
	props: readonly P[],
): SingleMatchHandlers<Partial<Record<P, string | null>>>
function bindStyle(
	element: HTMLElement | SVGElement | MathMLElement,
	propOrProps: string | readonly string[],
): SingleMatchHandlers<any> {
	if (typeof propOrProps === 'string') {
		const prop = propOrProps
		const handlers: SingleMatchHandlers<string> = {
			ok: (value: string) => {
				element.style.setProperty(prop, value)
			},
			nil: () => {
				element.style.removeProperty(prop)
			},
		}
		registerDebugBindingTarget(handlers, element)
		return handlers
	}
	const props = propOrProps
	const handlers: SingleMatchHandlers<Record<string, string | null>> = {
		ok: (map: Record<string, string | null>) => {
			for (const prop of props) {
				const value = map[prop]
				if (value == null) element.style.removeProperty(prop)
				else element.style.setProperty(prop, value)
			}
		},
		nil: () => {
			for (const prop of props) element.style.removeProperty(prop)
		},
	}
	registerDebugBindingTarget(handlers, element)
	return handlers
}

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
const dangerouslyBindInnerHTML = (
	element: Element,
	options: DangerouslyBindInnerHTMLOptions = {},
): SingleMatchHandlers<string> => {
	// Resets via DOM mutation, not `innerHTML = ''` — a Trusted-Types CSP
	// throws on any string assignment, even an empty one.
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
			const {
				shadowRootMode,
				allowScripts,
				sanitize = defaultSanitize,
			} = options
			if (shadowRootMode && !element.shadowRoot)
				element.attachShadow({ mode: shadowRootMode })
			const target = element.shadowRoot || element
			const html = sanitize ? sanitize(rawHtml) : rawHtml
			schedule(element, () => {
				try {
					// `innerHTML` also accepts `TrustedHTML` under Trusted Types;
					// lib.dom.d.ts only types it as `string`.
					;(target as { innerHTML: string | TrustedHTML }).innerHTML = html
				} catch (e) {
					// Re-throw from a microtask so the error surfaces as uncaught
					// without re-entering the scheduler's try/catch (see ADR-0010).
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
	type AriaValue,
	bindAria,
	bindAttribute,
	bindClass,
	bindProperty,
	bindState,
	bindStyle,
	bindText,
	bindVisible,
	configureHtmlSanitizer,
	type DangerouslyBindInnerHTMLOptions,
	dangerouslyBindInnerHTML,
	escapeHTML,
	getDebugBindingTarget,
	type Sanitizer,
	safeSetAttribute,
	setTextPreservingComments,
}
