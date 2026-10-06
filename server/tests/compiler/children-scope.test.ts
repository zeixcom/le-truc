import { describe, expect, test } from 'bun:test'
import { DEFAULT_CSS_TARGETS } from '../../compiler/emit-paths'
import { emitChildrenScoped, foreignRegion } from './children-scope'

/**
 * LT-465 spike fixtures — shape (a), a second scope root at the insertion
 * point, pinned at the text level for both emissions. What each emission
 * MATCHES is measured in a real browser by `spike/children-scope/` (the
 * matrix and its report in NOTES.md); these tests pin the emitted shape the
 * matrix ran against. Kept for ADR 0048: if it adopts another shape, mark
 * this file `describe.skip` rather than deleting it.
 */

const NATIVE: Record<string, number> = {
	chrome: 118 << 16,
	edge: 118 << 16,
	firefox: 128 << 16,
	safari: (17 << 16) | (4 << 8),
}

const P_SHEET = `
:host { display: block }
:host::before { content: '' }
.x { color: red }
.wrap .x { top: 0 }
:host(.on) .x::after { left: 0 }
@media (width > 1px) { pre { top: 1px } }
@keyframes k { from { top: 0 } }
:global(body) { top: 0 }
`

const owner = (mode: 'native' | 'lowered') =>
	emitChildrenScoped(
		P_SHEET,
		'p-par',
		['c-child'],
		mode === 'native' ? NATIVE : DEFAULT_CSS_TARGETS,
		mode,
		{ inserts: false, owns: true },
	)

const child = (mode: 'native' | 'lowered', boundaries: string[] = []) =>
	emitChildrenScoped(
		'.x { top: 0 }',
		'c-child',
		boundaries,
		mode === 'native' ? NATIVE : DEFAULT_CSS_TARGETS,
		mode,
		{ inserts: true, owns: false },
	)

describe('shape (a), native: the owner re-includes its region', () => {
	const css = owner('native')
	const region = css.slice(css.indexOf('@scope ([data-children="p-par"])'))

	test('the region is a second scope root, limited by the same boundaries', () => {
		expect(css).toContain('@scope (p-par) to (c-child > *) {')
		expect(css).toContain('@scope ([data-children="p-par"]) to (c-child > *) {')
	})

	test('region rules take the lowered lead and anchor the subject with :where(:scope *)', () => {
		// The explicit :scope lifts the implicit `:scope ` prefix, so an
		// ancestor compound outside the region (`.wrap`) still matches.
		expect(region).toContain(':where(p-par) .wrap .x:where(:scope *) {')
		expect(region).toContain(':where(p-par) .x:where(:scope *) {')
		// The anchor goes before a pseudo-element, on the originating element.
		expect(region).toContain(':where(p-par:is(.on)) .x:where(:scope *):after {')
		expect(region).toContain('@media (width > 1px) {')
		expect(region).toContain(':where(p-par) pre:where(:scope *) {')
	})

	test('host-subject rules and hoisted rules stay out of the region copy', () => {
		expect(region).not.toContain('display: block')
		expect(region).not.toContain('content:')
		expect(region).not.toContain('@keyframes')
		expect(region).not.toContain('body')
	})
})

describe('shape (a), lowered: one copy, the guard re-includes the region', () => {
	const css = owner('lowered')
	const guard =
		':where(:not(:is(p-par c-child > *, p-par c-child > * *):not(:is([data-children="p-par"] *):not(:is([data-children="p-par"] c-child > *, [data-children="p-par"] c-child > * *)))))'

	test('every guarded rule carries the re-include clause; no second copy', () => {
		expect(css).toContain(`:where(p-par) .x${guard} {`)
		expect(css).toContain(`:where(p-par) .wrap .x${guard} {`)
		expect(css.match(/color: red/g)).toHaveLength(1)
		expect(css).not.toContain('@scope')
	})
})

describe('shape (a), child side: the scope stops at a foreign region', () => {
	test('the pseudo-boundary names every region but the own', () => {
		expect(foreignRegion('c-child')).toBe(
			'[data-children]:not([data-children="c-child"])',
		)
	})

	test('native: a leaf that inserts children gains a `to` limit', () => {
		expect(child('native')).toContain(
			'@scope (c-child) to ([data-children]:not([data-children="c-child"]) > *) {',
		)
	})

	test('lowered: a leaf that inserts children gains a guard', () => {
		expect(child('lowered')).toContain(
			':where(c-child) .x:where(:not(c-child [data-children]:not([data-children="c-child"]) > *, c-child [data-children]:not([data-children="c-child"]) > * *)) {',
		)
	})

	test('the pseudo-boundary joins existing boundaries', () => {
		expect(child('native', ['b-btn'])).toContain(
			'to (b-btn > *, [data-children]:not([data-children="c-child"]) > *)',
		)
	})
})

describe('shape (a): specificity is untouched in both emissions', () => {
	/** Specificity of the rule's first selector, every `:where()` stripped. */
	const outsideWhere = (selector: string): string => {
		let out = ''
		let depth = 0
		for (let i = 0; i < selector.length; i++) {
			if (depth === 0 && selector.startsWith(':where(', i)) {
				depth = 1
				i += ':where('.length - 1
				continue
			}
			if (depth > 0) {
				if (selector[i] === '(') depth++
				else if (selector[i] === ')') depth--
				continue
			}
			out += selector[i]
		}
		return out.trim()
	}

	test('every addition sits inside :where()', () => {
		const native = owner('native')
		const lowered = owner('lowered')
		for (const css of [native, lowered]) {
			const wrap = css
				.split('\n')
				.filter(line => line.includes('.wrap .x') && line.endsWith('{'))
			expect(wrap.length).toBeGreaterThan(0)
			for (const line of wrap)
				expect(outsideWhere(line.slice(0, -1))).toBe('.wrap .x')
		}
	})
})
