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
/**
 * Activate effects returned by the setup function inside a reactive scope.
 *
 * For Memo targets (from `all()`), wraps iteration in a `createEffect` so the
 * loop re-runs when elements are added or removed. For single Element targets
 * (from `first()`), runs effects directly in the scope.
 *
 * @since 0.15.0
 * @param {U} ui - Frozen UI object containing queried DOM elements and `host`
 * @param {Effects<P, U>} effects - Effects keyed by UI element name, returned by the setup function
 * @returns {Cleanup} Cleanup function that disposes the reactive scope and all child effects
 * @throws {InvalidEffectsError} If the effects argument is not a plain object
 */
declare const runEffects: <P extends ComponentProps, U extends UI & {
    host: Component<P>;
}>(ui: U, effects: Effects<P, U>) => Cleanup;
/**
 * Resolve a `Reactive<T>` to a concrete value inside a reactive tracking context.
 *
 * Handles all three forms of `Reactive<T>`:
 * - `keyof P` string → reads `host[name]` (registers signal dependency)
 * - `Signal<T>` → calls `.get()` (registers signal dependency)
 * - `(target: E) => T` → calls the reader function
 *
 * Returns `undefined` on error, which causes `updateElement` to restore the original DOM value.
 *
 * @param {Reactive<T, P, E>} reactive - Reactive property name, signal, or reader function
 * @param {Component<P>} host - The component host element
 * @param {E} target - The target element the effect operates on
 * @param {string} [context] - Description used in error log messages
 * @returns {T | undefined} Resolved value, or `undefined` if resolution failed
 */
declare const resolveReactive: <T extends {}, P extends ComponentProps, E extends Element>(reactive: Reactive<T, P, E>, host: Component<P>, target: E, context?: string) => T | undefined;
/**
 * Shared abstraction used by all built-in DOM effects.
 *
 * Captures the current DOM value as a fallback, then creates a `createEffect` that
 * re-runs whenever the reactive value changes. On each run:
 * - `undefined` → restore the original DOM value
 * - `null` → call `updater.delete` if available, else restore fallback
 * - anything else → call `updater.update` if the value changed
 *
 * @since 0.9.0
 * @param {Reactive<T, P, E>} reactive - Reactive value driving the DOM update (property name, signal, or reader function)
 * @param {ElementUpdater<E, T>} updater - Describes how to read, update, and optionally delete the DOM property
 * @returns {Effect<P, E>} Effect that manages the reactive DOM update and returns a cleanup function
 */
declare const updateElement: <T extends {}, P extends ComponentProps, E extends Element>(reactive: Reactive<T, P, E>, updater: ElementUpdater<E, T>) => Effect<P, E>;
export { type Effect, type Effects, type ElementEffects, type ElementUpdater, type Reactive, type UpdateOperation, runEffects, resolveReactive, updateElement };
