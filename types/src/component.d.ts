import { type MemoCallback, type Signal, type TaskCallback } from '@zeix/cause-effect';
import { type ProvideContextsHelper, type RequestContextHelper } from './context';
import { type FactoryResult, type Falsy, type PassHelper, type WatchHelper } from './effects';
import { type OnHelper } from './events';
import { type ElementQueries } from './ui';
/** Symbol brand applied to all Parser functions. */
declare const PARSER_BRAND: unique symbol;
/** Symbol brand applied to all MethodProducer functions. */
declare const METHOD_BRAND: unique symbol;
/** A branded parser function (transforms HTML attribute strings to typed values). */
type Parser<T extends {}> = (value: string | null | undefined) => T;
/** A branded method-producer function (side-effect initializer, returns void). */
type MethodProducer = ((...args: any[]) => void) & {
    readonly [METHOD_BRAND]: true;
};
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
 * Any value that `#setAccessor` can turn into a signal:
 * - `T` — wrapped in `createState()`
 * - `Signal<T>` — used directly
 * - `MemoCallback<T>` — wrapped in `createComputed()`
 * - `TaskCallback<T>` — wrapped in `createTask()`
 */
type MaybeSignal<T extends {}> = T | Signal<T> | MemoCallback<T> | TaskCallback<T>;
/**
 * The context object passed to the v1.1 factory function.
 *
 * Components destructure only what they need.
 */
type FactoryContext<P extends ComponentProps> = ElementQueries & {
    host: HTMLElement & P;
    expose: (props: Initializers<P>) => void;
    watch: WatchHelper<P>;
    on: OnHelper<P>;
    pass: PassHelper<P>;
    provideContexts: ProvideContextsHelper<P>;
    requestContext: RequestContextHelper;
};
/**
 * Check if a value is a parser
 *
 * Checks for the `PARSER_BRAND` symbol. Unbranded functions are NOT treated as
 * parsers — always use `asParser()` to brand custom parsers.
 *
 * @since 0.14.0
 * @param {unknown} value - Value to check if it is a parser
 * @returns {boolean} True if the value is a parser, false otherwise
 */
declare const isParser: <T extends {}>(value: unknown) => value is Parser<T>;
/**
 * Check if a value is a MethodProducer (branded side-effect initializer)
 *
 * @since 0.16.2
 * @param {unknown} value - Value to check
 * @returns {boolean} True if the value is a MethodProducer
 */
declare const isMethodProducer: (value: unknown) => value is MethodProducer;
/**
 * Brand a custom parser function with the `PARSER_BRAND` symbol.
 *
 * Use this to wrap any custom parser so `isParser()` can identify it reliably.
 *
 * @since 0.16.2
 * @param {Parser<T>} fn - Custom parser function to brand
 * @returns {Parser<T>} The same function, branded
 */
declare const asParser: <T extends {}>(fn: Parser<T>) => Parser<T>;
/**
 * Brand a custom method-producer function with the `METHOD_BRAND` symbol.
 *
 * Use this to wrap any side-effect initializer so `isMethodProducer()` can
 * identify it explicitly rather than relying on the absence of a return value.
 *
 * @since 0.16.2
 * @param {T} fn - Side-effect initializer to brand
 * @returns {T & { readonly [METHOD_BRAND]: true }} The same function, branded as a `MethodProducer`
 */
declare const defineMethod: <T extends (...args: any[]) => void>(fn: T) => T & {
    readonly [METHOD_BRAND]: true;
};
/**
 * Define and register a reactive custom element using the v1.1 factory form.
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
 * @throws {InvalidComponentNameError} If the component name is not a valid custom element name
 */
declare function defineComponent<P extends ComponentProps>(name: string, factory: (context: FactoryContext<P>) => FactoryResult | Falsy | void): CustomElementConstructor | undefined;
export { asParser, type ComponentProp, type ComponentProps, defineComponent, defineMethod, type FactoryContext, type Initializers, isMethodProducer, isParser, type MaybeSignal, METHOD_BRAND, type MethodProducer, PARSER_BRAND, type Parser, type ReservedWords, };
