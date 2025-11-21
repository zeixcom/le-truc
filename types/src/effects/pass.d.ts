import type { Component, ComponentProps } from '../component';
import type { Effect, Reactive } from '../effects';
type PassedProp<T, P extends ComponentProps, E extends HTMLElement> = Reactive<T, P, E> | [Reactive<T, P, E>, (value: T) => void];
type PassedProps<P extends ComponentProps, Q extends ComponentProps> = {
    [K in keyof Q & string]?: PassedProp<Q[K], P, Component<Q>>;
};
/**
 * Effect for passing reactive values to a descendant Le Truc component.
 *
 * @since 0.15.0
 * @param {MutableReactives<Component<Q>, P>} props - Reactive values to pass
 * @returns {Effect<P, Component<Q>>} Effect function that passes reactive values to the descendant component
 * @throws {InvalidCustomElementError} When the target element is not a valid custom element
 * @throws {InvalidReactivesError} When the provided reactives is not a record of signals, reactive property names or functions
 * @throws {Error} When passing signals failed for some other reason
 */
declare const pass: <P extends ComponentProps, Q extends ComponentProps>(props: PassedProps<P, Q> | ((target: Component<Q>) => PassedProps<P, Q>)) => Effect<P, Component<Q>>;
export { type PassedProp, type PassedProps, pass };
