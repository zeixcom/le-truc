import { type Computed } from '@zeix/cause-effect';
import type { Component, ComponentProps } from './component';
import { type ParserOrFallback } from './parsers';
import type { ElementFromKey, UI } from './ui';
type EventType<K extends string> = K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event;
type EventTransformer<T extends {}, Evt extends Event, U extends UI, E extends Element> = (context: {
    event: Evt;
    ui: U;
    target: E;
    value: T;
}) => T | void | Promise<void>;
type EventTransformers<T extends {}, U extends UI, E extends Element> = {
    [K in keyof HTMLElementEventMap]?: EventTransformer<T, EventType<K>, U, E>;
};
/**
 * Produce a computed signal from transformed event data
 *
 * @since 0.14.0
 * @param {S} key - name of UI key
 * @param {ParserOrFallback<T>} init - Initial value, reader or parser
 * @param {EventTransformers<T, ElementFromSelector<S>, C>} events - Transformation functions for events
 * @returns {Extractor<Computed<T>, C>} Extractor function for value from event
 */
declare const fromEvents: <T extends {}, P extends ComponentProps, U extends UI, K extends keyof U>(key: K, init: ParserOrFallback<T, U>, events: EventTransformers<T, U, ElementFromKey<U, K>>) => ((ui: U & {
    host: Component<P>;
}) => Computed<T>);
export { fromEvents };
