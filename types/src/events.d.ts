import { type Sensor } from '@zeix/cause-effect';
import type { Component, ComponentProps } from './component';
import { type ParserOrFallback } from './parsers';
import type { ElementFromKey, UI } from './ui';
type EventType<K extends string> = K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event;
type EventHandler<T extends {}, Evt extends Event, U extends UI, E extends Element> = (context: {
    event: Evt;
    ui: U;
    target: E;
    prev: T;
}) => T | void | Promise<void>;
type EventHandlers<T extends {}, U extends UI, E extends Element> = {
    [K in keyof HTMLElementEventMap]?: EventHandler<T, EventType<K>, U, E>;
};
/**
 * Produce an event-driven sensor from transformed event data
 *
 * @since 0.16.0
 * @param {S} key - name of UI key
 * @param {ParserOrFallback<T>} init - Initial value, reader or parser
 * @param {EventHandlers<T, ElementFromSelector<S>, C>} events - Transformation functions for events
 * @returns {Extractor<Sensor<T>, C>} Extractor function for value from event
 */
declare const createEventsSensor: <T extends {}, P extends ComponentProps, U extends UI, K extends keyof U>(init: ParserOrFallback<T, U>, key: K, events: EventHandlers<T, U, ElementFromKey<U, K>>) => ((ui: U & {
    host: Component<P>;
}) => Sensor<T>);
export { createEventsSensor, type EventHandler, type EventHandlers, type EventType, };
