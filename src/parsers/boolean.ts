import { asParser, type Parser } from '../types'

/**
 * Converts a boolean HTML attribute to a boolean value.
 *
 * Returns `true` when the attribute is present and its value is not
 * `"false"` (case-insensitive). Returns `fallback` when the attribute is
 * absent. This also covers ARIA-style attributes like `aria-hidden="true"`.
 *
 * @since 0.13.1
 * @param fallback - Value to use when the attribute is absent
 * @returns Parser that returns the boolean value
 */
const asBoolean = (fallback: boolean = false): Parser<boolean> =>
	asParser((value: string | null | undefined) =>
		value != null ? value.toLowerCase() !== 'false' : fallback,
	)

export { asBoolean }
