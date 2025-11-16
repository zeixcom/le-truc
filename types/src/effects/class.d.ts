import type { ComponentProps } from '../component';
import { type Effect, type Reactive } from '../effects';
/**
 * Effect for toggling a CSS class token on an element.
 * When the reactive value is true, the class is added; when false, it's removed.
 *
 * @since 0.8.0
 * @param {string} token - CSS class token to toggle
 * @param {Reactive<boolean, P, E>} reactive - Reactive value bound to the class presence (defaults to class name)
 * @returns {Effect<P, U, E>} Effect function that toggles the class on the element
 */
declare const toggleClass: <P extends ComponentProps, E extends Element = HTMLElement>(token: string, reactive?: Reactive<boolean, P>) => Effect<P, E>;
export { toggleClass };
