/**
 * A context member read only from a setup declaration still reaches the
 * generated client's factory destructure (LT-104). module-lazyload reads
 * `host` inside its `createTask` callback and in a plain const's
 * initializer, and nowhere else. Neither position is an effect position
 * `collectAmbient` walks, so the client factory destructured no `host` and
 * the task threw a ReferenceError at connect.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../compiler/frontend/tsrx'

const compile = (source: string) =>
	compileComponent(source, 'c.tsrx', new Set())

const factoryContext = (clientCode: string): string =>
	/\(\{ ([^}]*) \}\) => \{/.exec(clientCode)?.[1] ?? ''

const component = (setup: string, imports = '') => `export function C({}: {})
@{
	const panel = first('.panel', 'the panel')
${setup}
	expose({})
	<>
		<c-el>
			<div class="panel">ok</div>
		</c-el>
		<style>c-el { display: block }</style>
	</>
}
${imports}`

describe('context members read from setup declarations', () => {
	test('a `host` read inside a createTask callback', () => {
		const { component: c, diagnostics } = compile(
			component(
				`	const data = createTask(async () => host.id)
	watch(data, { ok: v => { panel.textContent = v } })`,
				"import { createTask } from '@zeix/le-truc'",
			),
		)
		expect(diagnostics).toEqual([])
		expect(factoryContext(c?.clientCode ?? '')).toContain('host')
	})

	test('a `host` read in a plain const the client emits', () => {
		const { component: c, diagnostics } = compile(
			component(`	const label = host.id + '!'
	watch(() => true, () => { panel.textContent = label })`),
		)
		expect(diagnostics).toEqual([])
		expect(factoryContext(c?.clientCode ?? '')).toContain('host')
	})

	test('an `all()` call in a plain const the client emits (LT-108)', () => {
		const { component: c } = compile(
			component(`	const items = all('li')
	watch(() => true, () => { panel.textContent = String(items.get().length) })`),
		)
		expect(factoryContext(c?.clientCode ?? '')).toContain('all')
	})

	test('no read, no destructure', () => {
		const { component: c } = compile(
			component(`	watch(() => true, () => { panel.textContent = 'x' })`),
		)
		expect(factoryContext(c?.clientCode ?? '')).not.toContain('host')
	})
})
