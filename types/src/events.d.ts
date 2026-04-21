import { type Memo } from '@zeix/cause-effect';
import type { ComponentProps } from './component';
import type { EffectDescriptor, Falsy } from './effects';
type EventType<K extends string> = K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event;
/**
 * Handler for `on()`. Receives `(event, element)`.
 *
 * Return `{ prop: value }` to batch-apply updates to host properties (sync only).
 * Return `Promise<void>` for fire-and-forget side effects — the Promise is not awaited
 * and its value cannot update host properties.
 */
type OnEventHandler<P extends ComponentProps, Evt extends Event, E extends Element> = (event: Evt, element: E) => {
    [K in keyof P]?: P[K];
} | Falsy | void | Promise<void>;
/**
 * `on` helper bound to a component host. Accepts a single element or `Memo<E[]>` target
 * and typed event names. Returns an `EffectDescriptor`.
 */
type OnHelper<P extends ComponentProps> = {
    <E extends Element, T extends keyof HTMLElementEventMap>(target: Memo<E[]> | Falsy, type: T, handler: OnEventHandler<P, HTMLElementEventMap[T], E>, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element>(target: Memo<E[]> | Falsy, type: string, handler: OnEventHandler<P, Event, E>, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element, T extends keyof HTMLElementEventMap>(target: E | Falsy, type: T, handler: OnEventHandler<P, HTMLElementEventMap[T], E>, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element>(target: E | Falsy, type: string, handler: OnEventHandler<P, Event, E>, options?: AddEventListenerOptions): EffectDescriptor;
};
/**
 * Create an `on` helper bound to a component host.
 *
 * The returned `on` attaches a typed event listener to a single element or `Memo<E[]>`
 * collection. Handlers receive `(event, element)`. Returning `{ prop: value }` synchronously
 * batch-applies those updates to host properties; returning `Promise<void>` is valid for
 * fire-and-forget side effects. For async state updates use a trigger-state + `Task`:
 *
 * ```ts
 * const trigger = createState<FormData | null>(null)
 * return [
 *   on(form, 'submit', e => { e.preventDefault(); trigger.set(new FormData(form)) }),
 *   watch(createTask(async () => { ... trigger.get() ... }), { ok: ..., err: ... }),
 * ]
 * ```
 *
 * For `Memo<E[]>` targets, uses event delegation (one listener on the shadow root or host).
 * Non-bubbling events fall back to per-element listeners; a DEV_MODE warning points toward
 * `each()` + `on()`.
 *
 * @since 2.0
 * @param {HTMLElement & P} host - The component host element
 * @returns {OnHelper<P>} Bound `on` function for the given host
 */
declare const makeOn: <P extends ComponentProps>(host: HTMLElement & P) => OnHelper<P>;
export { type EventType, makeOn, type OnEventHandler, type OnHelper };
