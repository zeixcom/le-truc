/**
 * Compile-time markers (ADR 0034 s1, LT-442): a marker is imported from
 * `@zeix/le-truc-compiler/macros`, recognized by module specifier and
 * imported name — an alias resolves, a same-named local never matches —
 * and its import never reaches either generated module. A `css` that is
 * not the marker is refused (LTC078, LT-444), not read as an empty sheet.
 * The shipped stub throws when a source reaches it uncompiled.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { css } from '../../compiler/macros'

/* === Sources === */

const SHEET = '@scope { :scope { display: block; } }'

const tsx = (head: string, tag: string, setup = ''): string => `${head}
export function C({}: {}) {
	${setup}
	return (
			<c-el>text
				<style>{${tag}\`${SHEET}\`}</style>
			</c-el>
	)
}`

const compile = (source: string) =>
	compileComponentTsx(source, 'examples/c/c-el.tsx', new Set(['c-el']))

const IMPORT = "import { css } from '@zeix/le-truc-compiler/macros'"

/** A source whose `css` tag is not the marker: refused, not compiled empty. */
const refused = (source: string) => {
	const { component, diagnostics } = compile(source)
	expect(component).toBeNull()
	expect(diagnostics.filter(d => d.code === 'LTC078')).toHaveLength(1)
}

/* === Tests === */

describe('compile-time markers (ADR 0034 s1, LT-442)', () => {
	test('the imported `css` tag is the stylesheet, and its import reaches neither module', () => {
		const { component, diagnostics } = compile(tsx(IMPORT, 'css'))
		expect(diagnostics).toEqual([])
		expect(component?.authoredCss.trim()).toBe(SHEET)
		expect(component?.serverCode).not.toContain('/macros')
		expect(component?.clientCode).not.toContain('/macros')
	})

	test('an aliased import compiles identically', () => {
		const plain = compile(tsx(IMPORT, 'css'))
		const aliased = compile(
			tsx(
				"import { css as style } from '@zeix/le-truc-compiler/macros'",
				'style',
			),
		)
		expect(aliased.diagnostics).toEqual([])
		expect(aliased.component?.css).toBe(plain.component?.css ?? '')
		expect(aliased.component?.serverCode).toBe(
			plain.component?.serverCode ?? '',
		)
		expect(aliased.component?.clientCode).toBe(
			plain.component?.clientCode ?? '',
		)
	})

	test('a bare `css` with no marker import is not the marker', () => {
		refused(tsx('', 'css'))
	})

	test('a `css` imported from another module is not the marker', () => {
		refused(tsx("import { css } from 'some-css-lib'", 'css'))
	})

	test('a component-scope `css` shadowing the import is not the marker', () => {
		refused(
			tsx(IMPORT, 'css', 'const css = (s: TemplateStringsArray) => s.join("")'),
		)
	})

	test('an alias leaves a same-named local `css` unrecognized', () => {
		refused(
			tsx(
				"import { css as style } from '@zeix/le-truc-compiler/macros'",
				'css',
			),
		)
	})

	test('a mixed declaration drops only its marker specifiers', () => {
		const source = `import { css, other } from '@zeix/le-truc-compiler/macros'
export function C({}: {}) {
	return (
			<c-el>
				<button type="button" onClick={() => other()}>x</button>
				<style>{css\`${SHEET}\`}</style>
			</c-el>
	)
}`
		const { component } = compile(source)
		expect(component?.authoredCss.trim()).toBe(SHEET)
		expect(component?.clientCode).toContain(
			"import { other } from '@zeix/le-truc-compiler/macros'",
		)
		expect(component?.clientCode).not.toMatch(/import \{[^}]*\bcss\b/)
	})

	test('a .tsrx source strips the marker import too, with no unused-import warning', () => {
		const source = `${IMPORT}
export function C({}: {})
	@{
			<c-el>text
				<style>${SHEET}</style>
			</c-el>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'examples/c/c-el.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.map(d => d.code)).not.toContain('LTC014')
		expect(component?.serverCode).not.toContain('/macros')
		expect(component?.clientCode).not.toContain('/macros')
	})

	test('the `css` stub throws when a source reaches it uncompiled', () => {
		expect(() => css`p { color: red }`).toThrow(
			'`css` ran in a source that was not compiled',
		)
	})
})
