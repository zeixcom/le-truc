import type { Component, ComponentProps } from '../component';
import type { Effect, Reactive } from '../effects';
type PassedProp<T, P extends ComponentProps, E extends HTMLElement> = Reactive<T, P, E> | [Reactive<T, P, E>, (value: T) => void];
type PassedProps<P extends ComponentProps, Q extends ComponentProps> = {
    [K in keyof Q & string]?: PassedProp<Q[K], P, Component<Q>>;
};
/**
 * Effect for passing reactive values to a descendant Le Truc component
 * by replacing the backing signal of the target's Slot.
 *
 * No cleanup/restore is needed: when the parent unmounts, the child
 * is torn down as well. For re-parenting scenarios, use context instead.
 *
 * @since 0.15.0
 * @param {PassedProps<P, Q>} props - Reactive values to pass
 * @returns {Effect<P, Component<Q>>} Effect function that passes reactive values to the descendant component
 * @throws {InvalidCustomElementError} When the target element is not a valid custom element
 * @throws {InvalidReactivesError} When the provided reactives is not a record of signals, reactive property names or functions
 */
declare const pass: <P extends ComponentProps, Q extends ComponentProps>(props: PassedProps<P, Q> | ((target: Component<Q>) => PassedProps<P, Q>)) => Effect<P, Component<Q>>;
export { type PassedProp, type PassedProps, pass };
