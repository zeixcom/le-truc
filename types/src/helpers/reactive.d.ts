import { type MaybeCleanup, type MaybePromise, type Memo, type Signal, type SingleMatchHandlers, type SlotDescriptor } from '@zeix/cause-effect';
import type { ComponentProps, EffectDescriptor, FactoryResult, Falsy } from '../types';
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
 *
 * Prefer the read-only thunk (`() => host.prop`) and the mediated
 * `{ get, set }` descriptor forms. The property-key and bare-writable-signal
 * forms are deprecated; they warn in DEV_MODE and will be removed in the next major.
 */
type PassedProps<P extends ComponentProps, Q extends ComponentProps> = {
    [K in keyof Q & string]?: Reactive<Q[K], P> | SlotDescriptor<Q[K] & {}>;
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
    <K extends keyof P & string>(source: K, handler: (value: P[K]) => MaybePromise<MaybeCleanup>): EffectDescriptor;
    <K extends keyof P & string>(source: K, handlers: SingleMatchHandlers<P[K]>): EffectDescriptor;
    <T extends {}>(source: Signal<T>, handler: (value: T) => MaybePromise<MaybeCleanup>): EffectDescriptor;
    <T extends {}>(source: Signal<T>, handlers: SingleMatchHandlers<T>): EffectDescriptor;
    <T extends {}>(source: () => T | Promise<T> | null | undefined, handler: (value: T) => MaybePromise<MaybeCleanup>): EffectDescriptor;
    <T extends {}>(source: () => T | Promise<T> | null | undefined, handlers: SingleMatchHandlers<T>): EffectDescriptor;
    (source: Array<Reactive<NonNullable<unknown>, P>>, handler: (values: any[]) => MaybePromise<MaybeCleanup>): EffectDescriptor;
};
/**
 * The `pass` helper type in `FactoryContext`.
 *
 * Passes reactive values to a descendant Le Truc component's Slot-backed signals.
 * Supports single-element and Memo targets (per-element lifecycle for Memo).
 *
 * The property-key (`'value'`) and bare-writable-signal (`someState`) forms are
 * deprecated — they hand the child unrestricted `.set()` on the parent's signal
 * (ADR-0012) and warn in DEV_MODE. Migrate to the behavior-preserving descriptor:
 *
 * ```ts
 * // before (deprecated) — child can write freely
 * pass(child, { value: parentSignal })
 * // after — child writes are mediated by the parent
 * pass(child, { value: { get: parentSignal.get, set: parentSignal.set } })
 * ```
 *
 * For read-only access use the thunk: `pass(child, { value: () => host.value })`.
 * Both deprecated forms are removed in the next major.
 */
type PassHelper<P extends ComponentProps> = {
    <Q extends ComponentProps>(target: (HTMLElement & Q) | Falsy, props: PassedProps<P, Q>): EffectDescriptor;
    <Q extends ComponentProps>(target: Memo<(HTMLElement & Q)[]> | Falsy, props: PassedProps<P, Q>): EffectDescriptor;
};
/**
 * Recursively activate a `FactoryResult` array of effect descriptors.
 *
 * Nested arrays are flattened; falsy values are skipped. Each truthy descriptor
 * is called immediately so its reactive effects register in the current scope.
 *
 * @since 2.0
 * @param {FactoryResult} result - Flat or nested array of effect descriptors to activate
 */
declare const activateResult: (result: FactoryResult) => void;
/**
 * Create a `watch` helper bound to a specific component host.
 *
 * `watch` wraps `match` to create a reactive effect driven by explicitly declared
 * signal sources. Only the declared source signals trigger re-runs — other reads
 * inside the handler are not tracked. Returns an `EffectDescriptor`.
 *
 * @since 2.0
 * @param {HTMLElement & P} host - The component host element
 * @returns {WatchHelper<P>} Bound `watch` function for the given host
 */
declare const makeWatch: <P extends ComponentProps>(host: HTMLElement & P) => WatchHelper<P>;
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
 * The property-key and bare-writable-signal short forms are deprecated:
 * They grant the child unrestricted `.set()` on the parent's signal.
 * In DEV_MODE `pass()` emits a warning for each writable binding:
 *
 * > `pass() received a writable signal for '<prop>'. Use () => host.<prop> for read-only access, or { get, set } to mediate writes.`
 *
 * The migration is behavior-preserving:
 * `pass(child, { value: sig })` → `pass(child, { value: { get: sig.get, set: sig.set } })`,
 * or for read-only access `pass(child, { value: () => host.value })`. The
 * deprecated forms are removed in the next major.
 *
 * @since 2.0
 * @param {HTMLElement & P} host - The component host element
 * @returns {PassHelper<P>} Bound `pass` function for the given host
 */
declare const makePass: <P extends ComponentProps>(host: HTMLElement & P) => PassHelper<P>;
/**
 * Create per-element reactive effects from a `Memo<Element[]>`.
 *
 * When elements enter the collection, their effects are created in a per-element
 * scope; when they leave, their effects are disposed with that scope.
 *
 * The callback receives a single element and returns a `FactoryResult` (array of
 * `EffectDescriptor`s) or a single `EffectDescriptor` (single-descriptor shortcut).
 * Falsy values can also be returned to skip conditionally.
 *
 * @since 2.0
 */
declare function each<E extends Element>(memo: Memo<E[]>, callback: (element: E) => FactoryResult | EffectDescriptor | Falsy): EffectDescriptor;
export { activateResult, type EffectDescriptor, each, type FactoryResult, type Falsy, makePass, makeWatch, type PassedProps, type PassHelper, type Reactive, type WatchHelper, };
