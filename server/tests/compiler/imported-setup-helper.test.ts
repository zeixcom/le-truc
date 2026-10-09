/**
 * An imported function is a client-known name in a client-only setup side
 * effect (ADR 0046 s5, LT-427; admitted since LT-088): a shared helper
 * module called from setup with `host` and a declared list compiles on both
 * surfaces, the statement stays client-only, and the import is placed into
 * the client module only (ADR 0024 s14). A compose import is not a helper:
 * calling it from setup stays the unsupported-statement error.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'

const IMPORTS = `import { createList } from '@zeix/le-truc'
import { setupReorder } from '../../_common/reorder.ts'
`
const STYLE = `@scope {
	:scope {
	  color: red;
	}
}`

const tsrx = `${IMPORTS}
export function ReorderList({ initial }: { initial?: string[] })
	@{
		const items = createList<string>(initial, { keyConfig: 'item' })
		setupReorder(host, items)
			<reorder-list>
				<ul data-container>
					@for (const item of items) {
						<li><span>{item}</span></li>
					}
				</ul>
				<style>${STYLE}</style>
			</reorder-list>
	}`

const tsxx = `import { css } from '@zeix/le-truc-compiler/macros'
${IMPORTS}
export function ReorderList({ initial }: { initial?: string[] }) {
	const items = createList<string>(initial, { keyConfig: 'item' })
	setupReorder(host, items)
	return (
			<reorder-list>
				<ul data-container>
					{items.map(item => <li><span>{item}</span></li>)}
				</ul>
				<style>{css\`${STYLE}\`}</style>
			</reorder-list>
	)
}`

const FILE = 'examples/module/reorder/reorder-list'
const body = (code: string | undefined): string =>
	(code ?? '').replace(/^\/\*\*[\s\S]*?\*\/\n/, '')

describe('an imported helper called from client-only setup (LT-427)', () => {
	const surfaces = [
		['.tsrx', compileComponent(tsrx, `${FILE}.tsrx`, new Set())],
		['.tsx', compileComponentTsx(tsxx, `${FILE}.tsx`, new Set())],
	] as const

	for (const [surface, { component, diagnostics }] of surfaces) {
		describe(surface, () => {
			test('compiles clean', () => {
				expect(diagnostics).toEqual([])
			})

			test('the call and its import land in the client module only', () => {
				const client = component?.clientCode ?? ''
				const server = component?.serverCode ?? ''
				expect(client).toContain(
					'import { setupReorder } from "../../../examples/_common/reorder"',
				)
				expect(client).toContain('\t\tsetupReorder(host, items)\n')
				expect(server).not.toContain('setupReorder')
			})
		})
	}

	test('both surfaces emit identical modules apart from the provenance header', () => {
		const [[, a], [, b]] = surfaces
		expect(body(b.component?.clientCode)).toBe(body(a.component?.clientCode))
		expect(body(b.component?.serverCode)).toBe(body(a.component?.serverCode))
	})
})

describe('a compose import is not a client-known helper', () => {
	test('calling it from setup stays the unsupported-statement error', () => {
		const source = `import { FormTextbox } from '../../form/textbox/form-textbox.tsrx'

export function C({}: {})
	@{
		FormTextbox(host)
			<c-el>
				<FormTextbox name="n">N</FormTextbox>
				<style>${STYLE}</style>
			</c-el>
	}`
		const { diagnostics } = compileComponent(
			source,
			'examples/module/c/c.tsrx',
			new Set(),
		)
		expect(diagnostics.map(d => d.code)).toEqual(['LTC005'])
		expect(diagnostics[0]?.message).toContain(
			'A setup statement other than a `const` declaration',
		)
	})
})
