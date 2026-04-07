import { type MaybeCleanup, type Memo, type Signal } from '@zeix/cause-effect';
import type { ComponentProps } from './component';
import { type Context } from './context';
import type { EffectDescriptor } from './effects';
/**
 * User-facing handler object for `watch()` with match branches.
 * `ok` receives the resolved value directly (not a tuple) for single-source `watch()`.
 * `err` receives a single Error (not an array) for convenience.
 */
type WatchHandlers<T> = {
    ok: (value: T) => MaybeCleanup | void;
    err?: (error: Error) => MaybeCleanup | void;
    nil?: () => MaybeCleanup | void;
};
/**
 * A single reactive value to pass to a descendant Le Truc component property.
 *
 * Three forms are accepted:
 * - `keyof P` — a string property name on the host
 * - `Signal<T>` — any signal
 * - `(host: HTMLElement & P) => T` — a reader function receiving the host
 */
type PassedProp<T, P extends ComponentProps> = keyof P | Signal<T & {}> | ((host: HTMLElement & P) => T);
/**
 * A map of child component property names to the reactive values to inject into them.
 * Passed as the second argument to `pass()`. Keys must be property names of the target component `Q`.
 */
type PassedProps<P extends ComponentProps, Q extends ComponentProps> = {
    [K in keyof Q & string]?: PassedProp<Q[K], P>;
};
/**
 * Events that do not bubble. When used as the `type` argument to `on()` with a Memo target,
 * event delegation cannot be used — per-element listeners are set up as a fallback instead.
 * In DEV_MODE, a warning is logged pointing toward the `each()` + `on()` pattern.
 */
declare const NON_BUBBLING_EVENTS: Set<string>;
/**
 * Create a `watch` helper bound to a specific component host.
 *
 * `watch` wraps `match` to create a reactive effect driven by explicitly declared
 * signal sources. Only the declared source signals trigger re-runs — other reads
 * inside the handler are not tracked. Returns an `EffectDescriptor`.
 *
 * @since 2.0
 * @param host - The component host element
 */
declare const makeWatch: <P extends ComponentProps>(host: HTMLElement & P) => {
    <K extends keyof P & string>(source: K, handler: (value: P[K]) => MaybeCleanup | void): EffectDescriptor;
    <K extends keyof P & string>(source: K, handlers: WatchHandlers<P[K]>): EffectDescriptor;
    <T extends {}>(source: Signal<T>, handler: (value: T) => MaybeCleanup | void): EffectDescriptor;
    <T extends {}>(source: Signal<T>, handlers: WatchHandlers<T>): EffectDescriptor;
    (source: Array<(keyof P & string) | Signal<any>>, handler: (values: any[]) => MaybeCleanup | void): EffectDescriptor;
};
/**
 * Create an `on` helper bound to a specific component host.
 *
 * `on` attaches an event listener to an element or a `Memo<Element[]>` collection.
 * The handler always receives `(event, element)` — a unified signature regardless
 * of target type. Returns an `EffectDescriptor`.
 *
 * For Memo targets, uses event delegation (single listener on the query root).
 * Non-bubbling events with Memo targets fall back to per-element listeners;
 * in DEV_MODE a warning is logged pointing toward `each()` + `on()`.
 *
 * @since 2.0
 * @param host - The component host element
 */
declare const makeOn: <P extends ComponentProps>(host: HTMLElement & P) => {
    <E extends Element, T extends keyof HTMLElementEventMap>(target: E, type: T, handler: (event: HTMLElementEventMap[T], element: E) => { [K in keyof P]?: P[K]; } | void, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element>(target: E, type: string, handler: (event: Event, element: E) => { [K in keyof P]?: P[K]; } | void, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element, T_1 extends keyof HTMLElementEventMap>(target: Memo<E[]>, type: T_1, handler: (event: HTMLElementEventMap[T_1], element: E) => { [K in keyof P]?: P[K]; } | void, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element>(target: Memo<E[]>, type: string, handler: (event: Event, element: E) => { [K in keyof P]?: P[K]; } | void, options?: AddEventListenerOptions): EffectDescriptor;
};
/**
 * Create a `pass` helper bound to a specific component host.
 *
 * `pass` passes reactive values to a descendant Le Truc component by swapping
 * its Slot-backed signals. The original signals are restored when the component
 * disconnects. Supports both single-element and `Memo<Element[]>` targets.
 *
 * For Memo targets, uses per-element lifecycle: signals are swapped when elements
 * enter the collection and restored when they leave.
 *
 * @since 2.0
 * @param host - The component host element
 */
declare const makePass: <P extends ComponentProps>(host: HTMLElement & P) => {
    <Q extends ComponentProps>(target: HTMLElement & Q, props: PassedProps<P, Q>): EffectDescriptor;
    <Q extends ComponentProps>(target: Memo<(HTMLElement & Q)[]>, props: PassedProps<P, Q>): EffectDescriptor;
};
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
declare const makeProvideContexts: <P extends ComponentProps>(host: HTMLElement & P) => (contexts: Array<keyof P>) => EffectDescriptor;
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
declare const makeRequestContext: <P extends ComponentProps>(host: HTMLElement & P) => <T extends {}>(context: Context<string, () => T>, fallback: T) => Memo<T>;
export { makeOn, makePass, makeProvideContexts, makeRequestContext, makeWatch, NON_BUBBLING_EVENTS, type PassedProp, type PassedProps, type WatchHandlers, };
