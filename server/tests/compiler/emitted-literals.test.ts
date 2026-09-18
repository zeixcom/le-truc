/**
 * Emitted string-literal safety (LT-221 §1.2): every author-supplied string
 * that reaches the generated client module — `first()`/`all()` reasons and
 * selectors, class/style map keys, attribute and event names — must be
 * emitted as a properly quoted JS literal. An apostrophe, backslash, or
 * quote character in author data must produce escaped source, never a
 * syntax error on generated code (surfacing as an unmapped tsc failure) or
 * an injection channel into the build output. The shared `jsString()`/
 * `CodeBuilder` consolidation is LT-234; these pins hold the point-fix to
 * the same bar.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../compiler/frontend/tsrx'

const transpiler = new Bun.Transpiler({ loader: 'ts' })

/** The generated module must be syntactically valid TypeScript. */
const parses = (code: string): void => {
	transpiler.transformSync(code)
}

const withReason = (reasonLiteral: string): string =>
	`export function C({}: {})
	@{
		const input = first('input', ${reasonLiteral})
		expose({})
		<>
			<c-el><input/></c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createCell } from '@zeix/le-truc'`

describe('first()/all() reasons are escaped into the generated client (LT-221)', () => {
	test('an apostrophe in the reason does not break the generated module', () => {
		const { component, diagnostics } = compileComponent(
			withReason(`"the user's name is required"`),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		const code = component?.clientCode ?? ''
		expect(code).toContain(`'input', "the user's name is required"`)
		parses(code)
	})

	test('a quote-and-call payload stays an inert string literal', () => {
		const { component } = compileComponent(
			withReason(`"', evil(), '"`),
			'c.tsrx',
			new Set(),
		)
		const code = component?.clientCode ?? ''
		expect(code).toContain(`first('input', "', evil(), '")`)
		expect(code).not.toContain(`first('input', '', evil(), '')`)
		parses(code)
	})

	test('a backslash in the reason survives the round-trip', () => {
		const { component } = compileComponent(
			withReason(`"a\\\\b"`),
			'c.tsrx',
			new Set(),
		)
		const code = component?.clientCode ?? ''
		expect(code).toContain('"a\\\\b"')
		parses(code)
	})

	test('plain reasons keep today’s single-quoted bytes (corpus goldens stay put)', () => {
		const { component } = compileComponent(
			withReason(`'a plain reason'`),
			'c.tsrx',
			new Set(),
		)
		const code = component?.clientCode ?? ''
		expect(code).toContain(`first('input', 'a plain reason')`)
		parses(code)
	})
})
