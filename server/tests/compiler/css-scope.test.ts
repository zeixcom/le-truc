import { describe, expect, test } from 'bun:test'
import { parseComponentSheet } from '../../compiler/css'
import {
	checkSheetContract,
	checkSheetLowering,
	describeCssTargets,
	emitScopedSheet,
	scopeModeOf,
} from '../../compiler/css-scope'
import { DEFAULT_CSS_TARGETS } from '../../compiler/emit-paths'

/* === Fixtures === */

/** Parse a sheet and emit it; the one-call shape every test below uses. */
const emit = (
	sheetText: string,
	options: { tag?: string; cssTargets?: Record<string, number> } = {},
): string => {
	const { sheet, errors } = parseComponentSheet(sheetText)
	expect(errors).toEqual([])
	expect(sheet).not.toBeNull()
	return emitScopedSheet(
		sheet,
		sheetText,
		options.tag ?? 'my-box',
		options.cssTargets ?? DEFAULT_CSS_TARGETS,
	)
}

const NATIVE: Record<string, number> = {
	chrome: 118 << 16,
	edge: 118 << 16,
	firefox: 128 << 16,
	safari: (17 << 16) | (4 << 8),
}

/** The guard one limit adds (ADR 0033 s4), for tag `my-box`. */
const guardOf = (limit: string, root = 'my-box'): string =>
	`:where(:not(:is(${root} ${limit}, ${root} ${limit} *):not(${root} ${limit} my-box, ${root} ${limit} my-box *)))`

const PAD = ':not([data-truc-scope-pad])'

/**
 * Specificity of a flat selector as [ids, classes, types]: `:where()` is
 * zero, `:is()`/`:not()` take their argument's maximum, a class, attribute
 * or pseudo-class counts as a class, a type as a type. Enough for the
 * selectors the emission writes.
 */
const specificity = (selector: string): [number, number, number] => {
	const total: [number, number, number] = [0, 0, 0]
	const add = (other: [number, number, number]) => {
		total[0] += other[0]
		total[1] += other[1]
		total[2] += other[2]
	}
	let i = 0
	while (i < selector.length) {
		const rest = selector.slice(i)
		const functional = /^:(where|is|not|has)\(/.exec(rest)
		if (functional) {
			let depth = 0
			let j = i + functional[0].length - 1
			for (; j < selector.length; j++) {
				if (selector[j] === '(') depth++
				if (selector[j] === ')' && --depth === 0) break
			}
			if (functional[1] !== 'where') {
				const members: string[] = []
				let level = 0
				let from = i + functional[0].length
				for (let k = from; k < j; k++) {
					if (selector[k] === '(') level++
					else if (selector[k] === ')') level--
					else if (selector[k] === ',' && level === 0) {
						members.push(selector.slice(from, k))
						from = k + 1
					}
				}
				members.push(selector.slice(from, j))
				const best = members
					.map(specificity)
					.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
					.pop() ?? [0, 0, 0]
				add(best)
			}
			i = j + 1
			continue
		}
		if (rest.startsWith('::')) {
			total[2]++
			i += 2 + (/^[\w-]+/.exec(rest.slice(2))?.[0].length ?? 0)
		} else if (rest[0] === ':') {
			total[1]++
			i += 1 + (/^[\w-]+/.exec(rest.slice(1))?.[0].length ?? 0)
		} else if (rest[0] === '.') {
			total[1]++
			i += 1 + (/^[\w-]+/.exec(rest.slice(1))?.[0].length ?? 0)
		} else if (rest[0] === '#') {
			total[0]++
			i += 1 + (/^[\w-]+/.exec(rest.slice(1))?.[0].length ?? 0)
		} else if (rest[0] === '[') {
			total[1]++
			i += rest.indexOf(']') + 1
		} else if (/^[a-z]/i.test(rest)) {
			total[2]++
			i += /^[\w-]+/.exec(rest)?.[0].length ?? 1
		} else i++
	}
	return total
}

/** The selector text of the first rule of an emitted sheet. */
const firstSelector = (css: string): string =>
	css.slice(0, css.indexOf(' {')).trim()

/* === The CSS target === */

describe('scopeModeOf (ADR 0033 s7)', () => {
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
	test('describeCssTargets names each browser and version', () => {
		expect(
			describeCssTargets({ chrome: 118 << 16, safari: (17 << 16) | (3 << 8) }),
		).toBe('chrome 118, safari 17.3')
		expect(describeCssTargets({})).toBe('no named browser')
	})
})

/* === The authored-form checks (ADR 0033 s6) === */

describe('checkSheetContract', () => {
	const findingsOf = (sheetText: string, tag = 'my-box') => {
		const { sheet } = parseComponentSheet(sheetText)
		expect(sheet).not.toBeNull()
		return checkSheetContract(sheet, sheetText, tag)
	}
	const faces = (sheetText: string) => findingsOf(sheetText).map(f => f.face)

	test('a rule inside @scope led by the own tag is the own-tag-led face, offset at the rule', () => {
		const findings = findingsOf('@scope {\n  my-box .x { top: 0 }\n}')
		expect(findings).toHaveLength(1)
		expect(findings[0]?.face).toBe('own-tag-led')
		expect(findings[0]?.offset).toBe(11)
	})

	test('a tag-led rule at the top level is the legal 2.x form, in conditional groups too', () => {
		expect(
			faces(
				'my-box .x { top: 0 }\n@media (width > 30em) { my-box { top: 0 } }',
			),
		).toEqual([])
	})

	test('own-tag-led reaches a rule in a conditional group inside @scope, not a nested rule', () => {
		expect(
			faces('@scope { @media (width > 1px) { my-box { top: 0 } } }'),
		).toEqual(['own-tag-led'])
		expect(faces('@scope { .a { my-box { top: 0 } } }')).toEqual([])
	})

	test(':host anywhere is the host face, qualified or not, nested in :is() too', () => {
		expect(faces(':host { color: red }')).toEqual(['host'])
		expect(faces('@scope { :host(.x) .y { color: red } }')).toEqual(['host'])
		expect(faces('@scope { .a:is(:host, .b) { color: red } }')).toEqual([
			'host',
		])
		expect(faces(':host.x { color: red }')).toEqual(['host'])
		// One finding per rule, not per occurrence.
		expect(faces(':host .a, :host .b { color: red }')).toEqual(['host'])
	})

	test('a qualifier after :scope is valid CSS (LTC070 retired)', () => {
		expect(
			faces('@scope { :scope.x { color: red } :scope:hover .y { top: 0 } }'),
		).toEqual([])
	})

	test('::slotted is the slotted face; :host-context the host-context face', () => {
		expect(
			faces(
				'@scope { ::slotted(.s) { color: red } :host-context(.c) .y { top: 0 } }',
			),
		).toEqual(['slotted', 'host-context'])
	})

	test(':global anywhere is the global face — whole-rule, block and nested', () => {
		expect(faces(':global(.page) { color: red }')).toEqual(['global'])
		expect(faces(':global { .other { color: teal } }')).toEqual(['global'])
		expect(faces('@scope { .a :global(.b) { color: red } }')).toEqual([
			'global',
		])
		expect(faces('@media (width > 1px) { :global(body) { top: 0 } }')).toEqual([
			'global',
		])
	})

	describe('a selector an authored limit always excludes (LTC071)', () => {
		const dead = (sheetText: string) =>
			findingsOf(sheetText)
				.filter(f => f.face === 'dead-by-limit')
				.map(f => f.selector)

		test('descending past a compound equal to a limit is dead', () => {
			expect(
				dead(
					'@scope to (.card) { .card .x { top: 0 } .a > .card > p { top: 0 } }',
				),
			).toEqual(['.card .x', '.a > .card > p'])
		})

		test('a `<child> > *` limit makes the child tag a dead end', () => {
			const findings = findingsOf(
				'@scope to (b-child > *) { b-child .x { top: 0 } b-child > p { top: 0 } }',
			)
			expect(findings.map(f => f.limit)).toEqual(['b-child > *', 'b-child > *'])
			expect(findings[1]?.offset).toBe(
				'@scope to (b-child > *) { b-child .x { top: 0 } '.length,
			)
		})

		test('the limit element itself, its pseudo-elements and its siblings stay legal', () => {
			expect(
				dead(
					'@scope to (b-child > *) { b-child { top: 0 } :scope > b-child::before { top: 0 } b-child + .x, b-child ~ p { top: 0 } .x:has(b-child) { top: 0 } }',
				),
			).toEqual([])
		})

		test('a literal `> *` limit still reads literally: the run must match and be followed', () => {
			expect(
				dead('@scope to (b-child > *) { b-child > * .x { top: 0 } }'),
			).toEqual(['b-child > * .x'])
			expect(dead('@scope to (b-child > *) { .a > .x { top: 0 } }')).toEqual([])
		})

		test('nesting resolves through &, implicit and explicit', () => {
			expect(
				dead(
					'@scope to (b-child > *) { @container (width > 1px) { :scope { & b-child { & h1, & h2 { top: 0 } } } } b-child { p { top: 0 } &:hover { top: 0 } & + .x { top: 0 } } }',
				),
			).toEqual(['& h1, & h2', '& p'])
		})

		test('a nested rule is dead only when dead under every parent alternative', () => {
			expect(
				dead('@scope to (b-child > *) { b-child, .live { .x { top: 0 } } }'),
			).toEqual([])
			expect(
				dead(
					'@scope to (b-child > *) { b-child, .a b-child { .x { top: 0 } } }',
				),
			).toEqual(['& .x'])
		})

		test('a block without limits, and a rule outside @scope, have nothing to exclude', () => {
			expect(dead('@scope { b-child .x { top: 0 } }')).toEqual([])
			expect(dead('b-child .x { top: 0 }')).toEqual([])
		})
	})
})

describe('checkSheetLowering (LTC089)', () => {
	const findingsOf = (sheetText: string) => {
		const { sheet } = parseComponentSheet(sheetText)
		expect(sheet).not.toBeNull()
		return checkSheetLowering(sheet, sheetText)
	}

	test('a plain component @scope is expressible', () => {
		expect(
			findingsOf('@scope (.card) to (.a > *) { :scope .x { top: 0 } }'),
		).toEqual([])
	})

	test('a @scope inside the component @scope is the nested-scope face, ranged at its prelude', () => {
		const findings = findingsOf('@scope {\n  @scope (.x) { .y { top: 0 } }\n}')
		expect(findings.map(f => f.face)).toEqual(['nested-scope'])
		expect(findings[0]?.offset).toBe(11)
		expect(findings[0]?.end).toBe(11 + '@scope (.x)'.length)
	})

	test('a nested @scope under a conditional group is still nested', () => {
		expect(
			findingsOf(
				'@scope { @media (width > 1px) { @scope (.x) { .y { top: 0 } } } }',
			).map(f => f.face),
		).toEqual(['nested-scope'])
	})

	test('a limit that names :scope is the scope-in-limit face', () => {
		expect(
			findingsOf('@scope to (:scope > .a) { .x { top: 0 } }').map(f => f.face),
		).toEqual(['scope-in-limit'])
	})
})

/* === The lowered emission (ADR 0033 s4) === */

describe('emitScopedSheet — lowered (the default targets)', () => {
	test('bare selectors lead with :where(tag); :scope becomes the padded root compound', () => {
		const css = emit(
			'@scope { :scope { display: block } .input { color: red } :scope.on > p { top: 0 } }',
		)
		expect(css).toBe(
			`:where(my-box)${PAD} {\n  display: block;\n}\n\n:where(my-box) .input {\n  color: red;\n}\n\n:where(my-box)${PAD}.on > p {\n  top: 0;\n}\n`,
		)
	})

	test('specificity equals the native form, :scope included (0,1,0)', () => {
		// The native specificity of each authored selector, `:where(:scope)`
		// leading the implicit-descendant forms.
		const cases: Array<[string, [number, number, number]]> = [
			['.x', [0, 1, 0]],
			[':scope', [0, 1, 0]],
			[':scope .x', [0, 2, 0]],
			[':scope > p', [0, 1, 1]],
			[':scope.on .x', [0, 3, 0]],
			[':scope:is(.a, .b) .x', [0, 3, 0]],
			['p .x', [0, 1, 1]],
		]
		for (const [selector, expected] of cases) {
			const css = emit(`@scope { ${selector} { top: 0 } }`)
			expect([selector, specificity(firstSelector(css))]).toEqual([
				selector,
				expected,
			])
		}
	})

	test('rules outside @scope emit verbatim: a tag-led rule and an unscoped rule', () => {
		const css = emit(
			'my-box .x { color: red }\n.page { top: 0 }\n@scope { .y { top: 1px } }',
		)
		expect(css).toBe(
			'my-box .x {\n  color: red;\n}\n\n.page {\n  top: 0;\n}\n\n:where(my-box) .y {\n  top: 1px;\n}\n',
		)
	})

	test('an authored limit adds its guard, the nested-instance re-include included', () => {
		const css = emit('@scope to (form-listbox > *) { .input { color: red } }')
		expect(css).toBe(
			`:where(my-box) .input${guardOf('form-listbox > *')} {\n  color: red;\n}\n`,
		)
		// The guard is a zero-specificity addition.
		expect(specificity(firstSelector(css))).toEqual([0, 1, 0])
	})

	test('each limit of a list adds its own guard; the compiler adds none', () => {
		const css = emit(
			'@scope to (form-listbox > *, b-x > *) { .input { color: red } }',
		)
		expect(css).toContain(
			`:where(my-box) .input${guardOf('form-listbox > *')}${guardOf('b-x > *')} {`,
		)
		expect(emit('@scope { .input { color: red } }')).not.toContain(':not(')
	})

	test('a rule whose subject is the root takes no guard', () => {
		const css = emit(
			'@scope to (form-listbox > *) { :scope { top: 0 } :scope .a { top: 1px } .a :scope { top: 2px } }',
		)
		expect(css).toContain(`:where(my-box)${PAD} {\n  top: 0;`)
		expect(css).toContain(
			`:where(my-box)${PAD} .a${guardOf('form-listbox > *')} {\n  top: 1px;`,
		)
		expect(css).toContain(`.a :where(my-box)${PAD} {\n  top: 2px;`)
	})

	test(':where(:scope) is the zero-specificity root: the bare lead, no pad, no guard', () => {
		const css = emit(
			'@scope to (form-listbox > *) { :where(:scope) { top: 0 } :where(:scope) .a { top: 1px } }',
		)
		expect(css).toContain(':where(my-box) {\n  top: 0;')
		expect(css).toContain(
			`:where(my-box) .a${guardOf('form-listbox > *')} {\n  top: 1px;`,
		)
		expect(specificity(firstSelector(css))).toEqual([0, 0, 0])
	})

	test('the guard sits before the subject’s first pseudo-element', () => {
		const css = emit(
			'@scope to (form-listbox > *) { .x::-webkit-scrollbar-thumb:hover { color: red } .a::part(x):hover { color: red } .b:hover::before { content: "" } }',
		)
		const guard = guardOf('form-listbox > *')
		expect(css).toContain(
			`:where(my-box) .x${guard}::-webkit-scrollbar-thumb:hover {`,
		)
		expect(css).toContain(`:where(my-box) .a${guard}::part(x):hover {`)
		expect(css).toContain(`:where(my-box) .b:hover${guard}:before {`)
	})

	test('every member of a selector list is prefixed and guarded', () => {
		const css = emit(
			'@scope to (form-listbox > *) { label, p { opacity: 0.5 } }',
		)
		const guard = guardOf('form-listbox > *')
		expect(css).toContain(
			`:where(my-box) label${guard}, :where(my-box) p${guard} {`,
		)
	})

	test('a preluded @scope roots on its prelude; a list prelude wraps in :is()', () => {
		const css = emit('@scope (.card) to (.a) { :scope .x { color: red } }')
		expect(css).toContain(
			`:where(.card)${PAD} .x:where(:not(:is(.card .a, .card .a *):not(.card .a my-box, .card .a my-box *))) {`,
		)
		const listed = emit('@scope (.card, .box) to (.a) { .x { color: red } }')
		expect(listed).toContain(
			':where(.card, .box) .x:where(:not(:is(:is(.card, .box) .a',
		)
	})

	test('nesting flattens; rules inside @media and @layer in @scope are rewritten too', () => {
		const css = emit(
			'@scope to (form-listbox > *) { :scope { display: block; & .x { color: red } } @media (min-width: 40em) { .x { top: 0 } } @layer base { .y { top: 0 } } }',
		)
		expect(css).not.toContain('&')
		expect(css).not.toContain('@scope')
		const guard = guardOf('form-listbox > *')
		expect(css).toContain(`:where(my-box)${PAD} .x${guard} {`)
		expect(css.slice(css.indexOf('@media'))).toContain(
			`:where(my-box) .x${guard} {`,
		)
		expect(css.slice(css.indexOf('@layer'))).toContain(
			`:where(my-box) .y${guard} {`,
		)
	})

	test('an & at the top of the block is the root, as lightningcss reads it', () => {
		expect(emit('@scope { & .q { top: 0 } }')).toBe(
			`:where(my-box)${PAD} .q {\n  top: 0;\n}\n`,
		)
	})

	test('a @scope inside a conditional group unwraps in place', () => {
		const css = emit(
			'@media (min-width: 1px) { @scope to (b-x > *) { .y { top: 0 } } }',
		)
		expect(css).toBe(
			`@media (width >= 1px) {\n  :where(my-box) .y${guardOf('b-x > *')} {\n    top: 0;\n  }\n}\n`,
		)
	})

	test('@keyframes emit verbatim before the rules', () => {
		const css = emit(
			'@scope { .input { color: red } }\n@keyframes spin { from { opacity: 0 } to { opacity: 1 } }',
		)
		expect(
			css.startsWith(
				'@keyframes spin { from { opacity: 0 } to { opacity: 1 } }',
			),
		).toBe(true)
		expect(css).toContain(':where(my-box) .input {')
	})

	test('the emission does not vary with the authored sheet indentation', () => {
		const flat = emit(
			'@scope {\n:scope { display: block }\n.input { color: red }\n}',
		)
		const indented = emit(
			'\n\t\t\t@scope {\n\t\t\t\t:scope {\n\t\t\t\t  display: block;\n\t\t\t\t}\n\t\t\t\t.input {\n\t\t\t\t  color: red;\n\t\t\t\t}\n\t\t\t}',
		)
		expect(indented).toBe(flat)
	})

	test('a sheet with no @scope and no rules emits nothing', () => {
		expect(
			emit('@keyframes spin { from { opacity: 0 } to { opacity: 1 } }'),
		).toBe('@keyframes spin { from { opacity: 0 } to { opacity: 1 } }\n')
	})
})

/* === The native emission (ADR 0033 s3) === */

describe('emitScopedSheet — native (@scope-capable targets)', () => {
	const native = (sheetText: string) => emit(sheetText, { cssTargets: NATIVE })

	test('a prelude-less @scope gains the explicit root; the body stays verbatim', () => {
		expect(
			native('@scope { :scope { display: block } .input { color: red } }'),
		).toBe(
			'@scope (my-box) { :scope { display: block } .input { color: red } }\n',
		)
	})

	test('the authored limits ride along; none are added', () => {
		expect(
			native('@scope to (form-listbox > *) { .input { color: red } }'),
		).toBe('@scope (my-box) to (form-listbox > *) { .input { color: red } }\n')
		expect(native('@scope { .input { color: red } }')).not.toContain(' to (')
	})

	test('a preluded @scope, a tag-led rule and an unscoped rule emit verbatim', () => {
		const sheet =
			'@scope (.card) to (.a) { .x { color: red } }\nmy-box .x { top: 0 }\n.page { top: 1px }'
		expect(native(sheet)).toBe(`${sheet}\n`)
	})

	test('a component @scope inside a conditional group gains the root there', () => {
		expect(native('@media (min-width: 1px) { @scope { .y { top: 0 } } }')).toBe(
			'@media (min-width: 1px) { @scope (my-box) { .y { top: 0 } } }\n',
		)
	})

	test('a nested @scope stays verbatim (it is native CSS)', () => {
		expect(native('@scope { @scope (.x) { .y { top: 0 } } }')).toBe(
			'@scope (my-box) { @scope (.x) { .y { top: 0 } } }\n',
		)
	})

	test('the emission does not vary with the authored sheet indentation', () => {
		const flat = native('@scope {\n  .input { color: red }\n}')
		const indented = native(
			'\n\t\t\t@scope {\n\t\t\t  .input { color: red }\n\t\t\t}',
		)
		expect(indented).toBe(flat)
	})
})

/* === LT-398: the review defects, once per mode === */

describe('emitScopedSheet — LT-398 review defects, both modes', () => {
	const modes = [
		['lowered', DEFAULT_CSS_TARGETS],
		['native', NATIVE],
	] as const

	for (const [mode, cssTargets] of modes) {
		test(`(a) a blockless statement does not swallow the next rule — ${mode}`, () => {
			const css = emit(
				'@layer base, theme;\n@scope to (form-listbox > *) { .x { color: red } }',
				{
					cssTargets,
				},
			)
			expect(css).toContain('@layer base, theme;')
			expect(css).toContain(
				mode === 'lowered'
					? `:where(my-box) .x${guardOf('form-listbox > *')} {`
					: '.x { color: red }',
			)
		})

		test(`(e) flattening lowers nesting and nothing the targets do not demand — ${mode}`, () => {
			const css = emit(
				'@scope { :scope { & .x { color: light-dark(red, blue); backdrop-filter: blur(2px) } } }',
				{ cssTargets },
			)
			expect(css).toContain('light-dark(')
			if (mode === 'lowered') {
				expect(css).not.toContain('&')
				// Safari 17.4 (both fixtures) needs the prefix…
				expect(css).toContain('-webkit-backdrop-filter')
			}
		})

		test(`(e) …and a target past the prefix needs none — lowered`, () => {
			if (mode !== 'lowered') return
			const css = emit(
				'@scope { :scope { & .x { backdrop-filter: blur(2px) } } }',
				{
					cssTargets: { ...cssTargets, safari: 18 << 16 },
				},
			)
			expect(css).not.toContain('-webkit-backdrop-filter')
		})

		test(`(f) :scope hidden in a flattened :is() list is rewritten — ${mode}`, () => {
			const css = emit(
				'@scope { :scope .a, :scope .b { &:empty { display: none } } }',
				{ cssTargets },
			)
			if (mode === 'lowered') {
				expect(css).not.toContain(':scope')
				expect(css).toContain(
					`:is(:where(my-box)${PAD} .a, :where(my-box)${PAD} .b):empty {`,
				)
			} else expect(css).toContain('&:empty')
		})
	}
})
