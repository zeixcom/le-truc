/** @see https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md */

import {
	createMemo,
	createScope,
	isFunction,
	type Memo,
} from '@zeix/cause-effect'
import type { ComponentProps } from './component'
import type { EffectDescriptor } from './effects'

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

/**
 * The `provideContexts` helper type in `FactoryContext`.
 *
 * Attaches a `context-request` listener to the host, providing the listed
 * property values as context to descendant consumers. Returns an `EffectDescriptor`.
 */
type ProvideContextsHelper<P extends ComponentProps> = (
	contexts: Array<keyof P>,
) => EffectDescriptor

/**
 * The `requestContext` helper type in `FactoryContext`.
 *
 * Dispatches a `context-request` event from the host and returns a `Memo<T>`
 * that tracks the provider's value. Falls back to `fallback` if no provider responds.
 * For use inside `expose()` as a property initializer.
 */
type RequestContextHelper = <T extends {}>(
	context: Context<string, () => T>,
	fallback: T,
) => Memo<T>

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
 * Create a `provideContexts` helper bound to a specific component host.
 *
 * Returns a function that takes a `contexts` array and returns an `EffectDescriptor`.
 * When activated, attaches a `context-request` listener to `host`; provides a
 * getter `() => host[context]` for each matching context key.
 *
 * @since 2.0
 * @param host - The component host element
 */
const makeProvideContexts =
	<P extends ComponentProps>(host: HTMLElement & P) =>
	(contexts: Array<keyof P>): EffectDescriptor =>
	() =>
		createScope(() => {
			const listener = (e: ContextRequestEvent<UnknownContext>) => {
				const { context, callback } = e
				if (
					typeof context === 'string' &&
					contexts.includes(context as unknown as Extract<keyof P, string>) &&
					isFunction(callback)
				) {
					e.stopImmediatePropagation()
					callback(() => host[context as keyof P])
				}
			}
			host.addEventListener(CONTEXT_REQUEST, listener)
			return () => host.removeEventListener(CONTEXT_REQUEST, listener)
		})

/**
 * Create a `requestContext` helper bound to a specific component host.
 *
 * Returns a function that dispatches a `context-request` event from `host`
 * and wraps the resolved getter in a `Memo<T>`. If no provider responds,
 * the Memo returns `fallback`. For use inside `expose()` as a property initializer.
 *
 * @since 2.0
 * @param host - The component host element
 */
const makeRequestContext =
	<P extends ComponentProps>(host: HTMLElement & P) =>
	<T extends {}>(context: Context<string, () => T>, fallback: T): Memo<T> => {
		let consumed: () => T = () => fallback
		host.dispatchEvent(
			new ContextRequestEvent(context, (getter: () => T) => {
				consumed = getter
			}),
		)
		return createMemo(consumed)
	}

export {
	CONTEXT_REQUEST,
	type Context,
	type ContextCallback,
	ContextRequestEvent,
	type ContextType,
	makeProvideContexts,
	makeRequestContext,
	type ProvideContextsHelper,
	type RequestContextHelper,
	type UnknownContext,
}
