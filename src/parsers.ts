import { isFunction, isString } from '@zeix/cause-effect'
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
 * Check if a value is a string parser
 *
 * @since 0.14.0
 * @param {unknown} value - Value to check if it is a string parser
 * @returns {boolean} True if the value is a string parser, false otherwise
 */
const isParser = <T extends {}, U extends UI>(
	value: unknown,
): value is Parser<T, U> => isFunction<T>(value) && value.length >= 2

/**
 * Get a fallback value for an element
 *
 * @since 0.14.0
 * @param {U} ui - Component UI
 * @param {ParserOrFallback<T, U>} fallback - Fallback value or parser function
 * @returns {T} Fallback value or parsed value
 */
const getFallback = <T extends {}, U extends UI>(
	ui: U,
	fallback: ParserOrFallback<T, U>,
): T => (isFunction<T>(fallback) ? fallback(ui) : fallback) as T

/**
 * Read a value from a UI element
 *
 * @since 0.15.0
 * @param {LooseReader<T, U>} reader - Reader function returning T | string | null | undefined
 * @param {ParserOrFallback<T, U>} fallback - Fallback value or parser function
 * @returns {Reader<T, U>} Parsed value or fallback value
 */
const read =
	<T extends {}, U extends UI>(
		reader: LooseReader<T, U>,
		fallback: ParserOrFallback<T, U>,
	): Reader<T, U> =>
	(ui: U): T => {
		const value = reader(ui)
		return isString(value) && isParser<T, U>(fallback)
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
	getFallback,
	read,
}
