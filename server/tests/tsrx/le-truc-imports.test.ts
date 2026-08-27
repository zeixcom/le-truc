/**
 * Authored `'@zeix/le-truc'` imports (ADR 0024 sub-design 16, LT-082):
 *
 * - TSRX036 — a real package export used in authored code without an
 *   import; scope-aware, so a local shadowing an export name never fires.
 * - TSRX037 — a FactoryContext member named inside an authored import
 *   line: not a package export, never re-emitted into generated output.
 * - Placement — the authored line re-emits into the client module while
 *   the synthesized `@zeix/le-truc` line drops the names it provides; the
 *   server module's runtime-harness import keeps providing
 *   harness-covered names (signal constructors, parsers, `defineMethod`).
 * - TSRX014 — an authored `'@zeix/le-truc'` import no name uses anywhere.
 */
import { describe, expect, test } from 'bun:test'
import { compileSource } from '../../tsrx/compiler'
import { compileComponent } from '../../tsrx'

const compile = (source: string) =>
	compileComponent(source, 'c.tsrx', new Set<string>())

const fixture = (imports: string, setup: string): string =>
	`${imports}
export function C({}: {})
@{
${setup}
	expose({})
	<>
		<c-el><span data-count={() => String(count.get())}>ok</span></c-el>
		<style>c-el { color: red }</style>
	</>
}`

describe('sub-design 16 — real-export imports', () => {
	test('a real export used without import fires TSRX036 with the name', () => {
		const { diagnostics } = compile(
			fixture('', '\tconst count = createCell(0)'),
		)
		const d = diagnostics.filter(x => x.code === 'TSRX036')
		expect(d).toHaveLength(1)
		expect(d[0]?.message).toContain('createCell')
	})

	test('an imported real export produces no import diagnostics', () => {
		const { diagnostics } = compile(
			fixture(
				"import { createCell } from '@zeix/le-truc'",
				'\tconst count = createCell(0)',
			),
		)
		expect(diagnostics).toEqual([])
	})

	test('FactoryContext vocabulary stays ambient — no import, no diagnostic', () => {
		const { diagnostics } = compile(
			fixture(
				"import { createCell } from '@zeix/le-truc'",
				'\tconst count = createCell(host.title.length)',
			),
		)
		expect(diagnostics).toEqual([])
	})

	test('a FactoryContext name inside the import line fires TSRX037 and is never re-emitted', () => {
		const source = fixture(
			"import { expose } from '@zeix/le-truc'",
			'\tconst count = createCell(0)',
		)
		// compileComponent nulls the component on the 037 error — inspect
		// the IR's import arrays directly (they are built before the gate).
		const { component, diagnostics } = compileSource(source, 'c.tsrx')
		const d = diagnostics.filter(x => x.code === 'TSRX037')
		expect(d).toHaveLength(1)
		expect(d[0]?.message).toContain('expose')
		expect(
			[...(component?.imports.client ?? []), ...(component?.imports.server ?? [])].join(
				'\n',
			),
		).not.toContain('expose')
	})

	test('a local shadowing an export name does not fire — scope-aware scan', () => {
		// `match` is a real CE export; the local declarator binds every later
		// read inside the @{ } container. Only the genuinely unimported
		// `createCell` fires (LT-079 review defect: declarator bindings were
		// not tracked, and the @{ } JSXCodeBlock needs sequential scoping).
		const { diagnostics } = compile(
			fixture(
				'',
				"\tconst match = createCell('x')\n\tconst count = match",
			),
		)
		const d = diagnostics.filter(x => x.code === 'TSRX036')
		expect(d).toHaveLength(1)
		expect(d[0]?.message).toContain('createCell')
		expect(d[0]?.message).not.toContain('match')
	})

	test('an authored import no name uses anywhere fires TSRX014', () => {
		const { diagnostics } = compile(
			fixture(
				"import { createCell, createTask } from '@zeix/le-truc'",
				'\tconst count = createCell(0)',
			),
		)
		// The statement as a whole has a used name (createCell), so no
		// statement-level TSRX014 — but drop createCell and it fires.
		expect(diagnostics.filter(x => x.code === 'TSRX014')).toEqual([])
		const unused = compile(
			fixture(
				"import { createTask } from '@zeix/le-truc'",
				'\tconst count = createCell(0)',
			),
		)
		expect(
			unused.diagnostics.some(
				x => x.code === 'TSRX014' && x.message.includes('createTask'),
			),
		).toBe(true)
	})
})

describe('sub-design 16 — generated-module placement', () => {
	test('the client re-emits the authored line and the synthesized line drops its names', () => {
		const { component } = compile(
			fixture(
				"import { createCell } from '@zeix/le-truc'",
				'\tconst count = createCell(0)',
			),
		)
		const code = component?.clientCode ?? ''
		expect(code).toContain("import { createCell } from '@zeix/le-truc'")
		expect(code).toContain(
			"import { bindAttribute, defineComponent } from '@zeix/le-truc'",
		)
		expect(code.match(/from '@zeix\/le-truc'/g)).toHaveLength(2)
	})

	test('the server module keeps harness-covered names from the authored line', () => {
		const { component } = compile(
			fixture(
				"import { createCell } from '@zeix/le-truc'",
				'\tconst count = createCell(0)',
			),
		)
		const code = component?.serverCode ?? ''
		// createCell comes from the runtime harness (plain-value shim), not
		// from a re-emitted authored import — no duplicate binding.
		expect(code).not.toContain("import { createCell } from '@zeix/le-truc'")
		expect(code).toContain("from '../../tsrx/runtime'")
	})
})
