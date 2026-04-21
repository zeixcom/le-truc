import { asParser } from '../..'
import { converter, type Oklch } from 'culori/fn'

export const asOklch = (
	fallback: Oklch = { mode: 'oklch', l: 0.48, c: 0.23, h: 263 },
) =>
	asParser<Oklch>(
		value => (value ? converter('oklch')(value) : fallback) ?? fallback,
	)
