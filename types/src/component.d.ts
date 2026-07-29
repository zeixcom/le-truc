import { type MemoCallback, type Signal, type TaskCallback } from '@zeix/cause-effect';
import { type ComponentExtension } from './extension';
import type { FormAssociatedCheckboxExtension, FormAssociatedExtension } from './extensions/form';
import { type ProvideContextsHelper, type RequestContextHelper } from './helpers/context';
import { type ElementQueries } from './helpers/dom';
import { type OnHelper } from './helpers/events';
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
 * The native form-control members the generated class defines on the host when
 * `formAssociated: true`, delegating to `internals`. Authors use this interface
 * in the declarations the library cannot write for them, chiefly the tag-name
 * map: `'my-input': FormAssociatedElement & MyProps`.
 *
 * `value` is deliberately **not** part of this interface: it is component-exposed
 * (string for textbox, number for spinbutton) and belongs in the author's props
 * type.
 */
interface FormAssociatedElement extends HTMLElement {
    readonly form: HTMLFormElement | null;
    name: string;
    disabled: boolean;
    readonly labels: NodeList;
    readonly validity: ValidityState;
    readonly validationMessage: string;
    readonly willValidate: boolean;
    checkValidity(): boolean;
    reportValidity(): boolean;
    setCustomValidity(message: string): void;
}
/**
 * The context object passed to the v2.x factory function.
 *
 * Components destructure only what they need.
 */
type FactoryContext<P extends ComponentProps> = ElementQueries & {
    host: HTMLElement & P;
    /**
     * The `ElementInternals` object, or `null` if `attachInternals()` failed
     * (pre-upgrade / parser-ordering edge case). Use it inside `watch()` for
     * typed validity flags — e.g. `watch('value', v => internals?.setValidity({ rangeOverflow: v > max }, msg))` —
     * or with `bindState()` for custom `:state()` pseudo-classes — e.g.
     * `watch(overflowEnd, bindState(internals, 'overflow-end'))`.
     * Form value sync (`setFormValue`) is managed automatically; do not call
     * `internals?.setFormValue(v)` from a `watch('value', …)`.
     */
    internals: ElementInternals | null;
    expose: (props: Initializers<P>) => void;
    watch: WatchHelper<P>;
    on: OnHelper<P>;
    pass: PassHelper<P>;
    provideContexts: ProvideContextsHelper<P>;
    requestContext: RequestContextHelper;
};
/**
 * The factory context for form-associated components. Extends `FactoryContext`
 * with `host` typed as `FormAssociatedElement & P` and `watch`/`on`/`pass`
 * accepting the managed `disabled` reactive prop in addition to `P`.
 *
 * `expose` stays typed over `Initializers<P>`, not the widened
 * `P & { disabled: boolean }`, so `expose({ disabled: … })` is a type error.
 * `disabled` is managed by the library; `expose()` throws
 * `InvalidPropertyNameError` for it at runtime.
 */
type FormFactoryContext<P extends ComponentProps> = Omit<FactoryContext<P & {
    disabled: boolean;
}>, 'host' | 'expose'> & {
    host: FormAssociatedElement & P;
    expose: (props: Initializers<P>) => void;
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
 * @param {ComponentExtension[]} [extensions] - Dependency-injected features, e.g. `[formAssociated()]`, `[formAssociatedCheckbox()]`, `[observedAttributes([...])]`. Bundled extensions tree-shake away unless imported and used. `formAssociated()`/`formAssociatedCheckbox()`, if present, must be first — that widens the factory's context type to `FormFactoryContext`.
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name
 */
declare function defineComponent<P extends ComponentProps & {
    value: string | number;
}>(name: string, factory: (context: FormFactoryContext<P>) => FactoryResult | Falsy | void, extensions: readonly [FormAssociatedExtension, ...ComponentExtension[]]): CustomElementConstructor | undefined;
declare function defineComponent<P extends ComponentProps & {
    checked: boolean;
}>(name: string, factory: (context: FormFactoryContext<P>) => FactoryResult | Falsy | void, extensions: readonly [
    FormAssociatedCheckboxExtension,
    ...ComponentExtension[]
]): CustomElementConstructor | undefined;
declare function defineComponent<P extends ComponentProps>(name: string, factory: (context: FactoryContext<P>) => FactoryResult | Falsy | void, extensions?: readonly ComponentExtension[]): CustomElementConstructor | undefined;
export { defineComponent, type FactoryContext, type FormAssociatedElement, type Initializers, type MaybeSignal, };
