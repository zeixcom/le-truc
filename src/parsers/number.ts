import { asParser, type Parser } from '../types'

/* === Internal Functions === */

/**
 * Parses a string value with the given parse function.
 *
 * @param parseFn - Parsing function (e.g. `parseFloat`, `parseInt`)
 * @param value - Raw attribute string to parse
 * @returns Parsed finite number, or `undefined` if the value is nullish or unparseable
 */
const parseNumber = (
	parseFn: (v: string) => number,
	value: string | null | undefined,
): number | undefined => {
	if (value == null) return
	const parsed = parseFn(value)
	return Number.isFinite(parsed) ? parsed : undefined
}

/* === Exported Functions === */

/**
 * Parses a string as an integer, with a fallback. Supports hexadecimal
 * and scientific notation.
 *
 * @since 0.11.0
 * @param fallback - Value to use when the attribute is absent or unparseable
 * @returns Parser that returns the integer value
 */
const asInteger = (fallback: number = 0): Parser<number> =>
	asParser((value: string | null | undefined) => {
		if (value == null) return fallback

		const trimmed = value.trim()
		if (trimmed.toLowerCase().startsWith('0x'))
			return parseNumber(v => parseInt(v, 16), trimmed) ?? fallback

		const parsed = parseNumber(parseFloat, value)
		return parsed != null ? Math.trunc(parsed) : fallback
	})

/**
 * Parses a string as a number, with a fallback.
 *
 * @since 0.11.0
 * @param fallback - Value to use when the attribute is absent or unparseable
 * @returns Parser that returns the number value
 */
const asNumber = (fallback: number = 0): Parser<number> =>
	asParser(
		(value: string | null | undefined) =>
			parseNumber(parseFloat, value) ?? fallback,
	)

/**
 * Parses a string as an integer, clamped between `min` and `max`.
 *
 * @since 2.0
 * @param min - Minimum value; also the fallback when the attribute is absent
 * @param max - Maximum value
 * @returns Parser that returns the clamped integer value
 */
const asClampedInteger = (
	min: number = 0,
	max: number = Number.MAX_SAFE_INTEGER,
): Parser<number> =>
	asParser((value: string | null | undefined) => {
		if (value == null) return min
		const trimmed = value.trim()
		const raw = trimmed.toLowerCase().startsWith('0x')
			? parseNumber(v => parseInt(v, 16), trimmed)
			: parseNumber(parseFloat, value)
		const parsed = raw != null ? Math.trunc(raw) : min
		return Math.max(min, Math.min(parsed, max))
	})

export { asClampedInteger, asInteger, asNumber }
