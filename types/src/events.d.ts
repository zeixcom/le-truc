import { type Memo, type Sensor } from '@zeix/cause-effect';
import type { ComponentProps } from './component';
import type { EffectDescriptor, Falsy } from './effects';
type EventType<K extends string> = K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event;
/**
 * Handler for a single event type inside `createEventsSensor`.
 *
 * Receives a context object with:
 * - `event` — the original DOM event (typed to the specific event type)
 * - `target` — the matched element (properly typed, unlike `event.target`)
 * - `prev` — the current sensor value before this event
 *
 * Return the new sensor value to update it, or `void` / `Promise<void>` to
 * leave the value unchanged.
 */
type SensorEventHandler<T extends {}, Evt extends Event, E extends Element> = (context: {
    event: Evt;
    target: E;
    prev: T;
}) => T | void | Promise<void>;
/**
 * Map of event type names to `SensorEventHandler` functions.
 * Each handler derives the new sensor value from the event, or returns `void` to leave it unchanged.
 */
type EventHandlers<T extends {}, E extends Element> = {
    [K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, E>;
};
/**
 * The `on` helper type in `FactoryContext`.
 *
 * Attaches an event listener. The handler always receives `(event, element)`.
 * For Memo targets, uses event delegation (or per-element fallback for non-bubbling events).
 */
type OnHelper<P extends ComponentProps> = {
    <E extends Element, T extends keyof HTMLElementEventMap>(target: E | Falsy, type: T, handler: (event: HTMLElementEventMap[T], element: E) => {
        [K in keyof P]?: P[K];
    } | void | Falsy, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element>(target: E | Falsy, type: string, handler: (event: Event, element: E) => {
        [K in keyof P]?: P[K];
    } | void | Falsy, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element, T extends keyof HTMLElementEventMap>(target: Memo<E[]> | Falsy, type: T, handler: (event: HTMLElementEventMap[T], element: E) => {
        [K in keyof P]?: P[K];
    } | void | Falsy, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element>(target: Memo<E[]> | Falsy, type: string, handler: (event: Event, element: E) => {
        [K in keyof P]?: P[K];
    } | void | Falsy, options?: AddEventListenerOptions): EffectDescriptor;
};
/**
 * Create a `Sensor<T>` driven by DOM events on a target element.
 *
 * Use this inside `expose()` as a property initializer when a single reactive
 * value should be derived from events on a specific element. The listener is
 * attached directly to `target`; the handler receives `{ event, target, prev }`.
 *
 * @since 2.0
 * @param {E} target - The element to listen on
 * @param {T} init - Initial value of the sensor
 * @param {EventHandlers<T, E>} events - Map of event type to handler function
 * @returns {Sensor<T>} Sensor that updates when matching events fire on target
 */
declare function createEventsSensor<T extends {}, E extends Element>(target: E, init: T, events: EventHandlers<T, E>): Sensor<T>;
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
    <E extends Element, T extends keyof HTMLElementEventMap>(target: E | Falsy, type: T, handler: (event: HTMLElementEventMap[T], element: E) => { [K in keyof P]?: P[K]; } | void | Falsy, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element>(target: E | Falsy, type: string, handler: (event: Event, element: E) => { [K in keyof P]?: P[K]; } | void | Falsy, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element, T_1 extends keyof HTMLElementEventMap>(target: Memo<E[]> | Falsy, type: T_1, handler: (event: HTMLElementEventMap[T_1], element: E) => { [K in keyof P]?: P[K]; } | void | Falsy, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element>(target: Memo<E[]> | Falsy, type: string, handler: (event: Event, element: E) => { [K in keyof P]?: P[K]; } | void | Falsy, options?: AddEventListenerOptions): EffectDescriptor;
};
export { createEventsSensor, type EventHandlers, type EventType, makeOn, type OnHelper, type SensorEventHandler, };
