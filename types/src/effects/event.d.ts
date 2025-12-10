import type { Component, ComponentProps } from '../component';
import { type Effect } from '../effects';
type EventType<K extends string> = K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event;
type EventHandler<P extends ComponentProps, E extends Element, Evt extends Event> = (context: {
    event: Evt;
    host: Component<P>;
    target: E;
}) => {
    [K in keyof P]?: P[K];
} | void | Promise<void>;
/**
 * Effect for attaching an event listener to an element.
 * Provides proper cleanup when the effect is disposed.
 *
 * @since 0.14.0
 * @param {K} type - Event type
 * @param {EventHandler<P, E, EventType<K>>} handler - Event handler function
 * @param {AddEventListenerOptions | boolean} options - Event listener options
 * @returns {Effect<ComponentProps, E>} Effect function that manages the event listener
 */
declare const on: <K extends keyof HTMLElementEventMap | string, P extends ComponentProps, E extends Element = HTMLElement>(type: K, handler: EventHandler<P, E, EventType<K>>, options?: AddEventListenerOptions) => Effect<P, E>;
export { type EventHandler, type EventType, on };
