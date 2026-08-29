import {
	converter,
	modeOklch,
	modeP3,
	modeRgb,
	type Oklch,
	useMode,
} from 'culori/fn'
import { asParser } from '../../index'

// culori's `fn` build ships mode DEFINITIONS but registers none of them —
// `converter('oklch')` silently returns a converter that resolves nothing,
// and `inGamut('p3')` throws at creation. This module is the corpus's one
// culori setup point: importing it (as every consumer of this parser does)
// registers the modes the examples use, in BOTH the browser bundle and the
// generated `.tsrx` server modules (which re-emit authored imports
// verbatim, so the side effect arrives with the import itself).
useMode(modeOklch)
useMode(modeP3)
useMode(modeRgb)

export const asOklch = (
	fallback: Oklch = { mode: 'oklch', l: 0.48, c: 0.23, h: 263 },
) =>
	asParser<Oklch>(
		value => (value ? converter('oklch')(value) : fallback) ?? fallback,
	)
