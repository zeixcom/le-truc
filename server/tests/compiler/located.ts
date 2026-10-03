/**
 * Test helpers over a diagnostic's range (ADR 0044 s1, LT-371): the line
 * it starts on and the authored text it covers. They read the published
 * record (`location`) and the stages' local one (`range`) alike.
 */

import { lineOf } from '../../compiler/diagnostics'

type Ranged =
	| { location: { start: number; end: number } }
	| { range: { start: number; end: number } }

const rangeOf = (d: Ranged): { start: number; end: number } =>
	'location' in d ? d.location : d.range

/** The 1-based line `d` starts on in `source`. */
export const lineAt = (source: string, d: Ranged | undefined) =>
	d ? lineOf(source, rangeOf(d).start) : undefined

/** The authored text `d` covers in `source`. */
export const textAt = (source: string, d: Ranged | undefined) =>
	d ? source.slice(rangeOf(d).start, rangeOf(d).end) : undefined
