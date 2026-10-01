/**
 * Unit pins for `selector-syntax.ts` (LTC026's parse half, LT-157b; on
 * css-what since LT-380, ADR 0045 Decision 5). The contract is asymmetric:
 * a reason for a selector a browser accepts is a build failure over working
 * markup — never acceptable — while passing a browser-invalid string merely
 * leaves the runtime's `InvalidSelectorError` (Tier 2) doing its job. The
 * reason strings here are the ones LTC026 has always produced; the swap
 * re-decides them from a css-what parse plus a small post-check, so each
 * string is pinned to the shape that produces it.
 */
import { describe, expect, test } from 'bun:test'
import * as cssWhat from 'css-what'
import { malformedSelectorReason } from '../../compiler/selector-syntax'

const reasonOf = (selector: string): string | null =>
	malformedSelectorReason(selector)

describe("reasons css-what throws, mapped to today's strings", () => {
	test('empty and whitespace-only selectors', () => {
		expect(reasonOf('')).toBe('it is empty')
		expect(reasonOf('   ')).toBe('it is empty')
	})

	test('empty comma groups', () => {
		expect(reasonOf('a,')).toBe('it has an empty selector between commas')
		expect(reasonOf(',a')).toBe('it has an empty selector between commas')
		expect(reasonOf('a,,b')).toBe('it has an empty selector between commas')
		expect(reasonOf('a[b="x,y"],')).toBe(
			'it has an empty selector between commas',
		)
	})

	test('unclosed attribute selector (the pinned LTC026 face)', () => {
		expect(reasonOf('button[')).toBe('it leaves a `[` unclosed')
		expect(reasonOf('button[role="option"')).toBe('it leaves a `[` unclosed')
	})

	test('unclosed grouping parenthesis', () => {
		expect(reasonOf('a:not(b')).toBe('it leaves a `(` unclosed')
		expect(reasonOf('button(')).toBe('it leaves a `(` unclosed')
	})

	test('brackets and parens closed without being opened', () => {
		expect(reasonOf('button]')).toBe('it closes a `]` that was never opened')
		expect(reasonOf('button)')).toBe('it closes a `)` that was never opened')
		expect(reasonOf('a:not(b))')).toBe('it closes a `)` that was never opened')
	})

	test('unterminated quoted string', () => {
		expect(reasonOf('button"')).toBe('it has an unterminated quoted string')
		expect(reasonOf('a[b="c')).toBe('it has an unterminated quoted string')
	})

	test('successive combinators name the second one', () => {
		expect(reasonOf('a > > b')).toBe('two combinators follow each other (`>`)')
		expect(reasonOf('a ~ + b')).toBe('two combinators follow each other (`+`)')
	})

	test('a trailing combinator (css-what tolerates it; the post-check does not)', () => {
		expect(reasonOf('button >')).toBe('it ends with a combinator')
		expect(reasonOf('a ~')).toBe('it ends with a combinator')
		expect(reasonOf('a > b >')).toBe('it ends with a combinator')
	})

	test('a lone leading combinator (css-what tolerates it; the post-check does not)', () => {
		expect(reasonOf('> a')).toBe('the combinator `>` has no selector before it')
		expect(reasonOf('~ a')).toBe('the combinator `~` has no selector before it')
	})
})

describe('selectors CSS accepts are never reported', () => {
	test('the unverifiable-but-valid shapes LTC026 must not touch', () => {
		expect(reasonOf('button[role="option"]:not([hidden])')).toBeNull()
		expect(reasonOf('a:focus')).toBeNull()
		expect(reasonOf('.b .c')).toBeNull()
		expect(reasonOf('a > b + c')).toBeNull()
		expect(reasonOf('[a="b" i]')).toBeNull()
		expect(reasonOf('a:hover, button[disabled]')).toBeNull()
	})

	test('unknown pseudo-class names are not decided (list-free posture)', () => {
		// css-what does not validate pseudo names; neither does this module.
		// A misspelled pseudo passes compile and dies at the Tier 2 backstop.
		expect(reasonOf('a:hver')).toBeNull()
		expect(reasonOf('a::part(x)')).toBeNull()
	})
})

describe('css-what throws this module never decided stay undecidable', () => {
	test('junk characters pass through as null, not a reason', () => {
		// The hand rules passed these (false negatives); the swap keeps them
		// null — a new reason string is a copy decision, not an engine one.
		expect(reasonOf('a{}')).toBeNull()
		expect(reasonOf('a;')).toBeNull()
	})

	test("css-what's leniency toward browser-invalid shapes is a false negative", () => {
		// `. b` parses as class " b" for css-what (a browser throws); the
		// accepted contract: passing it leaves the Tier 2 backstop on duty.
		expect(reasonOf('. b')).toBeNull()
		expect(reasonOf('a. b')).toBeNull()
	})
})

describe('where css-what is stricter than browsers (LT-384)', () => {
	test('forgiving lists: an empty group inside :is()/:where() is valid', () => {
		expect(reasonOf(':is()')).toBeNull()
		expect(reasonOf('a:where()')).toBeNull()
		expect(reasonOf(':is(a,,b)')).toBeNull()
		expect(reasonOf(':where(a, )')).toBeNull()
		expect(reasonOf('a:is(,b)')).toBeNull()
	})

	test('a top-level empty group is still decided beside a nested one', () => {
		expect(reasonOf(':is(a),')).toBe('it has an empty selector between commas')
		expect(reasonOf(', :where()')).toBe(
			'it has an empty selector between commas',
		)
	})

	test('the nesting selector is undecidable, not malformed', () => {
		expect(reasonOf('&')).toBeNull()
		expect(reasonOf('& > a')).toBeNull()
	})

	test('comments are undecidable, not successive combinators', () => {
		expect(reasonOf('a /* c */ b')).toBeNull()
		expect(reasonOf('a > /* c */ b')).toBeNull()
		// Inside a quoted value neither `&` nor `/*` is syntax.
		expect(reasonOf('[a="&/*"],')).toBe(
			'it has an empty selector between commas',
		)
	})

	test('invalid shapes the old mapping misnamed stay undecided', () => {
		// Browser-invalid (`:not`/`:has` are not forgiving; `z` is junk inside
		// a CLOSED bracket) — null leaves the Tier 2 backstop on duty rather
		// than ship a reason that names the wrong fault.
		expect(reasonOf('a:not()')).toBeNull()
		expect(reasonOf('a:has()')).toBeNull()
		expect(reasonOf('[x="y" z]')).toBeNull()
	})
})

describe('css-what message prefixes the reason map matches', () => {
	// `throwReason` keys on css-what's error text (`css-what` ^8.0.0). A
	// release that rewords one silently degrades its reason to null — the
	// safe direction, but a lost decision — so each mapped prefix is pinned
	// against the raw throw here.
	const thrown = (selector: string): string => {
		try {
			cssWhat.parse(selector)
		} catch (error) {
			return (error as Error).message
		}
		return '(no throw)'
	}

	test.each([
		['a,', 'Empty sub-selector'],
		['a[b', "Attribute selector didn't terminate"],
		['[a="b', "Attribute value didn't end"],
		['a:not(b', 'Missing closing parenthesis'],
		['a:nth-child(2n', 'Parenthesis not matched'],
		['a~~b', 'Did not expect successive traversals'],
		['a]', 'Unmatched selector: ]'],
		['button[', 'Expected name, found '],
	])('%p throws %p', (selector, prefix) => {
		expect(thrown(selector).startsWith(prefix)).toBe(true)
	})
})
