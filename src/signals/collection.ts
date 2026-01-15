import {
	batch,
	type Collection,
	type CollectionCallback,
	DerivedCollection,
	isEqual,
	isFunction,
	isString,
	notifyOf,
	Ref,
	subscribeTo,
	TYPE_COLLECTION,
} from '@zeix/cause-effect'
import type { ListOptions } from '@zeix/cause-effect/types/src/classes/list'
import type { ElementFromSelector } from '../ui'
import { isElement } from '../util'

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

/* === Class === */

class ElementCollection<T extends Element> implements Collection<T> {
	#signals = new Map<string, Ref<T>>()
	#parent: ParentNode
	#selector: string
	#observer: MutationObserver | undefined
	#keys: string[] = []
	#generateKey: (item: T) => string

	constructor(
		parent: ParentNode,
		selector: string,
		options?: ListOptions<T[]>,
	) {
		this.#parent = parent
		this.#selector = selector

		let keyCounter = 0
		const keyConfig = options?.keyConfig
		this.#generateKey = isString(keyConfig)
			? () => `${keyConfig}${keyCounter++}`
			: isFunction<string>(keyConfig)
				? (element: T) => keyConfig(element)
				: () => String(keyCounter++)
	}

	#keyFor(element: T): string | undefined {
		for (const [key, signal] of this.#signals) {
			if (signal.get() === element) return key
		}
		return undefined
	}

	#observe() {
		Array.from(this.#parent.querySelectorAll<T>(this.#selector)).forEach(
			element => {
				const key = this.#generateKey(element)
				this.#signals.set(key, new Ref(element))
			},
		)

		const findMatches = (nodes: NodeList) => {
			const elements = Array.from(nodes).filter(isElement)
			const found: T[] = []
			for (const element of elements) {
				if (element.matches(this.#selector)) found.push(element as T)
				found.push(...Array.from(element.querySelectorAll<T>(this.#selector)))
			}
			return found
		}

		this.#observer = new MutationObserver(mutations => {
			const addedElements: T[] = []
			const changedKeys = new Set<string>()
			const removedKeys: string[] = []
			let changed = false

			for (const mutation of mutations) {
				const target = mutation.target as T

				if (mutation.type === 'childList') {
					// Maybe observed match -> change
					if (isElement(target)) {
						const key = this.#keyFor(target)
						if (key) changedKeys.add(key)
					}

					// Maybe new matches in childList -> add
					if (mutation.addedNodes.length)
						addedElements.push(...findMatches(mutation.addedNodes))

					// Maybe removed matches in childList -> remove
					if (mutation.removedNodes.length)
						removedKeys.push(
							...findMatches(mutation.removedNodes)
								.map(this.#keyFor)
								.filter(v => v !== undefined),
						)
				} else if (mutation.type === 'attributes') {
					if (!isElement(target)) continue

					const key = this.#keyFor(target)
					const isMatching = target.matches(this.#selector)

					// No longer matching -> remove
					if (key && !isMatching) removedKeys.push(key)
					// Still matching -> change
					else if (key && isMatching) changedKeys.add(key)
					// Matching for the first time -> add
					else if (!key && isMatching) addedElements.push(target)
				}
			}

			if (addedElements.length) {
				changed = true
				for (const element of addedElements) {
					const key = this.#generateKey(element)
					this.#signals.set(key, new Ref(element))
				}
			}

			if (removedKeys.length) {
				changed = true
				for (const key of removedKeys) {
					this.#signals.delete(key)
				}
			}

			const newKeys = Array.from(
				this.#parent.querySelectorAll<T>(this.#selector),
			)
				.map(element => this.#keyFor(element))
				.filter(key => key !== undefined)

			if (!isEqual(this.#keys, newKeys)) {
				this.#keys = newKeys
				changed = true
			}

			batch(() => {
				for (const key of changedKeys) {
					if (key) this.#signals.get(key)?.notify()
				}

				if (changed) notifyOf(this)
			})
		})

		const observerConfig: MutationObserverInit = {
			childList: true,
			subtree: true,
		}
		const observedAttributes = extractAttributes(this.#selector)
		if (observedAttributes.length) {
			observerConfig.attributes = true
			observerConfig.attributeFilter = observedAttributes
		}
		this.#observer.observe(this.#parent, observerConfig)
	}

	get [Symbol.toStringTag](): 'Collection' {
		return TYPE_COLLECTION
	}

	get [Symbol.isConcatSpreadable](): true {
		return true
	}

	*[Symbol.iterator](): IterableIterator<Ref<T>> {
		for (const key of this.#keys) {
			const element = this.#signals.get(key)
			if (element) yield element
		}
	}

	keys(): IterableIterator<string> {
		subscribeTo(this)
		if (!this.#observer) this.#observe()
		return this.#keys.values()
	}

	get(): T[] {
		subscribeTo(this)
		if (!this.#observer) this.#observe()
		return this.#keys
			.map(key => this.#signals.get(key)?.get())
			.filter(element => element !== undefined)
	}

	at(index: number): Ref<T> | undefined {
		return this.#signals.get(this.#keys[index])
	}

	byKey(key: string): Ref<T> | undefined {
		return this.#signals.get(key)
	}

	keyAt(index: number): string | undefined {
		return this.#keys[index]
	}

	indexOfKey(key: string): number {
		return this.#keys.indexOf(key)
	}

	deriveCollection<R extends {}>(
		callback: (sourceValue: T) => R,
	): DerivedCollection<R, T>
	deriveCollection<R extends {}>(
		callback: (sourceValue: T, abort: AbortSignal) => Promise<R>,
	): DerivedCollection<R, T>
	deriveCollection<R extends {}>(
		callback: CollectionCallback<R, T>,
	): DerivedCollection<R, T> {
		return new DerivedCollection(this, callback)
	}

	get length(): number {
		subscribeTo(this)
		if (!this.#observer) this.#observe()
		return this.#signals.size
	}
}

/* === Exported Functions === */

/**
 * Create a collection of elements from a parent node and a CSS selector.
 *
 * @since 0.15.0
 * @param parent - The parent node to search within
 * @param selector - The CSS selector to match elements
 * @returns A collection signal of elements
 */
function createElementCollection<S extends string>(
	parent: ParentNode,
	selector: S,
	options?: ListOptions<ElementFromSelector<S>[]>,
): ElementCollection<ElementFromSelector<S>>
function createElementCollection<E extends Element>(
	parent: ParentNode,
	selector: string,
	options?: ListOptions<E[]>,
): ElementCollection<E>
function createElementCollection<S extends string>(
	parent: ParentNode,
	selector: S,
	options?: ListOptions<ElementFromSelector<S>[]>,
): ElementCollection<ElementFromSelector<S>> {
	return new ElementCollection(parent, selector, options)
}

export { createElementCollection, ElementCollection }
