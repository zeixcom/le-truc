/**
 * The parsed stylesheet (ADR 0033 s9, LT-268): the model the IR carries
 * (`ComponentIR.sheet`), and the LTC064 spec-grammar faces the parse
 * reports. The emission stays verbatim — `component.css` is asserted
 * byte-identical with the authored dedent on every compiled fixture, and
 * the corpus sweep pins both facts across every compiled source.
 *
 * The grammar arbitration is css-tree's (`lexer.matchDeclaration`, the
 * per-declaration entry), reached through css-tree's own pre-nesting
 * parse: nested rules fold into positioned Raw nodes whose brace regions
 * the parse recurses into. lightningcss collects the sheet READ-ONLY —
 * returning parsed nodes into the parser crashes on `var()` inside
 * nested rules at 1.33 (the write path is LT-304's) — so every assertion
 * below reads the model after the parse has returned. A grammar error
 * points at the declaration it sits on (the property's own offset).
 */
import { describe, expect, test } from 'bun:test'
import { parseComponentSheet } from '../../compiler/css'
import { compileSource } from '../../compiler/frontend/tsrx/compiler'
import { compileSourceTsx } from '../../compiler/frontend/tsx/compiler-tsx'
import { compileCorpusSource, loadCorpus } from './corpus-fixture'

/* === Sources === */

const SHEET = `c-el {
	display: flex;

	> span {
		color: red;
	}
}

@media (min-width: 40em) {
	c-el {
		top: 0;
	}
}`

const SHEET_WITH_BAD_UNIT = `c-el {
	> span {
		width: 10pxx;
	}
}`

const tsrxSource = (sheet: string) => `export function C({}: {})
	@{
		<>
			<c-el>text</c-el>
			<style>${sheet}</style>
		</>
	}`

const tsxSource = (sheet: string) => `export function C({}: {}) {
	return (
		<>
			<c-el>text</c-el>
			<style>{css\`${sheet}\`}</style>
		</>
	)
}`

/** Authored 1-based line of a sheet fragment, as the diagnostics compute it. */
const lineOf = (source: string, fragment: string): number | undefined => {
	const offset = source.indexOf(fragment)
	return offset === -1 ? undefined : source.slice(0, offset).split('\n').length
}

/* === parseComponentSheet === */

describe('parseComponentSheet — the model', () => {
	test('reaches rules, nested rules, at-rules and declarations', () => {
		const { sheet, errors } = parseComponentSheet(SHEET)
		expect(errors).toEqual([])
		expect(sheet).not.toBeNull()
		const rules = sheet?.rules ?? []
		expect(rules.map(rule => rule.type)).toEqual(['style', 'media'])
		const style = rules[0] as {
			type: 'style'
			value: {
				declarations: { declarations: Array<{ property: string }> }
				rules: Array<{
					value: { declarations: { declarations: Array<{ property: string }> } }
				}>
			}
		}
		expect(style.value.declarations.declarations.map(d => d.property)).toEqual([
			'display',
		])
		const nested = style.value.rules ?? []
		expect(nested).toHaveLength(1)
		expect(
			nested[0]?.value.declarations.declarations.map(d => d.property),
		).toEqual(['color'])
		const media = rules[1] as {
			type: 'media'
			value: { rules: unknown[] }
		}
		expect(media.value.rules).toHaveLength(1)
	})

	test('the model stays readable after the parse returned', () => {
		const { sheet } = parseComponentSheet('a { color: red }')
		const rule = sheet?.rules[0] as {
			value: { declarations: { declarations: Array<{ property: string }> } }
		}
		expect(rule.value.declarations.declarations[0]?.property).toBe('color')
	})

	test('an empty sheet parses to no rules', () => {
		const { sheet, errors } = parseComponentSheet('')
		expect(errors).toEqual([])
		expect(sheet?.rules).toEqual([])
	})
})

describe('parseComponentSheet — the LTC064 faces', () => {
	test('an unknown property reports without losing the sheet', () => {
		const css = 'a {\n\tcolr: red\n}'
		const { sheet, errors } = parseComponentSheet(css)
		expect(sheet?.rules).toHaveLength(1)
		expect(errors).toEqual([
			{
				face: 'unknown-property',
				offset: css.indexOf('colr'),
				property: 'colr',
				detail: 'Unknown property `colr`',
			},
		])
	})

	test('an invalid unit reports the property and the value', () => {
		const css = 'a {\n\twidth: 10pxx\n}'
		const { errors } = parseComponentSheet(css)
		expect(errors).toEqual([
			{
				face: 'invalid-value',
				offset: css.indexOf('width: 10pxx'),
				property: 'width',
				value: '10pxx',
				detail: 'Mismatch',
			},
		])
	})

	test('a nested declaration reports at its authored offset', () => {
		const { errors } = parseComponentSheet(SHEET_WITH_BAD_UNIT)
		expect(errors).toEqual([
			{
				face: 'invalid-value',
				offset: SHEET_WITH_BAD_UNIT.indexOf('width: 10pxx'),
				property: 'width',
				value: '10pxx',
				detail: 'Mismatch',
			},
		])
	})

	test('custom properties and var()/env() references are exempt', () => {
		const { errors } = parseComponentSheet(
			'a {\n\t--x: 10pxx whatever;\n\twidth: var(--x);\n\theight: env(safe-area-inset-top, 10pxx);\n}',
		)
		expect(errors).toEqual([])
	})

	test('at-rule descriptors are never matched as properties', () => {
		const { errors } = parseComponentSheet(
			'@font-face {\n\tfont-family: X;\n\tsrc: url(a.woff2) format(woff2)\n}',
		)
		expect(errors).toEqual([])
	})

	test('a sheet that does not parse reports the syntax face and no sheet', () => {
		const css = 'a {\n\tcolor: red\n}\na >> .b { color: red }'
		const { sheet, errors } = parseComponentSheet(css)
		expect(sheet).toBeNull()
		expect(errors).toHaveLength(1)
		expect(errors[0]?.face).toBe('syntax')
		expect(errors[0]?.detail).toBe('Invalid dangling combinator in selector')
		// lightningcss reports the offending column; the offset lands on
		// the combinator it names.
		const combinator = css.indexOf('>>')
		expect(errors[0]?.offset).toBeGreaterThanOrEqual(combinator)
		expect(errors[0]?.offset).toBeLessThanOrEqual(combinator + 1)
	})
})

/* === The sheet on the IR === */

describe('the IR carries the parsed sheet', () => {
	test('.tsrx: sheet reachable, css stays the verbatim dedent', () => {
		const source = tsrxSource(SHEET)
		const { component, diagnostics } = compileSource(source, 'c-el.tsrx')
		expect(diagnostics).toEqual([])
		expect(component?.css.startsWith('c-el {')).toBe(true)
		expect(component?.css.endsWith('}\n')).toBe(true)
		expect(component?.sheet?.rules.map(r => r.type)).toEqual(['style', 'media'])
	})

	test('.tsx: sheet reachable from the css-tagged template', () => {
		const source = tsxSource(SHEET)
		const { component, diagnostics } = compileSourceTsx(source, 'c-el.tsx')
		expect(diagnostics).toEqual([])
		expect(component?.css.startsWith('c-el {')).toBe(true)
		expect(component?.sheet?.rules.map(r => r.type)).toEqual(['style', 'media'])
	})

	test('no style block carries no sheet', () => {
		const { component } = compileSource(
			'export function C({}: {})\n\t@{\n\t\t<c-el>text</c-el>\n\t}',
			'c-el.tsrx',
		)
		expect(component?.css).toBe('')
		expect(component?.sheet).toBeNull()
	})

	test('an invalid unit reports LTC064 on the authored line, sheet intact', () => {
		const source = tsrxSource(SHEET_WITH_BAD_UNIT)
		const { component, diagnostics } = compileSource(source, 'c-el.tsrx')
		// The sheet parsed; only a syntax error leaves no sheet.
		expect(component?.sheet?.rules).toHaveLength(1)
		expect(diagnostics.map(d => [d.code, d.severity])).toEqual([
			['LTC064', 'error'],
		])
		expect(diagnostics[0]?.line).toBe(lineOf(source, 'width: 10pxx'))
		expect(diagnostics[0]?.message).toContain('`width`')
		expect(diagnostics[0]?.message).toContain('10pxx')
	})
})

/* === The corpus === */

describe('the corpus parses clean', () => {
	test('no corpus component reports LTC064, and CSS-bearing ones carry the sheet', async () => {
		const failures: string[] = []
		for (const file of await loadCorpus()) {
			const { component, diagnostics } = compileCorpusSource(
				file.content,
				file.path,
			)
			if (diagnostics.some(d => d.code === 'LTC064')) failures.push(file.path)
			if ((component?.css.length ?? 0) > 0 !== (component?.sheet != null))
				failures.push(`${file.path} (sheet/css mismatch)`)
		}
		expect(failures).toEqual([])
	})
})
