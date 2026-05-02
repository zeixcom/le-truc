/**
 * Core type definitions for Le Truc.
 * This file contains types that are shared across multiple modules.
 */
import type { MaybeCleanup } from '@zeix/cause-effect';
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
type Falsy = false | null | undefined | '' | 0 | 0n;
/**
 * A deferred effect: a thunk that, when called inside a reactive scope, creates
 * a reactive effect and returns an optional cleanup function.
 *
 * Effect descriptors are returned by `watch()`, `on()`, `each()`, `pass()`, and
 * `provideContexts()`. They are activated after dependency resolution, not
 * immediately when the factory function runs.
 */
type EffectDescriptor = () => MaybeCleanup;
/**
 * The return value of the factory function.
 *
 * An array of effect descriptors (and optional falsy guards for conditional
 * effects). Nested arrays are automatically flattened. Falsy values (`false`,
 * `undefined`, `null`, `""`, `0`) are filtered out before activation, enabling the
 * `element && [watch(...)]` conditional pattern.
 */
type FactoryResult = Array<EffectDescriptor | FactoryResult | Falsy>;
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
export { asParser, type ComponentProp, type ComponentProps, defineMethod, type EffectDescriptor, type FactoryResult, type Falsy, isMethodProducer, isParser, type MethodProducer, type Parser, type ReservedWords, };
