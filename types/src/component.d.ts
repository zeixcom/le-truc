import { type MemoCallback, type Signal, type TaskCallback } from '@zeix/cause-effect';
import { type Effects } from './effects';
import { type Parser, type Reader } from './parsers';
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
/** An `HTMLElement` extended with a component's reactive properties as signal-backed accessors. */
type Component<P extends ComponentProps> = HTMLElement & P;
/**
 * The UI object passed to the `setup` function: the result of the `select`
 * function merged with a `host` key pointing to the component element itself.
 */
type ComponentUI<P extends ComponentProps, U extends UI> = U & {
    host: Component<P>;
};
/**
 * The type of the `setup` function passed to `defineComponent`.
 * Receives the frozen UI object (including `host`) and returns an `Effects` record.
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
 * - A **`MethodProducer`** (branded with `asMethod()`) — called for side effect of
 *   creating the method only; its return value is ignored.
 */
type Initializers<P extends ComponentProps, U extends UI> = {
    [K in keyof P]?: P[K] | Signal<P[K]> | Parser<P[K], ComponentUI<P, U>> | Reader<MaybeSignal<P[K]>, ComponentUI<P, U>> | ((ui: ComponentUI<P, U>) => void);
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
 * The return value of the factory function in the 2-param form of `defineComponent`.
 *
 * - `ui` — queried DOM elements, keyed by name; used by `runEffects` and passed to `props` initializers.
 * - `props` — optional reactive property initializers (same as the second argument in the 4-param form).
 * - `effects` — optional effects keyed by UI element name (same as the return value of `setup` in the 4-param form).
 *
 * Components defined via the factory form opt out of `observedAttributes` entirely.
 * Reactive state flows through the signal-backed property interface only.
 */
type ComponentFactoryResult<P extends ComponentProps, U extends UI> = {
    ui?: U;
    props?: Initializers<P, U>;
    effects?: Effects<P, ComponentUI<P, U>>;
};
/**
 * Factory function used in the 2-param form of `defineComponent`.
 *
 * Receives `{ first, all }` query helpers and the host `Component<P>` at connect time.
 * Returns the UI element map, optional reactive property initializers, and optional effects.
 * All three share the same closure scope, so UI elements can be referenced directly without
 * passing a `ui` object between functions.
 */
type ComponentFactory<P extends ComponentProps, U extends UI> = (queries: ElementQueries & {
    host: Component<P>;
}) => ComponentFactoryResult<P, U>;
/**
 * Define and register a reactive custom element using the 2-param factory form.
 *
 * The factory receives `{ first, all, host }` at connect time and returns `{ ui, props?, effects? }`.
 * UI elements, props initializers, and effects share a single closure scope — no `ui` object is
 * passed between functions. Components defined this way do not use `observedAttributes`; reactive
 * state is managed entirely through the signal-backed property interface.
 *
 * @since 1.1
 * @param {string} name - Custom element name (must contain a hyphen and start with a lowercase letter)
 * @param {ComponentFactory<P, U>} factory - Factory function that queries elements and returns ui, props, and effects
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name
 */
declare function defineComponent<P extends ComponentProps, U extends UI = {}>(name: string, factory: ComponentFactory<P, U>): Component<P>;
/**
 * Define and register a reactive custom element.
 *
 * Calls `customElements.define()` and returns the registered class.
 * Reactive properties are initialised in `connectedCallback` and torn down in `disconnectedCallback`.
 *
 * @since 0.15.0
 * @param {string} name - Custom element name (must contain a hyphen and start with a lowercase letter)
 * @param {Initializers<P, U>} props - Initializers for reactive properties: static values, signals, parsers, or readers
 * @param {function} select - Receives `{ first, all }` query helpers; returns the UI object (queried DOM elements used by effects)
 * @param {function} setup - Receives the frozen UI object (plus `host`) and returns effects keyed by UI element name
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name
 * @throws {InvalidPropertyNameError} If a property name conflicts with reserved words or inherited HTMLElement properties
 */
declare function defineComponent<P extends ComponentProps, U extends UI = {}>(name: string, props?: Initializers<P, U>, select?: (elementQueries: ElementQueries) => U, setup?: (ui: ComponentUI<P, U>) => Effects<P, ComponentUI<P, U>>): Component<P>;
export { type Component, type ComponentFactory, type ComponentFactoryResult, type ComponentProp, type ComponentProps, type ComponentSetup, type ComponentUI, defineComponent, type Initializers, type MaybeSignal, type ReservedWords, };
