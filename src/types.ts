/**
 * Core type definitions for Le Truc.
 * This file contains types that are shared across multiple modules.
 */

import type { MaybeCleanup } from '@zeix/cause-effect'

/* === Constants === */

/** Symbol brand applied to all Parser functions. */
const PARSER_BRAND: unique symbol = Symbol('parser')

/** Symbol brand applied to all MethodProducer functions. */
const METHOD_BRAND: unique symbol = Symbol('method')

/* === Types === */

/** A branded parser function (transforms HTML attribute strings to typed values). */
type Parser<T extends {}> = (value: string | null | undefined) => T

/** A branded method-producer function (side-effect initializer, returns void). */
type MethodProducer = ((...args: any[]) => void) & {
	readonly [METHOD_BRAND]: true
}

/**
 * The single source of truth for reserved property names.
 *
 * These are fundamental JavaScript / `Object` builtins that must not be used
 * as reactive component properties. Defining them as own properties on the
 * host would corrupt the prototype chain or shadow builtins used internally
 * by the reactive layer.
 *
 * The {@link ReservedWords} type and {@link RESERVED_WORDS} runtime set are
 * both derived from this tuple so they can never diverge.
 */
const RESERVED_WORDS_LIST = [
	'constructor',
	'prototype',
	'__proto__',
	'toString',
	'valueOf',
	'hasOwnProperty',
	'isPrototypeOf',
	'propertyIsEnumerable',
	'toLocaleString',
] as const

/**
 * Property names that must not be used as reactive component properties.
 * Derived from {@link RESERVED_WORDS_LIST} — do not edit directly.
 */
type ReservedWords = (typeof RESERVED_WORDS_LIST)[number]

/**
 * Runtime mirror of the {@link ReservedWords} type, derived from the same
 * {@link RESERVED_WORDS_LIST} source. Used by `#initSignals` to reject
 * reserved property names that defeat the type-level exclusion (e.g. via
 * `asJSON`-parsed keys or `Record<string, …>` casts). O(1) lookup via `Set`.
 */
const RESERVED_WORDS: ReadonlySet<string> = new Set(RESERVED_WORDS_LIST)

/** A valid reactive property name — any string that is not an `HTMLElement` or `ReservedWords` key. */
type ComponentProp = Exclude<string, keyof HTMLElement | ReservedWords>

/** A record of reactive property names to their value types, used to type a component's props. */
type ComponentProps = Record<ComponentProp, NonNullable<unknown>>

type Falsy = false | null | undefined | '' | 0 | 0n

/**
 * The state value passed to `formStateRestoreCallback`.
 *
 * Mirrors the types accepted by `ElementInternals.setFormValue(value, state)`.
 * The browser restores the `state` argument (not the submitted `value`) during
 * back/forward navigation or bfcache restoration.
 */
type FormState = string | File | FormData | null

/**
 * A deferred effect: a thunk that, when called inside a reactive scope, creates
 * a reactive effect and returns an optional cleanup function.
 *
 * Effect descriptors are returned by `watch()`, `on()`, `each()`, `pass()`, and
 * `provideContexts()`. They are activated after dependency resolution, not
 * immediately when the factory function runs.
 */
type EffectDescriptor = () => MaybeCleanup

/**
 * The return value of the factory function.
 *
 * An array of effect descriptors (and optional falsy guards for conditional
 * effects). Nested arrays are automatically flattened. Falsy values (`false`,
 * `undefined`, `null`, `""`, `0`) are filtered out before activation, enabling the
 * `element && [watch(...)]` conditional pattern.
 */
type FactoryResult = Array<EffectDescriptor | FactoryResult | Falsy>

/* === Exported Functions === */

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
const isParser = <T extends {}>(value: unknown): value is Parser<T> =>
	typeof value === 'function' && PARSER_BRAND in value

/**
 * Check if a value is a MethodProducer (branded side-effect initializer)
 *
 * @since 0.16.2
 * @param {unknown} value - Value to check
 * @returns {boolean} True if the value is a MethodProducer
 */
const isMethodProducer = (value: unknown): value is MethodProducer =>
	typeof value === 'function' && METHOD_BRAND in value

/**
 * Check whether a string is a reserved property name.
 *
 * Runtime counterpart of the {@link ReservedWords} type exclusion. `#initSignals`
 * calls this to reject names that would corrupt the host's prototype chain or
 * shadow `Object` builtins used by the reactive layer.
 *
 * @since 2.0.4
 * @param {string} name - Property name to check
 * @returns {boolean} True if the name is reserved and must not be used as a reactive property
 */
const isReservedWord = (name: string): boolean => RESERVED_WORDS.has(name)

/**
 * Brand a custom parser function with the `PARSER_BRAND` symbol.
 *
 * Use this to wrap any custom parser so `isParser()` can identify it reliably.
 *
 * @since 0.16.2
 * @param {Parser<T>} fn - Custom parser function to brand
 * @returns {Parser<T>} The same function, branded
 */
const asParser = <T extends {}>(fn: Parser<T>): Parser<T> =>
	Object.assign(fn, { [PARSER_BRAND]: true as const })

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
const defineMethod = <T extends (...args: any[]) => void>(
	fn: T,
): T & { readonly [METHOD_BRAND]: true } =>
	Object.assign(fn, { [METHOD_BRAND]: true as const })

export {
	asParser,
	type ComponentProp,
	type ComponentProps,
	defineMethod,
	type EffectDescriptor,
	type FactoryResult,
	type Falsy,
	type FormState,
	isMethodProducer,
	isParser,
	isReservedWord,
	type MethodProducer,
	type Parser,
	RESERVED_WORDS,
	RESERVED_WORDS_LIST,
	type ReservedWords,
}
