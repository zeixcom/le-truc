import type { ComponentProps } from '../component';
import type { Effect } from '../effects';
import type { EventType } from '../events';
/**
 * Event handler for use with `on()`.
 *
 * Two return modes are valid:
 * - **Side-effect only** — return `void` (or nothing). The component state is
 *   not automatically updated. This is always safe and is the right choice for
 *   handlers that call external APIs, dispatch custom events, etc.
 * - **Property update shortcut** — return a partial `{ [key: keyof P]: value }`
 *   object. All returned key/value pairs are applied to the host inside a single
 *   `batch()`, equivalent to writing `batch(() => { host.prop = value })` by hand.
 *   Use this when the handler's only job is to update one or more host properties.
 */
type EventHandler<P extends ComponentProps, Evt extends Event> = (event: Evt) => {
    [K in keyof P]?: P[K];
} | void | Promise<void>;
/**
 * Effect for attaching an event listener to a UI element.
 *
 * The handler receives the DOM event. Two return modes are valid:
 * - Return `void` for side-effect-only handlers (always correct).
 * - Return `{ prop: value }` as a shortcut for `batch(() => { host.prop = value })`.
 *   All returned entries are applied to the host in a single `batch()`.
 *
 * For passive events (scroll, resize, touch, wheel), execution is deferred
 * via `schedule()` to avoid blocking the main thread.
 *
 * Returns a cleanup function that removes the listener when the component disconnects.
 *
 * @deprecated Use the `on(target, type, handler)` helper from `FactoryContext` in the v1.1 factory form instead.
 * The factory helper returns an `EffectDescriptor` and receives `(event, element)` in its handler.
 * @since 0.14.0
 * @param {T} type - Event type (e.g. `'click'`, `'input'`)
 * @param {EventHandler<P, EventType<T>>} handler - Handler receiving the event
 * @param {AddEventListenerOptions} [options] - Listener options; `passive` is set automatically for high-frequency events
 * @returns {Effect<P, E>} Effect that attaches the listener and returns a cleanup function
 */
declare const on: <T extends keyof HTMLElementEventMap | string, P extends ComponentProps, E extends Element = HTMLElement>(type: T, handler: EventHandler<P, EventType<T>>, options?: AddEventListenerOptions) => Effect<P, E>;
export { type EventHandler, type EventType, on };
