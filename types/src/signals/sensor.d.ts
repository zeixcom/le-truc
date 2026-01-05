import { type Computed } from '@zeix/cause-effect';
import type { Component, ComponentProps } from '../component';
import { type ParserOrFallback } from '../parsers';
import type { ElementFromKey, UI } from '../ui';
type EventType<K extends string> = K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event;
type SensorHandler<T extends {}, Evt extends Event, U extends UI, E extends Element> = (context: {
    event: Evt;
    ui: U;
    target: E;
    prev: T;
}) => T | void | Promise<void>;
type SensorEvents<T extends {}, U extends UI, E extends Element> = {
    [K in keyof HTMLElementEventMap]?: SensorHandler<T, EventType<K>, U, E>;
};
/**
 * Create a computed signal from transformed event data
 *
 * @since 0.14.0
 * @param {ParserOrFallback<T, U>} init - Initial value, reader or parser
 * @param {K} key - Name of UI key
 * @param {SensorEvents<T, U, ElementFromKey<U, K>>} events - Transformation functions for events
 * @returns {Extractor<Computed<T>, C>} Extractor function for value from event
 */
declare const createSensor: <T extends {}, P extends ComponentProps, U extends UI, K extends keyof U & string>(init: ParserOrFallback<T, U>, key: K, events: SensorEvents<T, U, ElementFromKey<U, K>>) => ((ui: U & {
    host: Component<P>;
}) => Computed<T>);
export { createSensor, type SensorEvents };
