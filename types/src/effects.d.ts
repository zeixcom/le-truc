import { type Cleanup, type MaybeCleanup, type Signal } from '@zeix/cause-effect';
import type { Component, ComponentProps } from './component';
import type { ElementFromKey, UI } from './ui';
/**
 * A single effect function bound to a host component and a target element.
 * Returned by built-in effect factories (`setText`, `setAttribute`, `on`, etc.)
 * and by `updateElement`. May return a cleanup function that runs when the
 * component disconnects or when the target element is removed.
 */
type Effect<P extends ComponentProps, E extends Element> = (host: Component<P>, target: E) => MaybeCleanup;
/**
 * One or more effects for a single UI element.
 * The setup function may return a single `Effect` or an array of `Effect`s
 * for each key of the UI object.
 */
type ElementEffects<P extends ComponentProps, E extends Element> = Effect<P, E> | Effect<P, E>[];
/**
 * The return type of the `setup` function passed to `defineComponent`.
 * Keys correspond to keys of the UI object (queried elements and `host`);
 * values are one or more effects to run for that element.
 */
type Effects<P extends ComponentProps, U extends UI & {
    host: Component<P>;
}> = {
    [K in keyof U]?: ElementEffects<P, ElementFromKey<U, K>>;
};
/**
 * A reactive value driving a DOM update inside an `updateElement` effect.
 *
 * Three forms are accepted:
 * - `keyof P` — a string property name on the host; reads `host[name]` and
 *   registers it as a signal dependency automatically.
 * - `Signal<T>` — any signal; `.get()` is called inside the effect.
 * - `(target: E) => T | null | undefined` — a reader function receiving the
 *   target element; return `null` to delete the DOM value, `undefined` to
 *   restore the original fallback captured at setup time.
 */
type Reactive<T, P extends ComponentProps, E extends Element> = keyof P | Signal<T & {}> | ((target: E) => T | null | undefined);
/**
 * Operation code used internally by `updateElement` for debug logging.
 *
 * | Code | Operation      |
 * |------|----------------|
 * | `a`  | attribute      |
 * | `c`  | CSS class      |
 * | `d`  | dataset        |
 * | `h`  | innerHTML      |
 * | `m`  | method call    |
 * | `p`  | property       |
 * | `s`  | style property |
 * | `t`  | text content   |
 */
type UpdateOperation = 'a' | 'c' | 'd' | 'h' | 'm' | 'p' | 's' | 't';
/**
 * Descriptor passed to `updateElement` that defines how to read, update, and
 * optionally delete a single DOM property or attribute.
 *
 * - `read` — captures the current DOM value as the fallback at setup time.
 * - `update` — called with the resolved reactive value when it changes.
 * - `delete` — called when the reactive returns `null` (removes the value).
 * - `resolve` / `reject` — optional lifecycle hooks for debug instrumentation.
 */
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
export { type Effect, type Effects, type ElementEffects, type ElementUpdater, type Reactive, type UpdateOperation, runEffects, resolveReactive, updateElement, };
