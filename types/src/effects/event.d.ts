import type { ComponentProps } from '../component';
import type { Effect } from '../effects';
import type { EventType } from '../events';
type EventHandler<P extends ComponentProps, Evt extends Event> = (event: Evt) => {
    [K in keyof P]?: P[K];
} | void | Promise<void>;
/**
 * Effect for attaching an event listener to a UI element.
 *
 * The handler receives the DOM event and may return a partial property update object
 * `{ [key: keyof P]: value }`. If it does, all updates are applied to the host in a
 * `batch()`. For passive events (scroll, resize, touch, wheel), execution is deferred
 * via `schedule()` to avoid blocking the main thread.
 *
 * Returns a cleanup function that removes the listener when the component disconnects.
 *
 * @since 0.14.0
 * @param {K} type - Event type (e.g. `'click'`, `'input'`)
 * @param {EventHandler<P, EventType<K>>} handler - Handler receiving the event; may return `{ prop: value }` to update host properties
 * @param {AddEventListenerOptions} [options] - Listener options; `passive` is set automatically for high-frequency events
 * @returns {Effect<P, E>} Effect that attaches the listener and returns a cleanup function
 */
declare const on: <K extends keyof HTMLElementEventMap | string, P extends ComponentProps, E extends Element = HTMLElement>(type: K, handler: EventHandler<P, EventType<K>>, options?: AddEventListenerOptions) => Effect<P, E>;
export { type EventHandler, type EventType, on };
