/**
 * Conservative CSS selector *parse* validation (ADR 0028 sub-design 5,
 * LT-157b). Since LT-380 (ADR 0045 Decision 5,
 * ../../../adr/0045-structural-uniqueness-proof-runs-on-a-materialized-probe.md)
 * the decision runs on a css-what parse — the parser css-select itself
 * uses — plus a small post-check over the parsed branches; the ~170 hand
 * rules this module carried before are gone.
 *
 * `first-refs.ts`'s `parseSimpleSelector` answers a different question: can
 * this compiler *structurally match* the selector against the component's
 * own template IR? It returns `null` for anything richer than its subset —
 * `:not([hidden])`, descendant combinators — which means "cannot verify,"
 * never "malformed." Those two answers must not be conflated: LTC026's
 * unverifiable-syntax half is a limit of the compiler, whereas a genuinely
 * malformed selector is a limit of CSS, and the runtime's
 * `InvalidSelectorError` (`createElementsMemo`'s eager `querySelector`
 * probe) fires only for the second.
 *
 * This module decides the second. The asymmetry is unchanged and remains
 * deliberate: a false positive here fails a build over working markup,
 * while a false negative merely leaves the pre-existing Tier 2 backstop
 * doing its job (ADR 0028 sub-design 1 — the compiler is the primary
 * channel, not the only one). The post-check therefore keeps only what
 * css-what tolerates but CSS's grammar forbids — a trailing combinator, a
 * lone leading one — and maps css-what's own throw classes onto the
 * reason strings this module has always produced. css-what does not
 * validate pseudo-class names, and this module keeps NOT deciding them: a
 * misspelled pseudo (`a:hver`) passes compile and dies at the Tier 2
 * backstop. Throws outside the mapped classes (junk css-what trips over
 * that these reasons never covered) stay undecidable — `null` — for the
 * same false-positive asymmetry; widening them is a copy decision, not an
 * engine one.
 */

import * as cssWhat from 'css-what'

/* === Internal Functions === */

/** The traversal entries a css-what branch spells combinators with. */
const TRAVERSALS = new Set([
	'descendant',
	'child',
	'adjacent',
	'sibling',
	'column-combinator',
])

const COMBINATOR_CHAR: Record<string, string> = {
	descendant: ' ',
	child: '>',
	adjacent: '+',
	sibling: '~',
	'column-combinator': '||',
}

const isTraversal = (simple: cssWhat.Selector): boolean =>
	TRAVERSALS.has(simple.type)

/**
 * The first successive combinator pair outside quoted strings, as the
 * character today's message names — css-what's own throw for this case
 * does not say which combinator it choked on.
 */
const successiveCombinatorChar = (selector: string): string => {
	let quote: string | null = null
	let prev = ''
	for (let i = 0; i < selector.length; i++) {
		const char = selector[i] as string
		if (quote) {
			if (char === '\\') i++
			else if (char === quote) quote = null
			continue
		}
		if (char === '"' || char === "'") {
			quote = char
			prev = ''
			continue
		}
		if (/[>+~]/.test(char) && /[>+~]/.test(prev)) return char
		if (!/\s/.test(char)) prev = char
	}
	return '>'
}

/**
 * Map a css-what parse failure onto the reason strings this module has
 * always produced, or `null` when the throw class is one the hand rules
 * never covered — undecidable, not malformed (the false-positive
 * asymmetry above).
 */
const throwReason = (selector: string, error: unknown): string | null => {
	const message = error instanceof Error ? error.message : String(error)
	if (message.startsWith('Empty sub-selector'))
		return 'it has an empty selector between commas'
	if (message.startsWith('Attribute selector didn'))
		return 'it leaves a `[` unclosed'
	if (message.startsWith('Attribute value didn'))
		return 'it has an unterminated quoted string'
	if (message.startsWith('Missing closing parenthesis'))
		return 'it leaves a `(` unclosed'
	if (message.startsWith('Parenthesis not matched'))
		return 'it leaves a `(` unclosed'
	if (message.startsWith('Did not expect successive traversals'))
		return `two combinators follow each other (\`${successiveCombinatorChar(selector)}\`)`
	const unmatched = message.match(/^Unmatched selector: (.+)$/)
	if (unmatched) {
		const char = (unmatched[1] as string)[0]
		if (char === ']') return 'it closes a `]` that was never opened'
		if (char === ')') return 'it closes a `)` that was never opened'
		if (char === '"' || char === "'")
			return 'it has an unterminated quoted string'
		if (char === '(') return 'it leaves a `(` unclosed'
	}
	if (message.startsWith('Expected name, found ')) {
		const found = message.slice('Expected name, found '.length)
		// End of input where a name was expected: an attribute selector left
		// open (`button[` — the pinned LTC026 face).
		if (found === '') return 'it leaves a `[` unclosed'
		return `\`${found[0]}\` is not followed by a name`
	}
	return null
}

/* === Exported Functions === */

/**
 * Reason `selector` is definitely malformed, or `null` when this module
 * cannot prove it is. Never returns a reason for a selector CSS accepts.
 */
export const malformedSelectorReason = (selector: string): string | null => {
	if (selector.trim() === '') return 'it is empty'

	let branches
	try {
		branches = cssWhat.parse(selector)
	} catch (error) {
		return throwReason(selector, error)
	}

	// css-what TOLERATES two shapes CSS forbids — a trailing combinator
	// (`button >`) and a lone leading one (`> a`) — and returns zero
	// branches for the empty string (special-cased above). Both tolerated
	// shapes keep today's decisions as post-checks.
	for (const branch of branches) {
		const last = branch.at(-1)
		if (last && isTraversal(last)) return 'it ends with a combinator'
		const first = branch[0]
		if (first && isTraversal(first))
			return `the combinator \`${COMBINATOR_CHAR[first.type] ?? '?'}\` has no selector before it`
	}
	return null
}
