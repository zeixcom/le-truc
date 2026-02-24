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
 * @since 0.14.0
 * @param {K} type - Event type (e.g. `'click'`, `'input'`)
 * @param {EventHandler<P, EventType<K>>} handler - Handler receiving the event
 * @param {AddEventListenerOptions} [options] - Listener options; `passive` is set automatically for high-frequency events
 * @returns {Effect<P, E>} Effect that attaches the listener and returns a cleanup function
 *
 * @example <caption>Side-effect-only handler</caption>
 * on('click', () => { analytics.track('button-clicked') })
 *
 * @example <caption>Property update shortcut</caption>
 * // Equivalent to: on('click', () => { host.count += 1 })
 * on('click', () => ({ count: host.count + 1 }))
 */
declare const on: <K extends keyof HTMLElementEventMap | string, P extends ComponentProps, E extends Element = HTMLElement>(type: K, handler: EventHandler<P, EventType<K>>, options?: AddEventListenerOptions) => Effect<P, E>;
export { type EventHandler, type EventType, on };
