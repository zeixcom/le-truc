/**
 * Conservative CSS selector *parse* validation (ADR 0028 sub-design 5,
 * LT-157b).
 *
 * `first-refs.ts`'s `parseSimpleSelector` answers a different question: can
 * this compiler *structurally match* the selector against the component's
 * own template IR? It returns `null` for anything richer than its subset —
 * `:not([hidden])`, descendant combinators — which means "cannot verify,"
 * never "malformed." Those two answers must not be conflated: TSRX026's
 * unverifiable-syntax half is a limit of the compiler, whereas a genuinely
 * malformed selector is a limit of CSS, and the runtime's
 * `InvalidSelectorError` (`createElementsMemo`'s eager `querySelector`
 * probe) fires only for the second.
 *
 * This module decides the second, and only where it can do so *outright* —
 * every rule below rejects a string no CSS parser accepts, so a selector
 * this module passes is not thereby claimed valid. That asymmetry is
 * deliberate: a false positive here fails a build over working markup,
 * while a false negative merely leaves the pre-existing Tier 2 backstop
 * doing its job (ADR 0028 sub-design 1 — the compiler is the primary
 * channel, not the only one).
 *
 * A real CSS parser would decide more (unknown pseudo-classes, bad
 * `an+b` clauses), but pulling one in — or a DOM to probe with — for this
 * one rule is not worth the dependency; the shapes below are the ones a
 * hand-written selector actually gets wrong.
 */

/* === Internal Functions === */

const COMBINATORS = new Set(['>', '+', '~'])

/** Can `char` start an identifier (or an escape introducing one)? */
const startsIdent = (char: string): boolean =>
	/[A-Za-z_\-\\*]/.test(char) || char.charCodeAt(0) > 127

/**
 * Reason `part` (one comma-separated complex selector) cannot parse, or
 * `null`. Assumes delimiters are already known balanced.
 */
const partReason = (part: string): string | null => {
	const trimmed = part.trim()
	if (trimmed === '') return 'it has an empty selector between commas'

	let depth = 0
	let quote: string | null = null
	/** Was the previous depth-0, non-whitespace token a combinator? */
	let afterCombinator = false
	let sawCompound = false
	for (let i = 0; i < trimmed.length; i++) {
		const char = trimmed[i] as string
		if (quote) {
			if (char === '\\') i++
			else if (char === quote) quote = null
			continue
		}
		if (char === '\\') {
			i++
			sawCompound = true
			afterCombinator = false
			continue
		}
		if (char === '"' || char === "'") {
			quote = char
			continue
		}
		if (char === '[' || char === '(') {
			depth++
			continue
		}
		if (char === ']' || char === ')') {
			depth--
			continue
		}
		if (depth > 0) continue
		if (/\s/.test(char)) continue
		if (COMBINATORS.has(char)) {
			if (!sawCompound)
				return `the combinator \`${char}\` has no selector before it`
			if (afterCombinator)
				return `two combinators follow each other (\`${char}\`)`
			afterCombinator = true
			continue
		}
		if (char === '.' || char === '#' || char === ':') {
			// `::before` — the second colon is part of the same token.
			const next =
				char === ':' && trimmed[i + 1] === ':' ? trimmed[i + 2] : trimmed[i + 1]
			if (next === undefined || !startsIdent(next))
				return `\`${char}\` is not followed by a name`
		}
		sawCompound = true
		afterCombinator = false
	}
	if (afterCombinator) return 'it ends with a combinator'
	return null
}

/* === Exported Functions === */

/**
 * Reason `selector` is definitely malformed, or `null` when this module
 * cannot prove it is. Never returns a reason for a selector CSS accepts.
 */
export const malformedSelectorReason = (selector: string): string | null => {
	if (selector.trim() === '') return 'it is empty'

	// Pass 1: delimiters. Anything unbalanced makes the depth-0 split below
	// meaningless, so it is reported on its own.
	let square = 0
	let paren = 0
	let quote: string | null = null
	for (let i = 0; i < selector.length; i++) {
		const char = selector[i] as string
		if (quote) {
			if (char === '\\') i++
			else if (char === quote) quote = null
			continue
		}
		if (char === '\\') {
			i++
			continue
		}
		if (char === '"' || char === "'") quote = char
		else if (char === '[') square++
		else if (char === ']') {
			square--
			if (square < 0) return 'it closes a `]` that was never opened'
		} else if (char === '(') paren++
		else if (char === ')') {
			paren--
			if (paren < 0) return 'it closes a `)` that was never opened'
		}
	}
	if (quote) return 'it has an unterminated quoted string'
	if (square > 0) return 'it leaves a `[` unclosed'
	if (paren > 0) return 'it leaves a `(` unclosed'

	// Pass 2: each comma-separated complex selector, split at depth 0 so a
	// comma inside `[attr="a,b"]` or `:is(a, b)` does not split anything.
	const parts: string[] = []
	let start = 0
	let depth = 0
	quote = null
	for (let i = 0; i < selector.length; i++) {
		const char = selector[i] as string
		if (quote) {
			if (char === '\\') i++
			else if (char === quote) quote = null
			continue
		}
		if (char === '\\') {
			i++
			continue
		}
		if (char === '"' || char === "'") quote = char
		else if (char === '[' || char === '(') depth++
		else if (char === ']' || char === ')') depth--
		else if (char === ',' && depth === 0) {
			parts.push(selector.slice(start, i))
			start = i + 1
		}
	}
	parts.push(selector.slice(start))
	for (const part of parts) {
		const reason = partReason(part)
		if (reason) return reason
	}
	return null
}
