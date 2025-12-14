import { type Cleanup, isFunction, isString } from '@zeix/cause-effect'

import type { Component, ComponentProps } from './component'
import { type Fallback, getFallback, type Reader } from './parsers'
import type { UI } from './ui'

/** @see https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md */

/* === Types === */

/**
 * A context key.
 *
 * A context key can be any type of object, including strings and symbols. The
 *  Context type brands the key type with the `__context__` property that
 * carries the type of the value the context references.
 */
type Context<K, V> = K & { __context__: V }

/**
 * An unknown context type
 */
type UnknownContext = Context<unknown, unknown>

/**
 * A helper type which can extract a Context value type from a Context type
 */
type ContextType<T extends UnknownContext> =
	T extends Context<infer _, infer V> ? V : never

/**
 * A callback which is provided by a context requester and is called with the value satisfying the request.
 * This callback can be called multiple times by context providers as the requested value is changed.
 */
type ContextCallback<V> = (value: V, unsubscribe?: () => void) => void

declare global {
	interface HTMLElementEventMap {
		/**
		 * A 'context-request' event can be emitted by any element which desires
		 * a context value to be injected by an external provider.
		 */
		'context-request': ContextRequestEvent<UnknownContext>
	}
}

/* === Constants === */

const CONTEXT_REQUEST = 'context-request'

/* === Exported class === */

/**
 * Class for context-request events
 *
 * An event fired by a context requester to signal it desires a named context.
 *
 * A provider should inspect the `context` property of the event to determine if it has a value that can
 * satisfy the request, calling the `callback` with the requested value if so.
 *
 * If the requested context event contains a truthy `subscribe` value, then a provider can call the callback
 * multiple times if the value is changed, if this is the case the provider should pass an `unsubscribe`
 * function to the callback which requesters can invoke to indicate they no longer wish to receive these updates.
 *
 * @class ContextRequestEvent
 * @extends {Event}
 *
 * @property {T} context - context key
 * @property {ContextCallback<ContextType<T>>} callback - callback function for value getter and unsubscribe function
 * @property {boolean} [subscribe=false] - whether to subscribe to context changes
 */
class ContextRequestEvent<T extends UnknownContext> extends Event {
	readonly context: T
	readonly callback: ContextCallback<ContextType<T>>
	readonly subscribe: boolean

	constructor(
		context: T,
		callback: ContextCallback<ContextType<T>>,
		subscribe: boolean = false,
	) {
		super(CONTEXT_REQUEST, {
			bubbles: true,
			composed: true,
		})
		this.context = context
		this.callback = callback
		this.subscribe = subscribe
	}
}

/**
 * Provide a context for descendant component consumers
 *
 * @since 0.13.3
 * @param {Context<string, P[K]>[]} contexts - Array of contexts to provide
 * @returns {(host: Component<P>) => Cleanup} Function to add an event listener for ContextRequestEvent returning a cleanup function to remove the event listener
 */
const provideContexts =
	<P extends ComponentProps>(
		contexts: Array<keyof P>,
	): ((host: Component<P>) => Cleanup) =>
	(host: Component<P>) => {
		const listener = (e: ContextRequestEvent<UnknownContext>) => {
			const { context, callback } = e
			if (
				isString(context) &&
				contexts.includes(context as unknown as Extract<keyof P, string>) &&
				isFunction(callback)
			) {
				e.stopImmediatePropagation()
				callback(() => host[context])
			}
		}
		host.addEventListener(CONTEXT_REQUEST, listener)
		return () => host.removeEventListener(CONTEXT_REQUEST, listener)
	}

/**
 * Consume a context value for a component.
 *
 * @since 0.13.1
 * @param {Context<string, () => T>} context - Context key to consume
 * @param {Fallback<T, U>} fallback - Fallback value or fallback
 * @returns {Extractor<() => T, C>} Function that returns the consumed context getter or a signal of the fallback value
 */
const requestContext =
	<
		T extends {},
		P extends ComponentProps,
		U extends UI & { host: Component<P> },
	>(
		context: Context<string, () => T>,
		fallback: Fallback<T, U>,
	): Reader<() => T, U> =>
	(ui: U) => {
		let consumed = () => getFallback(ui, fallback)
		ui.host.dispatchEvent(
			new ContextRequestEvent(context, (getter: () => T) => {
				consumed = getter
			}),
		)
		return consumed
	}

export {
	type Context,
	type UnknownContext,
	type ContextType,
	CONTEXT_REQUEST,
	ContextRequestEvent,
	provideContexts,
	requestContext,
}
