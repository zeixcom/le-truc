import type { ComponentProps } from '../component';
import { type Effect, type Reactive } from '../effects';
/**
 * Effect for calling a method on an element.
 *
 * @since 0.13.3
 * @param {K} methodName - Name of the method to call
 * @param {Reactive<boolean, P, E>} reactive - Reactive value bound to the method call
 * @param {unknown[]} args - Arguments to pass to the method
 * @returns Effect function that calls the method on the element
 */
declare const callMethod: <P extends ComponentProps, E extends HTMLElement, K extends keyof E & string>(methodName: K, reactive: Reactive<boolean, P, E>, args?: unknown[]) => Effect<P, E>;
/**
 * Effect for controlling element focus by calling the 'focus()' method.
 * If the reactive value is true, element will be focussed; when false, nothing happens.
 *
 * @since 0.13.3
 * @param {Reactive<boolean, P, E>} reactive - Reactive value bound to the focus state
 * @returns {Effect<P, E>} Effect function that sets element focus
 */
declare const focus: <P extends ComponentProps, E extends HTMLElement>(reactive: Reactive<boolean, P, E>) => Effect<P, E>;
export { callMethod, focus };
