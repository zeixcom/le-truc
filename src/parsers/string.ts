import { type Fallback, getFallback, type Parser } from '../parsers'
import type { UI } from '../ui'

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

export { asString, asEnum }
