import { createMemo, type Memo, type Sensor } from '@zeix/cause-effect'
import { DependencyTimeoutError, MissingElementError } from './errors'
import { isNotYetDefinedComponent } from './util'

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

type ElementChanges<E extends Element> = {
	current: Set<E>
	added: E[]
	removed: E[]
}

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
	): Memo<ElementChanges<ElementFromSelector<S>>>
	<E extends Element>(
		selector: string,
		required?: string,
	): Memo<ElementChanges<E>>
}

type ElementQueries = {
	first: FirstElement
	all: AllElements
}

type UI = Record<string, Element | Memo<ElementChanges<Element>>>

type ElementFromKey<U extends UI, K extends keyof U> = NonNullable<
	U[K] extends Memo<ElementChanges<infer E extends Element>>
		? E
		: U[K] extends Element
			? U[K]
			: never
>

/* === Constants === */

const DEPENDENCY_TIMEOUT = 50

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

/**
 * Observe changes to elements matching a CSS selector.
 * Returns a Memo that tracks which elements were added and removed.
 * The MutationObserver is lazily activated when an effect first reads
 * the memo, and disconnected when no effects are watching.
 *
 * @since 0.16.0
 * @param parent - The parent node to search within
 * @param selector - The CSS selector to match elements
 * @returns A Memo of element changes (current set, added, removed)
 */
function observeSelectorChanges<S extends string>(
	parent: ParentNode,
	selector: S,
): Memo<ElementChanges<ElementFromSelector<S>>>
function observeSelectorChanges<E extends Element>(
	parent: ParentNode,
	selector: string,
): Memo<ElementChanges<E>>
function observeSelectorChanges<S extends string>(
	parent: ParentNode,
	selector: S,
): Memo<ElementChanges<ElementFromSelector<S>>> {
	type E = ElementFromSelector<S>

	return createMemo(
		(prev: ElementChanges<E>) => {
			const next = new Set(Array.from(parent.querySelectorAll<E>(selector)))
			const added: E[] = []
			const removed: E[] = []

			for (const el of next) if (!prev.current.has(el)) added.push(el)
			for (const el of prev.current) if (!next.has(el)) removed.push(el)

			return { current: next, added, removed }
		},
		{
			value: { current: new Set<E>(), added: [], removed: [] },
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
				const observer = new MutationObserver(() => invalidate())
				observer.observe(parent, observerConfig)
				return () => observer.disconnect()
			},
		},
	)
}

/* === Exported Functions === */

function getWatchedElements<S extends string>(
	parent: ParentNode,
	selector: S,
): () => ElementFromSelector<S>[]
function getWatchedElements<E extends Element>(
	parent: ParentNode,
	selector: string,
): () => E[]
function getWatchedElements<S extends string>(
	parent: ParentNode,
	selector: S,
): () => ElementFromSelector<S>[] {
	const watcher = observeSelectorChanges(parent, selector)
	return () => Array.from(watcher.get().current)
}

/**
 * Create partially applied helper functions to get descendants and run effects on them
 *
 * @since 0.14.0
 * @param {HTMLElement} host - Host component
 * @returns {ElementSelectors<P>} - Helper functions for selecting descendants
 */
const getHelpers = (
	host: HTMLElement,
): [ElementQueries, (run: () => void) => void] => {
	const root = host.shadowRoot ?? host
	const dependencies: Set<string> = new Set()

	/**
	 * Get the first descendant element matching a selector
	 * If the element is a custom elements it will be added to dependencies
	 *
	 * @since 0.15.0
	 * @param {S} selector - Selector for element to check for
	 * @param {string} [required] - Optional reason for the assertion; if provided, throws on missing element
	 * @returns {ElementFromSelector<S> | undefined} First matching descendant element, or void if not found and not required
	 * @throws {MissingElementError} - Thrown when the element is required but not found
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
	 * Get all descendant elements matching a selector
	 * If any element is a custom element it will be added to dependencies
	 *
	 * @since 0.15.0
	 * @param {S} selector - Selector for elements to check for
	 * @param {string} [required] - Optional reason for the assertion; if provided, throws on missing elements
	 * @returns {ElementFromSelector<S>[]} All matching descendant elements
	 * @throws {MissingElementError} - Thrown when elements are required but not found
	 */
	function all<S extends string>(
		selector: S,
		required?: string,
	): Memo<ElementChanges<ElementFromSelector<S>>>
	function all<E extends Element>(
		selector: string,
		required?: string,
	): Memo<ElementChanges<E>>
	function all<S extends string>(
		selector: S,
		required?: string,
	): Memo<ElementChanges<ElementFromSelector<S>>> {
		const changes = observeSelectorChanges(root, selector)
		const targets = changes.get().current
		if (required != null && !targets.size)
			throw new MissingElementError(host, selector, required)
		if (targets.size)
			for (const target of targets) {
				// Only add to dependencies if element is a custom element that's not yet defined
				if (isNotYetDefinedComponent(target)) dependencies.add(target.localName)
			}
		return changes
	}

	/**
	 * Resolve dependencies and thereafter run the provided function
	 *
	 * @param {() => void} callback - Function to run after resolving dependencies
	 */
	const resolveDependencies = (callback: () => void) => {
		if (dependencies.size) {
			const deps = Array.from(dependencies)
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
				.catch(() => {
					// Error during setup of <${name}>. Trying to run effects anyway.
					callback()
				})
		} else {
			callback()
		}
	}

	return [{ first, all }, resolveDependencies]
}

export {
	type ElementChanges,
	type ElementFromKey,
	type ElementFromSelector,
	type ElementQueries,
	getWatchedElements,
	getHelpers,
	type UI,
}
