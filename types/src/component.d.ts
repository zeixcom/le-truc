import { type MemoCallback, type Signal, type TaskCallback } from '@zeix/cause-effect';
import { type ProvideContextsHelper, type RequestContextHelper } from './helpers/context';
import { type ElementQueries } from './helpers/dom';
import { type OnHelper } from './helpers/events';
import { type OnFormAssociatedHelper, type OnFormDisabledHelper, type OnFormResetHelper, type OnFormStateRestoreHelper } from './helpers/form';
import { type FactoryResult, type Falsy, type PassHelper, type WatchHelper } from './helpers/reactive';
import { type ComponentProps, type MethodProducer, type Parser } from './types';
/**
 * Any value that `#setAccessor` can turn into a signal:
 * - `T` — wrapped in `createState()`
 * - `Signal<T>` — used directly
 * - `MemoCallback<T>` — wrapped in `createComputed()`
 * - `TaskCallback<T>` — wrapped in `createTask()`
 */
type MaybeSignal<T extends {}> = T | Signal<T> | MemoCallback<T> | TaskCallback<T>;
/**
 * The `props` argument of `defineComponent` — a map from property names to their initializers.
 *
 * Each value may be:
 * - A **static value** or **`Signal`** — used directly as the initial signal value.
 * - A **`Parser`** (branded with `asParser()`) — called with the attribute value string
 *   at connect time.
 * - A **`MethodProducer`** (branded with `defineMethod()`) — assigned directly as the property
 *   value; the function IS the method. Per-instance state lives in factory scope.
 */
type Initializers<P extends ComponentProps> = {
    [K in keyof P]?: P[K] | Signal<P[K]> | Parser<P[K]> | MethodProducer;
};
/**
 * Static class-level configuration for a component.
 *
 * Passed as the third (optional) argument to `defineComponent`. Currently
 * carries only `formAssociated`, but is extensible for future class-level
 * options without further signature changes.
 */
type ComponentOptions = {
    /**
     * When `true`, the generated class gets `static formAssociated = true` and
     * the four form-lifecycle callback stubs. The browser then treats the
     * element as a form-associated custom element (FACE), enabling
     * `setFormValue`, `setValidity`, and the `formAssociatedCallback` /
     * `formDisabledCallback` / `formResetCallback` / `formStateRestoreCallback`
     * lifecycle. Default: `false`.
     */
    formAssociated?: boolean;
};
/**
 * The context object passed to the v2.x factory function.
 *
 * Components destructure only what they need.
 */
type FactoryContext<P extends ComponentProps> = ElementQueries & {
    host: HTMLElement & P;
    /**
     * The `ElementInternals` object, or `null` if `attachInternals()` failed
     * (pre-upgrade / parser-ordering edge case). Use imperatively inside
     * `watch()` — e.g. `watch('value', v => { internals?.setFormValue(v) })`.
     * The optional chaining is the graceful-degradation guard.
     */
    internals: ElementInternals | null;
    expose: (props: Initializers<P>) => void;
    watch: WatchHelper<P>;
    on: OnHelper<P>;
    pass: PassHelper<P>;
    provideContexts: ProvideContextsHelper<P>;
    requestContext: RequestContextHelper;
    onFormAssociated: OnFormAssociatedHelper;
    onFormDisabled: OnFormDisabledHelper;
    onFormReset: OnFormResetHelper;
    onFormStateRestore: OnFormStateRestoreHelper;
};
/**
 * Define and register a reactive custom element using the v2.x factory form.
 *
 * The factory receives a `FactoryContext` at connect time: query helpers (`first`, `all`),
 * the `host` element, and `expose()` for declaring reactive properties. It returns a flat
 * array of effect descriptors created by helpers like `watch()`, `on()`, `pass()`,
 * `provideContexts()`, and `requestContext()`.
 *
 * Effects activate after dependency resolution — child custom elements are guaranteed to
 * be defined before any descriptor runs.
 *
 * @since 2.0
 * @param {string} name - Custom element name (must contain a hyphen and start with a lowercase letter)
 * @param {function} factory - Factory function that queries elements, calls expose(), and returns effect descriptors
 * @param {ComponentOptions} [options] - Static class-level configuration (e.g. `{ formAssociated: true }`)
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name
 */
declare function defineComponent<P extends ComponentProps>(name: string, factory: (context: FactoryContext<P>) => FactoryResult | Falsy | void, options?: ComponentOptions): CustomElementConstructor | undefined;
export { type ComponentOptions, defineComponent, type FactoryContext, type Initializers, type MaybeSignal, };
