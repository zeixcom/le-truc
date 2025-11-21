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

/* === Internal Functions === */

const parseNumber = (
	parseFn: (v: string) => number,
	value: string | null | undefined,
) => {
	if (value == null) return
	const parsed = parseFn(value)
	return Number.isFinite(parsed) ? parsed : undefined
}

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

/**
 * Parse a boolean attribute as an actual boolean value
 *
 * @since 0.13.1
 * @returns {Parser<boolean, UI>}
 */
const asBoolean =
	(): Parser<boolean, UI> => (_: UI, value: string | null | undefined) =>
		value != null && value !== 'false'

/**
 * Parse a string as a number forced to integer with a fallback
 *
 * Supports hexadecimal and scientific notation
 *
 * @since 0.11.0
 * @param {Fallback<number, U>} [fallback=0] - Fallback value or reader function
 * @returns {Parser<number, U>} Parser function
 */
const asInteger =
	<U extends UI>(fallback: Fallback<number, U> = 0): Parser<number, U> =>
	(ui: U, value: string | null | undefined) => {
		if (value == null) return getFallback(ui, fallback)

		// Handle hexadecimal notation
		const trimmed = value.trim()
		if (trimmed.toLowerCase().startsWith('0x'))
			return (
				parseNumber(v => parseInt(v, 16), trimmed) ??
				getFallback(ui, fallback)
			)

		// Handle other formats (including scientific notation)
		const parsed = parseNumber(parseFloat, value)
		return parsed != null ? Math.trunc(parsed) : getFallback(ui, fallback)
	}

/**
 * Parse a string as a number with a fallback
 *
 * @since 0.11.0
 * @param {Fallback<number, U>} [fallback=0] - Fallback value or reader function
 * @returns {Parser<number, U>} Parser function
 */
const asNumber =
	<U extends UI>(fallback: Fallback<number, U> = 0): Parser<number, U> =>
	(ui: U, value: string | null | undefined) =>
		parseNumber(parseFloat, value) ?? getFallback(ui, fallback)

/**
 * Pass through string with a fallback
 *
 * @since 0.11.0
 * @param {Fallback<string, U>} [fallback=''] - Fallback value or reader function
 * @returns {Parser<string, U>} Parser function
 */
const asString =
	<U extends UI>(fallback: Fallback<string, U> = ''): Parser<string, U> =>
	(ui: U, value: string | null | undefined) =>
		value ?? getFallback(ui, fallback)

/**
 * Parse a string as a multi-state value (for example: ['true', 'false', 'mixed'], defaulting to the first valid option
 *
 * @since 0.9.0
 * @param {[string, ...string[]]} valid - Array of valid values
 * @returns {Parser<string, UI>} Parser function
 */
const asEnum =
	(valid: [string, ...string[]]): Parser<string, UI> =>
	(_: UI, value: string | null | undefined) => {
		if (value == null) return valid[0]
		const lowerValue = value.toLowerCase()
		const matchingValid = valid.find(v => v.toLowerCase() === lowerValue)
		return matchingValid ? value : valid[0]
	}

/**
 * Parse a string as a JSON serialized object with a fallback
 *
 * @since 0.11.0
 * @param {Fallback<T, C>} fallback - Fallback value or reader function
 * @returns {Parser<T, C>} Parser function
 * @throws {TypeError} If the value and fallback are both null or undefined
 * @throws {SyntaxError} If value is not a valid JSON string
 */
const asJSON =
	<T extends {}, U extends UI>(fallback: Fallback<T, U>): Parser<T, U> =>
	(host: U, value: string | null | undefined) => {
		if ((value ?? fallback) == null)
			throw new TypeError(
				'asJSON: Value and fallback are both null or undefined',
			)
		if (value == null) return getFallback(host, fallback)
		if (value === '') throw new TypeError('Empty string is not valid JSON')
		let result: T | undefined
		try {
			result = JSON.parse(value)
		} catch (error) {
			throw new SyntaxError(`Failed to parse JSON: ${String(error)}`, {
				cause: error,
			})
		}
		return result ?? getFallback(host, fallback)
	}

export {
	type Parser,
	type ParserOrFallback,
	type LooseReader,
	type Reader,
	isParser,
	asBoolean,
	asInteger,
	asNumber,
	asString,
	asEnum,
	asJSON,
	getFallback,
	read,
}
