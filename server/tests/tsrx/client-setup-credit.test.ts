/**
 * A signal read by a CLIENT-ONLY setup statement is credited as rendered
 * (LT-119). Such a statement — `watch(() => open.get() && …,
 * bindAttribute(el, 'hidden'))` — reaches the DOM without a template render
 * site, and is the only route open to a predicate over a composed child's
 * public prop: as a reactive JSX attribute the same predicate cannot be
 * folded by the server, so the attribute is omitted from the served HTML
 * (TSRX034) instead. The credit seeds by initializer reuse, which is sound
 * here by construction — `clientSetup` exists only in the generated client,
 * so the server rendered nothing for the reused initializer to contradict.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'

const compile = (source: string) =>
	compileComponent(source, 'c.tsrx', new Set())

describe('client-only setup statements credit a signal as rendered', () => {
	const source = `export function C({}: {})
@{
	const open = createState(false)
	const panel = first('.panel', 'the panel')
	expose({})
	watch(() => !open.get(), bindAttribute(panel, 'hidden'))
	<>
		<c-el>
			<div class="panel" hidden>ok</div>
		</c-el>
		<style>c-el { display: block }</style>
	</>
}
import { bindAttribute, createState } from '@zeix/le-truc'`

	test('no TSRX004 — the signal is consumed, not dead', () => {
		const { diagnostics } = compile(source)
		expect(diagnostics.filter(d => d.code === 'TSRX004')).toHaveLength(0)
	})

	test('the signal seeds from its initializer, not from a DOM site', () => {
		const { component } = compile(source)
		expect(component?.clientCode).toContain('createState(false)')
	})

	test('the binding is client-only — the server never runs it', () => {
		const { component } = compile(source)
		expect(component?.serverCode).not.toContain('bindAttribute')
	})

	test('the credit is per statement and does not follow a const', () => {
		// `open.get()` sits one level of indirection away inside `isOpen`, so
		// the statement's own node carries no signal read. Pinned because the
		// corpus depends on the inlined spelling (form-combobox.tsrx).
		const { diagnostics } = compile(
			source.replace(
				"\twatch(() => !open.get(), bindAttribute(panel, 'hidden'))",
				"\tconst isOpen = () => open.get()\n\twatch(() => !isOpen(), bindAttribute(panel, 'hidden'))",
			),
		)
		expect(diagnostics.some(d => d.code === 'TSRX004')).toBe(true)
	})
})
