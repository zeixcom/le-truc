import { type MaybeCleanup, type Memo, type Signal } from '@zeix/cause-effect';
import type { ComponentProps } from './component';
/**
 * A deferred effect: a thunk that, when called inside a reactive scope, creates
 * a reactive effect and returns an optional cleanup function.
 *
 * Effect descriptors are returned by `run()`, `on()`, `each()`, `pass()`, and
 * `provideContexts()`. They are activated after dependency resolution, not
 * immediately when the factory function runs.
 */
type EffectDescriptor = () => MaybeCleanup;
/**
 * The return value of the factory function.
 *
 * A flat array of effect descriptors (and optional falsy guards for conditional
 * effects). Falsy values (`false`, `undefined`) are filtered out before activation,
 * enabling the `element && run(...)` conditional pattern.
 */
type FactoryResult = Array<EffectDescriptor | false | undefined>;
/**
 * User-facing handler object for `watch()` with match branches.
 * `ok` receives the resolved value directly (not a tuple) for single-source `watch()`.
 * `err` receives a single Error (not an array) for convenience.
 */
type WatchHandlers<T> = {
    ok: (value: T) => MaybeCleanup;
    err?: (error: Error) => MaybeCleanup;
    nil?: () => MaybeCleanup;
};
/**
 * A reactive value that drives a DOM update or a slot injection.
 *
 * Three forms are accepted:
 * - `keyof P` — a string property name on the host; reads `host[name]` and
 *   registers it as a signal dependency automatically.
 * - `Signal<T>` — any signal; `.get()` is called inside the reactive effect.
 * - `() => T | Promise<T> | null | undefined` — a thunk wrapped in `createComputed`;
 *   all signals read inside are tracked in the pure phase. Returning `null` or
 *   `undefined` drives the `nil` path; an async thunk becomes a `Task` signal.
 */
type Reactive<T, P extends ComponentProps> = keyof P | Signal<T & {}> | (() => T | Promise<T> | null | undefined);
/**
 * A map of child component property names to the reactive values to inject into them.
 * Passed as the second argument to `pass()`. Keys must be property names of the target component `Q`.
 */
type PassedProps<P extends ComponentProps, Q extends ComponentProps> = {
    [K in keyof Q & string]?: Reactive<Q[K], P>;
};
/**
 * The `watch` helper type in `FactoryContext`.
 *
 * Drives a reactive effect from a signal source (property name, Signal, thunk,
 * or array). Only the declared sources trigger re-runs — incidental reads inside
 * the handler are not tracked. Returns an `EffectDescriptor`.
 *
 * Thunk form `() => T` is wrapped in `createComputed`, so all signals read inside
 * it are tracked in the pure phase — useful for deriving or transforming values
 * before the side-effectful handler runs.
 */
type WatchHelper<P extends ComponentProps> = {
    <K extends keyof P & string>(source: K, handler: (value: P[K]) => MaybeCleanup): EffectDescriptor;
    <K extends keyof P & string>(source: K, handlers: WatchHandlers<P[K]>): EffectDescriptor;
    <T extends {}>(source: Signal<T>, handler: (value: T) => MaybeCleanup): EffectDescriptor;
    <T extends {}>(source: Signal<T>, handlers: WatchHandlers<T>): EffectDescriptor;
    <T extends {}>(source: () => T | Promise<T> | null | undefined, handler: (value: T) => MaybeCleanup): EffectDescriptor;
    <T extends {}>(source: () => T | Promise<T> | null | undefined, handlers: WatchHandlers<T>): EffectDescriptor;
    (source: Array<Reactive<NonNullable<unknown>, P>>, handler: (values: any[]) => MaybeCleanup): EffectDescriptor;
};
/**
 * The `pass` helper type in `FactoryContext`.
 *
 * Passes reactive values to a descendant Le Truc component's Slot-backed signals.
 * Supports single-element and Memo targets (per-element lifecycle for Memo).
 */
type PassHelper<P extends ComponentProps> = {
    <Q extends ComponentProps>(target: HTMLElement & Q, props: PassedProps<P, Q>): EffectDescriptor;
    <Q extends ComponentProps>(target: Memo<(HTMLElement & Q)[]>, props: PassedProps<P, Q>): EffectDescriptor;
};
/**
 * Create a `watch` helper bound to a specific component host.
 *
 * `watch` wraps `match` to create a reactive effect driven by explicitly declared
 * signal sources. Only the declared source signals trigger re-runs — other reads
 * inside the handler are not tracked. Returns an `EffectDescriptor`.
 *
 * @since 2.0
 * @param host - The component host element
 */
declare const makeWatch: <P extends ComponentProps>(host: HTMLElement & P) => {
    <K extends keyof P & string>(source: K, handler: (value: P[K]) => MaybeCleanup): EffectDescriptor;
    <K extends keyof P & string>(source: K, handlers: WatchHandlers<P[K]>): EffectDescriptor;
    <T extends {}>(source: Signal<T>, handler: (value: T) => MaybeCleanup): EffectDescriptor;
    <T extends {}>(source: Signal<T>, handlers: WatchHandlers<T>): EffectDescriptor;
    <T extends {}>(source: () => T | Promise<T> | null | undefined, handler: (value: T) => MaybeCleanup): EffectDescriptor;
    <T extends {}>(source: () => T | Promise<T> | null | undefined, handlers: WatchHandlers<T>): EffectDescriptor;
    (source: Array<Reactive<NonNullable<unknown>, P>>, handler: (values: any[]) => MaybeCleanup): EffectDescriptor;
};
/**
 * Create a `pass` helper bound to a specific component host.
 *
 * `pass` passes reactive values to a descendant Le Truc component by swapping
 * its Slot-backed signals. The original signals are restored when the component
 * disconnects. Supports both single-element and `Memo<Element[]>` targets.
 *
 * For Memo targets, uses per-element lifecycle: signals are swapped when elements
 * enter the collection and restored when they leave.
 *
 * @since 2.0
 * @param host - The component host element
 */
declare const makePass: <P extends ComponentProps>(host: HTMLElement & P) => {
    <Q extends ComponentProps>(target: HTMLElement & Q, props: PassedProps<P, Q>): EffectDescriptor;
    <Q extends ComponentProps>(target: Memo<(HTMLElement & Q)[]>, props: PassedProps<P, Q>): EffectDescriptor;
};
/**
 * Create per-element reactive effects from a `Memo<Element[]>`.
 *
 * When elements enter the collection, their effects are created in a per-element
 * scope; when they leave, their effects are disposed with that scope.
 *
 * The callback receives a single element and returns a `FactoryResult` (array of
 * `EffectDescriptor`s) or a single `EffectDescriptor` (single-descriptor shortcut).
 *
 * @since 2.0
 */
declare function each<E extends Element>(memo: Memo<E[]>, callback: (element: E) => FactoryResult): EffectDescriptor;
declare function each<E extends Element>(memo: Memo<E[]>, callback: (element: E) => EffectDescriptor): EffectDescriptor;
export { type EffectDescriptor, each, type FactoryResult, makePass, makeWatch, type PassedProps, type PassHelper, type Reactive, type WatchHandlers, type WatchHelper, };
