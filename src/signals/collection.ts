import {
	batchSignalWrites,
	type Cleanup,
	type Collection,
	type CollectionCallback,
	DerivedCollection,
	HOOK_ADD,
	HOOK_CHANGE,
	HOOK_REMOVE,
	HOOK_SORT,
	HOOK_WATCH,
	type Hook,
	type HookCallback,
	type HookCallbacks,
	InvalidHookError,
	isEqual,
	isFunction,
	isHandledHook,
	isString,
	type KeyConfig,
	notifyWatchers,
	Ref,
	subscribeActiveWatcher,
	TYPE_COLLECTION,
	triggerHook,
	type Watcher,
} from '@zeix/cause-effect'
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
	#watchers = new Set<Watcher>()
	#signals = new Map<string, Ref<T>>()
	#hookCallbacks: HookCallbacks = {}
	#parent: ParentNode
	#selector: string
	#observer: MutationObserver | undefined
	#order: string[] = []
	#generateKey: (item: T) => string

	constructor(parent: ParentNode, selector: string, keyConfig?: KeyConfig<T>) {
		this.#parent = parent
		this.#selector = selector

		let keyCounter = 0
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
			const removedElements: T[] = []
			const addedKeys: string[] = []
			const changedKeys = new Set<string>()
			const removedKeys: string[] = []
			let changed = false

			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					const target = mutation.target as T
					if (isElement(target)) {
						// maybe observed match -> change
						const key = this.#keyFor(target)
						if (key) changedKeys.add(key)
					}
					if (mutation.addedNodes.length)
						// Maybe new matches in childList -> add
						addedElements.push(...findMatches(mutation.addedNodes))
					if (mutation.removedNodes.length)
						// Maybe removed matches in childList -> remove
						removedElements.push(...findMatches(mutation.removedNodes))
				} else if (mutation.type === 'attributes') {
					const target = mutation.target as T
					if (isElement(target)) {
						const key = this.#keyFor(target)
						const isMatching = target.matches(this.#selector)
						if (key && !isMatching) {
							// No longer matching -> remove
							this.#signals.delete(key)
							removedElements.push(target)
							removedKeys.push(key)
						} else if (key && isMatching) {
							// Still matching -> change
							changedKeys.add(key)
						} else if (!key && isMatching) {
							// Matching for the first time -> add
							const newKey = this.#generateKey(target)
							this.#signals.set(newKey, new Ref(target))
							addedElements.push(target)
							addedKeys.push(newKey)
						}
					}
				}
			}

			batchSignalWrites(() => {
				if (addedKeys.length || removedKeys.length) {
					changed = true
					if (addedKeys.length)
						triggerHook(this.#hookCallbacks[HOOK_ADD], addedKeys)
					if (removedKeys.length)
						triggerHook(this.#hookCallbacks[HOOK_REMOVE], removedKeys)
				}

				if (this.#hookCallbacks[HOOK_CHANGE]?.size) {
					triggerHook(this.#hookCallbacks[HOOK_CHANGE], Array.from(changedKeys))
					for (const key of changedKeys) {
						if (key) this.#signals.get(key)?.notify()
					}
				}

				const newOrder = Array.from(
					this.#parent.querySelectorAll<T>(this.#selector),
				)
					.map(element => this.#keyFor(element))
					.filter(key => key !== undefined)

				if (!isEqual(this.#order, newOrder)) {
					this.#order = newOrder
					changed = true
					triggerHook(this.#hookCallbacks[HOOK_SORT], newOrder)
				}

				if (changed) notifyWatchers(this.#watchers)
			})
		})

		const observerConfig: MutationObserverInit = this.#hookCallbacks[
			HOOK_CHANGE
		]?.size
			? {
					attributes: true,
					childList: true,
					subtree: true,
				}
			: {
					childList: true,
					subtree: true,
				}
		if (!this.#hookCallbacks[HOOK_CHANGE]?.size) {
			const observedAttributes = extractAttributes(this.#selector)
			if (observedAttributes.length) {
				observerConfig.attributes = true
				observerConfig.attributeFilter = observedAttributes
			}
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
		for (const key of this.#order) {
			const element = this.#signals.get(key)
			if (element) yield element
		}
	}

	keys(): IterableIterator<string> {
		return this.#order.values()
	}

	get(): T[] {
		subscribeActiveWatcher(this.#watchers, this.#hookCallbacks[HOOK_WATCH])
		if (!this.#observer) this.#observe()
		return this.#order
			.map(key => this.#signals.get(key)?.get())
			.filter(element => element !== undefined)
	}

	at(index: number): Ref<T> | undefined {
		return this.#signals.get(this.#order[index])
	}

	byKey(key: string): Ref<T> | undefined {
		return this.#signals.get(key)
	}

	keyAt(index: number): string | undefined {
		return this.#order[index]
	}

	indexOfKey(key: string): number {
		return this.#order.indexOf(key)
	}

	on(type: Hook, callback: HookCallback): Cleanup {
		if (
			isHandledHook(type, [
				HOOK_ADD,
				HOOK_CHANGE,
				HOOK_REMOVE,
				HOOK_SORT,
				HOOK_WATCH,
			])
		) {
			this.#hookCallbacks[type] ||= new Set()
			this.#hookCallbacks[type].add(callback)
			if (!this.#observer) this.#observe()
			return () => {
				this.#hookCallbacks[type]?.delete(callback)
			}
		}
		throw new InvalidHookError(TYPE_COLLECTION, type)
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
		subscribeActiveWatcher(this.#watchers, this.#hookCallbacks[HOOK_WATCH])
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
	keyConfig?: KeyConfig<ElementFromSelector<S>>,
): ElementCollection<ElementFromSelector<S>>
function createElementCollection<E extends Element>(
	parent: ParentNode,
	selector: string,
	keyConfig?: KeyConfig<E>,
): ElementCollection<E>
function createElementCollection<S extends string>(
	parent: ParentNode,
	selector: S,
	keyConfig?: KeyConfig<ElementFromSelector<S>>,
): ElementCollection<ElementFromSelector<S>> {
	return new ElementCollection(parent, selector, keyConfig)
}

export { createElementCollection, ElementCollection }
