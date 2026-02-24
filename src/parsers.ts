import { isFunction } from '@zeix/cause-effect'
import type { UI } from './ui'
import { DEV_MODE } from './util'

/* === Types === */

type Parser<T extends {}, U extends UI> = (
	ui: U,
	value: string | null | undefined,
	old?: string | null,
) => T

type LooseReader<T extends {}, U extends UI> = (
	ui: U,
) => T | string | null | undefined
type Reader<T extends {}, U extends UI> = (ui: U) => T

type Fallback<T extends {}, U extends UI> = T | Reader<T, U>

type ParserOrFallback<T extends {}, U extends UI> =
	| Parser<T, U>
	| Fallback<T, U>

/** A branded method-producer function (side-effect initializer, returns void). */
type MethodProducer = ((...args: any[]) => void) & {
	readonly [METHOD_BRAND]: true
}

/* === Constants === */

/** Symbol brand applied to all Parser functions. */
const PARSER_BRAND: unique symbol = Symbol('parser')

/** Symbol brand applied to all MethodProducer functions. */
const METHOD_BRAND: unique symbol = Symbol('method')

/* === Exported Functions === */

/**
 * Check if a value is a parser
 *
 * Checks for the `PARSER_BRAND` symbol first. Falls back to `fn.length >= 2`
 * for backward compatibility, emitting a DEV_MODE warning when the fallback
 * is triggered so authors can migrate to `asParser()`.
 *
 * @since 0.14.0
 * @param {unknown} value - Value to check if it is a parser
 * @returns {boolean} True if the value is a parser, false otherwise
 */
const isParser = <T extends {}, U extends UI>(
	value: unknown,
): value is Parser<T, U> => {
	if (!isFunction<T>(value)) return false
	if (PARSER_BRAND in value) return true
	if (value.length >= 2) {
		if (DEV_MODE) {
			console.warn(
				`isParser: unbranded two-argument function detected. Wrap custom parsers with asParser() to avoid misclassification when using default parameters or destructuring.`,
				value,
			)
		}
		return true
	}
	return false
}

/**
 * Check if a value is a MethodProducer (branded side-effect initializer)
 *
 * @since 0.17.0
 * @param {unknown} value - Value to check
 * @returns {boolean} True if the value is a MethodProducer
 */
const isMethodProducer = (value: unknown): value is MethodProducer =>
	isFunction(value) && METHOD_BRAND in value

/**
 * Check if a value is a reader
 *
 * @since 0.15.0
 * @param {unknown} value - Value to check if it is a reader
 * @returns {boolean} True if the value is a reader, false otherwise
 */
const isReader = <T extends {}, U extends UI>(
	value: unknown,
): value is Reader<T, U> => isFunction<T>(value)

/**
 * Resolve a fallback to a concrete value using the UI object.
 *
 * If `fallback` is a Reader function, calls it with `ui`; otherwise returns it directly.
 *
 * @since 0.14.0
 * @param {U} ui - The frozen UI object (DOM elements + host)
 * @param {ParserOrFallback<T, U>} fallback - Static fallback value, Reader function, or Parser
 * @returns {T} The resolved fallback value
 */
const getFallback = <T extends {}, U extends UI>(
	ui: U,
	fallback: ParserOrFallback<T, U>,
): T => (isReader<T, U>(fallback) ? fallback(ui) : (fallback as T))

/**
 * Brand a custom parser function with the `PARSER_BRAND` symbol.
 *
 * Use this to wrap any custom two-argument parser so `isParser()` can
 * identify it reliably even when default parameters or destructuring
 * would otherwise reduce `function.length`.
 *
 * @since 0.17.0
 * @param {Parser<T, U>} fn - Custom parser function to brand
 * @returns {Parser<T, U>} The same function, branded
 */
const asParser = <T extends {}, U extends UI>(fn: Parser<T, U>): Parser<T, U> =>
	Object.assign(fn, { [PARSER_BRAND]: true as const })

/**
 * Brand a custom method-producer function with the `METHOD_BRAND` symbol.
 *
 * Use this to wrap any side-effect initializer so `isMethodProducer()` can
 * identify it explicitly rather than relying on the absence of a return value.
 *
 * @since 0.17.0
 * @param {(ui: U & { host: Component<P> }) => void} fn - Side-effect initializer to brand
 * @returns Branded MethodProducer
 */
const asMethod = <T extends (...args: any[]) => void>(
	fn: T,
): T & { readonly [METHOD_BRAND]: true } =>
	Object.assign(fn, { [METHOD_BRAND]: true as const })

/**
 * Compose a loose reader with a parser or fallback to produce a typed `Reader<T>`.
 *
 * Used to initialise a reactive property from the current DOM state rather than
 * from an attribute. Example: `read(ui => ui.input.value, asInteger())` reads the
 * input's text value, parses it as an integer, and falls back to `0` if missing.
 *
 * - If the reader returns a `string` and `fallback` is a Parser, the string is parsed.
 * - Otherwise, the reader's return value is used directly, falling back to `getFallback`.
 *
 * @since 0.15.0
 * @param {LooseReader<T, U>} reader - Reads a raw value from the UI object (`T | string | null | undefined`)
 * @param {ParserOrFallback<T, U>} fallback - Parser used when the reader returns a string, or static/reader fallback
 * @returns {Reader<T, U>} A typed reader that always returns `T`
 */
const read =
	<T extends {}, U extends UI>(
		reader: LooseReader<T, U>,
		fallback: ParserOrFallback<T, U>,
	): Reader<T, U> =>
	(ui: U): T => {
		const value = reader(ui)
		return typeof value === 'string' && isParser<T, U>(fallback)
			? fallback(ui, value)
			: ((value as T) ?? getFallback(ui, fallback))
	}

export {
	type Parser,
	type LooseReader,
	type Reader,
	type Fallback,
	type ParserOrFallback,
	type MethodProducer,
	PARSER_BRAND,
	METHOD_BRAND,
	isParser,
	isMethodProducer,
	isReader,
	getFallback,
	asParser,
	asMethod,
	read,
}
