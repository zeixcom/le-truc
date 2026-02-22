import { createMemo, type Memo } from '@zeix/cause-effect'
import { DependencyTimeoutError, MissingElementError } from './errors'
import { DEV_MODE, isNotYetDefinedComponent, LOG_WARN } from './util'

/* === Types === */

// Split a comma-separated selector into individual selectors
type SplitByComma<S extends string> = S extends `${infer First},${infer Rest}`
	? [TrimWhitespace<First>, ...SplitByComma<Rest>]
	: [TrimWhitespace<S>]

// Trim leading/trailing whitespace from a string
type TrimWhitespace<S extends string> = S extends ` ${infer Rest}`
	? TrimWhitespace<Rest>
	: S extends `${infer Rest} `
		? TrimWhitespace<Rest>
		: S

// Extract the rightmost selector part from combinator selectors (space, >, +, ~)
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

// Extract tag name from a simple selector (without combinators)
type ExtractTagFromSimpleSelector<S extends string> =
	S extends `${infer T}.${string}`
		? T
		: S extends `${infer T}#${string}`
			? T
			: S extends `${infer T}:${string}`
				? T
				: S extends `${infer T}[${string}`
					? T
					: S

// Main extraction logic for a single selector
type ExtractTag<S extends string> = ExtractTagFromSimpleSelector<
	ExtractRightmostSelector<S>
>

// Normalize to lowercase and ensure it's a known HTML tag
type KnownTag<S extends string> =
	Lowercase<ExtractTag<S>> extends
		| keyof HTMLElementTagNameMap
		| keyof SVGElementTagNameMap
		| keyof MathMLElementTagNameMap
		? Lowercase<ExtractTag<S>>
		: never

// Get element type from a single selector
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

// Map a tuple of selectors to a union of their element types
type ElementsFromSelectorArray<Selectors extends readonly string[]> = {
	[K in keyof Selectors]: Selectors[K] extends string
		? ElementFromSingleSelector<Selectors[K]>
		: never
}[number]

// Main type: handle both single selectors and comma-separated selectors
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
	): Memo<ElementFromSelector<S>[]>
	<E extends Element>(selector: string, required?: string): Memo<E[]>
}

type ElementQueries = {
	first: FirstElement
	all: AllElements
}

type UI = Record<string, Element | Memo<Element[]>>

type ElementFromKey<U extends UI, K extends keyof U> = NonNullable<
	U[K] extends Memo<infer E extends Element[]>
		? E[number]
		: U[K] extends Element
			? U[K]
			: never
>

/* === Constants === */

const DEPENDENCY_TIMEOUT = 200

/* === Internal Functions === */

/**
 * Extract attribute names from a CSS selector
 * Handles various attribute selector formats: .class, #id, [attr], [attr=value], [attr^=value], etc.
 *
 * @param {string} selector - CSS selector to parse
 * @returns {string[]} - Array of attribute names found in the selector
 */
const extractAttributes = (selector: string): string[] => {
	const attributes = new Set<string>()
	if (selector.includes('.')) attributes.add('class')
	if (selector.includes('#')) attributes.add('id')
	if (selector.includes('[')) {
		const parts = selector.split('[')
		for (let i = 1; i < parts.length; i++) {
			const part = parts[i]
			if (!part.includes(']')) continue
			const attrName = part
				.split('=')[0]
				.trim()
				.replace(/[^a-zA-Z0-9_-]/g, '')
			if (attrName) attributes.add(attrName)
		}
	}
	return [...attributes]
}

/* === Exported Functions === */

/**
 * Create a memo of elements matching a CSS selector.
 * The MutationObserver is lazily activated when an effect first reads
 * the memo, and disconnected when no effects are watching.
 *
 * @since 0.16.0
 * @param parent - The parent node to search within
 * @param selector - The CSS selector to match elements
 * @returns A Memo of current matching elements
 */
function createElementsMemo<S extends string>(
	parent: ParentNode,
	selector: S,
): Memo<ElementFromSelector<S>[]>
function createElementsMemo<E extends Element>(
	parent: ParentNode,
	selector: string,
): Memo<E[]>
function createElementsMemo<S extends string>(
	parent: ParentNode,
	selector: S,
): Memo<ElementFromSelector<S>[]> {
	type E = ElementFromSelector<S>

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
 * Queries are run against `host.shadowRoot` if present, otherwise against `host` itself.
 * Any undefined custom elements found during queries are collected as dependencies;
 * `resolveDependencies` waits for them to be defined before activating effects.
 *
 * @since 0.14.0
 * @param {HTMLElement} host - The component host element
 * @returns {[ElementQueries, (callback: () => void) => void]} Query helpers and a dependency resolver
 */
const getHelpers = (
	host: HTMLElement,
): [ElementQueries, (run: () => void) => void] => {
	const root = host.shadowRoot ?? host
	const dependencies: Set<string> = new Set()

	/**
	 * Return the first descendant element matching a CSS selector.
	 *
	 * If the matched element is an undefined custom element, its tag name is added
	 * to the dependency set so `resolveDependencies` can await its definition.
	 *
	 * @since 0.15.0
	 * @param {S} selector - CSS selector
	 * @param {string} [required] - If provided and no element is found, throws with this message as context
	 * @returns {ElementFromSelector<S> | undefined} The first matching element, or `undefined` if not found and not required
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
		const target = root.querySelector<ElementFromSelector<S>>(selector)
		if (required != null && !target)
			throw new MissingElementError(host, selector, required)

		// Only add to dependencies if element is a custom element that's not yet defined
		if (target && isNotYetDefinedComponent(target))
			dependencies.add(target.localName)
		return target ?? undefined
	}

	/**
	 * Return a `Memo` of all descendant elements matching a CSS selector.
	 *
	 * The Memo is backed by a `MutationObserver` that activates lazily when first
	 * read inside a reactive effect, and disconnects when no effects are watching.
	 * Undefined custom elements found at query time are added to the dependency set.
	 *
	 * @since 0.15.0
	 * @param {S} selector - CSS selector
	 * @param {string} [required] - If provided and no elements are found at query time, throws with this message as context
	 * @returns {Memo<ElementFromSelector<S>[]>} Reactive memo of current matching elements
	 * @throws {MissingElementError} If `required` is set and no matching elements exist at query time
	 */
	function all<S extends string>(
		selector: S,
		required?: string,
	): Memo<ElementFromSelector<S>[]>
	function all<E extends Element>(
		selector: string,
		required?: string,
	): Memo<E[]>
	function all<S extends string>(
		selector: S,
		required?: string,
	): Memo<ElementFromSelector<S>[]> {
		const targets = createElementsMemo(root, selector)
		const current = targets.get()
		if (required != null && !current.length)
			throw new MissingElementError(host, selector, required)
		if (current.length)
			for (const target of current) {
				// Only add to dependencies if element is a custom element that's not yet defined
				if (isNotYetDefinedComponent(target)) dependencies.add(target.localName)
			}
		return targets
	}

	/**
	 * Wait for all collected custom element dependencies to be defined, then run `callback`.
	 *
	 * If no dependencies were collected, `callback` runs synchronously. Otherwise, a
	 * microtask filters out already-defined elements, then `Promise.all` awaits the rest
	 * with a 200 ms timeout. On timeout, logs a `DependencyTimeoutError` and runs `callback` anyway.
	 *
	 * @param {() => void} callback - Function to run once dependencies are resolved
	 */
	const resolveDependencies = (callback: () => void) => {
		if (dependencies.size) {
			// Defer to microtask to filter out components that get defined
			// synchronously after queries ran (e.g. co-bundled components
			// whose define() calls execute later in the same script).
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
						if (DEV_MODE) console[LOG_WARN](error)
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
	type ElementFromKey,
	type ElementFromSelector,
	type ElementsFromSelectorArray,
	type ElementFromSingleSelector,
	type ElementQueries,
	type ExtractRightmostSelector,
	type ExtractTag,
	type ExtractTagFromSimpleSelector,
	type FirstElement,
	type KnownTag,
	createElementsMemo,
	getHelpers,
	type SplitByComma,
	type TrimWhitespace,
	type UI,
}
