import { type Signal } from '@zeix/cause-effect';
import type { ComponentProps, EffectDescriptor, Falsy } from '../types';
type EventType<K extends string> = K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event;
/**
 * Handler for `on()`. Receives `(event, element)`.
 *
 * Return `{ prop: value }` to batch-apply updates to host properties
 * synchronously. Return `Promise<void>` for a fire-and-forget side effect;
 * the promise is not awaited and cannot update host properties.
 */
type OnEventHandler<P extends ComponentProps, Evt extends Event, E extends Element> = (event: Evt, element: E) => {
    [K in keyof P]?: P[K];
} | Falsy | void | Promise<void>;
/**
 * `on` helper bound to a component host. Accepts a single element or a
 * `Signal<E[]>` target, and typed event names.
 */
type OnHelper<P extends ComponentProps> = {
    <E extends Element, T extends keyof HTMLElementEventMap>(target: Signal<E[]> | Falsy, type: T, handler: OnEventHandler<P, HTMLElementEventMap[T], E>, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element>(target: Signal<E[]> | Falsy, type: string, handler: OnEventHandler<P, Event, E>, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element, T extends keyof HTMLElementEventMap>(target: E | Falsy, type: T, handler: OnEventHandler<P, HTMLElementEventMap[T], E>, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element>(target: E | Falsy, type: string, handler: OnEventHandler<P, Event, E>, options?: AddEventListenerOptions): EffectDescriptor;
};
/**
 * Creates an `on` helper bound to a component host.
 *
 * The returned `on` attaches a typed event listener to a single element or
 * a `Signal<E[]>` collection. Handlers receive `(event, element)`.
 * Returning `{ prop: value }` synchronously batch-applies those updates to
 * host properties; returning `Promise<void>` is valid for a fire-and-forget
 * side effect. For async state updates, use a trigger state and a `Task`:
 *
 * ```ts
 * const trigger = createState<FormData | null>(null)
 * on(form, 'submit', e => { e.preventDefault(); trigger.set(new FormData(form)) })
 * watch(createTask(async () => { ... trigger.get() ... }), { ok: ..., err: ... })
 * ```
 *
 * For `Signal<E[]>` targets, `on` delegates the event with one listener on
 * the shadow root or host. Non-bubbling events fall back to per-element
 * listeners, with a DEV_MODE warning pointing toward `each()` + `on()`.
 *
 * @since 2.0
 * @param host - The component host element
 * @returns Bound `on` function for the given host
 */
declare const makeOn: <P extends ComponentProps>(host: HTMLElement & P) => OnHelper<P>;
export { type EventType, makeOn, type OnEventHandler, type OnHelper };
