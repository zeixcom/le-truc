/**
 * Unit tests for template-literal-safe reindentation (LT-010): the
 * `lineStartsInTemplate` scanner and its consumers `reindent`
 * (emit-server, via setup slices) and `pushStatement` (emit-client, via
 * event-handler slices). A multi-line template literal's interior lines are
 * string content — reindenting them silently changes rendered values.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'
import { lineStartsInTemplate } from '../../tsrx/indent'

describe('lineStartsInTemplate', () => {
	test('all-code lines are never masked', () => {
		expect(
			lineStartsInTemplate([
				'const a = 1',
				'const b = a + 2',
				'// `tick` in a comment',
			]),
		).toEqual([false, false, false])
	})

	test('interior lines of a multi-line template are masked, closing line too', () => {
		const lines = [
			'const msg = `Min length is ${n}',
			'Please enter more',
			'`',
			'console.log(msg)',
		]
		expect(lineStartsInTemplate(lines)).toEqual([false, true, true, false])
	})

	test('single-line templates mask nothing', () => {
		expect(
			lineStartsInTemplate(['const s = `a` + `b`', 'const t = 1']),
		).toEqual([false, false])
	})

	test('nested template inside interpolation', () => {
		const lines = [
			'const outer = `head ${`inner ${x}',
			'    tail`} end',
			'`',
			'const after = 2',
		]
		expect(lineStartsInTemplate(lines)).toEqual([false, true, true, false])
	})

	test('quotes and escapes do not leak template state', () => {
		const lines = [
			'const q = "it\'s a ` backtick"',
			"const r = 'not `open` either'",
			'const esc = `a \\` b` + 1',
			'const after = 3',
		]
		expect(lineStartsInTemplate(lines)).toEqual([false, false, false, false])
	})
})

describe('reindentation keeps template-literal interiors byte-identical', () => {
	test('client: handler with a multi-line template literal', () => {
		const source = `import { createCell } from '@zeix/le-truc'

export function C({}: {})
	@{
		const seen = createCell(0)
		expose({ seen: seen.get })
		<>
			<c-el><button type="button" onClick={(e: Event) => {
				const n = 3
				const msg = \`Min length is \${n}
				Please enter more\`
				seen.set(n)
			}}>{seen}</button></c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		if (!component) throw new Error('fixture must compile')
		// The interior line keeps its authored leading tabs verbatim.
		expect(component.clientCode).toContain('\t\t\t\tPlease enter more`')
	})

	test('server: setup const with a multi-line template literal', () => {
		const source = `import { createCell } from '@zeix/le-truc'

export function C({ note }: { note?: string })
	@{
		const seen = createCell(note)
		const banner = \`First \${note}
		second line of banner\`
		expose({ seen: seen.get })
		<>
			<c-el title={banner}>{seen}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		if (!component) throw new Error('fixture must compile')
		expect(component.serverCode).toContain('second line of banner`')
		// The banner const's interior line is not re-indented as code: its
		// authored tabs survive (they are string content), while surrounding
		// setup lines are re-indented to one tab.
		expect(component.serverCode).toMatch(
			/\tconst banner = `First \$\{note\}\n\t\tsecond line of banner`/,
		)
	})
})
