import { isFunction } from '@zeix/cause-effect'
import type { Component, ComponentProps } from './component'
import type { Fallback, Reader } from './readers'
import type { UI } from './ui'

/* === Types === */

type Parser<T extends {}> = <C extends HTMLElement>(
	host: C,
	value: string | null | undefined,
	old?: string | null,
) => T

type ParserOrFallback<T extends {}> = Parser<T> | Fallback<T>

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
const isParser = <T extends {}>(value: unknown): value is Parser<T> =>
	isFunction<T>(value) && value.length >= 2

/**
 * Get a fallback value for an element
 *
 * @since 0.14.0
 * @param {C} host - Host component
 * @param {ParserOrFallback<T>} fallback - Fallback value or parser function
 * @returns {T} Fallback value or parsed value
 */
const getFallback = <T extends {}, C extends HTMLElement>(
	host: C,
	fallback: ParserOrFallback<T>,
): T => (isFunction<T>(fallback) ? fallback(host) : fallback) as T

/**
 * Parse a boolean attribute as an actual boolean value
 *
 * @since 0.13.1
 * @returns {Parser<boolean>}
 */
const asBoolean =
	(): Parser<boolean> => (_: HTMLElement, value: string | null | undefined) =>
		value != null && value !== 'false'

/**
 * Parse a string as a number forced to integer with a fallback
 *
 * Supports hexadecimal and scientific notation
 *
 * @since 0.11.0
 * @param {Fallback<number>} [fallback=0] - Fallback value or extractor function
 * @returns {Parser<number>} Parser function
 */
const asInteger =
	(fallback: Fallback<number> = 0): Parser<number> =>
	<C extends HTMLElement>(host: C, value: string | null | undefined) => {
		if (value == null) return getFallback(host, fallback)

		// Handle hexadecimal notation
		const trimmed = value.trim()
		if (trimmed.toLowerCase().startsWith('0x'))
			return (
				parseNumber(v => parseInt(v, 16), trimmed) ??
				getFallback(host, fallback)
			)

		// Handle other formats (including scientific notation)
		const parsed = parseNumber(parseFloat, value)
		return parsed != null ? Math.trunc(parsed) : getFallback(host, fallback)
	}

/**
 * Parse a string as a number with a fallback
 *
 * @since 0.11.0
 * @param {Fallback<number>} [fallback=0] - Fallback value or extractor function
 * @returns {Parser<number>} Parser function
 */
const asNumber =
	(fallback: Fallback<number> = 0): Parser<number> =>
	<C extends HTMLElement>(host: C, value: string | null | undefined) =>
		parseNumber(parseFloat, value) ?? getFallback(host, fallback)

/**
 * Pass through string with a fallback
 *
 * @since 0.11.0
 * @param {Fallback<string>} [fallback=''] - Fallback value or extractor function
 * @returns {Parser<string>} Parser function
 */
const asString =
	(fallback: Fallback<string> = ''): Parser<string> =>
	<C extends HTMLElement>(host: C, value: string | null | undefined) =>
		value ?? getFallback(host, fallback)

/**
 * Parse a string as a multi-state value (for example: ['true', 'false', 'mixed'], defaulting to the first valid option
 *
 * @since 0.9.0
 * @param {[string, ...string[]]} valid - Array of valid values
 * @returns {Parser<string>} Parser function
 */
const asEnum =
	(valid: [string, ...string[]]): Parser<string> =>
	(_: HTMLElement, value: string | null | undefined) => {
		if (value == null) return valid[0]
		const lowerValue = value.toLowerCase()
		const matchingValid = valid.find(v => v.toLowerCase() === lowerValue)
		return matchingValid ? value : valid[0]
	}

/**
 * Parse a string as a JSON serialized object with a fallback
 *
 * @since 0.11.0
 * @param {Fallback<T>} fallback - Fallback value or extractor function
 * @returns {Parser<T>} Parser function
 * @throws {TypeError} If the value and fallback are both null or undefined
 * @throws {SyntaxError} If value is not a valid JSON string
 */
const asJSON =
	<T extends {}>(fallback: Fallback<T>): Parser<T> =>
	<C extends HTMLElement>(host: C, value: string | null | undefined) => {
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
	isParser,
	asBoolean,
	asInteger,
	asNumber,
	asString,
	asEnum,
	asJSON,
	getFallback,
}
