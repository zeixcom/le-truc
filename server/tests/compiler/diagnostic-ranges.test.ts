/**
 * The published diagnostic record's ranges (ADR 0044 s1–s2, LT-371).
 *
 * One pin per producer family: the reported `location` covers the
 * offending construct, in the file the caller named. Each rule both
 * surfaces share is pinned on both, and the two must cover the same
 * authored text — the parity half of the verification. A rule with no
 * construct in scope reports the whole file, never no location.
 */

import { describe, expect, test } from 'bun:test'
import {
	type CompileDiagnostic,
	diagnostic,
	locate,
	wholeFile,
} from '../../compiler/diagnostics'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { textAt } from './located'

/* === Helpers === */

type Shape = {
	setup?: string
	template: string
	head?: string
	params?: string
	css?: string
}

const DEFAULT_CSS = ':host {\n  color: red;\n}'

const tsrxSource = ({
	setup = '\t\texpose({})',
	template,
	head = '',
	params = '{}: {}',
	css = DEFAULT_CSS,
}: Shape): string => `${head}export function C(${params})
	@{
${setup}
		<>
			<c-el>${template}</c-el>
			<style>${css}</style>
		</>
	}`

const tsxSource = ({
	setup = '\t\texpose({})',
	template,
	head = '',
	params = '{}: {}',
	css = DEFAULT_CSS,
}: Shape): string => `${head}export function C(${params}) {
${setup}
	return (
		<>
			<c-el>${template}</c-el>
			<style>{css\`${css}\`}</style>
		</>
	)
}`

/** The first `code` diagnostic and its source, per surface. */
const reportOn = (shape: Shape, code: string) =>
	(['tsrx', 'tsx'] as const).map(surface => {
		const source = surface === 'tsx' ? tsxSource(shape) : tsrxSource(shape)
		const file = `examples/c/c-el.${surface}`
		const { diagnostics } =
			surface === 'tsx'
				? compileComponentTsx(source, file, new Set())
				: compileComponent(source, file, new Set())
		const hit = diagnostics.find(d => d.code === code)
		return { surface, source, file, hit }
	})

/** Both surfaces report `code` over exactly `covered`, in their own file. */
const expectCovers = (shape: Shape, code: string, covered: string) => {
	for (const { source, file, hit } of reportOn(shape, code)) {
		expect(hit).toBeDefined()
		expect(hit?.location.file).toBe(file)
		expect(textAt(source, hit)).toBe(covered)
	}
}

/* === Tests === */

describe('the record shape (ADR 0044 s1)', () => {
	test('a reported diagnostic carries location and related, never line', () => {
		const hit: CompileDiagnostic | undefined = reportOn(
			{ template: '<script>x</script>' },
			'LTC056',
		)[0]?.hit
		expect(hit && Object.keys(hit).sort()).toEqual([
			'code',
			'location',
			'message',
			'related',
			'severity',
		])
		expect(hit?.related).toEqual([])
	})

	test('locate() names the file and maps related ranges and fix edits', () => {
		expect(
			locate(
				{
					code: 'LTC050',
					severity: 'error',
					message: 'm',
					range: { start: 1, end: 2 },
					related: [{ start: 3, end: 4 }],
					fix: {
						description: 'd',
						edits: [{ range: { start: 1, end: 2 }, text: 't' }],
					},
				},
				'a.tsx',
			),
		).toEqual({
			code: 'LTC050',
			severity: 'error',
			message: 'm',
			location: { file: 'a.tsx', start: 1, end: 2 },
			related: [{ file: 'a.tsx', start: 3, end: 4 }],
			fix: {
				description: 'd',
				edits: [{ location: { file: 'a.tsx', start: 1, end: 2 }, text: 't' }],
			},
		})
	})
})

describe('each producer family covers the offending construct, on both surfaces', () => {
	test('grammar and shape: a deferred collector call (LTC045)', () => {
		expectCovers(
			{
				setup:
					"\t\texpose({})\n\t\tsetTimeout(() => on(host, 'click', () => {}))",
				template: '<span>x</span>',
			},
			'LTC045',
			"on(host, 'click', () => {})",
		)
	})

	test('grammar and shape: an unsupported construct (LTC005)', () => {
		expectCovers({ template: '<span {...x}>x</span>' }, 'LTC005', '{...x}')
	})

	test('template elements: an authored <script> (LTC056)', () => {
		expectCovers(
			{ template: '<script>x</script>' },
			'LTC056',
			'<script>x</script>',
		)
	})

	test('selectors and addressing: no match (LTC026)', () => {
		expectCovers(
			{
				setup: "\t\tconst input = first('.nope', 'required')\n\t\texpose({})",
				template: '<input />',
			},
			'LTC026',
			"first('.nope', 'required')",
		)
	})

	test('selectors and addressing: two names, one element (LTC041), the other related', () => {
		const shape = {
			setup:
				"\t\tconst a = first('input', 'a')\n\t\tconst b = first('input', 'b')\n\t\texpose({})\n\t\ton(host, 'click', () => { a.focus(); b.focus() })",
			template: '<input />',
		}
		expectCovers(shape, 'LTC041', "first('input', 'b')")
		for (const { source, hit } of reportOn(shape, 'LTC041'))
			expect(
				hit?.related.map(related => textAt(source, { location: related })),
			).toEqual(["first('input', 'a')"])
	})

	test('selectors and addressing: a static id (LTC042)', () => {
		expectCovers(
			{ template: '<span id="fixed">x</span>' },
			'LTC042',
			'<span id="fixed">x</span>',
		)
	})

	test('form association: a named inner control (LTC029)', () => {
		expectCovers(
			{
				head: "import { asString } from '@zeix/le-truc'\nexport const config = { formAssociated: true }\n",
				setup: "\t\texpose({ value: asString('') })",
				template: '<input name="inner" />',
			},
			'LTC029',
			'<input name="inner" />',
		)
	})

	test('evaluability: an impure read (LTC033) and page context (LTC054)', () => {
		expectCovers(
			{ template: '<span>{Math.random()}</span>' },
			'LTC033',
			'Math.random()',
		)
		expectCovers(
			{
				setup: '\t\tconst w = String(window.innerWidth)\n\t\texpose({})',
				template: '<span>{w}</span>',
			},
			'LTC054',
			'String(window.innerWidth)',
		)
	})

	test('managed form props: a host read without formAssociated (LTC010)', () => {
		expectCovers(
			{ template: '<span>{host.validationMessage}</span>' },
			'LTC010',
			'{host.validationMessage}',
		)
	})

	test('stylesheet: a declaration (LTC065) and a selector (LTC066, LTC067)', () => {
		expectCovers(
			{ template: '<span>x</span>', css: ':host {\n  colr: red;\n}' },
			'LTC065',
			'colr: red',
		)
		expectCovers(
			{ template: '<span>x</span>', css: 'c-el span {\n  color: red;\n}' },
			'LTC066',
			'c-el span',
		)
		expectCovers(
			{
				template: '<span>x</span>',
				css: '::slotted(span) {\n  color: red;\n}',
			},
			'LTC067',
			'::slotted(span)',
		)
	})

	test('imports: a missing import (LTC036) and a context name imported (LTC037)', () => {
		expectCovers(
			{
				setup: '\t\tconst n = createCell(0)\n\t\texpose({ n })',
				template: '<span>x</span>',
			},
			'LTC036',
			'createCell',
		)
		expectCovers(
			{
				head: "import { host } from '@zeix/le-truc'\n",
				template: '<span>x</span>',
			},
			'LTC037',
			'host',
		)
	})

	test('imports: an unused import (LTC014), Le Truc names and a plain declaration', () => {
		expectCovers(
			{
				head: "import { createTask, createCell } from '@zeix/le-truc'\n",
				template: '<span>x</span>',
			},
			'LTC014',
			'createTask, createCell',
		)
		expectCovers(
			{
				head: "import { host, createTask } from '@zeix/le-truc'\n",
				template: '<span>x</span>',
			},
			'LTC014',
			'createTask',
		)
		expectCovers(
			{
				head: "import { foo } from 'bar'\n",
				template: '<span>x</span>',
			},
			'LTC014',
			"import { foo } from 'bar'",
		)
	})

	test('config and params: an unknown key (LTC009) and a default on a required prop (LTC032)', () => {
		expectCovers(
			{
				head: 'export const config = { bogus: true }\n',
				template: '<span>x</span>',
			},
			'LTC009',
			'bogus: true',
		)
		expectCovers(
			{
				params: "{ label = 'a' }: { label: string }",
				template: '<span>{label}</span>',
			},
			'LTC032',
			"label = 'a'",
		)
	})

	test('React near-misses (TSRX021, .tsrx only)', () => {
		const source = tsrxSource({
			setup: '\t\tconst ok = true\n\t\texpose({})',
			template: '{ok && <b>x</b>}',
		})
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX021')
		expect(textAt(source, hit)).toBe('ok && <b>x</b>')
	})
})

describe('positions the parser or the file supplies (ADR 0044 s2)', () => {
	test("a parse failure reports the parser's own position, inside the file", () => {
		const source = 'export function C( {\n'
		for (const { diagnostics } of [
			compileComponent(source, 'c.tsrx', new Set()),
			compileComponentTsx(source, 'c.tsx', new Set()),
		]) {
			const hit = diagnostics.find(d => d.code === 'LTC008')
			expect(hit?.location.start).toBeGreaterThan(0)
			expect(hit?.location.end).toBeLessThanOrEqual(source.length)
		}
	})

	test('a file-level shape with no construct reports the whole file', () => {
		const source = 'export const x = 1\n'
		const { diagnostics } = compileComponentTsx(source, 'c.tsx', new Set())
		expect(diagnostics.map(d => [d.code, d.location])).toEqual([
			['LTC008', { file: 'c.tsx', start: 0, end: source.length }],
		])
	})

	test('a corpus-level rule locates the whole file and relates the others (LTC048)', () => {
		const a = wholeFile('a/x-el.tsx', 'one')
		const b = wholeFile('b/x-el.tsx', 'three')
		const reported = diagnostic.duplicateTag(
			'x-el',
			['a/x-el.tsx', 'b/x-el.tsx'],
			a,
			[b],
		)
		expect(reported.location).toEqual({ file: 'a/x-el.tsx', start: 0, end: 3 })
		expect(reported.related).toEqual([{ file: 'b/x-el.tsx', start: 0, end: 5 }])
	})
})

describe('routing signals take the same location shape', () => {
	test('a Simulated-tier signal is located in the authored file', () => {
		const source = `import { createCell } from '@zeix/le-truc'
export function C({}: {}) {
	const input = first('input', 'needed')
	const w = createCell(input.value)
	expose({ w })
	return (
		<>
			<c-el><input /><span>{w.get()}</span></c-el>
			<style>{css\`:host {
  color: red;
}\`}</style>
		</>
	)
}`
		const { component } = compileComponentTsx(source, 'c.tsx', new Set())
		const signal = component?.entry.routingSignals.find(
			s => s.origin === 'LTC043',
		)
		expect(signal?.location?.file).toBe('c.tsx')
		expect(
			textAt(source, signal?.location && { location: signal.location }),
		).toBe('const w = createCell(input.value)')
	})
})
