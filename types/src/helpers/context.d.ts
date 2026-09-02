/** @see https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md */
import { type Signal } from '@zeix/cause-effect';
import type { ComponentProps, EffectDescriptor } from '../types';
/**
 * A context key. Can be any object, including a string or symbol. Brands
 * the key type with a `__context__` property carrying the value type.
 */
type Context<K, V> = K & {
    __context__: V;
};
/**
 * A context key of unknown type.
 */
type UnknownContext = Context<unknown, unknown>;
/**
 * Extracts the value type from a `Context` type.
 */
type ContextType<T extends UnknownContext> = T extends Context<infer _, infer V> ? V : never;
/**
 * Callback a context requester provides to receive the requested value. A
 * provider may call it again on later changes.
 */
type ContextCallback<V> = (value: V, unsubscribe?: () => void) => void;
declare global {
    interface HTMLElementEventMap {
        /**
         * Fired by an element that wants a context value from a provider.
         */
        'context-request': ContextRequestEvent<UnknownContext>;
    }
}
/**
 * The `provideContexts` helper type in `FactoryContext`. Attaches a
 * `context-request` listener to the host, providing the listed property
 * values as context to descendant consumers.
 */
type ProvideContextsHelper<P extends ComponentProps> = (contexts: Array<keyof P>) => EffectDescriptor;
/**
 * The `requestContext` helper type in `FactoryContext`. Dispatches a
 * `context-request` event from the host and returns a `Signal<T>` that
 * tracks the provider's value, falling back to `fallback` if no provider
 * responds. For use inside `expose()` as a property initializer.
 */
type RequestContextHelper = <T extends {}>(context: Context<string, () => T>, fallback: T) => Signal<T>;
declare const CONTEXT_REQUEST = "context-request";
/**
 * Event a context requester fires to ask for a named context.
 *
 * A provider inspects `context` to decide whether it can satisfy the
 * request, then calls `callback` with the value. If `subscribe` is true,
 * the provider may call `callback` again on later changes, passing an
 * `unsubscribe` function the requester can call to stop receiving updates.
 *
 * @property context - Context key
 * @property callback - Called with the value, and an unsubscribe function if subscribed
 * @property subscribe - Whether to subscribe to context changes
 */
declare class ContextRequestEvent<T extends UnknownContext> extends Event {
    readonly context: T;
    readonly callback: ContextCallback<ContextType<T>>;
    readonly subscribe: boolean;
    constructor(context: T, callback: ContextCallback<ContextType<T>>, subscribe?: boolean);
}
/**
 * Creates a typed context key from a plain string.
 *
 * @since 2.0.2
 * @param key - The context key
 * @returns A typed context key
 *
 * @example
 * ```ts
 * const themeContext = createContext<() => string>('theme')
 * const countContext = createContext<() => number>('count')
 * ```
 */
declare const createContext: <V>(key: string) => Context<string, V>;
/**
 * Creates a `provideContexts` helper bound to a specific component host.
 *
 * The returned function attaches a `context-request` listener to `host` and
 * provides a getter `() => host[context]` for each matching context key.
 *
 * @since 2.0
 * @param host - The component host element
 * @returns Bound `provideContexts` function for the given host
 */
declare const makeProvideContexts: <P extends ComponentProps>(host: HTMLElement & P) => ProvideContextsHelper<P>;
/**
 * Creates a `requestContext` helper bound to a specific component host.
 *
 * The returned function dispatches a `context-request` event from `host`
 * and returns a `Slot<T>` that tracks the provider's value, falling back to
 * `fallback` until a provider answers. For use inside `expose()` as a
 * property initializer.
 *
 * A provider may miss the initial dispatch if it defines or activates
 * later. The request is re-dispatched once on a microtask and once after
 * {@link CONTEXT_RETRY_DELAY} to cover both cases. If no provider ever
 * answers, `fallback` stays permanent and a `DEV_MODE` warning names the
 * context and host. See ADR 0007.
 *
 * Resolved once per component lifetime, at first connect.
 *
 * @since 2.0
 * @param host - The component host element
 * @returns Bound `requestContext` function for the given host
 */
declare const makeRequestContext: <P extends ComponentProps>(host: HTMLElement & P) => RequestContextHelper;
export { CONTEXT_REQUEST, type Context, type ContextCallback, ContextRequestEvent, type ContextType, createContext, makeProvideContexts, makeRequestContext, type ProvideContextsHelper, type RequestContextHelper, type UnknownContext, };
