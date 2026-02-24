import type { Component, ComponentProps } from '../component';
import type { Effect, Reactive } from '../effects';
type PassedProp<T, P extends ComponentProps, E extends HTMLElement> = Reactive<T, P, E>;
type PassedProps<P extends ComponentProps, Q extends ComponentProps> = {
    [K in keyof Q & string]?: PassedProp<Q[K], P, Component<Q>>;
};
/**
 * Effect for passing reactive values to a descendant Le Truc component.
 *
 * Replaces the backing signal of the target's Slot, creating a live
 * parent→child binding. The original signal is captured and restored when the
 * parent disconnects, so the child regains its own independent state after
 * detachment.
 *
 * Scope: Le Truc components only (targets whose properties are Slot-backed).
 * For non-Le Truc custom elements or plain HTML elements, use `setProperty()`
 * instead — it goes through the element's public setter and is always correct
 * regardless of the child's internal framework.
 *
 * @since 0.15.0
 * @param {PassedProps<P, Q>} props - Reactive values to pass
 * @returns {Effect<P, Component<Q>>} Effect function that passes reactive values to the descendant component
 * @throws {InvalidCustomElementError} When the target element is not a valid custom element
 * @throws {InvalidReactivesError} When the provided reactives is not a record of signals, reactive property names or functions
 */
declare const pass: <P extends ComponentProps, Q extends ComponentProps>(props: PassedProps<P, Q> | ((target: Component<Q>) => PassedProps<P, Q>)) => Effect<P, Component<Q>>;
export { type PassedProp, type PassedProps, pass };
