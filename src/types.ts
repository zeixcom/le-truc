/**
 * Core type definitions shared across Le Truc modules.
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
 * JavaScript and `Object` builtins that must not be used as reactive component properties.
 *
 * {@link ReservedWords} and `RESERVED_WORDS` both derive from this tuple.
 *
 * @since 2.6
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

/** Property names that must not be used as reactive component properties. */
type ReservedWords = (typeof RESERVED_WORDS_LIST)[number]

/** Runtime set version of {@link ReservedWords}, for O(1) lookup. */
const RESERVED_WORDS: ReadonlySet<string> = new Set(RESERVED_WORDS_LIST)

/** A valid reactive property name — any string that is not an `HTMLElement` or `ReservedWords` key. */
type ComponentProp = Exclude<string, keyof HTMLElement | ReservedWords>

/** A record of reactive property names to their value types, used to type a component's props. */
type ComponentProps = Record<ComponentProp, NonNullable<unknown>>

type Falsy = false | null | undefined | '' | 0 | 0n

/**
 * A deferred effect: creates a reactive effect when called inside a reactive scope.
 *
 * Returned by `watch()`, `on()`, `each()`, `pass()`, and `provideContexts()`.
 * Activates after dependency resolution, not when the factory function runs.
 */
type EffectDescriptor = () => MaybeCleanup

/**
 * The factory function's return value: an array of effect descriptors and optional falsy guards.
 *
 * Nested arrays flatten automatically. Falsy values are filtered out before
 * activation, enabling the `element && [watch(...)]` conditional pattern.
 */
type FactoryResult = Array<EffectDescriptor | FactoryResult | Falsy>

/* === Exported Functions === */

/**
 * Checks whether a value is a branded parser function.
 *
 * Unbranded functions are not parsers — brand custom parsers with `asParser()`.
 *
 * @since 0.14.0
 * @param value - Value to check.
 * @returns True if the value is a parser.
 */
const isParser = <T extends {}>(value: unknown): value is Parser<T> =>
	typeof value === 'function' && PARSER_BRAND in value

/**
 * Checks whether a value is a branded method-producer function.
 *
 * @since 0.16.2
 * @param value - Value to check.
 * @returns True if the value is a MethodProducer.
 */
const isMethodProducer = (value: unknown): value is MethodProducer =>
	typeof value === 'function' && METHOD_BRAND in value

/**
 * Checks whether a string is a reserved property name.
 *
 * @since 2.0.4
 * @param name - Property name to check.
 * @returns True if the name is reserved and must not be used as a reactive property.
 */
const isReservedWord = (name: string): boolean => RESERVED_WORDS.has(name)

/**
 * Brands a custom parser function so `isParser()` identifies it.
 *
 * @since 0.16.2
 * @param fn - Parser function to brand.
 * @returns The same function, branded.
 */
const asParser = <T extends {}>(fn: Parser<T>): Parser<T> =>
	Object.assign(fn, { [PARSER_BRAND]: true as const })

/**
 * Brands a custom method-producer function so `isMethodProducer()` identifies it.
 *
 * @since 0.16.2
 * @param fn - Side-effect initializer to brand.
 * @returns The same function, branded as a MethodProducer.
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
	isMethodProducer,
	isParser,
	isReservedWord,
	type MethodProducer,
	type Parser,
	RESERVED_WORDS,
	RESERVED_WORDS_LIST,
	type ReservedWords,
}
