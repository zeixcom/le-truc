import { asParser, type Parser } from '../parsers'

/**
 * Parse a string as a localized date string, or a fallback when absent or invalid
 *
 * @since 2.0
 * @param {string} [fallback=''] - Fallback value
 * @returns {Parser<string>} Parser function
 */
const asDate = (fallback: string = ''): Parser<string> =>
	asParser((value: string | null | undefined) =>
		value
			? new Date(value).toLocaleDateString(undefined, {
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				})
			: fallback,
	)

export { asDate }
