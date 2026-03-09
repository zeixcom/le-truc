import { asParser, type Fallback, type Parser, type UI } from '../..'
import { getFallback } from '../../src/parsers'

export const asDate = <U extends UI>(
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
