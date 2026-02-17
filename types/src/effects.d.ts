import { type Cleanup, type MaybeCleanup, type Signal } from '@zeix/cause-effect';
import type { Component, ComponentProps } from './component';
import type { ElementFromKey, UI } from './ui';
type Effect<P extends ComponentProps, E extends Element> = (host: Component<P>, target: E) => MaybeCleanup;
type ElementEffects<P extends ComponentProps, E extends Element> = Effect<P, E> | Effect<P, E>[];
type Effects<P extends ComponentProps, U extends UI & {
    host: Component<P>;
}> = {
    [K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>>;
};
type Reactive<T, P extends ComponentProps, E extends Element> = keyof P | Signal<T & {}> | ((target: E) => T | null | undefined);
type UpdateOperation = 'a' | 'c' | 'd' | 'h' | 'm' | 'p' | 's' | 't';
type ElementUpdater<E extends Element, T> = {
    op: UpdateOperation;
    name?: string;
    read: (element: E) => T | null;
    update: (element: E, value: T) => void;
    delete?: (element: E) => void;
    resolve?: (element: E) => void;
    reject?: (error: unknown) => void;
};
declare const RESET: any;
/**
 * Run element effects
 *
 * @since 0.15.0
 * @param {U} host - Host component
 * @param {E} target - Target element
 * @param {ElementEffects<P, E>} effects - Effect functions to run
 * @returns {MaybeCleanup} - Cleanup function that runs collected cleanup functions
 * @throws {InvalidEffectsError} - If the effects are invalid
 */
declare const runElementEffects: <P extends ComponentProps, E extends Element>(host: Component<P>, target: E, effects: ElementEffects<P, E>) => MaybeCleanup;
/**
 * Run component effects
 *
 * @since 0.15.0
 * @param {ComponentUI<P, U>} ui - Component UI
 * @param {Effects<P, U>} effects - Effect functions to run
 * @returns {Cleanup} - Cleanup function that runs collected cleanup functions
 * @throws {InvalidEffectsError} - If the effects are invalid
 */
declare const runEffects: <P extends ComponentProps, U extends UI & {
    host: Component<P>;
}>(ui: U, effects: Effects<P, U>) => Cleanup;
/**
 * Resolve reactive property name, reader function or signal
 *
 * @param {Reactive<T, P, E>} reactive - Reactive property name, reader function or signal
 * @param {Component<P, U>} host - Component host element
 * @param {E} target - Element to resolve reactive value for
 * @param {string} [context] - Context for error logging
 * @returns {T} - Resolved reactive value
 */
declare const resolveReactive: <T extends {}, P extends ComponentProps, E extends Element>(reactive: Reactive<T, P, E>, host: Component<P>, target: E, context?: string) => T;
/**
 * Core effect function for updating element properties based on reactive values.
 * This function handles the lifecycle of reading, updating, and deleting element properties
 * while providing proper error handling and debugging support.
 *
 * @since 0.9.0
 * @param {Reactive<T, P, E>} reactive - The reactive value that drives the element updates
 * @param {ElementUpdater<E, T>} updater - Configuration object defining how to read, update, and delete the element property
 * @returns {Effect<P, E>} Effect function that manages the element property updates
 */
declare const updateElement: <T extends {}, P extends ComponentProps, E extends Element>(reactive: Reactive<T, P, E>, updater: ElementUpdater<E, T>) => Effect<P, E>;
export { type Effect, type Effects, type ElementEffects, type ElementUpdater, type Reactive, type UpdateOperation, runEffects, runElementEffects, resolveReactive, updateElement, RESET, };
