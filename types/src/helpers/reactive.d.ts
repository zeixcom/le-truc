import { type Collection, type List, type MaybeCleanup, type MaybePromise, type Memo, type MutableSignal, type Signal, type SingleMatchHandlers, type SlotDescriptor } from '@zeix/cause-effect';
import type { ComponentProp, ComponentProps, EffectDescriptor, FactoryResult, Falsy } from '../types';
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
 * `Q`'s own bound is only `HTMLElement` — not `ComponentProps` — because a target's
 * element type (e.g. `FormAssociatedElement & FormTextboxProps`) may mix in
 * interfaces with nullable native members (`form: HTMLFormElement | null`), which
 * would make the whole intersection fail a `Record<string, {}>`-style constraint.
 * Instead, `keyof Q & ComponentProp` does the filtering: it keeps only the
 * author-exposed reactive props (excluding native `HTMLElement` members and
 * reserved words) regardless of what else `Q` mixes in.
 *
 * Prefer the read-only thunk (`() => host.prop`) and the mediated
 * `{ get, set }` descriptor forms. The property-key and bare-writable-signal
 * forms are deprecated; they warn in DEV_MODE and will be removed in the next major.
 */
type PassedProps<P extends ComponentProps, Q extends HTMLElement> = {
    [K in keyof Q & ComponentProp]?: Reactive<Q[K], P> | SlotDescriptor<Q[K] & {}>;
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
    <Q extends HTMLElement>(target: Q | Falsy, props: PassedProps<P, Q>): EffectDescriptor;
    <Q extends HTMLElement>(target: Memo<Q[]> | Falsy, props: PassedProps<P, Q>): EffectDescriptor;
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
 * Recursively flatten a `FactoryResult` (or a single descriptor, or a falsy
 * value), invoking `visit` for each descriptor not already present in `seen`
 * (checked by reference).
 *
 * Reconciles the legacy explicit-`return` form with descriptors already
 * pushed into the active collector by `watch()`/`on()`/`pass()`/`each()`
 * (ADR 0018) — a descriptor produced by one of those helpers is pushed
 * whether or not it's also `return`ed, so it must only be visited once. A
 * manually-constructed `EffectDescriptor` that bypasses every helper (never
 * pushed anywhere) is not in `seen` and is still visited — the explicit
 * `FactoryResult` return type has always allowed authoring one directly,
 * without going through `watch()`/`on()`/`pass()`/`each()`, so this remains
 * the one path such a descriptor can be picked up by.
 *
 * @since 2.3
 * @param {FactoryResult | EffectDescriptor | Falsy} result - Flat or nested array, single descriptor, or falsy value to reconcile
 * @param {ReadonlySet<EffectDescriptor>} seen - Descriptors already accounted for (by reference) — skipped
 * @param {(descriptor: EffectDescriptor) => void} visit - Called once per not-yet-seen descriptor, in encounter order
 */
declare const forEachUnseen: (result: FactoryResult | EffectDescriptor | Falsy, seen: ReadonlySet<EffectDescriptor>, visit: (descriptor: EffectDescriptor) => void) => void;
/**
 * Drive per-element scopes from a `Memo<E[]>` with element-identity keying.
 *
 * Elements entering the collection get a scope created by `mount`; elements
 * leaving get exactly their own scope disposed. Surviving elements are
 * untouched across re-runs. All remaining scopes are disposed when the
 * enclosing owner (component scope) is disposed.
 *
 * Two ownership details are load-bearing:
 * - Per-element scopes use `{ root: true }` — a plain `createScope` inside the
 *   effect would register its dispose on the effect, which runs all cleanups
 *   before every re-run, silently reproducing wholesale rebuild.
 * - The outer `createScope` wrapper registers on the component scope; its
 *   returned cleanup is the only thing that tears down still-live root-scoped
 *   element scopes on component disconnect.
 *
 * @since 2.2
 * @param {Memo<E[]>} memo - Memo of the current element collection
 * @param {(element: E) => MaybeCleanup} mount - Called once per entering element inside its scope; a returned cleanup registers on that scope
 */
declare const keyedScopes: <E extends object>(memo: Memo<E[]>, mount: (element: E) => MaybeCleanup) => void;
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
 * Elements entering the collection get their own scope; when they leave,
 * that scope — and everything registered in it — is disposed.
 *
 * The callback can call `watch()`, `on()`, and `pass()` directly instead of
 * returning them; each call registers against that element's scope. A
 * callback that calls `each()` again (e.g. rows containing columns) gets its
 * own nested scope the same way. Returning descriptors still works and isn't
 * double-activated if you also call them directly.
 *
 * @since 2.0
 */
declare function each<E extends Element>(memo: Memo<E[]>, callback: (element: E) => FactoryResult | EffectDescriptor | Falsy): EffectDescriptor;
/**
 * Sync a keyed reactive data source to a container's children.
 *
 * For every key in `source` (in source order), the container holds one
 * element carrying `data-key`: entering keys clone `template`'s root
 * element, leaving keys are disposed and removed, surviving elements are
 * reused and repositioned. The sync is one-way, data → DOM — `reconcile()`
 * never reads item data back out; mutate `source` (e.g. from an event
 * handler) to change structure.
 *
 * On first run, existing children whose `data-key` matches a source key are
 * adopted (`bindItem` runs for them too, so make it idempotent against
 * server-rendered content); everything else is removed. Children carrying
 * `data-unreconciled` are left alone entirely — never removed, repositioned,
 * or bound, even if `reconcile()` itself originally placed them.
 *
 * `bindItem` is called once per entering element, with the same collector
 * support as `each()`'s callback: `watch()`, `on()`, `pass()`, and
 * `provideContexts()` can be called directly inside it, scoped to that item
 * rather than the driving structural effect. A returned
 * `MaybeCleanup` runs when the key leaves the source or the component
 * disconnects.
 *
 * See ADR 0017 for the full rationale (SSR adoption, unreconciled pinning,
 * keyed-relative positioning).
 *
 * @since 2.3
 * @param {Element} container - Container element whose children are reconciled
 * @param {HTMLTemplateElement} template - Template whose single root element is cloned for entering keys
 * @param {List<T> | Collection<T>} source - Keyed reactive data source
 * @param {(element: HTMLElement, item: Signal<T>, key: string) => MaybeCleanup} bindItem - Mounted once per entering element inside an ambient collector; collected descriptors activate against the per-item scope, and any returned cleanup is that scope's teardown
 * @returns {EffectDescriptor} Effect descriptor to include in the component's factory result
 * @throws {InvalidTemplateError} if the template content does not contain exactly one root element
 */
declare function reconcile<T extends {}, S extends MutableSignal<T>>(container: Element, template: HTMLTemplateElement, source: List<T, S>, bindItem: (element: HTMLElement, item: S, key: string) => MaybeCleanup): EffectDescriptor;
declare function reconcile<T extends {}, S extends Signal<T>>(container: Element, template: HTMLTemplateElement, source: Collection<T, S>, bindItem: (element: HTMLElement, item: S, key: string) => MaybeCleanup): EffectDescriptor;
export { activateResult, type EffectDescriptor, each, type FactoryResult, type Falsy, forEachUnseen, keyedScopes, makePass, makeWatch, type PassedProps, type PassHelper, type Reactive, reconcile, type WatchHelper, };
