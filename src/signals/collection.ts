import {
	type Cleanup,
	isString,
	isSymbol,
	type MaybeCleanup,
	notify,
	subscribe,
	type Watcher,
} from '@zeix/cause-effect'
import type { ElementFromSelector } from '../ui'
import { hasMethod, isElement } from '../util'

/* === Types === */

type CollectionListener<E extends Element> = (changes: E[]) => void

interface Collection<E extends Element> {
	readonly [Symbol.toStringTag]: 'Collection'
	readonly [Symbol.isConcatSpreadable]: true
	[Symbol.iterator](): IterableIterator<E>
	[n: number]: E
	get(): E[]
	on(type: 'add' | 'remove', listener: CollectionListener<E>): Cleanup
	readonly length: number
}

/* === Constants === */

const TYPE_COLLECTION = 'Collection'

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
 * Create a collection of elements from a parent node and a CSS selector.
 *
 * @since 0.15.0
 * @param parent - The parent node to search within
 * @param selector - The CSS selector to match elements
 * @returns A collection signal of elements
 */
const createCollection = <S extends string, E extends ElementFromSelector<S>>(
	parent: ParentNode,
	selector: S,
): Collection<E> => {
	const watchers: Set<Watcher> = new Set()
	const listeners = {
		add: new Set<CollectionListener<E>>(),
		remove: new Set<CollectionListener<E>>(),
	}
	let elements: E[] = []
	let observer: MutationObserver | undefined
	let cleanup: MaybeCleanup

	const filterMatches = (elements: NodeList) =>
		Array.from(elements)
			.filter(isElement)
			.filter(element => element.matches(selector)) as E[]

	const notifyListeners = (
		listeners: Set<CollectionListener<E>>,
		elements: E[],
	) => {
		Object.freeze(elements) // Immutable snapshot of changed elements
		for (const listener of listeners) listener(elements)
	}

	const observe = () => {
		elements = Array.from(parent.querySelectorAll<E>(selector))

		observer = new MutationObserver(([mutation]) => {
			if (
				!watchers.size &&
				!listeners.add.size &&
				!listeners.remove.size
			) {
				if (cleanup) cleanup()
				return
			}

			const added = filterMatches(mutation.addedNodes)
			const removed = filterMatches(mutation.removedNodes)
			if (added.length) {
				notifyListeners(listeners.add, added)
				elements = Array.from(parent.querySelectorAll<E>(selector))
			}
			if (removed.length) {
				notifyListeners(listeners.remove, removed)
				for (const element of removed) {
					const index = elements.indexOf(element)
					if (index !== -1) elements.splice(index, 1)
				}
			}
			if (added.length || removed.length) notify(watchers)
		})
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

		cleanup = () => {
			if (observer) observer.disconnect()
			cleanup = undefined
		}
	}

	const collection = {} as Collection<E>
	Object.defineProperties(collection, {
		[Symbol.toStringTag]: {
			value: TYPE_COLLECTION,
		},
		[Symbol.isConcatSpreadable]: {
			value: true,
		},
		[Symbol.iterator]: {
			value: function* () {
				for (const element of elements) yield element
			},
		},
		get: {
			value: () => {
				subscribe(watchers)
				if (!observer) observe()
				return elements
			},
		},
		on: {
			value: (
				type: 'add' | 'remove',
				listener: CollectionListener<E>,
			) => {
				const listenerSet = listeners[type]
				if (!listenerSet)
					throw new TypeError(
						`Invalid change notification type: ${type}`,
					)
				listenerSet.add(listener)
				if (!observer) observe()
				return () => listenerSet.delete(listener)
			},
		},
		length: {
			get: () => {
				subscribe(watchers)
				if (!observer) observe()
				return elements.length
			},
		},
	})

	return new Proxy(collection, {
		get(target, prop) {
			if (prop in target) return Reflect.get(target, prop)
			if (isSymbol(prop)) return undefined

			// Handle numeric indices
			const index = Number(prop)
			if (Number.isInteger(index)) return elements[index]

			// Reflect array methods from the elements array
			if (isString(prop) && hasMethod(elements, prop)) {
				const method = elements[prop]
				return (...args: unknown[]) => {
					subscribe(watchers)
					if (!observer) observe()
					return method.apply(elements, args)
				}
			}

			return undefined
		},
		has(target, prop) {
			if (prop in target) return true
			if (Number.isInteger(Number(prop))) return !!elements[Number(prop)]
			return isString(prop) && hasMethod(elements, prop)
		},
		ownKeys(target) {
			const staticKeys = Reflect.ownKeys(target)
			const indexes = Object.keys(elements).map(key => String(key))
			return [...new Set([...indexes, ...staticKeys])]
		},
		getOwnPropertyDescriptor(target, prop) {
			if (prop in target)
				return Reflect.getOwnPropertyDescriptor(target, prop)

			const element = elements[Number(prop)]
			return element
				? {
						enumerable: true,
						configurable: true,
						writable: true,
						value: element,
					}
				: undefined
		},
	})
}

/**
 * Check if a value is a collection signal
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a collection signal, false otherwise
 */
const isCollection = <E extends Element = Element>(
	value: unknown,
): value is Collection<E> =>
	Object.prototype.toString.call(value) === `[object Collection]`

export {
	type Collection,
	type CollectionListener,
	TYPE_COLLECTION,
	createCollection,
	isCollection,
}
