import { asParser, isReservedWord, type Parser } from '../types'

/**
 * Parses a string as JSON, with a fallback.
 *
 * Drops reserved keys (`__proto__`, `constructor`, …) from the parsed
 * result at every nesting level, so a crafted payload cannot pollute a
 * host's prototype chain.
 *
 * @since 0.11.0
 * @param fallback - Value to use when the attribute is absent
 * @returns Parser that returns the parsed object
 * @throws {TypeError} If the value and fallback are both null or undefined
 * @throws {SyntaxError} If the value is not a valid JSON string
 */
const asJSON = <T extends {}>(fallback: T): Parser<T> =>
	asParser((value: string | null | undefined) => {
		if ((value ?? fallback) == null)
			throw new TypeError(
				'asJSON: Value and fallback are both null or undefined',
			)
		if (value == null) return fallback
		if (value === '') throw new SyntaxError('Empty string is not valid JSON')
		let result: T | undefined
		try {
			result = JSON.parse(value, (key, parsed) =>
				isReservedWord(key) ? undefined : parsed,
			)
		} catch (error) {
			throw new SyntaxError(`Failed to parse JSON: ${String(error)}`, {
				cause: error,
			})
		}
		return result ?? fallback
	})

export { asJSON }
