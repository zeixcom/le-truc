import { type DerivedList, type MatchHandlers, type MaybeCleanup, type MaybePromise, type MutableList, type MutableSignal, type Signal, type SingleMatchHandlers, type SlotDescriptor } from '@zeix/cause-effect';
import type { ComponentProp, ComponentProps, EffectDescriptor, FactoryResult, Falsy } from '../types';
import { type FirstElement } from './dom';
/**
 * Reactive-effect helpers exposed through `FactoryContext`: `watch`, `pass`,
 * `each`, and `reconcile`.
 *
 * A `Reactive<T, P>` source is one of three forms: a property name (reads
 * `host[name]` and tracks it as a signal dependency), a `Signal`, or a thunk
 * wrapped in `deriveCell()`. `watch()` and `pass()` both resolve sources
 * through `toSignal()`.
 *
 * `pass()` accepts a read-only thunk, a mediated `{ get, set }` descriptor, a
 * bare property name, or a bare writable `Signal`. The last two forms hand
 * the child component unrestricted `.set()` on the parent's signal
 * (ADR-0012) and warn in DEV_MODE; prefer the thunk or the descriptor form.
 *
 * `watch()`, `pass()`, `each()`, and `reconcile()` push an `EffectDescriptor`
 * into the active ambient collector when called and do not require an
 * explicit `return` (ADR 0018). Explicit `return` is still supported.
 */
/**
 * A reactive value that drives a DOM update or a slot injection.
 *
 * Three forms are accepted:
 * - `keyof P` — a string property name on the host; reads `host[name]` and
 *   registers it as a signal dependency automatically.
 * - `Signal<T>` — any signal; `.get()` is called inside the reactive effect.
 * - `() => T | Promise<T> | null | undefined` — a thunk wrapped in `deriveCell`;
 *   all signals read inside are tracked in the pure phase. Returning `null` or
 *   `undefined` drives the `nil` path; an async thunk becomes a `Task` signal.
 */
type Reactive<T, P extends ComponentProps> = keyof P | Signal<T & {}> | (() => T | Promise<T> | null | undefined);
/**
 * The value one `Reactive` source delivers to a `watch()` handler, resolved
 * per form: prop key `K` → `P[K]`, `Signal<V>` → `V`, thunk → the awaited,
 * null/undefined-stripped return type (matching the single-source thunk
 * overload's `T extends {}` handler value).
 */
type ResolvedReactive<R, P extends ComponentProps> = R extends keyof P ? P[R] : R extends Signal<infer V> ? V : R extends () => infer V ? Awaited<V> & {} : never;
/**
 * Position-preserving tuple of `ResolvedReactive` values for an array
 * source — what `watch([a, b], ([x, y]) => …)` hands the handler, instead
 * of the untyped `any[]` the array form carried before.
 */
type ResolvedReactiveValues<S extends readonly unknown[], P extends ComponentProps> = {
    [K in keyof S]: ResolvedReactive<S[K], P> & {};
};
/**
 * `S`'s resolved values wrapped as signals — the source-tuple shape
 * `match()`'s multi-signal overload (`MatchHandlers<T>`) expects for an
 * array of `Reactive` sources.
 */
type ResolvedReactiveSignals<S extends readonly unknown[], P extends ComponentProps> = {
    [K in keyof S]: Signal<ResolvedReactive<S[K], P> & {}>;
};
/**
 * Map of child component property names to the reactive values `pass()` injects into them.
 *
 * `Q` is bound to `HTMLElement`, not `ComponentProps`, because native members
 * mixed into a target's element type (e.g. `form: HTMLFormElement | null`)
 * fail a `Record<string, {}>`-style constraint. `keyof Q & ComponentProp`
 * filters to the author-exposed reactive props instead.
 */
type PassedProps<P extends ComponentProps, Q extends HTMLElement> = {
    [K in keyof Q & ComponentProp]?: Reactive<Q[K], P> | SlotDescriptor<Q[K] & {}>;
};
/**
 * The `watch` helper type in `FactoryContext`.
 *
 * Drives a reactive effect from one or more `Reactive` sources. Only the
 * declared sources trigger re-runs; other reads inside the handler are not
 * tracked. Returns an `EffectDescriptor`.
 *
 * Every source form accepts both flavors: a plain handler receiving the
 * value (the resolved tuple for an array source), or match handlers for
 * `ok`/`nil`/`err`/`stale` routing with `match()`'s documented
 * `nil > err > stale > ok` precedence — for an array source, `nil` fires
 * when any source is unset and `err` collects every source error.
 */
type WatchHelper<P extends ComponentProps> = {
    <K extends keyof P & string>(source: K, handler: (value: P[K]) => MaybePromise<MaybeCleanup>): EffectDescriptor;
    <K extends keyof P & string>(source: K, handlers: SingleMatchHandlers<P[K]>): EffectDescriptor;
    <T extends {}>(source: Signal<T>, handler: (value: T) => MaybePromise<MaybeCleanup>): EffectDescriptor;
    <T extends {}>(source: Signal<T>, handlers: SingleMatchHandlers<T>): EffectDescriptor;
    <T extends {}>(source: () => T | Promise<T> | null | undefined, handler: (value: T) => MaybePromise<MaybeCleanup>): EffectDescriptor;
    <T extends {}>(source: () => T | Promise<T> | null | undefined, handlers: SingleMatchHandlers<T>): EffectDescriptor;
    <S extends readonly Reactive<unknown, P>[]>(source: [...S], handler: (values: ResolvedReactiveValues<S, P>) => MaybePromise<MaybeCleanup>): EffectDescriptor;
    <S extends readonly Reactive<unknown, P>[]>(source: [...S], handlers: MatchHandlers<ResolvedReactiveSignals<S, P>>): EffectDescriptor;
};
/**
 * The `pass` helper type in `FactoryContext`.
 *
 * Passes reactive values to a descendant Le Truc component's Slot-backed
 * signals. Supports a single element or a `Signal<Element[]>` target, with
 * per-element lifecycle for the latter.
 */
type PassHelper<P extends ComponentProps> = {
    <Q extends HTMLElement>(target: Q | Falsy, props: PassedProps<P, Q>): EffectDescriptor;
    <Q extends HTMLElement>(target: Signal<Q[]> | Falsy, props: PassedProps<P, Q>): EffectDescriptor;
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
 * (ADR 0018). A descriptor from one of those helpers is pushed whether or
 * not it is also `return`ed, so it must only be visited once. A manually
 * constructed `EffectDescriptor` that bypasses every helper is never pushed,
 * so it is still visited here — the only path that picks it up.
 *
 * @since 2.3
 * @param {FactoryResult | EffectDescriptor | Falsy | void} result - Flat or nested array, single descriptor, falsy value, or nothing to reconcile
 * @param {ReadonlySet<EffectDescriptor>} seen - Descriptors already accounted for (by reference) — skipped
 * @param {(descriptor: EffectDescriptor) => void} visit - Called once per not-yet-seen descriptor, in encounter order
 */
declare const forEachUnseen: (result: FactoryResult | EffectDescriptor | Falsy | void, seen: ReadonlySet<EffectDescriptor>, visit: (descriptor: EffectDescriptor) => void) => void;
/**
 * Drive per-element scopes from a `Signal<E[]>` with element-identity keying.
 *
 * Entering elements get a scope created by `mount`; leaving elements get
 * exactly their own scope disposed. Surviving elements are untouched across
 * re-runs. All remaining scopes are disposed when the enclosing component
 * scope is disposed.
 *
 * Two details matter for correctness:
 * - Per-element scopes use `{ root: true }`. A plain `createScope` inside the
 *   effect would register its dispose on the effect, which runs all cleanups
 *   before every re-run — a wholesale rebuild instead of a keyed diff.
 * - The outer `createScope` wrapper registers on the component scope; its
 *   cleanup is what tears down still-live element scopes on disconnect.
 *
 * @since 2.2
 * @param {Signal<E[]>} memo - Signal of the current element collection
 * @param {(element: E) => MaybeCleanup} mount - Called once per entering element inside its scope; a returned cleanup registers on that scope
 */
declare const keyedScopes: <E extends object>(memo: Signal<E[]>, mount: (element: E) => MaybeCleanup) => void;
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
 * Swaps the target's Slot-backed signals for the given values and restores
 * the originals on disconnect. A `Signal<Element[]>` target swaps and restores
 * signals per element as it enters and leaves the collection.
 *
 * ```ts
 * // deprecated — child can write freely
 * pass(child, { value: parentSignal })
 * // preferred — child writes are mediated by the parent
 * pass(child, { value: { get: parentSignal.get, set: parentSignal.set } })
 * ```
 *
 * @since 2.0
 * @param {HTMLElement & P} host - The component host element
 * @returns {PassHelper<P>} Bound `pass` function for the given host
 */
declare const makePass: <P extends ComponentProps>(host: HTMLElement & P) => PassHelper<P>;
/**
 * Create per-element reactive effects from a `Signal<Element[]>`.
 *
 * Entering elements get their own scope; when they leave, that scope — and
 * everything registered in it — is disposed.
 *
 * The callback can call `watch()`, `on()`, and `pass()` directly instead of
 * returning them; each call registers against that element's scope. A
 * callback that calls `each()` again (e.g. rows containing columns) gets its
 * own nested scope. Returning descriptors still works and is not
 * double-activated if you also call them directly.
 *
 * The callback's 2nd parameter is `first`, a type-safe, throwing lookup
 * scoped to `element` instead of the host — the same shape as host-level
 * `first()`, minus M8 dependency-resolution participation (see ADR 0021).
 *
 * @since 2.0
 */
declare function each<E extends Element>(memo: Signal<E[]>, callback: (element: E, first: FirstElement) => FactoryResult | EffectDescriptor | Falsy | void): EffectDescriptor;
/**
 * Sync a keyed reactive data source to a container's children.
 *
 * For every key in `source` (in source order), the container holds one
 * element carrying `data-key`. Entering keys clone `template`'s root
 * element; leaving keys are disposed and removed; surviving elements are
 * reused and repositioned. The sync is one-way, data → DOM — mutate
 * `source` (e.g. from an event handler) to change structure.
 *
 * On first run, existing children whose `data-key` matches a source key are
 * adopted (`bindItem` runs for them too, so make it idempotent against
 * server-rendered content). Everything else is removed. Children carrying
 * `data-unreconciled` are left alone entirely — never removed, repositioned,
 * or bound.
 *
 * `bindItem` is called once per entering element, with the same collector
 * support as `each()`'s callback: `watch()`, `on()`, `pass()`, and
 * `provideContexts()` can be called directly inside it, scoped to that item.
 * A returned `MaybeCleanup` runs when the key leaves the source or the
 * component disconnects.
 *
 * `bindItem`'s 4th parameter is `first`, a type-safe, throwing lookup scoped
 * to `element` instead of the host — the same shape as host-level `first()`,
 * minus M8 dependency-resolution participation (see ADR 0021).
 *
 * See ADR 0017 for full rationale (SSR adoption, unreconciled pinning,
 * keyed-relative positioning).
 *
 * @since 2.3
 * @param {Element} container - Container element whose children are reconciled
 * @param {HTMLTemplateElement} template - Template whose single root element is cloned for entering keys
 * @param {MutableList<T> | DerivedList<T>} source - Keyed reactive data source
 * @param {(element: HTMLElement, item: Signal<T>, key: string, first: FirstElement) => MaybeCleanup} bindItem - Mounted once per entering element inside an ambient collector; collected descriptors activate against the per-item scope, and any returned cleanup is that scope's teardown
 * @returns {EffectDescriptor} Effect descriptor to include in the component's factory result
 * @throws {InvalidTemplateError} if the template content does not contain exactly one root element
 */
declare function reconcile<T extends {}, S extends MutableSignal<T>>(container: Element, template: HTMLTemplateElement, source: MutableList<T, S>, bindItem: (element: HTMLElement, item: S, key: string, first: FirstElement) => MaybeCleanup): EffectDescriptor;
declare function reconcile<T extends {}, S extends Signal<T>>(container: Element, template: HTMLTemplateElement, source: DerivedList<T, S>, bindItem: (element: HTMLElement, item: S, key: string, first: FirstElement) => MaybeCleanup): EffectDescriptor;
export { activateResult, type EffectDescriptor, each, type FactoryResult, type Falsy, forEachUnseen, keyedScopes, makePass, makeWatch, type PassedProps, type PassHelper, type Reactive, reconcile, type WatchHelper, };
