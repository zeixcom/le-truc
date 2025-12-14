import { type Fallback, getFallback, type Parser } from '../parsers'
import type { UI } from '../ui'

/**
 * Parse a string as a JSON serialized object with a fallback
 *
 * @since 0.11.0
 * @param {Fallback<T, U>} fallback - Fallback value or reader function
 * @returns {Parser<T, U>} Parser function
 * @throws {TypeError} If the value and fallback are both null or undefined
 * @throws {SyntaxError} If value is not a valid JSON string
 */
const asJSON =
	<T extends {}, U extends UI>(fallback: Fallback<T, U>): Parser<T, U> =>
	(ui: U, value: string | null | undefined) => {
		if ((value ?? fallback) == null)
			throw new TypeError(
				'asJSON: Value and fallback are both null or undefined',
			)
		if (value == null) return getFallback(ui, fallback)
		if (value === '') throw new TypeError('Empty string is not valid JSON')
		let result: T | undefined
		try {
			result = JSON.parse(value)
		} catch (error) {
			throw new SyntaxError(`Failed to parse JSON: ${String(error)}`, {
				cause: error,
			})
		}
		return result ?? getFallback(ui, fallback)
	}

export { asJSON }
