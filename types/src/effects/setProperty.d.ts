import type { ComponentProps } from '../component';
import { type Effect, type Reactive } from '../effects';
import type { UI } from '../ui';
/**
 * Effect for setting a property on an element.
 * Sets the specified property directly on the element object.
 *
 * @since 0.8.0
 * @param {K} key - Name of the property to set
 * @param {Reactive<E[K], P, E>} reactive - Reactive value bound to the property value (defaults to property name)
 * @returns {Effect<P, U, E>} Effect function that sets the property on the element
 */
declare const setProperty: <P extends ComponentProps, U extends UI, K extends keyof E & string, E extends Element = HTMLElement>(key: K, reactive?: Reactive<E[K] & {}, P, E>) => Effect<P, U, E>;
/**
 * Effect for controlling element visibility by setting the 'hidden' property.
 * When the reactive value is true, the element is shown; when false, it's hidden.
 *
 * @since 0.13.1
 * @param {Reactive<boolean, P, E>} reactive - Reactive value bound to the visibility state
 * @returns {Effect<P, E>} Effect function that controls element visibility
 */
declare const show: <P extends ComponentProps, U extends UI, E extends HTMLElement = HTMLElement>(reactive: Reactive<boolean, P, E>) => Effect<P, U, E>;
export { setProperty, show };
