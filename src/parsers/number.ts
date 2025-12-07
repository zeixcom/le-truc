import { type Fallback, getFallback, type Parser } from '../parsers'
import type { UI } from '../ui'

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
				parseNumber(v => parseInt(v, 16), trimmed) ?? getFallback(ui, fallback)
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

export { asInteger, asNumber }
