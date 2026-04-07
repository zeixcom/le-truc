import { asParser, type Parser } from '../parsers'

/**
 * Parser that returns the attribute value as a string, or a fallback when absent.
 *
 * @since 0.11.0
 * @param {string} [fallback=''] - Static fallback string
 * @returns {Parser<string>} Parser that returns the attribute string or the fallback
 */
const asString = (fallback: string = ''): Parser<string> =>
	asParser((value: string | null | undefined) => value ?? fallback)

/**
 * Parser that constrains an attribute value to one of a fixed set of allowed strings.
 *
 * Comparison is case-insensitive. If the attribute value is absent or does not match
 * any allowed value, the first entry of `valid` is returned as the default.
 *
 * @since 0.9.0
 * @param {[string, ...string[]]} valid - Non-empty array of allowed values; first entry is the default
 * @returns {Parser<string>} Parser that returns a valid enum value
 */
const asEnum = (valid: [string, ...string[]]): Parser<string> =>
	asParser((value: string | null | undefined) => {
		if (value == null) return valid[0]
		const lowerValue = value.toLowerCase()
		const matchingValid = valid.find(v => v.toLowerCase() === lowerValue)
		return matchingValid ?? valid[0]
	})

export { asEnum, asString }
