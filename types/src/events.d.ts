import { type Sensor } from '@zeix/cause-effect';
import type { Component, ComponentProps } from './component';
import { type ParserOrFallback } from './parsers';
import type { UI } from './ui';
type EventType<K extends string> = K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event;
/**
 * Handler for a single event type inside `createEventsSensor` (v1.0 form).
 *
 * Receives a context object with:
 * - `event` — the original DOM event (typed to the specific event type)
 * - `ui` — the full component UI object
 * - `target` — the matched element (properly typed, unlike `event.target`)
 * - `prev` — the current sensor value before this event
 *
 * Return the new sensor value to update it, or `void` / `Promise<void>` to
 * leave the value unchanged.
 */
type SensorEventHandler<T extends {}, Evt extends Event, U extends UI, E extends Element> = (context: {
    event: Evt;
    ui: U;
    target: E;
    prev: T;
}) => T | void | Promise<void>;
/**
 * Map of event type names to `SensorEventHandler` functions, passed as the
 * third argument to `createEventsSensor` (v1.0 form). Each handler derives the
 * new sensor value from the event, or returns `void` to leave it unchanged.
 */
type EventHandlers<T extends {}, U extends UI, E extends Element> = {
    [K in keyof HTMLElementEventMap]?: SensorEventHandler<T, EventType<K>, U, E>;
};
/**
 * Handler for a single event type inside `createEventsSensor` (v1.1 form).
 *
 * Receives a context object with:
 * - `event` — the original DOM event (typed to the specific event type)
 * - `target` — the matched element (properly typed, unlike `event.target`)
 * - `prev` — the current sensor value before this event
 *
 * The `ui` field is dropped in the v1.1 form — elements are available in
 * the factory closure directly. Return the new value or `void` to leave unchanged.
 */
type SensorEventHandlerV2<T extends {}, Evt extends Event, E extends Element> = (context: {
    event: Evt;
    target: E;
    prev: T;
}) => T | void | Promise<void>;
/**
 * Map of event type names to `SensorEventHandlerV2` functions for the v1.1 form.
 */
type EventHandlersV2<T extends {}, E extends Element> = {
    [K in keyof HTMLElementEventMap]?: SensorEventHandlerV2<T, EventType<K>, E>;
};
/**
 * Create a `Sensor<T>` driven by DOM events on a target element (v1.1 form).
 *
 * Use this inside `expose()` as a property initializer when a single reactive
 * value should be derived from events on a specific element. The listener is
 * attached directly to `target`; the handler receives `{ event, target, prev }`.
 *
 * @since 1.1
 * @param {E} target - The element to listen on
 * @param {T} init - Initial value of the sensor
 * @param {EventHandlersV2<T, E>} events - Map of event type to handler function
 * @returns {Sensor<T>} Sensor that updates when matching events fire on target
 */
declare function createEventsSensor<T extends {}, E extends Element>(target: E, init: T, events: EventHandlersV2<T, E>): Sensor<T>;
/**
 * Create a `Reader` that produces a `Sensor<T>` driven by DOM events (v1.0 form).
 *
 * Use this as a reactive property initializer when a single state value should be
 * derived from multiple event types (e.g. combining `click` and `keyup` into a
 * `selected` value), instead of updating host properties imperatively via `on()`.
 *
 * Event listeners are attached to the host element using event delegation.
 * Each handler receives `{ event, ui, target, prev }` and returns the new value,
 * or `void`/`Promise<void>` to leave the value unchanged. Passive events are
 * deferred via `schedule()`.
 *
 * @since 0.16.0
 * @param {ParserOrFallback<T, U>} init - Initial value, static fallback, or reader function
 * @param {K} key - Key of the UI object whose element(s) to listen on
 * @param {EventHandlers<T, U, any>} events - Map of event type to handler function
 * @returns {(ui: U & { host: Component<P> }) => Sensor<T>} Reader that creates and returns the sensor
 */
declare function createEventsSensor<T extends {}, P extends ComponentProps, U extends UI, K extends keyof U>(init: ParserOrFallback<T, U>, key: K, events: EventHandlers<T, U, any>): (ui: U & {
    host: Component<P>;
}) => Sensor<T>;
export { createEventsSensor, type EventHandlers, type EventHandlersV2, type EventType, type SensorEventHandler, type SensorEventHandlerV2, };
