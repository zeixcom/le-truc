/** @see https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md */
import { type Signal } from '@zeix/cause-effect';
import type { ComponentProps, EffectDescriptor } from '../types';
/**
 * A context key.
 *
 * A context key can be any type of object, including strings and symbols. The
 *  Context type brands the key type with the `__context__` property that
 * carries the type of the value the context references.
 */
type Context<K, V> = K & {
    __context__: V;
};
/**
 * An unknown context type
 */
type UnknownContext = Context<unknown, unknown>;
/**
 * A helper type which can extract a Context value type from a Context type
 */
type ContextType<T extends UnknownContext> = T extends Context<infer _, infer V> ? V : never;
/**
 * A callback which is provided by a context requester and is called with the value satisfying the request.
 * This callback can be called multiple times by context providers as the requested value is changed.
 */
type ContextCallback<V> = (value: V, unsubscribe?: () => void) => void;
declare global {
    interface HTMLElementEventMap {
        /**
         * A 'context-request' event can be emitted by any element which desires
         * a context value to be injected by an external provider.
         */
        'context-request': ContextRequestEvent<UnknownContext>;
    }
}
/**
 * The `provideContexts` helper type in `FactoryContext`.
 *
 * Attaches a `context-request` listener to the host, providing the listed
 * property values as context to descendant consumers. Returns an `EffectDescriptor`.
 */
type ProvideContextsHelper<P extends ComponentProps> = (contexts: Array<keyof P>) => EffectDescriptor;
/**
 * The `requestContext` helper type in `FactoryContext`.
 *
 * Dispatches a `context-request` event from the host and returns a `Signal<T>`
 * that tracks the provider's value. Falls back to `fallback` if no provider responds.
 * For use inside `expose()` as a property initializer.
 */
type RequestContextHelper = <T extends {}>(context: Context<string, () => T>, fallback: T) => Signal<T>;
declare const CONTEXT_REQUEST = "context-request";
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
declare class ContextRequestEvent<T extends UnknownContext> extends Event {
    readonly context: T;
    readonly callback: ContextCallback<ContextType<T>>;
    readonly subscribe: boolean;
    constructor(context: T, callback: ContextCallback<ContextType<T>>, subscribe?: boolean);
}
/**
 * Create a typed context key.
 *
 * The Context type brands the key type with the `__context__` property that
 * carries the type of the value the context references. This helper function
 * creates a properly typed context key from a plain value.
 *
 * @since 2.0.2
 * @param {string} key - The context key (typically a string)
 * @returns {Context<string, V>} A typed context key
 *
 * @example
 * ```ts
 * const themeContext = createContext<() => string>('theme')
 * const countContext = createContext<() => number>('count')
 * ```
 */
declare const createContext: <V>(key: string) => Context<string, V>;
/**
 * Create a `provideContexts` helper bound to a specific component host.
 *
 * Returns a function that takes a `contexts` array and returns an `EffectDescriptor`.
 * When activated, attaches a `context-request` listener to `host`; provides a
 * getter `() => host[context]` for each matching context key.
 *
 * @since 2.0
 * @param {HTMLElement & P} host - The component host element
 * @returns {ProvideContextsHelper<P>} Bound `provideContexts` function for the given host
 */
declare const makeProvideContexts: <P extends ComponentProps>(host: HTMLElement & P) => ProvideContextsHelper<P>;
/**
 * Create a `requestContext` helper bound to a specific component host.
 *
 * Returns a function that dispatches a `context-request` event from `host`
 * and returns a `Slot<T>` that tracks the provider's value. If no provider
 * responds, the Slot delegates to a `State` holding `fallback`. For use inside
 * `expose()` as a property initializer.
 *
 * A provider may miss the initial synchronous dispatch if its
 * `customElements.define()` runs after the consumer's (bundle ordering,
 * code-splitting, deferred script) or its own `provideContexts` listener hasn't
 * activated yet (descriptors activate after dependency resolution — see ADR
 * 0007). The request is therefore re-dispatched once on a microtask (covers
 * providers upgraded later in the same bundle) and once after
 * {@link CONTEXT_RETRY_DELAY} (covers providers whose effect activation waited
 * on `customElements.whenDefined()`). When a provider answers late, the Slot's
 * backing signal is swapped (`slot.replace(createMemo(getter))`), so the
 * consumer's value switches from `fallback` to the provided value reactively —
 * no consumer code change required. If no provider ever answers, `fallback` is
 * permanent for that connection (and a `DEV_MODE` warning names the context
 * and host).
 *
 * The `Slot` is the same primitive `pass()` uses to override a child
 * component's reactive property: the backing signal is overridable, and
 * `replace()` invalidates all downstream subscribers without breaking existing
 * edges. The Slot's computation reads the delegated signal inside a tracking
 * context, so both the late-binding swap and the provider's live value updates
 * propagate from a single `slot.get()`.
 *
 * Resolved once per component lifetime, at first connect: `connectedCallback`
 * re-activates cached descriptors on reconnect but does not re-run the factory.
 *
 * @since 2.0
 * @param {HTMLElement & P} host - The component host element
 * @returns {RequestContextHelper} Bound `requestContext` function for the given host
 */
declare const makeRequestContext: <P extends ComponentProps>(host: HTMLElement & P) => RequestContextHelper;
export { CONTEXT_REQUEST, type Context, type ContextCallback, ContextRequestEvent, type ContextType, createContext, makeProvideContexts, makeRequestContext, type ProvideContextsHelper, type RequestContextHelper, type UnknownContext, };
