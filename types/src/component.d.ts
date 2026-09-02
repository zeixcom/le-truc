import { type MemoCallback, type Signal, type SlotDescriptor, type TaskCallback } from '@zeix/cause-effect';
import { type ComponentExtension } from './extension';
import type { FormAssociatedCheckboxExtension, FormAssociatedExtension } from './extensions/form';
import { type ProvideContextsHelper, type RequestContextHelper } from './helpers/context';
import { type ElementQueries } from './helpers/dom';
import { type OnHelper } from './helpers/events';
import { type FactoryResult, type Falsy, type PassHelper, type WatchHelper } from './helpers/reactive';
import { type ComponentProps, type MethodProducer, type Parser } from './types';
/**
 * Any value that `#setAccessor` can turn into a signal.
 *
 * - `T` — wrapped in `createState()`.
 * - `Signal<T>` — used directly.
 * - `MemoCallback<T>` — wrapped in `deriveCell()`.
 * - `TaskCallback<T>` — wrapped in `createTask()`.
 * - `SlotDescriptor<T>` (`{ get, set? }`) — used directly as the Slot's backing
 *   signal. Use this form when the property needs both a computed read and a
 *   validated write, e.g.
 *   `expose({ value: { get: () => tokens.get().join(', '), set: v => tokens.set(parse(v)) } })`.
 */
type MaybeSignal<T extends {}> = T | Signal<T> | MemoCallback<T> | TaskCallback<T> | SlotDescriptor<T>;
/**
 * The `props` argument of `defineComponent` — a map from property names to their initializers.
 *
 * Each value may be:
 * - A static value or `Signal` — used directly as the initial signal value.
 * - A `Parser` (branded with `asParser()`) — called with the attribute value string at connect time.
 * - A `MethodProducer` (branded with `defineMethod()`) — assigned directly as the property value.
 * - A `SlotDescriptor` (`{ get, set? }`) — used directly as the property's backing Slot.
 */
type Initializers<P extends ComponentProps> = {
    [K in keyof P]?: P[K] | Signal<P[K]> | Parser<P[K]> | MethodProducer | SlotDescriptor<P[K]>;
};
/**
 * The native form-control members the generated class defines on the host when `formAssociated: true`.
 *
 * Authors use this interface in the tag-name map: `'my-input': FormAssociatedElement & MyProps`.
 * `value` is not part of this interface; it belongs in the author's props type.
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
 * The host shape of the `formAssociated()` value variant, carrying the managed `defaultValue` reset baseline.
 *
 * Mirrors `<input>.defaultValue`. Setting it moves the baseline for the
 * next form reset; it never changes the live `value`.
 *
 * @since 2.5.1
 */
interface FormAssociatedValueElement extends FormAssociatedElement {
    defaultValue: string | number;
}
/**
 * The host shape of the `formAssociatedCheckbox()` variant, carrying the managed `defaultChecked` reset baseline.
 *
 * Mirrors `<input>.defaultChecked`. Setting it moves the baseline for the
 * next form reset; it never changes the live `checked`.
 *
 * @since 2.5.1
 */
interface FormAssociatedCheckboxElement extends FormAssociatedElement {
    defaultChecked: boolean;
}
/**
 * The context object passed to the factory function.
 *
 * Components destructure only what they need.
 */
type FactoryContext<P extends ComponentProps> = ElementQueries & {
    host: HTMLElement & P;
    /**
     * The `ElementInternals` object, or `null` if `attachInternals()` failed.
     *
     * Use it inside `watch()` for validity flags or with `bindState()` for
     * custom `:state()` pseudo-classes. The library manages form value sync
     * (`setFormValue`) automatically; do not call it from a `watch('value', …)`.
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
 * The factory context for form-associated components.
 *
 * Extends `FactoryContext` with `host` typed as `HostElement & P` and with
 * `watch`/`on`/`pass` accepting the managed `disabled`, `validationMessage`,
 * and `validity` reactive props in addition to `P`. `expose()` stays typed
 * over `Initializers<P>`: setting `disabled`, `validationMessage`, or
 * `validity` through `expose()` is a type error, since the library manages
 * them and throws `InvalidPropertyNameError` at runtime for any attempt.
 *
 * @since 2.6
 */
type FormFactoryContext<P extends ComponentProps, HostElement extends FormAssociatedElement = FormAssociatedValueElement> = Omit<FactoryContext<P & {
    disabled: boolean;
    validationMessage: string;
    validity: ValidityState;
}>, 'host' | 'expose'> & {
    host: HostElement & P;
    expose: (props: Initializers<P>) => void;
};
/**
 * Defines and registers a reactive custom element.
 *
 * The factory receives a `FactoryContext` at connect time: query helpers
 * (`first`, `all`), the `host` element, and `expose()` for declaring
 * reactive properties. It returns effect descriptors created by helpers
 * like `watch()`, `on()`, `pass()`, `provideContexts()`, and
 * `requestContext()`. Effects activate after dependency resolution, so
 * child custom elements are defined before any descriptor runs.
 *
 * @since 2.0
 * @param name - Custom element name; must contain a hyphen and start with a lowercase letter.
 * @param factory - Function that queries elements, calls `expose()`, and returns effect descriptors.
 * @param extensions - Dependency-injected features, e.g. `[formAssociated()]`, `[observedAttributes([...])]`. If present, `formAssociated()`/`formAssociatedCheckbox()` must be first.
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name.
 */
declare function defineComponent<P extends ComponentProps & {
    value: string | number;
}>(name: string, factory: (context: FormFactoryContext<P>) => FactoryResult | Falsy | void, extensions: readonly [FormAssociatedExtension, ...ComponentExtension[]]): CustomElementConstructor | undefined;
declare function defineComponent<P extends ComponentProps & {
    checked: boolean;
}>(name: string, factory: (context: FormFactoryContext<P, FormAssociatedCheckboxElement>) => FactoryResult | Falsy | void, extensions: readonly [
    FormAssociatedCheckboxExtension,
    ...ComponentExtension[]
]): CustomElementConstructor | undefined;
declare function defineComponent<P extends ComponentProps>(name: string, factory: (context: FactoryContext<P>) => FactoryResult | Falsy | void, extensions?: readonly ComponentExtension[]): CustomElementConstructor | undefined;
export { defineComponent, type FactoryContext, type FormAssociatedCheckboxElement, type FormAssociatedElement, type FormAssociatedValueElement, type FormFactoryContext, type Initializers, type MaybeSignal, };
