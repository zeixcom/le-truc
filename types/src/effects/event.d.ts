import type { Component, ComponentProps } from '../component';
import { type Effect, type Reactive } from '../effects';
import type { UI } from '../ui';
type EventType<K extends string> = K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event;
type EventHandler<P extends ComponentProps, E extends Element, Evt extends Event> = (context: {
    event: Evt;
    host: Component<P, UI>;
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
declare const on: <K extends keyof HTMLElementEventMap | string, P extends ComponentProps, E extends Element = HTMLElement>(type: K, handler: EventHandler<P, E, EventType<K>>, options?: AddEventListenerOptions | boolean) => Effect<P, E>;
/**
 * Effect for emitting custom events with reactive detail values.
 * Creates and dispatches CustomEvent instances with bubbling enabled by default.
 *
 * @since 0.13.3
 * @param {string} type - Event type to emit
 * @param {Reactive<T, P>} reactive - Reactive value bound to the event detail
 * @returns {Effect<P, E>} Effect function that emits custom events
 */
declare const emit: <T extends {}, P extends ComponentProps, E extends Element = HTMLElement>(type: string, reactive: Reactive<T, P>) => Effect<P, E>;
export { type EventHandler, type EventType, emit, on };
