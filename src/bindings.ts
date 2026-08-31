import type { SingleMatchHandlers } from '@zeix/cause-effect'
import { internalsHosts } from './internal'
import { schedule } from './scheduler'

/**
 * Low-level DOM-mutation primitives behind `bindText`, `bindAttribute`,
 * `bindAria`, `bindClass`, `bindState`, `bindStyle`, `bindVisible`, and
 * `dangerouslyBindInnerHTML`. Each `bind*` function returns a setter (or
 * `SingleMatchHandlers`) that a caller wires to a signal via `watch()` or
 * `match()`.
 *
 * `safeSetAttribute()` blocks `on*` attribute names and validates URL-like
 * values against an allowlist (`http:`, `https:`, `ftp:`, `mailto:`,
 * `tel:`); see `isSafeURL()` for the exact rules. `dangerouslyBindInnerHTML()`
 * is an XSS sink — pass a `sanitize` option (e.g. DOMPurify) for untrusted
 * input, and return `TrustedHTML` from it on pages that enforce
 * `require-trusted-types-for 'script'`. Le Truc ships no sanitizer.
 */

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
	 * Sanitizer applied to the HTML string before assignment to `innerHTML`.
	 * Return a sanitized `string`, or a `TrustedHTML` instance on pages that
	 * enforce Trusted Types (see the Security note on
	 * `dangerouslyBindInnerHTML` below).
	 */
	sanitize?: (html: string) => string | TrustedHTML
}

/* === DEV_MODE Debug Attribution (ADR 0022) === */

/**
 * DEV_MODE-only registry mapping a `bind*` helper's returned setter (or
 * `SingleMatchHandlers` object, for `bindAttribute`/`bindStyle`) back to the
 * element it closes over. `watch()`'s debug instrumentation looks a handler
 * up here to attribute an otherwise-opaque closure to a DOM element — exact
 * tagging of a fact the helper already has, never a heuristic guess. Never
 * populated outside `DEV_MODE`; empty in production.
 */
const debugBindingTargets = new WeakMap<object, Element>()

/**
 * Register a `bind*` helper's returned closure against the element it closes
 * over, gated by `DEV_MODE` — a no-op call in production that constant-folds
 * away along with the guard.
 */
const registerDebugBindingTarget = (target: object, element: Element): void => {
	if (process.env.DEV_MODE === 'true') debugBindingTargets.set(target, element)
}

/**
 * Look up the element a `bind*`-produced closure was registered against, if
 * any. Used by `watch()`'s `DEV_MODE` instrumentation (ADR 0022) — a handler
 * not produced by a `bind*` helper resolves to `undefined`, which is the
 * correct "don't guess" outcome, not a bug.
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
 * Blocks `on*` event handler attribute names and rejects unsafe URL values
 * (see `isSafeURL()`). Violations throw; they never fail silently.
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
 * TypeScript infers `O[K]` from the object type and key, so no explicit type
 * parameters are needed at call sites.
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
 * Unlike the single-key form, this is a partial PATCH, not a clear/set pair:
 * `keys` is declared statically at the call site, but object properties have
 * no "unset" operation, so absent keys in the value are simply skipped —
 * their previous value is left untouched.
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
 * Returns a function that toggles several CSS class tokens on an element.
 *
 * `tokens` is declared statically at the call site — the array is always the
 * complete set of tokens this binding owns. For every declared token,
 * `classList.toggle(token, Boolean(map[token]))` runs; an absent token in the
 * map coerces to `false` (off), the same coercion the single-token form
 * already uses. No separate `nil` handler is needed: an empty map already
 * clears every declared token via the same toggle loop.
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
 * `value=true` adds the state; `value=false` removes it. Consumers match it in
 * CSS with the `:state(token)` pseudo-class. Unlike a class token, a custom
 * state is owned by the component — author code or frameworks rewriting the
 * host's `class` attribute cannot overwrite it.
 *
 * Accepts `null` for graceful degradation: the factory context's `internals`
 * is `null` when `attachInternals()` failed, in which case the returned
 * function is a no-op.
 *
 * `ElementInternals` carries no reference back to its host element, so this
 * setter is never registered in the debug attribution registry (ADR 0022) —
 * a custom state is host-scoped anyway, and the debug host pulse already
 * covers it.
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
 * `tokens` is declared statically at the call site — the array is always the
 * complete set of states this binding owns. For every declared token,
 * `internals.states.add(token)`/`.delete(token)` runs per
 * `Boolean(map[token])`; an absent token in the map coerces to `false` (off),
 * the same coercion the single-token form already uses. No separate `nil`
 * handler is needed: an empty map already clears every declared token via
 * the same toggle loop. Degrades the same way as the single-token form —
 * `internals === null` makes the returned function a no-op.
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
 * `value=true` makes the element visible; `value=false` hides it.
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
function bindAttribute(
	element: Element,
	name: string,
	allowUnsafe?: boolean,
): SingleMatchHandlers<string | boolean>
/**
 * Returns `SingleMatchHandlers` that set, toggle, or remove several
 * attributes with security validation, from one map.
 *
 * `names` is declared statically at the call site, so it is always the
 * complete set of attributes this binding owns:
 *
 * - `ok(map)` — for every declared name: present and a string →
 *   `safeSetAttribute`/`setAttribute` (per `allowUnsafe`); present and a
 *   boolean → `toggleAttribute`; absent or `null`/`undefined` →
 *   `removeAttribute`.
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
 * Everything `bindAria()`'s `ok()` handler accepts, per ADR 0026 §2's mapping
 * table. Deliberately excludes `null | undefined` even though `ok()` guards
 * for both at runtime: `SingleMatchHandlers<T>` constrains `T extends {}`, so
 * a union including them fails to typecheck as the generic parameter — the
 * same "typed optimistically, guarded defensively" split the map-form
 * `ok(map)` of `bindAttribute`/`bindStyle` already carries for absent keys.
 * A signal whose *resolved value* is legitimately `null` still reaches
 * `ok(null)` via cause-effect's `match()` (which routes to `nil` only on
 * `UnsetSignalValueError`, i.e. pending/unset, never on a resolved null) —
 * exactly the case the runtime guard exists for.
 */
type AriaValue = boolean | number | string | Element | readonly Element[]

/**
 * IDL property name → content attribute name. NOT kebab-case: ARIA attribute
 * names carry no inner hyphens. Strip a trailing `Element`/`Elements`, strip
 * the `aria` prefix, lowercase the remainder, prefix `aria-` —
 * `ariaValueNow` → `aria-valuenow`, `ariaDescribedByElements` →
 * `aria-describedby`, `ariaActiveDescendantElement` → `aria-activedescendant`;
 * `role` maps to itself. A naive kebab-case transform would yield
 * `aria-labelled-by` for `ariaLabelledByElements` and silently remove nothing.
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
 * target via the platform's ARIA reflection properties — `ElementInternals`
 * for component-owned host semantics (invisible in markup, unclobberable by
 * attribute rewriting), or a native `Element` whose IDL write mirrors into
 * the content attribute. Both implement `ARIAMixin`, so one signature covers
 * host reflection and inner-element binding.
 *
 * Coercion per ADR 0026 §2's mapping table:
 *
 * - `ok(boolean)` → assigns `'true'` / `'false'` — ARIA enumerated semantics,
 *   never `toggleAttribute`'s invalid empty-string form
 * - `ok(number)` → assigns the decimal string (`ariaValueNow` from a numeric
 *   prop — note the IDL casing, which is *not* the hyphenated attribute name;
 *   a mis-cased write would be a silent no-op)
 * - `ok(string | Element | readonly Element[])` → pass-through (`'mixed'`,
 *   element references, …)
 * - `ok(null | undefined)` → assigns `null`, clearing the reflection and
 *   restoring attribute authority (runtime guard; see `AriaValue`)
 * - `nil` → assigns `null` (same clear)
 *
 * **Stale-attribute rule (ADR 0026 §1, `ElementInternals` targets only).**
 * A pre-existing host content attribute for the property being reflected
 * *permanently shadows* the internals value in the accessibility tree —
 * host attributes are the consumer-override channel, so a server-rendered
 * `aria-expanded="false"` would silently nullify every later
 * `internals.ariaExpanded` write. `bindAria()` therefore removes the
 * shadowing attribute itself. **The removal fires once** — per property,
 * at that property's first value-bearing `ok()`. Never on `nil` or a
 * nullish `ok` (those restore attribute authority instead), and never
 * again afterwards, so an
 * attribute set *after* connect keeps overriding on every later update. The
 * one-line contract: the server-rendered attribute is the initial value;
 * from the first assertion on, the component owns that property reactively
 * via internals. For an `Element` target the IDL write *is* the attribute
 * channel (native reflection mirrors it), so there is nothing shadowing and
 * nothing is removed. A nullish target (the `attachInternals()`-failed path)
 * makes every handler a no-op — the same graceful degradation `bindState()`
 * established.
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
 * `names` is declared statically at the call site, so it is always the
 * complete set of properties this binding owns:
 *
 * - `ok(map)` — for every declared name: present and non-nullish → assign
 *   per the single-form coercion table (boolean → `'true'`/`'false'`,
 *   number → decimal string, otherwise pass-through); absent or
 *   `null`/`undefined` → assign `null`, clearing that reflection.
 * - `nil` → assigns `null` to every declared name (clear).
 *
 * The stale-attribute rule applies per declared property: each one's
 * shadowing content attribute is removed at that property's first asserted
 * value (`ElementInternals` targets only — see the single form).
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
	// The stale-attribute rule needs the host element behind an
	// `ElementInternals` target; internals this library did not create are
	// absent from the reverse lookup, which makes the removal a graceful
	// no-op. `Element` targets skip it entirely — their IDL writes mirror
	// into the attribute natively, so there is nothing shadowing.
	const isElementTarget =
		target != null &&
		typeof Element !== 'undefined' &&
		target instanceof Element
	const host =
		target != null && !isElementTarget
			? internalsHosts.get(target as ElementInternals)
			: undefined
	// Per property: the shadowing content attribute is removed exactly once,
	// at the first `ok()` that asserts a value — never on `nil`/null clears
	// (those restore attribute authority), never twice (a post-connect
	// consumer override must survive every later update).
	const cleared = new Set<keyof ARIAMixin & string>()
	// `value` accepts `undefined` in addition to `AriaValue`: the map form's
	// index read widens under `noUncheckedIndexedAccess`, and an undefined
	// entry clears the reflection exactly like a null one.
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
 * - `ok(string)` → schedules `el.style.setProperty(prop, value)`
 * - `nil` → schedules `el.style.removeProperty(prop)`, restoring the CSS cascade value
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
 * `props` is declared statically at the call site, so it is always the
 * complete set of properties this binding owns:
 *
 * - `ok(map)` — for every declared property: present and non-nil →
 *   `el.style.setProperty(prop, value)`; absent or `null`/`undefined` →
 *   `el.style.removeProperty(prop)`.
 * - `nil` → removes every declared property, restoring the CSS cascade value
 *   for each.
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
 * **Security.** `allowScripts: false` (the default) does not make untrusted
 * HTML safe: `innerHTML` still fires event-handler attributes on other
 * elements (e.g. `<img src=x onerror=…>`, `<svg onload=…>`, `<iframe srcdoc>`)
 * even though it does not execute inline `<script>`. Pass a `sanitize`
 * function for any content that is not fully trusted.
 *
 * **Trusted Types.** Under `Content-Security-Policy:
 * require-trusted-types-for 'script'`, the `innerHTML` assignment throws
 * unless `html` is a `TrustedHTML` instance — return one from `sanitize`
 * (e.g. DOMPurify with `RETURN_TRUSTED_TYPE: true`).
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
	type AriaValue,
	bindAria,
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
	getDebugBindingTarget,
	safeSetAttribute,
	setTextPreservingComments,
}
