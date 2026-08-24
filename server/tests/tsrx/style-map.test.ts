/**
 * Tests for `style={() => ({ … })}` object-literal-bodied style thunks
 * (LT-028): server-side initial render and client-side lowering to one
 * `watch(thunk, bindStyle(el, keys))` call against `bindStyle()`'s map-form
 * overload (LT-029) — including the component-root case (targeting `host`),
 * which the custom-element reactive-attribute gate otherwise rejects.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'

describe('style-map on a descendant native element', () => {
	const source = `export function C({}: {})
	@{
		const color = createCell('red')
		expose({})
		<>
			<c-el>
				<p>&{color}</p>
				<span style={() => ({ color: color.get(), '--gap': null })}>ok</span>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('compiles without diagnostics', () => {
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component).not.toBeNull()
	})

	test('client lowers to one watch(...bindStyle(el, [keys])) call', () => {
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		expect(component?.clientCode).toContain(
			"bindStyle(span, ['color', '--gap'])",
		)
		expect(component?.clientCode).toContain('bindStyle')
	})

	test('server renders the initial style attribute from the map', () => {
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		expect(component?.serverCode).toContain('styleAttr')
	})
})

describe('style-map on the component root (targets host)', () => {
	const source = `export function C({}: {})
	@{
		const color = createCell('red')
		expose({})
		<>
			<c-el style={() => ({ color: color.get(), '--gap': null })}>
				<p>&{color}</p>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

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
			"bindStyle(host, ['color', '--gap'])",
		)
	})

	test('server renders the initial style attribute on the root opening tag', () => {
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		expect(component?.serverCode).toContain("attr('style', styleAttr(")
	})
})

describe('style-map on a descendant custom element bypasses the reactive-attribute gate', () => {
	const source = `export function C({}: {})
	@{
		const color = createCell('red')
		expose({})
		<>
			<c-el>
				<p>&{color}</p>
				<sub-el style={() => ({ '--x': color.get() })}>ok</sub-el>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

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

	test('client lowers via bindStyle, not pass()', () => {
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		expect(component?.clientCode).toContain("bindStyle(subEl, ['--x'])")
	})
})
