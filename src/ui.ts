import { DependencyTimeoutError, MissingElementError } from './errors'
import { type Collection, createCollection } from './signals/collection'
import { isNotYetDefinedComponent } from './util'

/* === Types === */

// Pull the part before the first ".", "#", ":", or "[".
type ExtractTag<S extends string> = S extends `${infer T}.${string}`
	? T
	: S extends `${infer T}#${string}`
		? T
		: S extends `${infer T}:${string}`
			? T
			: S extends `${infer T}[${string}`
				? T
				: S

// Normalize to lowercase and ensure it's a known HTML tag.
type KnownTag<S extends string> =
	Lowercase<ExtractTag<S>> extends
		| keyof HTMLElementTagNameMap
		| keyof SVGElementTagNameMap
		| keyof MathMLElementTagNameMap
		? Lowercase<ExtractTag<S>>
		: never

// Map the selector string to the concrete element type.
// If we can't statically prove the tag is known, fall back to HTMLElement.
type ElementFromSelector<S extends string> =
	KnownTag<S> extends never
		? HTMLElement
		: KnownTag<S> extends keyof HTMLElementTagNameMap
			? HTMLElementTagNameMap[KnownTag<S>]
			: KnownTag<S> extends keyof SVGElementTagNameMap
				? SVGElementTagNameMap[KnownTag<S>]
				: KnownTag<S> extends keyof MathMLElementTagNameMap
					? MathMLElementTagNameMap[KnownTag<S>]
					: HTMLElement

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
	): Collection<ElementFromSelector<S>>
	<E extends Element>(selector: string, required?: string): Collection<E>
}
type UI = Record<string, Element | Collection<Element>>

type ElementFromKey<U extends UI, K extends keyof U> = NonNullable<
	U[K] extends Collection<infer E extends Element>
		? E
		: U[K] extends Element
			? U[K]
			: never
>

type ElementQueries = {
	first: FirstElement
	all: AllElements
}

/* === Constants === */

const DEPENDENCY_TIMEOUT = 50

/* === Exported Functions === */

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
	): Collection<ElementFromSelector<S>>
	function all<E extends Element>(
		selector: string,
		required?: string,
	): Collection<E>
	function all<S extends string>(
		selector: S,
		required?: string,
	): Collection<ElementFromSelector<S>> {
		const collection = createCollection(root, selector)
		const targets = collection.get()
		if (required != null && !targets.length)
			throw new MissingElementError(host, selector, required)
		if (targets.length)
			targets.forEach(target => {
				// Only add to dependencies if element is a custom element that's not yet defined
				if (isNotYetDefinedComponent(target))
					dependencies.add(target.localName)
			})
		return collection
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
	type ElementFromKey,
	type ElementFromSelector,
	type ElementQueries,
	getHelpers,
	type UI,
}
