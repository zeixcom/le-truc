import {
	type Cleanup,
	createMemo,
	isFunction,
	type Memo,
} from '@zeix/cause-effect'

import type { Component, ComponentProps } from './component'
import { asMethod, type Fallback, getFallback, type Reader } from './parsers'
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
 * Make reactive properties of this component available to descendant consumers via the context protocol.
 *
 * Returns a `MethodProducer` — use it as a property initializer in `defineComponent`.
 * It attaches a `context-request` listener to the host; when a matching request arrives,
 * it provides a getter `() => host[context]` to the requester.
 *
 * @since 0.13.3
 * @param {Array<keyof P>} contexts - Reactive property names to expose as context
 * @returns {(host: Component<P>) => Cleanup} MethodProducer that installs the listener and returns a cleanup function
 */
const provideContexts = <P extends ComponentProps>(
	contexts: Array<keyof P>,
): ((host: Component<P>) => Cleanup) =>
	asMethod((host: Component<P>) => {
		const listener = (e: ContextRequestEvent<UnknownContext>) => {
			const { context, callback } = e
			if (
				typeof context === 'string' &&
				contexts.includes(context as unknown as Extract<keyof P, string>) &&
				isFunction(callback)
			) {
				e.stopImmediatePropagation()
				callback(() => host[context])
			}
		}
		host.addEventListener(CONTEXT_REQUEST, listener)
		return () => host.removeEventListener(CONTEXT_REQUEST, listener)
	})

/**
 * Request a context value from an ancestor provider, returning a reactive `Memo<T>`.
 *
 * Use as a property initializer in `defineComponent`. During `connectedCallback`, dispatches
 * a `context-request` event that bubbles up the DOM. If an ancestor provider intercepts it,
 * the returned Memo reflects the provider's current value reactively. If no provider responds,
 * the Memo falls back to `fallback`.
 *
 * @since 0.15.0
 * @param {Context<string, () => T>} context - Context key to request
 * @param {Fallback<T, U & { host: Component<P> }>} fallback - Static value or reader function used when no provider is found
 * @returns {Reader<Memo<T>, U & { host: Component<P> }>} Reader that dispatches the request and wraps the result in a Memo
 */
const requestContext =
	<T extends {}, P extends ComponentProps, U extends UI>(
		context: Context<string, () => T>,
		fallback: Fallback<T, U & { host: Component<P> }>,
	): Reader<Memo<T>, U & { host: Component<P> }> =>
	(ui: U & { host: Component<P> }) => {
		let consumed = () => getFallback(ui, fallback)
		ui.host.dispatchEvent(
			new ContextRequestEvent(context, (getter: () => T) => {
				consumed = getter
			}),
		)
		return createMemo(consumed)
	}

export {
	type Context,
	type ContextCallback,
	type UnknownContext,
	type ContextType,
	CONTEXT_REQUEST,
	ContextRequestEvent,
	provideContexts,
	requestContext,
}
