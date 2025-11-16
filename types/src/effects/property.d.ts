import type { ComponentProps } from '../component';
import { type Effect, type Reactive } from '../effects';
/**
 * Effect for setting a property on an element.
 * Sets the specified property directly on the element object.
 *
 * @since 0.8.0
 * @param {K} key - Name of the property to set
 * @param {Reactive<E[K], P>} reactive - Reactive value bound to the property value (defaults to property name)
 * @returns {Effect<P, E>} Effect function that sets the property on the element
 */
declare const setProperty: <P extends ComponentProps, K extends keyof E & string, E extends Element = HTMLElement>(key: K, reactive?: Reactive<E[K] & {}, P>) => Effect<P, E>;
/**
 * Effect for controlling element visibility by setting the 'hidden' property.
 * When the reactive value is true, the element is shown; when false, it's hidden.
 *
 * @since 0.13.1
 * @param {Reactive<boolean, P>} reactive - Reactive value bound to the visibility state
 * @returns {Effect<P, E>} Effect function that controls element visibility
 */
declare const show: <P extends ComponentProps, E extends HTMLElement = HTMLElement>(reactive: Reactive<boolean, P>) => Effect<P, E>;
export { setProperty, show };
