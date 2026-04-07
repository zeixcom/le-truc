import { type MaybeCleanup, type Memo, type MemoCallback, type Signal, type TaskCallback } from '@zeix/cause-effect';
import type { Context } from './context';
import { type EffectDescriptor, type Effects, type FactoryResult } from './effects';
import type { PassedProps } from './effects/pass';
import { type WatchHandlers } from './factory';
import { METHOD_BRAND, type Parser, type Reader } from './parsers';
import { type ElementQueries, type UI } from './ui';
/**
 * Property names that must not be used as reactive component properties
 * because they are fundamental JavaScript / `Object` builtins.
 */
type ReservedWords = 'constructor' | 'prototype' | '__proto__' | 'toString' | 'valueOf' | 'hasOwnProperty' | 'isPrototypeOf' | 'propertyIsEnumerable' | 'toLocaleString';
/** A valid reactive property name — any string that is not an `HTMLElement` or `ReservedWords` key. */
type ComponentProp = Exclude<string, keyof HTMLElement | ReservedWords>;
/** A record of reactive property names to their value types, used to type a component's props. */
type ComponentProps = Record<ComponentProp, NonNullable<unknown>>;
/**
 * An `HTMLElement` extended with a component's reactive properties as
 * signal-backed accessors.
 *
 * @deprecated Use `HTMLElement & P` instead.
 **/
type Component<P extends ComponentProps> = HTMLElement & P;
/**
 * The UI object passed to the `setup` function: the result of the `select`
 * function merged with a `host` key pointing to the component element itself.
 *
 * @deprecated Used only by the v1.0 4-param form of `defineComponent`. Use the v1.1 factory form with `FactoryContext` instead.
 */
type ComponentUI<P extends ComponentProps, U extends UI> = U & {
    host: HTMLElement & P;
};
/**
 * The type of the `setup` function passed to `defineComponent`.
 * Receives the frozen UI object (including `host`) and returns an `Effects` record.
 *
 * @deprecated Used only by the v1.0 4-param form of `defineComponent`. Use the v1.1 factory form with `FactoryContext` instead.
 */
type ComponentSetup<P extends ComponentProps, U extends UI> = (ui: ComponentUI<P, U>) => Effects<P, ComponentUI<P, U>>;
/**
 * The `props` argument of `defineComponent` — a map from property names to their initializers.
 *
 * Each value may be:
 * - A **static value** or **`Signal`** — used directly as the initial signal value.
 * - A **`Parser`** (two-argument function branded with `asParser()`) — called with
 *   `(ui, attributeValue)` at connect time and again on every attribute change.
 * - A **`Reader`** (one-argument function) — called with `ui` at connect time; if it
 *   returns a function or `TaskCallback`, a computed/task signal is created; otherwise
 *   a mutable state signal is created.
 * - A **`MethodProducer`** (branded with `asMethod()`) — assigned directly as the property
 *   value; the function IS the method. Per-instance state lives in factory scope.
 */
type Initializers<P extends ComponentProps, U extends UI> = {
    [K in keyof P]?: P[K] | Signal<P[K]> | Parser<P[K], ComponentUI<P, U>> | Reader<MaybeSignal<P[K]>, ComponentUI<P, U>> | (P[K] extends (...args: any[]) => any ? P[K] & {
        readonly [METHOD_BRAND]: true;
    } : never);
};
/**
 * Any value that `#setAccessor` can turn into a signal:
 * - `T` — wrapped in `createState()`
 * - `Signal<T>` — used directly
 * - `MemoCallback<T>` — wrapped in `createComputed()`
 * - `TaskCallback<T>` — wrapped in `createTask()`
 */
type MaybeSignal<T extends {}> = T | Signal<T> | MemoCallback<T> | TaskCallback<T>;
/**
 * The `watch` helper type in `FactoryContext`.
 *
 * Drives a reactive effect from a signal source (property name, Signal, or array).
 * Only the declared sources trigger re-runs — incidental reads inside the handler
 * are not tracked. Returns an `EffectDescriptor`.
 */
type FactoryWatchHelper<P extends ComponentProps> = {
    <K extends keyof P & string>(source: K, handler: (value: P[K]) => MaybeCleanup | void): EffectDescriptor;
    <K extends keyof P & string>(source: K, handlers: WatchHandlers<P[K]>): EffectDescriptor;
    <T extends {}>(source: Signal<T>, handler: (value: T) => MaybeCleanup | void): EffectDescriptor;
    <T extends {}>(source: Signal<T>, handlers: WatchHandlers<T>): EffectDescriptor;
    (source: Array<string | Signal<any>>, handler: (values: any[]) => MaybeCleanup | void): EffectDescriptor;
};
/**
 * The `on` helper type in `FactoryContext`.
 *
 * Attaches an event listener. The handler always receives `(event, element)`.
 * For Memo targets, uses event delegation (or per-element fallback for non-bubbling events).
 */
type FactoryOnHelper<P extends ComponentProps> = {
    <E extends Element, T extends keyof HTMLElementEventMap>(target: E, type: T, handler: (event: HTMLElementEventMap[T], element: E) => {
        [K in keyof P]?: P[K];
    } | void, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element>(target: E, type: string, handler: (event: Event, element: E) => {
        [K in keyof P]?: P[K];
    } | void, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element, T extends keyof HTMLElementEventMap>(target: Memo<E[]>, type: T, handler: (event: HTMLElementEventMap[T], element: E) => {
        [K in keyof P]?: P[K];
    } | void, options?: AddEventListenerOptions): EffectDescriptor;
    <E extends Element>(target: Memo<E[]>, type: string, handler: (event: Event, element: E) => {
        [K in keyof P]?: P[K];
    } | void, options?: AddEventListenerOptions): EffectDescriptor;
};
/**
 * The `pass` helper type in `FactoryContext`.
 *
 * Passes reactive values to a descendant Le Truc component's Slot-backed signals.
 * Supports single-element and Memo targets (per-element lifecycle for Memo).
 */
type FactoryPassHelper<P extends ComponentProps> = {
    <Q extends ComponentProps>(target: HTMLElement & Q, props: PassedProps<P, Q>): EffectDescriptor;
    <Q extends ComponentProps>(target: Memo<(HTMLElement & Q)[]>, props: PassedProps<P, Q>): EffectDescriptor;
};
/**
 * The `provideContexts` helper type in `FactoryContext`.
 *
 * Attaches a `context-request` listener to the host, providing the listed
 * property values as context to descendant consumers. Returns an `EffectDescriptor`.
 */
type FactoryProvideContextsHelper<P extends ComponentProps> = (contexts: Array<keyof P>) => EffectDescriptor;
/**
 * The `requestContext` helper type in `FactoryContext`.
 *
 * Dispatches a `context-request` event from the host and returns a `Memo<T>`
 * that tracks the provider's value. Falls back to `fallback` if no provider responds.
 * For use inside `expose()` as a property initializer.
 */
type FactoryRequestContextHelper = <T extends {}>(context: Context<string, () => T>, fallback: T) => Memo<T>;
/**
 * The context object passed to the v1.1 factory function.
 *
 * Components destructure only what they need.
 */
type FactoryContext<P extends ComponentProps> = ElementQueries & {
    host: HTMLElement & P;
    expose: (props: Initializers<P, {}>) => void;
    watch: FactoryWatchHelper<P>;
    on: FactoryOnHelper<P>;
    pass: FactoryPassHelper<P>;
    provideContexts: FactoryProvideContextsHelper<P>;
    requestContext: FactoryRequestContextHelper;
};
/**
 * Define and register a reactive custom element using the v1.1 factory form.
 *
 * The factory receives a `FactoryContext` at connect time: query helpers (`first`, `all`),
 * the `host` element, and `expose()` for declaring reactive properties. It returns a flat
 * array of effect descriptors created by helpers like `watch()`, `on()`, `each()`, `pass()`,
 * and `provideContexts()`.
 *
 * Effects activate after dependency resolution — child custom elements are guaranteed to
 * be defined before any descriptor runs.
 *
 * @since 1.1
 * @param {string} name - Custom element name (must contain a hyphen and start with a lowercase letter)
 * @param {function} factory - Factory function that queries elements, calls expose(), and returns effect descriptors
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name
 */
declare function defineComponent<P extends ComponentProps>(name: string, factory: (context: FactoryContext<P>) => FactoryResult): HTMLElement & P;
/**
 * Define and register a reactive custom element using the v1.0 4-param form.
 *
 * Calls `customElements.define()` and returns the registered class.
 * Reactive properties are initialised in `connectedCallback` and torn down in `disconnectedCallback`.
 *
 * @deprecated Use the v1.1 factory form `defineComponent(name, factory)` with `expose()` and effect descriptors instead.
 * The 4-param form remains fully supported for components that require attribute-reactive `observedAttributes`.
 * @since 0.15.0
 * @param {string} name - Custom element name (must contain a hyphen and start with a lowercase letter)
 * @param {Initializers<P, U>} props - Initializers for reactive properties: static values, signals, parsers, or readers
 * @param {function} select - Receives `{ first, all }` query helpers; returns the UI object (queried DOM elements used by effects)
 * @param {function} setup - Receives the frozen UI object (plus `host`) and returns effects keyed by UI element name
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name
 * @throws {InvalidPropertyNameError} If a property name conflicts with reserved words or inherited HTMLElement properties
 */
declare function defineComponent<P extends ComponentProps, U extends UI = {}>(name: string, props?: Initializers<P, U>, select?: (elementQueries: ElementQueries) => U, setup?: (ui: ComponentUI<P, U>) => Effects<P, ComponentUI<P, U>>): HTMLElement & P;
export { type Component, type ComponentProp, type ComponentProps, type ComponentSetup, type ComponentUI, defineComponent, type FactoryContext, type FactoryOnHelper, type FactoryPassHelper, type FactoryProvideContextsHelper, type FactoryRequestContextHelper, type FactoryWatchHelper, type Initializers, type MaybeSignal, type ReservedWords, };
