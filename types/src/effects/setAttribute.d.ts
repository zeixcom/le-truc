import type { ComponentProps } from '../component';
import { type Effect, type Reactive } from '../effects';
import type { UI } from '../ui';
/**
 * Effect for setting an attribute on an element.
 * Sets the specified attribute with security validation for unsafe values.
 *
 * @since 0.8.0
 * @param {string} name - Name of the attribute to set
 * @param {Reactive<string, P, E>} reactive - Reactive value bound to the attribute value (defaults to attribute name)
 * @returns {Effect<P, E>} Effect function that sets the attribute on the element
 */
declare const setAttribute: <P extends ComponentProps, U extends UI, E extends Element = HTMLElement>(name: string, reactive?: Reactive<string, P, E>) => Effect<P, U, E>;
/**
 * Effect for toggling a boolean attribute on an element.
 * When the reactive value is true, the attribute is present; when false, it's absent.
 *
 * @since 0.8.0
 * @param {string} name - Name of the attribute to toggle
 * @param {Reactive<boolean, P, E>} reactive - Reactive value bound to the attribute presence (defaults to attribute name)
 * @returns {Effect<P, E>} Effect function that toggles the attribute on the element
 */
declare const toggleAttribute: <P extends ComponentProps, U extends UI, E extends Element = HTMLElement>(name: string, reactive?: Reactive<boolean, P, E>) => Effect<P, U, E>;
export { setAttribute, toggleAttribute };
