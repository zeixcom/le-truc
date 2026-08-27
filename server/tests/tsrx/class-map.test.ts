/**
 * Tests for `class={() => ({ … })}` object-literal-bodied class thunks
 * (LT-031/LT-032): server-side initial render and client-side lowering to
 * one `watch(thunk, bindClass(el, keys))` call against `bindClass()`'s
 * map-form overload (LT-029) — including the component-root case (targeting
 * `host`), which the custom-element reactive-attribute gate otherwise
 * rejects. Mirrors `style-map.test.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'

describe('class-map on a descendant native element', () => {
	const source = `export function C({}: {})
	@{
		const open = createCell(true)
		expose({})
		<>
			<c-el>
				<p>{open}</p>
				<span class={() => ({ open: open.get(), disabled: false })}>ok</span>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createCell } from '@zeix/le-truc'`

	test('compiles without diagnostics', () => {
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component).not.toBeNull()
	})

	test('client lowers to one watch(...bindClass(el, [keys])) call', () => {
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		expect(component?.clientCode).toContain(
			"bindClass(span, ['open', 'disabled'])",
		)
		expect(component?.clientCode).toContain('bindClass')
	})

	test('server renders the initial class attribute from the map', () => {
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		expect(component?.serverCode).toContain('cls(')
	})
})

describe('class-map on the component root (targets host)', () => {
	const source = `export function C({}: {})
	@{
		const open = createCell(true)
		expose({})
		<>
			<c-el class={() => ({ open: open.get(), disabled: false })}>
				<p>{open}</p>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createCell } from '@zeix/le-truc'`

	test('compiles without the "Reactive constructs on the component root element" diagnostic', () => {
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(d =>
				d.message.includes('Reactive constructs on the component root element'),
			),
		).toBe(false)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
	})

	test('client targets the ambient host, not a query', () => {
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		expect(component?.clientCode).toContain(
			"bindClass(host, ['open', 'disabled'])",
		)
	})

	test('server renders the initial class attribute on the root opening tag', () => {
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		expect(component?.serverCode).toContain("attr('class', cls(")
	})
})

describe('class-map on a descendant custom element bypasses the reactive-attribute gate', () => {
	const source = `export function C({}: {})
	@{
		const open = createCell(true)
		expose({})
		<>
			<c-el>
				<p>{open}</p>
				<sub-el class={() => ({ open: open.get() })}>ok</sub-el>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createCell } from '@zeix/le-truc'`

	test('compiles without a reactiveAttrOnCustomElement diagnostic', () => {
		const { diagnostics, component } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(d => d.code === 'TSRX005' || d.code === 'TSRX004'),
		).toBe(false)
		expect(component).not.toBeNull()
	})

	test('client lowers via bindClass, not pass()', () => {
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		expect(component?.clientCode).toContain("bindClass(subEl, ['open'])")
	})
})

describe('signal used only inside the class-map thunk (LT-036)', () => {
	const descendant = `export function C({}: {})
@{
	const on = createCell(true)
	expose({})
	<>
		<c-el>
			<span class={() => ({ active: on.get() })}>ok</span>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}
import { createCell } from '@zeix/le-truc'`
	const root = `export function C({}: {})
@{
	const on = createCell(true)
	expose({})
	<>
		<c-el class={() => ({ active: on.get() })}>
			<span>ok</span>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}
import { createCell } from '@zeix/le-truc'`

	test('descendant case: no TSRX004, client seeds by initializer reuse', () => {
		const { component, diagnostics } = compileComponent(
			descendant,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'TSRX004')).toBe(false)
		expect(component).not.toBeNull()
		expect(component?.clientCode).toContain('createCell(true)')
		expect(component?.serverCode).toContain('createCell(true)')
		expect(component?.clientCode).toContain(
			"watch(() => ({ active: on.get() }), bindClass(span, ['active']))",
		)
	})

	test('root case (targets host): no TSRX004 either', () => {
		const { component, diagnostics } = compileComponent(
			root,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'TSRX004')).toBe(false)
		expect(component?.clientCode).toContain("bindClass(host, ['active'])")
	})
})
