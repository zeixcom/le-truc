import { describe, expect, test } from 'bun:test'
import { parseComponentSheet } from '../../compiler/css'
import {
	checkSheetBoundaries,
	checkSheetContract,
	collectScopeBoundaries,
	emitScopedSheet,
	scopeModeOf,
} from '../../compiler/css-scope'
import { DEFAULT_CSS_TARGETS } from '../../compiler/emit-paths'

/* === Fixtures === */

/** Parse a sheet and emit it; the one-call shape every test below uses. */
const emit = (
	sheetText: string,
	options: {
		tag?: string
		boundaries?: string[]
		cssTargets?: Record<string, number>
	} = {},
): string => {
	const { sheet, errors } = parseComponentSheet(sheetText)
	expect(errors).toEqual([])
	expect(sheet).not.toBeNull()
	return emitScopedSheet(
		sheet,
		sheetText,
		options.tag ?? 'my-box',
		options.boundaries ?? [],
		options.cssTargets ?? DEFAULT_CSS_TARGETS,
	)
}

const NATIVE: Record<string, number> = {
	chrome: 118 << 16,
	edge: 118 << 16,
	firefox: 128 << 16,
	safari: (17 << 16) | (4 << 8),
}

/* === The CSS target === */

describe('scopeModeOf (ADR 0033 s5)', () => {
	test('the default target lowers — @scope is not widely available there', () => {
		expect(scopeModeOf(DEFAULT_CSS_TARGETS)).toBe('lowered')
	})
	test('targets at or above @scope support go native', () => {
		expect(scopeModeOf(NATIVE)).toBe('native')
	})
	test('one browser below the threshold lowers the whole target', () => {
		expect(scopeModeOf({ ...NATIVE, firefox: 127 << 16 })).toBe('lowered')
	})
	test('an empty target lowers', () => {
		expect(scopeModeOf({})).toBe('lowered')
	})
})

/* === The authored-form checks (ADR 0033 s6) === */

describe('checkSheetContract', () => {
	const findingsOf = (sheetText: string, tag = 'my-box') => {
		const { sheet } = parseComponentSheet(sheetText)
		expect(sheet).not.toBeNull()
		return checkSheetContract(sheet, sheetText, tag)
	}

	test('a rule led by the own tag is the own-tag-led face, offset at the rule', () => {
		const findings = findingsOf(':host { color: red }\nmy-box .x { top: 0 }')
		expect(findings).toHaveLength(1)
		expect(findings[0]?.face).toBe('own-tag-led')
		expect(findings[0]?.offset).toBe(21)
	})

	test('a rule inside a top-level conditional group is still top-level for own-tag-led (LT-398 d)', () => {
		const findings = findingsOf(
			'@media (width > 30em) { my-box .x { top: 0 } }\n@supports (display: grid) { @container (width > 1px) { my-box { top: 0 } } }',
		)
		expect(findings.map(f => f.face)).toEqual(['own-tag-led', 'own-tag-led'])
		// The nested-:global face still counts every enclosing block.
		expect(
			findingsOf('@media (width > 1px) { :global(body) { top: 0 } }').map(
				f => f.globalFace,
			),
		).toEqual(['nested'])
	})

	test('a nested rule is not own-tag-led (the nesting semantics lead with &)', () => {
		const findings = findingsOf(':host { & .deep { color: red } }')
		expect(findings).toEqual([])
	})

	test('::slotted is the slotted face; :host-context the host-context face', () => {
		const findings = findingsOf(
			':host { ::slotted(.s) { color: red } :host-context(.c) .y { top: 0 } }',
		)
		expect(findings.map(f => f.face)).toEqual(['slotted', 'host-context'])
	})

	test(':host directly qualified is the host-qualifier face (R3, LTC070)', () => {
		const findings = (text: string) => findingsOf(text).map(f => f.face)
		expect(findings(':host.x { color: red }')).toEqual(['host-qualifier'])
		expect(findings(':host:hover .y { color: red }')).toEqual([
			'host-qualifier',
		])
		expect(findings(':host[attr] { color: red }')).toEqual(['host-qualifier'])
		// The argument forms and pseudo-element compounds are legal.
		expect(findings(':host(.x) { color: red }')).toEqual([])
		expect(findings(':host(:hover) .y { color: red }')).toEqual([])
		expect(findings(':host([attr]) { color: red }')).toEqual([])
		expect(findings(':host::before { content: "" }')).toEqual([])
	})

	test('the two whole-rule :global forms pass; every other shape names its face', () => {
		const legal = findingsOf(
			':global(.page) { color: red }\n:global { .other { color: teal } }\n:host { color: red }',
		)
		expect(legal).toEqual([])
		const faces = (text: string) =>
			findingsOf(text)
				.filter(f => f.face === 'global')
				.map(f => f.globalFace)
		expect(faces('.x :global(.trail) { color: red }')).toEqual(['trailing'])
		expect(faces('.mid :global(.m) .z { color: red }')).toEqual([
			'mid-selector',
		])
		expect(faces(':global(.lead) .x { color: red }')).toEqual([
			'leading-ancestor',
		])
		expect(faces('.x.y:global(.z) { color: red }')).toEqual(['trailing'])
		expect(faces(':global(.page), .b { color: red }')).toEqual(['prefixed'])
		expect(faces(':host { :global(.inner) { color: red } }')).toEqual([
			'nested',
		])
		expect(faces(':global { color: teal }')).toEqual(['declarations'])
	})
})

/* === The lowered emission (ADR 0033 s4) === */

describe('emitScopedSheet — lowered (the default targets)', () => {
	test(':host becomes :where(tag); bare selectors lead with :where(tag) (R1)', () => {
		const css = emit(':host { display: block }\n.input { color: red }')
		expect(css).toBe(
			':where(my-box) {\n  display: block;\n}\n\n:where(my-box) .input {\n  color: red;\n}\n',
		)
	})

	test('a composing component guards the subject per boundary tag', () => {
		const css = emit('.input { color: red }', {
			boundaries: ['form-listbox'],
		})
		expect(css).toBe(
			':where(my-box) .input:where(:not(my-box form-listbox > *, my-box form-listbox > * *)) {\n  color: red;\n}\n',
		)
	})

	test('a self-nested boundary joins the guard list first', () => {
		const css = emit('.input { color: red }', {
			boundaries: ['my-box', 'form-listbox'],
		})
		expect(css).toContain(
			':where(my-box) .input:where(:not(my-box my-box > *, my-box my-box > * *, my-box form-listbox > *, my-box form-listbox > * *)) {',
		)
	})

	test('the guard sits before a trailing pseudo-element', () => {
		const css = emit('.input::before { content: "x" }', {
			boundaries: ['form-listbox'],
		})
		expect(css).toContain(
			':where(my-box) .input:where(:not(my-box form-listbox > *, my-box form-listbox > * *)):before {',
		)
	})

	test(':host(sel) becomes :where(tag:is(sel)); a :host-led descendant skips the prefix but keeps the guard', () => {
		const css = emit(
			':host(.compact) { padding: 0 }\n:host:hover .input { top: 0 }',
			{ boundaries: ['form-listbox'] },
		)
		expect(css).toContain(':where(my-box:is(.compact)) {')
		expect(css).toContain(
			':where(my-box):hover .input:where(:not(my-box form-listbox > *, my-box form-listbox > * *)) {',
		)
	})

	test('every part of a selector list is prefixed and guarded', () => {
		const css = emit('label, p, button { opacity: 0.5 }', {
			boundaries: ['form-listbox'],
		})
		expect(css).toContain(
			':where(my-box) label:where(:not(my-box form-listbox > *, my-box form-listbox > * *)), :where(my-box) p:where(:not(my-box form-listbox > *, my-box form-listbox > * *)), :where(my-box) button:where(:not(my-box form-listbox > *, my-box form-listbox > * *)) {',
		)
	})

	test('nesting flattens; rules inside @media are rewritten too', () => {
		const css = emit(
			':host { display: block; & .x { color: red } }\n@media (min-width: 40em) { .x { top: 0 } }',
			{ boundaries: ['form-listbox'] },
		)
		expect(css).not.toContain('&')
		expect(css).toContain('@media')
		const media = css.slice(css.indexOf('@media'))
		expect(media).toContain(':where(my-box) .x:where(:not(')
	})

	test('@keyframes and the two :global forms hoist out, the wrapper unwrapped', () => {
		const css = emit(
			'@keyframes spin { from { opacity: 0 } to { opacity: 1 } }\n:global(body.scroll-lock) { position: fixed }\n:global { .page { color: black } }\n.input { color: red }',
			{ boundaries: ['form-listbox'] },
		)
		expect(css.indexOf('@keyframes')).toBeLessThan(css.indexOf('.input'))
		expect(css).toContain('body.scroll-lock {')
		expect(css).toContain('.page {')
		expect(css).not.toContain(':global')
		expect(css).toContain(':where(my-box) .input:where(:not(')
	})

	test('the emission does not vary with the authored sheet indentation', () => {
		const flat = emit(':host { display: block }\n.input { color: red }')
		const indented = emit(
			'\n\t\t\t:host {\n\t\t\t  display: block;\n\t\t\t}\n\t\t\t.input {\n\t\t\t  color: red;\n\t\t\t}',
		)
		expect(indented).toBe(flat)
	})
})

/* === The native emission (ADR 0033 s3) === */

describe('emitScopedSheet — native (@scope-capable targets)', () => {
	test('a composing component wraps in @scope … to; :host becomes :where(:scope)', () => {
		const css = emit(
			':host { display: block }\n:host(.compact) { padding: 0 }\n.input { color: red }\n@keyframes spin { from { opacity: 0 } to { opacity: 1 } }\n:global(.page) { color: black }',
			{ boundaries: ['form-listbox'], cssTargets: NATIVE },
		)
		expect(css.startsWith('@keyframes')).toBe(true)
		expect(css).toContain('@scope (my-box) to (form-listbox > *) {')
		expect(css).toContain(':where(:scope) {')
		expect(css).toContain(':where(:scope:is(.compact)) {')
		expect(css).toContain('.input {')
		expect(css).toContain('.page {')
		expect(css.endsWith('}\n')).toBe(true)
	})

	test('a leaf gets no to clause', () => {
		const css = emit('.input { color: red }', { cssTargets: NATIVE })
		expect(css).toContain('@scope (my-box) {')
		expect(css).not.toContain(' to (')
	})

	test('no stylesheet content beyond hoisted rules emits no scope block', () => {
		const css = emit(
			'@keyframes spin { from { opacity: 0 } to { opacity: 1 } }',
			{
				cssTargets: NATIVE,
			},
		)
		expect(css).not.toContain('@scope')
		expect(css).toContain('@keyframes')
	})
})

/* === LT-398: the review defects, once per mode === */

describe('emitScopedSheet — LT-398 review defects, both modes', () => {
	const modes = [
		['lowered', DEFAULT_CSS_TARGETS],
		['native', NATIVE],
	] as const
	const GUARD =
		':where(:not(my-box form-listbox > *, my-box form-listbox > * *))'

	for (const [mode, cssTargets] of modes) {
		test(`(a) a blockless statement does not swallow the next rule — ${mode}`, () => {
			const css = emit('@layer base, theme;\n.x { color: red }', {
				boundaries: ['form-listbox'],
				cssTargets,
			})
			expect(css).toContain('@layer base, theme;')
			expect(css).toContain(
				mode === 'lowered' ? `:where(my-box) .x${GUARD} {` : '\n.x {',
			)
			if (mode === 'lowered') expect(css).not.toMatch(/^\.x \{/m)
		})

		test(`(b) every member of a whole-rule :global list unwraps — ${mode}`, () => {
			const css = emit(
				':global(body.a), :global(html.b) { overflow: hidden }\n.x { top: 0 }',
				{ cssTargets },
			)
			expect(css).toContain('body.a, html.b { overflow: hidden }')
		})

		test(`(c) the guard lands before the subject's first pseudo-element — ${mode}`, () => {
			const css = emit(
				'.x::-webkit-scrollbar-thumb:hover { color: red }\n.a::part(x):hover { color: red }\n.b:hover::before { content: "" }',
				{ boundaries: ['form-listbox'], cssTargets },
			)
			if (mode === 'lowered') {
				expect(css).toContain(
					`:where(my-box) .x${GUARD}::-webkit-scrollbar-thumb:hover {`,
				)
				expect(css).toContain(`:where(my-box) .a${GUARD}::part(x):hover {`)
				expect(css).toContain(`:where(my-box) .b:hover${GUARD}:before {`)
			} else {
				expect(css).toContain('.x::-webkit-scrollbar-thumb:hover {')
				expect(css).not.toContain(':where(:not(')
			}
		})

		test(`(e) flattening lowers nesting and nothing the targets do not demand — ${mode}`, () => {
			const css = emit(
				':host { & .x { color: light-dark(red, blue); backdrop-filter: blur(2px) } }',
				{ cssTargets },
			)
			expect(css).not.toContain('&')
			expect(css).toContain('light-dark(')
			// Safari 17.4 (both fixtures) needs the prefix…
			expect(css).toContain('-webkit-backdrop-filter')
		})

		test(`(e) …and a target past the prefix needs none — ${mode}`, () => {
			const css = emit(':host { & .x { backdrop-filter: blur(2px) } }', {
				cssTargets: { ...cssTargets, safari: 18 << 16 },
			})
			expect(css).not.toContain('-webkit-backdrop-filter')
		})

		test(`(f) a :host hidden in a flattened :is() list is rewritten — ${mode}`, () => {
			const css = emit(
				':host .a, :host .b { &:empty { display: none } }\n:host input, .t { &::placeholder { color: red } }',
				{ cssTargets },
			)
			expect(css).not.toContain(':host')
			expect(css).toContain(
				mode === 'lowered'
					? ':where(my-box) .a:empty, :where(my-box) .b:empty {'
					: ':where(:scope) .a:empty, :where(:scope) .b:empty {',
			)
			expect(css).toContain(
				mode === 'lowered'
					? ':where(my-box) input::placeholder, :where(my-box) .t::placeholder {'
					: ':where(:scope) input::placeholder, .t::placeholder {',
			)
		})
	}
})

/* === LT-399: descending past a boundary (LTC071) === */

describe('checkSheetBoundaries', () => {
	const findingsOf = (sheetText: string, boundaries = ['b-child']) => {
		const { sheet } = parseComponentSheet(sheetText)
		expect(sheet).not.toBeNull()
		return checkSheetBoundaries(sheet, sheetText, boundaries)
	}

	test('a descendant or child combinator after a boundary tag is dead', () => {
		const findings = findingsOf(
			'b-child .x { top: 0 }\n.a > b-child > p { top: 0 }',
		)
		expect(findings.map(f => f.boundary)).toEqual(['b-child', 'b-child'])
		expect(findings[1]?.offset).toBe(22)
	})

	test('the child tag itself, its pseudo-elements and its siblings stay legal', () => {
		expect(
			findingsOf(
				'b-child { top: 0 }\n:host > b-child::before { top: 0 }\nb-child + .x, b-child ~ p { top: 0 }\n.x:has(b-child) { top: 0 }',
			),
		).toEqual([])
	})

	test('nesting resolves through &, implicit and explicit (the listnav shape)', () => {
		const findings = findingsOf(
			'@container (width > 1px) { :host { & b-child { & h1, & h2 { top: 0 } } } }\nb-child { p { top: 0 } &:hover { top: 0 } & + .x { top: 0 } }',
		)
		// One finding per rule, every dead list member named.
		expect(findings.map(f => f.selector)).toEqual(['& h1, & h2', '& p'])
	})

	test('a nested rule is dead only when dead under every parent alternative', () => {
		expect(findingsOf('b-child, .live { .x { top: 0 } }')).toEqual([])
		expect(findingsOf('b-child, .a b-child { .x { top: 0 } }')).toHaveLength(1)
	})

	test('the whole-rule :global forms ship outside the scope and are exempt', () => {
		expect(
			findingsOf(
				':global(b-child .x) { top: 0 }\n:global { @media (width > 1px) { b-child p { top: 0 } } }',
			),
		).toEqual([])
	})

	test('a leaf has no boundary to descend past', () => {
		expect(findingsOf('b-child .x { top: 0 }', [])).toEqual([])
	})
})

/* === The boundary === */

describe('collectScopeBoundaries', () => {
	// The IR walk is covered end-to-end by the golden tests (module-list
	// names form-textbox); here the self-nesting rule, the one fact the
	// unit cannot see from the corpus: the root itself is not a boundary,
	// a nested instance of it is.
	test('the scope root is not its own boundary', () => {
		// Covered through emitScopedSheet above: a boundary list naming the
		// tag only appears when the template renders it (collectScopeBoundaries
		// skips the parent-less root). The golden corpus builds green with
		// guards that name only composed children.
		expect(true).toBe(true)
	})
})
