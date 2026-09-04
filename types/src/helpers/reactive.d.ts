import { type DerivedList, type MatchHandlers, type MaybeCleanup, type MaybePromise, type MutableList, type MutableSignal, type Signal, type SingleMatchHandlers, type SlotDescriptor } from '@zeix/cause-effect';
import type { ComponentProp, ComponentProps, EffectDescriptor, FactoryResult, Falsy } from '../types';
import { type FirstElement } from './dom';
/**
 * Reactive-effect helpers exposed through `FactoryContext`: `watch`, `pass`,
 * `each`, and `reconcile`.
 *
 * A `Reactive<T, P>` source is a property name, a `Signal`, or a thunk
 * wrapped in `deriveCell()`. `watch()` and `pass()` resolve sources through
 * `toSignal()`.
 *
 * `pass()` accepts a read-only thunk, a mediated `{ get, set }` descriptor, a
 * bare property name, or a bare writable `Signal`. Prefer the thunk or
 * descriptor form; the last two hand the child unrestricted `.set()` on the
 * parent's signal (ADR-0012) and warn in DEV_MODE.
 *
 * `watch()`, `pass()`, `each()`, and `reconcile()` push an `EffectDescriptor`
 * into the active ambient collector and do not require an explicit `return`
 * (ADR 0018), though `return` is still supported.
 */
/**
 * A reactive value that drives a DOM update or a slot injection.
 *
 * Accepts three forms:
 * - `keyof P` — a host property name; reads `host[name]` and registers it
 *   as a signal dependency automatically.
 * - `Signal<T>` — any signal; `.get()` is called inside the reactive effect.
 * - `() => T | Promise<T> | null | undefined` — a thunk wrapped in
 *   `deriveCell`. Returning `null`/`undefined` drives the `nil` path; an
 *   async thunk becomes a `Task` signal.
 */
type Reactive<T, P extends ComponentProps> = keyof P | Signal<T & {}> | (() => T | Promise<T> | null | undefined);
/**
 * The value one `Reactive` source delivers to a `watch()` handler: prop key
 * `K` → `P[K]`, `Signal<V>` → `V`, thunk → the awaited, non-nullish return type.
 *
 * @since 2.6
 */
type ResolvedReactive<R, P extends ComponentProps> = R extends keyof P ? P[R] : R extends Signal<infer V> ? V : R extends () => infer V ? Awaited<V> & {} : never;
/**
 * Position-preserving tuple of `ResolvedReactive` values for an array
 * source — what `watch([a, b], ([x, y]) => …)` hands the handler.
 *
 * @since 2.6
 */
type ResolvedReactiveValues<S extends readonly unknown[], P extends ComponentProps> = {
    [K in keyof S]: ResolvedReactive<S[K], P> & {};
};
/**
 * `S`'s resolved values wrapped as signals — the source-tuple shape
 * `match()`'s multi-signal overload expects for an array of `Reactive` sources.
 *
 * @since 2.6
 */
type ResolvedReactiveSignals<S extends readonly unknown[], P extends ComponentProps> = {
    [K in keyof S]: Signal<ResolvedReactive<S[K], P> & {}>;
};
/**
 * Map of child component property names to the reactive values `pass()` injects into them.
 *
 * `Q` is bound to `HTMLElement`, not `ComponentProps`, because native
 * members on a target's element type (e.g. `form: HTMLFormElement | null`)
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
 * Every source form accepts a plain handler receiving the value, or match
 * handlers for `ok`/`nil`/`err`/`stale` routing with `match()`'s
 * `nil > err > stale > ok` precedence. For an array source, `nil` fires when
 * any source is unset and `err` collects every source error.
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
 * Nested arrays are flattened; falsy values are skipped. Each truthy
 * descriptor is called immediately so its effects register in the current scope.
 *
 * @since 2.0
 * @param result - Flat or nested array of effect descriptors to activate
 * @param onError - When given, each descriptor is contained individually and a throw is reported here instead of propagating (ADR 0028)
 */
declare const activateResult: (result: FactoryResult, onError?: (error: unknown, descriptor: EffectDescriptor) => void) => void;
/**
 * Recursively flatten a `FactoryResult` (or a single descriptor, or a falsy
 * value), invoking `visit` for each descriptor not already present in `seen`.
 *
 * Reconciles the explicit-`return` form with descriptors already pushed
 * into the active collector by `watch()`/`on()`/`pass()`/`each()` (ADR
 * 0018), so a descriptor already pushed is visited only once. A manually
 * constructed `EffectDescriptor` that bypasses every helper is never
 * pushed, so it is still visited here.
 *
 * @since 2.3
 * @param result - Flat or nested array, single descriptor, falsy value, or nothing to reconcile
 * @param seen - Descriptors already accounted for (by reference) — skipped
 * @param visit - Called once per not-yet-seen descriptor, in encounter order
 */
declare const forEachUnseen: (result: FactoryResult | EffectDescriptor | Falsy | void, seen: ReadonlySet<EffectDescriptor>, visit: (descriptor: EffectDescriptor) => void) => void;
/**
 * Drive per-element scopes from a `Signal<E[]>` with element-identity keying.
 *
 * Entering elements get a scope created by `mount`; leaving elements get
 * exactly their own scope disposed. Surviving elements are untouched across
 * re-runs. Remaining scopes are disposed when the enclosing component scope
 * is disposed.
 *
 * Per-element scopes use `{ root: true }` so their dispose registers
 * independently of the effect, which would otherwise tear all of them down
 * on every re-run instead of doing a keyed diff.
 *
 * @since 2.2
 * @param memo - Signal of the current element collection
 * @param mount - Called once per entering element inside its scope; a returned cleanup registers on that scope
 */
declare const keyedScopes: <E extends object>(memo: Signal<E[]>, mount: (element: E) => MaybeCleanup) => void;
/**
 * Create a `watch` helper bound to a specific component host.
 *
 * `watch` wraps `match` to create a reactive effect driven by explicitly
 * declared signal sources. Only the declared sources trigger re-runs; other
 * reads inside the handler are not tracked. Returns an `EffectDescriptor`.
 *
 * @since 2.0
 * @param host - The component host element
 * @returns Bound `watch` function for the given host
 */
declare const makeWatch: <P extends ComponentProps>(host: HTMLElement & P) => WatchHelper<P>;
/**
 * Create a `pass` helper bound to a specific component host.
 *
 * Swaps the target's Slot-backed signals for the given values and restores
 * the originals on disconnect. A `Signal<Element[]>` target swaps and
 * restores signals per element as it enters and leaves the collection.
 *
 * ```ts
 * // deprecated — child can write freely
 * pass(child, { value: parentSignal })
 * // preferred — child writes are mediated by the parent
 * pass(child, { value: { get: parentSignal.get, set: parentSignal.set } })
 * ```
 *
 * @since 2.0
 * @param host - The component host element
 * @returns Bound `pass` function for the given host
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
 * callback that calls `each()` again gets its own nested scope. Returning
 * descriptors still works and is not double-activated alongside direct calls.
 *
 * The callback's 2nd parameter, `first`, is a type-safe, throwing lookup
 * scoped to `element` instead of the host (see ADR 0021).
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
 * `source` to change structure.
 *
 * On first run, existing children whose `data-key` matches a source key are
 * adopted (`bindItem` runs for them too, so make it idempotent against
 * server-rendered content). Everything else is removed. Children carrying
 * `data-unreconciled` are left alone entirely.
 *
 * `bindItem` is called once per entering element, with the same collector
 * support as `each()`'s callback: `watch()`, `on()`, `pass()`, and
 * `provideContexts()` can be called directly inside it, scoped to that
 * item. A returned `MaybeCleanup` runs when the key leaves the source or
 * the component disconnects.
 *
 * `bindItem`'s 4th parameter, `first`, is a type-safe, throwing lookup
 * scoped to `element` instead of the host (see ADR 0021).
 *
 * See ADR 0017 for SSR adoption, unreconciled pinning, and keyed-relative
 * positioning.
 *
 * @since 2.3
 * @param container - Container element whose children are reconciled
 * @param template - Template whose single root element is cloned for entering keys
 * @param source - Keyed reactive data source
 * @param bindItem - Mounted once per entering element inside an ambient collector; collected descriptors activate against the per-item scope, and any returned cleanup is that scope's teardown
 * @returns Effect descriptor to include in the component's factory result
 * @throws {InvalidTemplateError} if the template content does not contain exactly one root element
 */
declare function reconcile<T extends {}, S extends MutableSignal<T>>(container: Element, template: HTMLTemplateElement, source: MutableList<T, S>, bindItem: (element: HTMLElement, item: S, key: string, first: FirstElement) => MaybeCleanup): EffectDescriptor;
declare function reconcile<T extends {}, S extends Signal<T>>(container: Element, template: HTMLTemplateElement, source: DerivedList<T, S>, bindItem: (element: HTMLElement, item: S, key: string, first: FirstElement) => MaybeCleanup): EffectDescriptor;
export { activateResult, each, type FactoryResult, type Falsy, forEachUnseen, keyedScopes, makePass, makeWatch, type PassedProps, type PassHelper, type Reactive, type ResolvedReactive, type ResolvedReactiveSignals, type ResolvedReactiveValues, reconcile, type WatchHelper, };
