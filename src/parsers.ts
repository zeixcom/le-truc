import { isFunction } from '@zeix/cause-effect'
import type { UI } from './ui'

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

/* === Exported Functions === */

/**
 * Check if a value is a parser
 *
 * @since 0.14.0
 * @param {unknown} value - Value to check if it is a parser
 * @returns {boolean} True if the value is a parser, false otherwise
 */
const isParser = <T extends {}, U extends UI>(
	value: unknown,
): value is Parser<T, U> => isFunction<T>(value) && value.length >= 2

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
	isParser,
	isReader,
	getFallback,
	read,
}
