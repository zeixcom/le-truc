import { asParser, isReservedWord, type Parser } from '../types'

/**
 * Parse a string as a JSON serialized object with a fallback
 *
 * Reserved words (`__proto__`, `constructor`, …, see `RESERVED_WORDS`) are
 * dropped from the parsed result at every nesting level via a `JSON.parse`
 * reviver, so a crafted payload can't plant an own `__proto__`/`constructor`
 * property that later corrupts a host's prototype chain (defense-in-depth
 * alongside the runtime guard in `#initSignals`).
 *
 * @since 0.11.0
 * @param {T} fallback - Fallback value
 * @returns {Parser<T>} Parser function
 * @throws {TypeError} If the value and fallback are both null or undefined
 * @throws {SyntaxError} If value is not a valid JSON string
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
