/**
 * A signal read by a CLIENT-ONLY setup statement is credited as rendered
 * (LT-119). Such a statement — `watch(() => open.get() && …,
 * bindAttribute(el, 'hidden'))` — reaches the DOM without a template render
 * site, and is the only route open to a predicate over a composed child's
 * public prop: as a reactive JSX attribute the same predicate cannot be
 * folded by the server, so the attribute is omitted from the served HTML
 * (LTC034) instead. The credit seeds by initializer reuse, which is sound
 * here by construction — `clientSetup` exists only in the generated client,
 * so the server rendered nothing for the reused initializer to contradict.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'

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

	test('no error — the signal is consumed, not dead', () => {
		// Pre-tiering this was the LTC004 refusal; since LT-165 step 5 the
		// code is retired onto tier.ts's RoutingSignalOrigin, so the pin is
		// the positive: the module compiles with no diagnostic at all.
		const { component, diagnostics } = compile(source)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
	})

	test('the signal seeds from its initializer, not from a DOM site', () => {
		const { component } = compile(source)
		expect(component?.clientCode).toContain('createState(false)')
	})

	test('the binding is client-only — the server never runs it', () => {
		const { component } = compile(source)
		expect(component?.serverCode).not.toContain('bindAttribute')
	})

	test('the credit follows a const (LT-323)', () => {
		// `open.get()` sits one level of indirection away inside `isOpen`.
		// Until LT-323 the credit read only the statement's own node, so this
		// spelling routed Simulated on LTC004; ADR 0029 folds it, because
		// every consumer is still client-only.
		const { component } = compile(
			source.replace(
				"\twatch(() => !open.get(), bindAttribute(panel, 'hidden'))",
				"\tconst isOpen = () => open.get()\n\twatch(() => !isOpen(), bindAttribute(panel, 'hidden'))",
			),
		)
		expect(component?.entry.routingSignals).toEqual([])
		expect(component?.entry.tier).toBe('folded')
		expect(component?.clientCode).toContain('createState(false)')
	})

	test('a bare signal reference is a read (LT-323)', () => {
		// module-scrollarea's `watch(overflowStart, bindState(…))` shape.
		const { component } = compile(
			source.replace(
				"\twatch(() => !open.get(), bindAttribute(panel, 'hidden'))",
				"\twatch(open, bindAttribute(panel, 'hidden'))",
			),
		)
		expect(component?.entry.routingSignals).toEqual([])
		expect(component?.entry.tier).toBe('folded')
	})

	test('an event handler is a client-only read position (LT-323)', () => {
		const { component } = compile(`export function C({}: {})
@{
	const count = createState(0)
	expose({})
	<>
		<c-el>
			<button type="button" onClick={() => console.log(count.get())}>log</button>
		</c-el>
		<style>c-el { display: block }</style>
	</>
}
import { createState } from '@zeix/le-truc'`)
		expect(component?.entry.routingSignals).toEqual([])
		expect(component?.entry.tier).toBe('folded')
	})

	test('a render position through a carrier blocks the context-member seed (LT-327)', () => {
		// `count` reaches the template only through `label`, so the direct
		// `sig.get()` scan misses it. Its initializer reads `all()`, which the
		// server cannot evaluate — folding it would emit `all` undeclared in
		// the server module (ADR 0029: any doubt routes downward).
		const { component } = compile(`export function C({}: {})
@{
	const count = createMemo(() => all('li').get().length)
	const label = () => String(count.get())
	const out = first('output', 'the log')
	expose({})
	watch(label, bindText(out))
	<>
		<c-el>
			<ul><li>a</li></ul>
			<output></output>
			<p>{() => label()}</p>
		</c-el>
		<style>c-el { display: block }</style>
	</>
}
import { bindText, createMemo } from '@zeix/le-truc'`)
		expect(
			component?.entry.routingSignals.some(s => s.origin === 'LTC004'),
		).toBe(true)
		expect(component?.entry.tier).toBe('simulated')
	})

	test('a @case test is a render position (LT-330)', () => {
		// The case test \`label()\` reaches \`count\` through a carrier, the
		// same shape as LT-327 — but in a switch arm, not an \`@if\` test.
		const { component } = compile(`export function C({ mode }: { mode: string })
@{
	const count = createMemo(() => all('li').get().length)
	const label = () => String(count.get())
	const out = first('output', 'the log')
	expose({})
	watch(label, bindText(out))
	<>
		<c-el>
			<ul><li>a</li></ul>
			<output></output>
			@switch (mode) {
				@case label(): {
					<p>one</p>
				}
				@default: {
					<p>other</p>
				}
			}
		</c-el>
		<style>c-el { display: block }</style>
	</>
}
import { bindText, createMemo } from '@zeix/le-truc'`)
		expect(
			component?.entry.routingSignals.some(s => s.origin === 'LTC004'),
		).toBe(true)
		expect(component?.entry.tier).toBe('simulated')
	})

	test('a switch case test is a render position on .tsx (LT-330)', () => {
		const { component } = compileComponentTsx(
			`export function C({ mode }: { mode: string }) {
	const count = createMemo(() => all('li').get().length)
	const label = () => String(count.get())
	const out = first('output', 'the log')
	expose({})
	watch(label, bindText(out))
	return (
		<>
			<c-el>
				<ul><li>a</li></ul>
				<output></output>
				{(() => {
					switch (mode) {
						case label():
							return <p>one</p>
						default:
							return <p>other</p>
					}
				})()}
			</c-el>
			<style>{'c-el { display: block }'}</style>
		</>
	)
}
import { bindText, createMemo } from '@zeix/le-truc'`,
			'c.tsx',
			new Set(),
		)
		expect(
			component?.entry.routingSignals.some(s => s.origin === 'LTC004'),
		).toBe(true)
		expect(component?.entry.tier).toBe('simulated')
	})

	test('a signal nothing reads still routes (LTC004)', () => {
		const { component } = compile(
			source.replace(
				"\twatch(() => !open.get(), bindAttribute(panel, 'hidden'))",
				'',
			),
		)
		expect(
			component?.entry.routingSignals.some(s => s.origin === 'LTC004'),
		).toBe(true)
	})
})
