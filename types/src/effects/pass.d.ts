import type { Component, ComponentProps } from '../component';
import type { Effect, Reactive } from '../effects';
type PassedProp<T, P extends ComponentProps, E extends HTMLElement> = Reactive<T, P, E> | [Reactive<T, P, E>, (value: T) => void];
type PassedProps<P extends ComponentProps, Q extends ComponentProps> = {
    [K in keyof Q & string]?: PassedProp<Q[K], P, Component<Q>>;
};
/**
 * Effect for passing reactive values to a descendant component.
 *
 * **Le Truc targets (Slot-backed properties):** Replaces the backing signal of the
 * target's Slot, creating a live parent→child binding. The original signal is restored
 * on cleanup so the child can be safely detached and reattached.
 *
 * **Other custom elements (Object.defineProperty fallback):** Overrides the property
 * descriptor on the target instance with a reactive getter (and optional setter for
 * two-way binding). The original descriptor is restored on cleanup. In DEV_MODE, logs
 * a warning if the descriptor is non-configurable and the binding cannot be installed.
 *
 * Scope: custom elements only (elements whose `localName` contains a hyphen).
 * For plain HTML elements, use `setProperty()` instead.
 *
 * @since 0.15.0
 * @param {PassedProps<P, Q>} props - Reactive values to pass
 * @returns {Effect<P, Component<Q>>} Effect function that passes reactive values to the descendant component
 * @throws {InvalidCustomElementError} When the target element is not a valid custom element
 * @throws {InvalidReactivesError} When the provided reactives is not a record of signals, reactive property names or functions
 */
declare const pass: <P extends ComponentProps, Q extends ComponentProps>(props: PassedProps<P, Q> | ((target: Component<Q>) => PassedProps<P, Q>)) => Effect<P, Component<Q>>;
export { type PassedProp, type PassedProps, pass };
