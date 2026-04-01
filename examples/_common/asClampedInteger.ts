import { asInteger, asParser, type Fallback, type UI } from '../..'

/**
 * Parse a string as a clamped integer (>= min, <= max)
 */
export const asClampedInteger = <U extends UI>(
	minFallback: Fallback<number, U> = 0,
	maxFallback: Fallback<number, U> = Number.MAX_SAFE_INTEGER,
) =>
	asParser((ui: U, value: string | null | undefined) => {
		const getFallback = (fallback: Fallback<number, U>) =>
			typeof fallback === 'function' ? fallback(ui) : fallback

		const parsed = asInteger(minFallback)(ui, value)
		const min = getFallback(minFallback)
		const max = getFallback(maxFallback)
		return Math.max(min, Math.min(parsed, max))
	})
