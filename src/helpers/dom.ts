import { type Cell, createMemo } from '@zeix/cause-effect'
import {
	DependencyTimeoutError,
	InvalidSelectorError,
	MissingElementError,
} from '../errors'
import { DEPENDENCY_TIMEOUT } from '../internal'
import { isCustomElement, isNotYetDefinedComponent } from '../util'

/* === Types === */

type SplitByComma<S extends string> = S extends `${infer First},${infer Rest}`
	? [TrimWhitespace<First>, ...SplitByComma<Rest>]
	: [TrimWhitespace<S>]

type TrimWhitespace<S extends string> = S extends ` ${infer Rest}`
	? TrimWhitespace<Rest>
	: S extends `${infer Rest} `
		? TrimWhitespace<Rest>
		: S

type ExtractRightmostSelector<S extends string> =
	S extends `${string} ${infer Rest}`
		? ExtractRightmostSelector<Rest>
		: S extends `${string}>${infer Rest}`
			? ExtractRightmostSelector<Rest>
			: S extends `${string}+${infer Rest}`
				? ExtractRightmostSelector<Rest>
				: S extends `${string}~${infer Rest}`
					? ExtractRightmostSelector<Rest>
					: S

// Check `[` before `:` so `button[attr]:pseudo` yields `button`. Only use the
// `[` match when the prefix has no `:` — otherwise the `[` is inside a
// pseudo-class argument like `:not([hidden])` and `:` should win.
type ExtractTagFromSimpleSelector<S extends string> =
	S extends `${infer T}.${string}`
		? T
		: S extends `${infer T}#${string}`
			? T
			: S extends `${infer T}[${string}`
				? T extends `${string}:${string}`
					? S extends `${infer U}:${string}`
						? U
						: S
					: T
				: S extends `${infer T}:${string}`
					? T
					: S

type ExtractTag<S extends string> = ExtractTagFromSimpleSelector<
	ExtractRightmostSelector<S>
>

type KnownTag<S extends string> =
	Lowercase<ExtractTag<S>> extends
		| keyof HTMLElementTagNameMap
		| keyof SVGElementTagNameMap
		| keyof MathMLElementTagNameMap
		? Lowercase<ExtractTag<S>>
		: never

type ElementFromSingleSelector<S extends string> =
	KnownTag<S> extends never
		? HTMLElement
		: KnownTag<S> extends keyof HTMLElementTagNameMap
			? HTMLElementTagNameMap[KnownTag<S>]
			: KnownTag<S> extends keyof SVGElementTagNameMap
				? SVGElementTagNameMap[KnownTag<S>]
				: KnownTag<S> extends keyof MathMLElementTagNameMap
					? MathMLElementTagNameMap[KnownTag<S>]
					: HTMLElement

type ElementsFromSelectorArray<Selectors extends readonly string[]> = {
	[K in keyof Selectors]: Selectors[K] extends string
		? ElementFromSingleSelector<Selectors[K]>
		: never
}[number]

type ElementFromSelector<S extends string> = S extends `${string},${string}`
	? ElementsFromSelectorArray<SplitByComma<S>>
	: ElementFromSingleSelector<S>

type FirstElement = {
	<S extends string>(selector: S, required: string): ElementFromSelector<S>
	<S extends string>(selector: S): ElementFromSelector<S> | undefined
	<E extends Element>(selector: string, required: string): E
	<E extends Element>(selector: string): E | undefined
}

type AllElements = {
	<S extends string>(
		selector: S,
		required?: string,
	): Cell<ElementFromSelector<S>[]>
	<E extends Element>(selector: string, required?: string): Cell<E[]>
}

type ElementQueries = {
	first: FirstElement
	all: AllElements
}

/* === Internal Functions === */

/**
 * Extract attribute names from a CSS selector.
 *
 * Handles `.class`, `#id`, `[attr]`, `[attr=value]`, `[attr^=value]`, and similar forms.
 *
 * @param selector - CSS selector to parse
 * @returns Attribute names found in the selector
 */
const extractAttributes = (selector: string): string[] => {
	const attributes = new Set<string>()
	// Strip attribute selector content before checking for class/id shorthand,
	// so #/. inside [attr^="#anchor"] don't produce false positives. Linear
	// scan instead of regex to avoid backtracking on inputs like `[[[[`.
	let withoutAttrValues = ''
	let depth = 0
	for (const ch of selector) {
		if (ch === '[') depth++
		else if (ch === ']') {
			if (depth > 0) depth--
		} else if (depth === 0) withoutAttrValues += ch
	}
	if (withoutAttrValues.includes('.')) attributes.add('class')
	if (withoutAttrValues.includes('#')) attributes.add('id')
	if (selector.includes('[')) {
		const parts = selector.split('[')
		for (let i = 1; i < parts.length; i++) {
			const part = parts[i]
			if (!part || !part.includes(']')) continue
			const attrName = part
				.split('=')[0]!
				.split(']')[0]!
				.trim()
				.replace(/[^a-zA-Z0-9_-]/g, '')
			if (attrName) attributes.add(attrName)
		}
	}
	return [...attributes]
}

// Shared lookup behind `query()`, `makeElementQueries`'s `first`, and
// `bindFirst`'s item-scoped `first`.
function queryOne<S extends string>(
	root: ParentNode,
	selector: S,
	required: string | undefined,
	contextLabel: string,
): ElementFromSelector<S> | undefined {
	const target = root.querySelector<ElementFromSelector<S>>(selector)
	if (required != null && !target)
		throw new MissingElementError(root, selector, required, contextLabel)
	return target ?? undefined
}

/**
 * Bind `query()` to `root`, throwing with contextLabel `'item'` instead of
 * the default `'component'`. Backs `reconcile()`'s `bindItem` and `each()`'s
 * scoped `first` parameter. See ADR 0021.
 */
const bindFirst = (root: Element): FirstElement =>
	((selector: string, required?: string) =>
		queryOne(root, selector, required, 'item')) as FirstElement

/* === Exported Functions === */

/**
 * Return the first descendant of `root` matching a CSS selector.
 *
 * One-shot: no dependency tracking for undefined custom elements, no `Cell`.
 * Use it for lookups relative to an already-obtained element. `first()`/
 * `all()` (see `makeElementQueries`) add dependency tracking for a
 * component host. See ADR 0021.
 *
 * @since 2.4.0
 * @param root - Node to search within
 * @param selector - CSS selector
 * @param [required] - If set and no element is found, throws with this message as context
 * @returns The first matching element, or `undefined` if not found and not required
 * @throws {MissingElementError} If `required` is set and no matching element exists
 */
function query<S extends string>(
	root: ParentNode,
	selector: S,
	required: string,
): ElementFromSelector<S>
function query<S extends string>(
	root: ParentNode,
	selector: S,
): ElementFromSelector<S> | undefined
function query<E extends Element>(
	root: ParentNode,
	selector: string,
	required: string,
): E
function query<E extends Element>(
	root: ParentNode,
	selector: string,
): E | undefined
function query<S extends string>(
	root: ParentNode,
	selector: S,
	required?: string,
): ElementFromSelector<S> | undefined {
	return queryOne(root, selector, required, 'component')
}

/**
 * Return a plain array of all descendants of `root` matching a CSS selector.
 *
 * One-shot: queried once, not backed by a `Cell`/`MutationObserver`. Use
 * this when a live collection isn't needed. See `query()` and ADR 0021.
 *
 * @since 2.4.0
 * @param root - Node to search within
 * @param selector - CSS selector
 * @param [required] - If set and no elements are found, throws with this message as context
 * @returns Array of matching elements
 * @throws {MissingElementError} If `required` is set and no matching elements exist
 */
function queryAll<S extends string>(
	root: ParentNode,
	selector: S,
	required?: string,
): ElementFromSelector<S>[]
function queryAll<E extends Element>(
	root: ParentNode,
	selector: string,
	required?: string,
): E[]
function queryAll<S extends string>(
	root: ParentNode,
	selector: S,
	required?: string,
): ElementFromSelector<S>[] {
	const targets = Array.from(
		root.querySelectorAll<ElementFromSelector<S>>(selector),
	)
	if (required != null && !targets.length)
		throw new MissingElementError(root, selector, required)
	return targets
}

/**
 * Create a memo of elements matching a CSS selector.
 *
 * The `MutationObserver` activates lazily when an effect first reads the
 * memo, and disconnects when no effects are watching.
 *
 * @since 0.16.0
 * @param parent - The parent node to search within
 * @param selector - The CSS selector to match elements
 * @returns Reactive memo of current matching elements
 * @throws {InvalidSelectorError} If the selector is malformed
 */
function createElementsMemo<S extends string>(
	parent: ParentNode,
	selector: S,
): Cell<ElementFromSelector<S>[]>
function createElementsMemo<E extends Element>(
	parent: ParentNode,
	selector: string,
): Cell<E[]>
function createElementsMemo<S extends string>(
	parent: ParentNode,
	selector: S,
): Cell<ElementFromSelector<S>[]> {
	type E = ElementFromSelector<S>

	// Validate eagerly: a SyntaxError thrown inside the MutationObserver
	// callback is silently swallowed per spec, leaving the memo stale.
	try {
		parent.querySelector(selector)
	} catch (error) {
		throw new InvalidSelectorError(parent, selector, error)
	}

	return createMemo(() => Array.from(parent.querySelectorAll<E>(selector)), {
		value: [],
		equals: (a, b) => a.length === b.length && a.every((el, i) => el === b[i]),
		watched: invalidate => {
			const observerConfig: MutationObserverInit = {
				childList: true,
				subtree: true,
			}
			const observedAttributes = extractAttributes(selector)
			if (observedAttributes.length) {
				observerConfig.attributes = true
				observerConfig.attributeFilter = observedAttributes
			}
			const couldMatch = (node: Node) =>
				node instanceof Element &&
				(node.matches(selector) || node.querySelector(selector))

			const maybeDirty = (mutation: MutationRecord) => {
				if (mutation.type === 'attributes') return true
				if (mutation.type === 'childList')
					return (
						Array.from(mutation.addedNodes).some(couldMatch) ||
						Array.from(mutation.removedNodes).some(couldMatch)
					)
				return false
			}

			const observer = new MutationObserver(mutations => {
				for (const mutation of mutations) {
					if (maybeDirty(mutation)) {
						invalidate()
						return
					}
				}
			})
			observer.observe(parent, observerConfig)
			return () => observer.disconnect()
		},
	})
}

/**
 * Create `{ first, all }` query helpers and a dependency resolver for a component host.
 *
 * Queries run against `host.shadowRoot` if present, otherwise against `host`
 * itself. Undefined custom elements found during queries are collected as
 * dependencies; `resolveDependencies` waits for them before activating effects.
 *
 * @since 0.14.0
 * @param host - The component host element
 * @returns Query helpers and a dependency resolver
 */
const makeElementQueries = (
	host: HTMLElement,
): [ElementQueries, (run: () => void) => void] => {
	const root = host.shadowRoot ?? host
	const dependencies: Set<string> = new Set()
	// True when `first()`/`all()` matched a `:defined` custom-element
	// descendant. Its connectedCallback may not have run yet when a whole
	// subtree connects in one operation (parent callback fires first, in
	// tree order) — resolveDependencies() defers a microtask to let it drain.
	let queriedDefinedCustomChild = false

	/**
	 * Return the first descendant element matching a CSS selector.
	 *
	 * If the matched element is an undefined custom element, its tag name is
	 * added to the dependency set so `resolveDependencies` can await it.
	 *
	 * @since 0.15.0
	 * @param selector - CSS selector
	 * @param [required] - If set and no element is found, throws with this message as context
	 * @returns The first matching element, or `undefined` if not found and not required
	 * @throws {MissingElementError} If `required` is set and no matching element exists
	 */
	function first<S extends string>(
		selector: S,
		required: string,
	): ElementFromSelector<S>
	function first<S extends string>(
		selector: S,
	): ElementFromSelector<S> | undefined
	function first<E extends Element>(selector: string, required: string): E
	function first<E extends Element>(selector: string): E | undefined
	function first<S extends string>(
		selector: S,
		required?: string,
	): ElementFromSelector<S> | undefined {
		const target = queryOne(root, selector, required, 'component')

		if (target && isNotYetDefinedComponent(target))
			dependencies.add(target.localName)
		else if (target && isCustomElement(target)) queriedDefinedCustomChild = true
		return target ?? undefined
	}

	/**
	 * Return a `Cell` of all descendant elements matching a CSS selector.
	 *
	 * The cell is backed by a `MutationObserver` that activates lazily when
	 * first read inside a reactive effect, and disconnects when no effects
	 * are watching. Undefined custom elements found at query time are added
	 * to the dependency set.
	 *
	 * @since 0.15.0
	 * @param selector - CSS selector
	 * @param [required] - If set and no elements are found at query time, throws with this message as context
	 * @returns Reactive cell of current matching elements
	 * @throws {MissingElementError} If `required` is set and no matching elements exist at query time
	 * @throws {InvalidSelectorError} If the selector is malformed
	 */
	function all<S extends string>(
		selector: S,
		required?: string,
	): Cell<ElementFromSelector<S>[]>
	function all<E extends Element>(
		selector: string,
		required?: string,
	): Cell<E[]>
	function all<S extends string>(
		selector: S,
		required?: string,
	): Cell<ElementFromSelector<S>[]> {
		const targets = createElementsMemo(root, selector)
		const current = targets.get()
		if (required != null && !current.length)
			throw new MissingElementError(host, selector, required)
		if (current.length)
			for (const target of current) {
				if (isNotYetDefinedComponent(target)) dependencies.add(target.localName)
				else if (isCustomElement(target)) queriedDefinedCustomChild = true
			}
		return targets
	}

	/**
	 * Wait for all collected custom element dependencies to be defined, then run `callback`.
	 *
	 * If no dependencies were collected and no `:defined` custom-element
	 * child was queried, `callback` runs synchronously. Otherwise, a
	 * microtask filters out already-defined elements, then `Promise.all`
	 * awaits the rest with a timeout (see `DEPENDENCY_TIMEOUT`).
	 *
	 * On timeout, a `DependencyTimeoutError` is logged in DEV_MODE and
	 * `callback` runs anyway, so one undefined dependency never blocks the
	 * whole component.
	 *
	 * @param callback - Function to run once dependencies are resolved (or timed out)
	 */
	const resolveDependencies = (callback: () => void) => {
		if (dependencies.size || queriedDefinedCustomChild) {
			// Defer to a microtask so components defined synchronously after
			// queries ran (e.g. co-bundled components) are filtered out.
			queueMicrotask(() => {
				const deps = Array.from(dependencies).filter(
					dep => !customElements.get(dep),
				)
				if (!deps.length) {
					callback()
					return
				}
				Promise.race([
					Promise.all(deps.map(dep => customElements.whenDefined(dep))),
					new Promise((_, reject) => {
						setTimeout(() => {
							reject(
								new DependencyTimeoutError(
									host,
									deps.filter(dep => !customElements.get(dep)),
								),
							)
						}, DEPENDENCY_TIMEOUT)
					}),
				])
					.then(callback)
					.catch((error: unknown) => {
						if (process.env.DEV_MODE === 'true') console.warn(error)
						callback()
					})
			})
		} else {
			callback()
		}
	}

	return [{ first, all }, resolveDependencies]
}

export {
	type AllElements,
	bindFirst,
	createElementsMemo,
	type ElementFromSelector,
	type ElementFromSingleSelector,
	type ElementQueries,
	type ElementsFromSelectorArray,
	type ExtractRightmostSelector,
	type ExtractTag,
	type ExtractTagFromSimpleSelector,
	extractAttributes,
	type FirstElement,
	type KnownTag,
	makeElementQueries,
	query,
	queryAll,
	type SplitByComma,
	type TrimWhitespace,
}
