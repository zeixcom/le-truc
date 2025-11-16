import type { ComponentProps } from '../component';
import { type Effect, type Reactive } from '../effects';
import type { UI } from '../ui';
/**
 * Effect for setting the text content of an element.
 * Replaces all child nodes (except comments) with a single text node.
 *
 * @since 0.8.0
 * @param {Reactive<string, P, E>} reactive - Reactive value bound to the text content
 * @returns {Effect<P, U, E>} Effect function that sets the text content of the element
 */
declare const setText: <P extends ComponentProps, U extends UI, E extends Element>(reactive: Reactive<string, P, E>) => Effect<P, U, E>;
export { setText };
