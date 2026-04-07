import { asParser, type Parser } from '../parsers'

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
 * Parse a string as a number forced to integer with a fallback
 *
 * Supports hexadecimal and scientific notation
 *
 * @since 0.11.0
 * @param {number} [fallback=0] - Fallback value
 * @returns {Parser<number>} Parser function
 */
const asInteger = (fallback: number = 0): Parser<number> =>
	asParser((value: string | null | undefined) => {
		if (value == null) return fallback

		// Handle hexadecimal notation
		const trimmed = value.trim()
		if (trimmed.toLowerCase().startsWith('0x'))
			return parseNumber(v => parseInt(v, 16), trimmed) ?? fallback

		// Handle other formats (including scientific notation)
		const parsed = parseNumber(parseFloat, value)
		return parsed != null ? Math.trunc(parsed) : fallback
	})

/**
 * Parse a string as a number with a fallback
 *
 * @since 0.11.0
 * @param {number} [fallback=0] - Fallback value
 * @returns {Parser<number>} Parser function
 */
const asNumber = (fallback: number = 0): Parser<number> =>
	asParser(
		(value: string | null | undefined) =>
			parseNumber(parseFloat, value) ?? fallback,
	)

/**
 * Parse a string as a clamped integer (>= min, <= max) with fallbacks
 *
 * @since 2.0
 * @param {number} [min=0] - Minimum value
 * @param {number} [max=Number.MAX_SAFE_INTEGER] - Maximum value
 * @returns {Parser<number>} Parser function
 */
const asClampedInteger = (
	min: number = 0,
	max: number = Number.MAX_SAFE_INTEGER,
): Parser<number> =>
	asParser((value: string | null | undefined) => {
		const parsed = asInteger(min)(value)
		return Math.max(min, Math.min(parsed, max))
	})

export { asClampedInteger, asInteger, asNumber }
