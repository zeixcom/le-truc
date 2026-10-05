/**
 * The shared code-generation kit (LT-234): `jsString`/`jsTemplate`,
 * `HtmlWriter`, `CodeBuilder`, `commonIndent`, and the server emitter's
 * reserved-name policy — a render-scope name equal to a local the emitter
 * mints (`__html`, …) renames the minted local instead of shadowing it.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import {
	CodeBuilder,
	HtmlWriter,
	jsString,
	jsTemplate,
} from '../../compiler/codegen'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { commonIndent } from '../../compiler/indent'
import { createGeneratedDir } from '../helpers/generated-corpus'

describe('jsString / jsTemplate', () => {
	test('plain ASCII keeps single quotes; anything else is JSON-quoted', () => {
		expect(jsString('a-b c')).toBe("'a-b c'")
		expect(jsString("it's")).toBe('"it\'s"')
		expect(jsString('a\\b')).toBe('"a\\\\b"')
		expect(jsString('é')).toBe('"é"')
		expect(jsString('x', 'double')).toBe('"x"')
	})

	test('every output evaluates back to its input', () => {
		for (const value of ["'", '"', '`', '${x}', '\\', '\n', ' ', 'é'])
			for (const quote of ['single', 'double'] as const)
				expect(new Function(`return ${jsString(value, quote)}`)()).toBe(value)
	})

	test('a template escapes statics and interpolates expressions', () => {
		expect(jsTemplate([{ static: 'a' }, { static: 'b' }])).toBe('"ab"')
		const code = jsTemplate([{ static: '`${\\' }, { expr: 'x' }])
		expect(code).toBe('`\\`\\${\\\\${x}`')
		expect(new Function('x', `return ${code}`)(1)).toBe('`${\\1')
	})
})

describe('HtmlWriter', () => {
	test('escapes attribute values and merges adjacent statics', () => {
		const html = new HtmlWriter()
			.static('<a')
			.attr('title', '"<&>"')
			.attr('hidden', null)
			.static(' data-x="$')
			.static('{y}"')
			.expr('z')
			.static('>')
		expect(`${html}`).toBe(
			'`<a title="&quot;&lt;&amp;&gt;&quot;" hidden data-x="\\${y}"${z}>`',
		)
		expect(html.exprs).toEqual(['z'])
	})
})

describe('CodeBuilder', () => {
	test('owns depth and offset; append rebases spans', () => {
		const inner = new CodeBuilder({ depth: 1, reindent: true })
		inner.line('const a = x', [{ text: 'x', start: 40 }])
		const out = new CodeBuilder()
			.open('if (c) {')
			.line('one()')
			.between('} else {')
			.line('two()')
			.close()
			.append(inner)
		expect(`${out}`).toBe(
			'if (c) {\n\tone()\n} else {\n\ttwo()\n}\n\tconst a = x',
		)
		const span = out.spans[0]
		expect(span?.sourceStart).toBe(40)
		expect(
			`${out}`.slice(span?.generatedStart, (span?.generatedStart ?? 0) + 1),
		).toBe('x')
		expect(out.offset).toBe(`${out}`.length + 1)
	})
})

describe('commonIndent', () => {
	test('line 0 participates unless skipFirst', () => {
		const lines = ['a', '\t\tb', '\t\t\tc']
		const mask = [false, false, false]
		expect(commonIndent(lines, mask)).toBe('')
		expect(commonIndent(lines, mask, { skipFirst: true })).toBe('\t\t')
	})

	test('template interiors, blanks and (optionally) doc continuations skip', () => {
		const lines = ['x', '  ', '\ty', '  * doc', 'z`']
		expect(
			commonIndent(lines, [false, false, false, false, true], {
				skipFirst: true,
				skipDocContinuations: true,
			}),
		).toBe('\t')
	})
})

const generated = createGeneratedDir('codegen')
afterAll(() => generated.cleanup())

describe('the server emitter renames its minted locals (LT-234)', () => {
	test('an author `__html` does not shadow the render buffer', async () => {
		const result = compileComponentTsx(
			`export function C({ __html, __key }: { __html: string; __key: string }) {
	return (
			<c-el>
				<p title={__key}>{__html}</p>
				<style></style>
			</c-el>
	)
}`,
			'c.tsx',
			new Set(),
		)
		expect(result.diagnostics.filter(d => d.severity === 'error')).toEqual([])
		const code = result.component?.serverCode ?? ''
		expect(code).toContain('const ___html: string[] = []')
		expect(code).not.toContain('const __html: string[]')
		generated.emit('c.server.ts', code)
		const mod = await generated.importModule<{
			renderC: (args: unknown) => string
		}>('c.server.ts')
		expect(mod.renderC({ __html: '<b>', __key: 'k' })).toBe(
			'<c-el><p title="k">&lt;b&gt;</p></c-el>',
		)
	})
})
