import { describe, expect, test } from 'bun:test'
import { migrateShadowCss } from '../../../scripts/migrate-shadow-css'
import { parseComponentSheet } from '../../compiler/css'
import {
	checkSheetBoundaries,
	checkSheetContract,
} from '../../compiler/css-scope'

/**
 * The tag-led → shadow-root codemod (LT-306), kept for pioneer projects.
 * LT-400: whether a rule leaves the scope as a page-level `:global` rule
 * is decided from the selector's structure — a custom-element compound
 * followed by a descendant or child combinator, LTC071's shape — at every
 * nesting level, never from a dashed name anywhere in the text.
 */

/** Migrate, then assert the result passes the compiler's sheet checks. */
const migrate = (
	sheet: string,
	tag = 'my-el',
	boundaries: string[] = ['child-el'],
): string => {
	const out = migrateShadowCss(sheet, tag)
	const { sheet: parsed, errors } = parseComponentSheet(out)
	expect(errors).toEqual([])
	expect(checkSheetContract(parsed, out, tag)).toEqual([])
	expect(checkSheetBoundaries(parsed, out, boundaries)).toEqual([])
	return out
}

describe('migrateShadowCss — the cross-boundary decision (LT-400)', () => {
	test('a dashed CLASS name is not a custom element', () => {
		const out = migrate('my-el .foo-bar { color: red }')
		expect(out).toBe('.foo-bar { color: red }')
	})

	test('a rule whose subject IS the composed child stays scoped', () => {
		const out = migrate(
			'my-el child-el { contain: inline-size }\nmy-el > child-el { top: 0 }',
		)
		expect(out).toBe(
			'child-el { contain: inline-size }\n:host > child-el { top: 0 }',
		)
		expect(out).not.toContain(':global')
	})

	test('a sibling of the composed child stays scoped', () => {
		const out = migrate('my-el child-el + p { top: 0 }')
		expect(out).toBe('child-el + p { top: 0 }')
	})

	test('a top-level crossing becomes an in-place whole-rule :global', () => {
		const out = migrate('my-el child-el .x { top: 0 }')
		expect(out).toBe(':global(my-el child-el .x) { top: 0 }')
	})

	test('a crossing through nesting hoists, under its conditions, resolved and tag-led (the listnav shape)', () => {
		const out = migrate(
			[
				'@container (width > 45em) {',
				'\tmy-el {',
				'\t\tdisplay: grid;',
				'',
				'\t\t& child-el {',
				'\t\t\t& h1,',
				'\t\t\t& h2 {',
				'\t\t\t\tmargin-top: 0;',
				'\t\t\t}',
				'\t\t}',
				'\t}',
				'}',
			].join('\n'),
		)
		expect(out).toBe(
			[
				'@container (width > 45em) {',
				'\t:host {',
				'\t\tdisplay: grid;',
				'\t}',
				'}',
				'',
				':global {',
				'\t@container (width > 45em) {',
				'\t\tmy-el child-el h1,',
				'\t\tmy-el child-el h2 {',
				'\t\t\tmargin-top: 0;',
				'\t\t}',
				'\t}',
				'}',
			].join('\n'),
		)
	})

	test('a mixed list splits: the crossing members hoist, the rest stays', () => {
		const out = migrate('my-el { & child-el p, & .own { top: 0 } }')
		expect(out).toContain(':host { & .own { top: 0 } }')
		expect(out).toContain(':global {\n\tmy-el child-el p {\n\t\ttop: 0\n\t}\n}')
	})

	test('a page rule under a condition hoists instead of nesting :global (LTC069)', () => {
		const out = migrate(
			'@media print { body.x { color: red } }\nmy-el { top: 0 }',
		)
		expect(out).toContain(':global {\n\t@media print {\n\t\tbody.x {')
		expect(out).toContain(':host { top: 0 }')
	})

	test('the shadow-root form passes through unchanged (idempotent)', () => {
		const once = migrateShadowCss(
			'my-el { & child-el { & h1 { top: 0 } } }',
			'my-el',
		)
		expect(migrateShadowCss(once, 'my-el')).toBe(once)
	})
})
