/**
 * Direct unit tests for `first-refs.ts` (LT-055): the structural matcher
 * `first(selector, required)` resolution uses to find which template
 * element(s) an author's selector refers to, replacing `ref={}`.
 */
import { describe, expect, test } from 'bun:test'
import {
	collectMatchingElements,
	type ElementNode,
	matchesAuthoredSelectorOn,
	shareExclusiveIf,
} from '../../compiler/first-refs'
import type { TemplateNode } from '../../compiler/ir'

/** A minimal element IR node — only the fields `first-refs.ts` reads. */
const el = (
	tag: string,
	attrs: Array<{ name: string; value: string | null }> = [],
	children: ElementNode[] = [],
): ElementNode => ({
	kind: 'element',
	tag,
	attrs: attrs.map(a => ({ kind: 'static' as const, ...a })),
	children,
	node: {} as ElementNode['node'],
})

describe('collectMatchingElements — bare tag/class/id/attribute-presence', () => {
	test('bare tag matches', () => {
		const input = el('input')
		const root = el('c-el', [], [input])
		expect(collectMatchingElements(root, 'input')).toEqual({
			elements: [input],
			unsupported: false,
		})
	})

	test('class selector matches', () => {
		const target = el('p', [{ name: 'class', value: 'status visually-hidden' }])
		const root = el('c-el', [], [target])
		expect(collectMatchingElements(root, '.status').elements).toEqual([target])
	})

	test('id selector matches', () => {
		const target = el('input', [{ name: 'id', value: 'subject' }])
		const root = el('c-el', [], [target])
		expect(collectMatchingElements(root, '#subject').elements).toEqual([target])
	})

	test('attribute-presence (no value) matches regardless of value', () => {
		const target = el('input', [{ name: 'disabled', value: '' }])
		const root = el('c-el', [], [target])
		expect(collectMatchingElements(root, '[disabled]').elements).toEqual([
			target,
		])
	})

	test('attribute-value selector requires an exact match', () => {
		const target = el('input', [{ name: 'type', value: 'checkbox' }])
		const root = el('c-el', [], [target])
		expect(
			collectMatchingElements(root, 'input[type="checkbox"]').elements,
		).toEqual([target])
		expect(
			collectMatchingElements(root, 'input[type="radio"]').elements,
		).toEqual([])
	})

	test('comma-separated list is OR semantics', () => {
		const input = el('input')
		const textarea = el('textarea')
		const root = el('c-el', [], [input, textarea])
		const { elements } = collectMatchingElements(root, 'input, textarea')
		expect(elements).toEqual([input, textarea])
	})

	test('no match, fully-supported syntax: unsupported is false', () => {
		const root = el('c-el', [], [el('input')])
		expect(collectMatchingElements(root, '.nonexistent')).toEqual({
			elements: [],
			unsupported: false,
		})
	})

	test('descendant combinator is unsupported, not "no match"', () => {
		const root = el('c-el', [], [el('div', [], [el('input')])])
		expect(collectMatchingElements(root, 'div input')).toEqual({
			elements: [],
			unsupported: true,
		})
	})

	test('pseudo-class is unsupported', () => {
		const root = el('c-el', [], [el('input')])
		expect(collectMatchingElements(root, 'input:focus').unsupported).toBe(true)
	})

	test('a match on a supported branch wins even if another branch is unsupported', () => {
		const input = el('input')
		const root = el('c-el', [], [input])
		const { elements, unsupported } = collectMatchingElements(
			root,
			'input, div > span',
		)
		expect(elements).toEqual([input])
		// The unsupported branch is still flagged, even though a real match
		// was found via the supported one — the caller only treats zero
		// matches as a hard error, so this is informational, not blocking.
		expect(unsupported).toBe(true)
	})

	test('composed elements are a boundary — never matched or descended into', () => {
		const compose = {
			kind: 'compose' as const,
			component: 'Child',
			source: './child.tsrx',
			attrs: [],
			children: [el('span')],
			node: {} as ElementNode['node'],
		}
		const root: ElementNode = {
			kind: 'element',
			tag: 'c-el',
			attrs: [],
			children: [compose],
			node: {} as ElementNode['node'],
		}
		expect(collectMatchingElements(root, 'span').elements).toEqual([])
	})
})

describe('shareExclusiveIf', () => {
	test('a single element is trivially exclusive', () => {
		const input = el('input')
		expect(shareExclusiveIf(el('c-el', [], [input]), [input])).toBe(true)
	})

	test('two direct branch roots of the same @if, one per branch: exclusive', () => {
		const input = el('input')
		const textarea = el('textarea')
		const ifNode: TemplateNode = {
			kind: 'conditional',
			construct: 'if',
			mode: 'server',
			testText: 'multiline',
			test: {} as ElementNode['node'],
			arms: [
				{ key: 'then', test: null, testText: null, children: [textarea] },
				{ key: 'else', test: null, testText: null, children: [input] },
			],
			initial: { fold: true },
			node: {} as ElementNode['node'],
		}
		const root: ElementNode = {
			kind: 'element',
			tag: 'c-el',
			attrs: [],
			children: [ifNode],
			node: {} as ElementNode['node'],
		}
		expect(shareExclusiveIf(root, [input, textarea])).toBe(true)
	})

	test('two independent siblings (no enclosing @if): not exclusive', () => {
		const a = el('input')
		const b = el('textarea')
		const root = el('c-el', [], [a, b])
		expect(shareExclusiveIf(root, [a, b])).toBe(false)
	})

	test('two matches in the SAME branch of an @if: not exclusive', () => {
		const a = el('input')
		const b = el('input')
		const ifNode: TemplateNode = {
			kind: 'conditional',
			construct: 'if',
			mode: 'server',
			testText: 'cond',
			test: {} as ElementNode['node'],
			arms: [
				{ key: 'then', test: null, testText: null, children: [a, b] },
				{ key: 'else', test: null, testText: null, children: [] },
			],
			initial: { fold: true },
			node: {} as ElementNode['node'],
		}
		const root: ElementNode = {
			kind: 'element',
			tag: 'c-el',
			attrs: [],
			children: [ifNode],
			node: {} as ElementNode['node'],
		}
		expect(shareExclusiveIf(root, [a, b])).toBe(false)
	})
})

/**
 * LT-380: `parseSimpleSelector` parses through css-what now, but the
 * VERIFIED SUBSET is frozen — the swap changed how it parses, not what it
 * verifies (widening is LT-381). These pins hold the subset's boundary
 * against css-what's leniency, through the exported matcher
 * (`null` = cannot verify, never "matches nothing").
 */
describe('the verified subset is unchanged under the css-what parse (LT-380)', () => {
	const attrs = (entries: Array<[string, string | null]>) => new Map(entries)
	const verify = (
		selector: string,
		candidate: { tag: string; attrs: Map<string, string | null> },
	) => matchesAuthoredSelectorOn(candidate, selector)

	test('the supported forms still verify exactly', () => {
		const el = {
			tag: 'input',
			attrs: attrs([
				['type', 'checkbox'],
				['class', 'a b'],
				['id', 'x'],
			]),
		}
		expect(verify('input[type="checkbox"]', el)).toBe(true)
		expect(verify('.b', el)).toBe(true)
		expect(verify('#x', el)).toBe(true)
		expect(verify('[type]', el)).toBe(true)
		expect(verify('input.b#x[type="checkbox"]', el)).toBe(true)
		expect(verify('input[type="radio"]', el)).toBe(false)
		expect(verify('#y', el)).toBe(false)
	})

	test('whitespace outside quoted values stays unverified (css-what is lenient there)', () => {
		const el = { tag: 'input', attrs: attrs([['type', 'checkbox']]) }
		// Browser-valid, but the subset predates the bracket forms — LT-381's widening.
		expect(verify('[ type = "checkbox" ]', el)).toBeNull()
		// Browser-invalid (a class token cannot start with a space); css-what
		// keeps the space in the value, the token check refuses it.
		expect(verify('a. b', el)).toBeNull()
	})

	test('single-quoted, unquoted, and flagged attribute values stay unverified', () => {
		const el = { tag: 'input', attrs: attrs([['type', 'checkbox']]) }
		expect(verify("[type='checkbox']", el)).toBeNull()
		expect(verify('[type=checkbox]', el)).toBeNull()
		expect(verify('[type="checkbox" i]', el)).toBeNull()
	})

	test('an explicit [id="…"] clause is an attribute, not the id path', () => {
		// `#a[id="b"]` can never match (one id, two values) — today's shape
		// of that answer is preserved by routing the explicit clause through
		// the attrs path while only the hash spelling takes the id path.
		const el = { tag: 'input', attrs: attrs([['id', 'b']]) }
		expect(verify('#b', el)).toBe(true)
		expect(verify('[id="b"]', el)).toBe(true)
		expect(verify('#a[id="b"]', el)).toBe(false)
	})

	test('css-what-only tag shapes stay unverified', () => {
		const el = { tag: 'input', attrs: attrs([]) }
		expect(verify('1a', el)).toBeNull() // css-what parses a tag `1a`; browsers throw
		expect(verify('a|b', el)).toBeNull() // namespaced
		expect(verify('input:first-child', el)).toBeNull()
		expect(verify('div > input', el)).toBeNull()
	})
})
