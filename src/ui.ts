import type { Cleanup, MaybeCleanup } from '@zeix/cause-effect'
import type { Component, ComponentProps } from './component'
import { type Effects, runEffects } from './effects'
import { MissingElementError } from './errors'
import { isCustomElement, isElement } from './util'

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
type KnownTag<S extends string> = Lowercase<ExtractTag<S>> extends
	| keyof HTMLElementTagNameMap
	| keyof SVGElementTagNameMap
	| keyof MathMLElementTagNameMap
	? Lowercase<ExtractTag<S>>
	: never

// Map the selector string to the concrete element type.
// If we can't statically prove the tag is known, fall back to HTMLElement.
type ElementFromSelector<S extends string> = KnownTag<S> extends never
	? HTMLElement
	: KnownTag<S> extends keyof HTMLElementTagNameMap
		? HTMLElementTagNameMap[KnownTag<S>]
		: KnownTag<S> extends keyof SVGElementTagNameMap
			? SVGElementTagNameMap[KnownTag<S>]
			: KnownTag<S> extends keyof MathMLElementTagNameMap
				? MathMLElementTagNameMap[KnownTag<S>]
				: HTMLElement

type ElementUsage = {
	<S extends string>(selector: S, required: string): ElementFromSelector<S>
	<S extends string>(selector: S): ElementFromSelector<S> | null
	<E extends Element>(selector: string, required: string): E
	<E extends Element>(selector: string): E | null
}

type ElementsUsage = {
	<S extends string>(selector: S, required?: string): ElementFromSelector<S>[]
	<E extends Element>(selector: string, required?: string): E[]
}

type UI = Record<string, ElementUsage | ElementsUsage>

type ElementEffects<P extends ComponentProps> = {
	<S extends string>(
		selector: S,
		effects: Effects<P, ElementFromSelector<S>>,
		required?: string,
	): () => MaybeCleanup
	<E extends Element>(
		selector: string,
		effects: Effects<P, E>,
		required?: string,
	): () => MaybeCleanup
}

type Helpers<P extends ComponentProps> = {
	useElement: ElementUsage
	useElements: ElementsUsage
	first: ElementEffects<P>
	all: ElementEffects<P>
}

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
 * Observe a DOM subtree with a mutation observer
 *
 * @since 0.12.2
 * @param {ParentNode} parent - parent node
 * @param {string} selector - selector for matching elements to observe
 * @param {MutationCallback} callback - mutation callback
 * @returns {MutationObserver} - the created mutation observer
 */
const observeSubtree = (
	parent: ParentNode,
	selector: string,
	callback: MutationCallback,
): MutationObserver => {
	const observer = new MutationObserver(callback)
	const observerConfig: MutationObserverInit = {
		childList: true,
		subtree: true,
	}
	const observedAttributes = extractAttributes(selector)
	if (observedAttributes.length) {
		observerConfig.attributes = true
		observerConfig.attributeFilter = observedAttributes
	}
	observer.observe(parent, observerConfig)
	return observer
}

/**
 * Create partially applied helper functions to get descendants and run effects on them
 *
 * @since 0.14.0
 * @param {Component<P>} host - Host component
 * @returns {ElementSelectors<P>} - Helper functions for selecting descendants
 */
const getHelpers = <P extends ComponentProps>(
	host: Component<P>,
): [Helpers<P>, () => string[]] => {
	const root = host.shadowRoot ?? host
	const dependencies: Set<string> = new Set()

	/**
	 * Get the first descendant element matching a selector
	 * If the element is a custom elements it will be added to dependencies
	 *
	 * @since 0.14.0
	 * @param {S} selector - Selector for element to check for
	 * @param {string} [required] - Optional reason for the assertion; if provided, throws on missing element
	 * @returns {ElementFromSelector<S> | null} First matching descendant element, or null if not found and not required
	 * @throws {MissingElementError} - Thrown when the element is required but not found
	 */
	function useElement<S extends string>(
		selector: S,
		required: string,
	): ElementFromSelector<S>
	function useElement<S extends string>(
		selector: S,
	): ElementFromSelector<S> | null
	function useElement<E extends Element>(
		selector: string,
		required: string,
	): E
	function useElement<E extends Element>(selector: string): E | null
	function useElement<S extends string>(
		selector: S,
		required?: string,
	): ElementFromSelector<S> | null {
		const target = root.querySelector<ElementFromSelector<S>>(selector)
		if (required != null && !target)
			throw new MissingElementError(host, selector, required)
		// Only add to dependencies if element is a custom element that's not yet defined
		if (
			target &&
			isCustomElement(target) &&
			target.matches(':not(:defined)')
		)
			dependencies.add(target.localName)
		return target
	}

	/**
	 * Get all descendant elements matching a selector
	 * If any element is a custom element it will be added to dependencies
	 *
	 * @since 0.14.0
	 * @param {S} selector - Selector for elements to check for
	 * @param {string} [required] - Optional reason for the assertion; if provided, throws on missing elements
	 * @returns {ElementFromSelector<S>[]} All matching descendant elements
	 * @throws {MissingElementError} - Thrown when elements are required but not found
	 */
	function useElements<S extends string>(
		selector: S,
		required?: string,
	): ElementFromSelector<S>[]
	function useElements<E extends Element>(
		selector: string,
		required?: string,
	): E[]
	function useElements<S extends string>(
		selector: S,
		required?: string,
	): ElementFromSelector<S>[] {
		const targets = root.querySelectorAll<ElementFromSelector<S>>(selector)
		if (required != null && !targets.length)
			throw new MissingElementError(host, selector, required)
		if (targets.length)
			targets.forEach(target => {
				// Only add to dependencies if element is a custom element that's not yet defined
				if (isCustomElement(target) && target.matches(':not(:defined)'))
					dependencies.add(target.localName)
			})
		return Array.from(targets)
	}

	/**
	 * Apply effect functions to a first matching descendant within the custom element
	 * If the target element is a custom element, waits for it to be defined before running effects
	 *
	 * @since 0.14.0
	 * @param {S} selector - Selector to match descendant
	 * @param {Effects<P, E>} effects - Effect functions to apply
	 * @param {string} [required] - Optional reason for the assertion; if provided, throws on missing element
	 * @throws {MissingElementError} - Thrown when the element is required but not found
	 */
	const first = <
		S extends string,
		E extends Element = ElementFromSelector<S>,
	>(
		selector: S,
		effects: Effects<P, E>,
		required?: string,
	) => {
		const target =
			required != null
				? useElement(selector, required)
				: useElement(selector)
		return () => {
			if (target) return runEffects(effects, host, target as unknown as E)
		}
	}

	/**
	 * Apply effect functions to all matching descendant elements within the custom element
	 * If any target element is a custom element, waits for it to be defined before running effects
	 *
	 * @since 0.14.0
	 * @param {S} selector - Selector to match descendants
	 * @param {Effects<P, ElementFromSelector<S>>} effects - Effect functions to apply
	 * @param {string} [required] - Optional reason for the assertion; if provided, throws on missing element
	 * @throws {MissingElementError} - Thrown when the element is required but not found
	 */
	const all = <S extends string, E extends Element = ElementFromSelector<S>>(
		selector: S,
		effects: Effects<P, E>,
		required?: string,
	) => {
		const targets =
			required != null
				? useElements(selector, required)
				: useElements(selector)

		return () => {
			const cleanups = new Map<E, Cleanup>()

			const attach = (target: E) => {
				const cleanup = runEffects(effects, host, target)
				if (cleanup && !cleanups.has(target))
					cleanups.set(target, cleanup)
			}

			const detach = (target: E) => {
				const cleanup = cleanups.get(target)
				if (cleanup) cleanup()
				cleanups.delete(target)
			}

			const applyToMatching =
				(fn: (target: E) => void) => (node: Node) => {
					if (isElement(node)) {
						if (node.matches(selector)) fn(node as E)
						node.querySelectorAll<E>(selector).forEach(fn)
					}
				}

			const observer = observeSubtree(root, selector, mutations => {
				for (const mutation of mutations) {
					mutation.addedNodes.forEach(applyToMatching(attach))
					mutation.removedNodes.forEach(applyToMatching(detach))
				}
			})

			if (targets.length)
				(targets as unknown as NodeListOf<E>).forEach(attach)

			return () => {
				observer.disconnect()
				cleanups.forEach(cleanup => cleanup())
				cleanups.clear()
			}
		}
	}

	return [
		{ useElement, useElements, first, all },
		() => Array.from(dependencies),
	]
}

export { type Helpers, getHelpers, type UI }
