import { asParser, type Fallback, getFallback, type Parser } from '../parsers'
import type { UI } from '../ui'

/**
 * Parse a string as a localized date string, or a fallback when absent or invalid
 *
 * @since 1.1
 * @param {Fallback<string, U>} [fallback=''] - Fallback value or reader function
 * @returns {Parser<string, U>} Parser function
 */
const asDate = <U extends UI>(
	fallback: Fallback<string, U> = '',
): Parser<string, U> =>
	asParser((ui: U, value: string | null | undefined) =>
		value
			? new Date(value).toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				})
			: getFallback(ui, fallback),
	)

export { asDate }
