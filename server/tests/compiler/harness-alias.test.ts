/**
 * A render-scope name equal to a name the emitter writes a call to is
 * aliased, not forbidden (LT-302). With an arg named `items`, the server
 * module once emitted `for (const item of items(items))` — `items is not a
 * function` at render. The harness import is now bound as `__items` on a
 * collision, and the generated client does the same for its
 * `@zeix/le-truc` names. No collision, no alias: the corpus stays
 * byte-identical.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { createGeneratedDir } from '../helpers/generated-corpus'

const generated = createGeneratedDir('harness-alias')
afterAll(() => generated.cleanup())

const render = async (file: string, code: string, args: unknown) => {
	generated.emit(file, code)
	const mod = await generated.importModule<{
		renderC: (args: unknown) => string
	}>(file)
	return mod.renderC(args)
}

const PROPS = '{ items, esc }: { items: string[]; esc: string }'

const tsrx = compileComponent(
	`export function C(${PROPS})
@{
	expose({})
	<>
		<c-el>
			<p title={esc}>{esc}</p>
			<ul>
				@for (const item of items) {
					<li>{item}</li>
				}
			</ul>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`,
	'c.tsrx',
	new Set(),
)

const tsx = compileComponentTsx(
	`export function C(${PROPS}) {
	return (
		<>
			<c-el>
				<p title={esc}>{esc}</p>
				<ul>{items.map(item => <li>{item}</li>)}</ul>
			</c-el>
			<style>{'c-el { color: red }'}</style>
		</>
	)
}`,
	'c.tsx',
	new Set(),
)

const EXPECTED =
	'<c-el><p title="&lt;b&gt;">&lt;b&gt;</p><ul><li>a</li><li>b</li></ul></c-el>'

describe('harness names shadowed by args are aliased (LT-302)', () => {
	test.each([
		['tsrx', tsrx],
		['tsx', tsx],
	])('args `items`/`esc` render on .%s', async (surface, result) => {
		expect(result.diagnostics.filter(d => d.severity === 'error')).toEqual([])
		const code = result.component?.serverCode ?? ''
		expect(code).toContain('esc as __esc')
		expect(code).toContain('items as __items')
		expect(
			await render(`c-${surface}.server.ts`, code, {
				items: ['a', 'b'],
				esc: '<b>',
			}),
		).toBe(EXPECTED)
	})

	test('a name nothing shadows keeps its bare import', () => {
		const code = tsrx.component?.serverCode ?? ''
		expect(code).toMatch(/import \{ attr, .*\} from/)
		expect(code).not.toContain('__attr')
	})

	test('a setup const shadowing a synthesized client call is aliased', () => {
		const { component, diagnostics } = compileComponent(
			`export function C({}: {})
@{
	const bindText = 'x'
	const count = createCell(0)
	expose({ count })
	<>
		<c-el>
			<span>{count}</span>
			<b>{() => bindText + count.get()}</b>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}
import { createCell } from '@zeix/le-truc'`,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		const client = component?.clientCode ?? ''
		expect(client).toContain('bindText as __bindText')
		expect(client).toContain('watch(count, __bindText(span))')
		// The authored reference keeps meaning the authored const.
		expect(client).toContain('() => bindText + count.get()')
	})
})
