/**
 * `truc:pass={{ }}` dispatch (ADR 0023 sub-design 10, amending sub-design 4):
 * the sole client-prop interop channel for custom-element targets, for both
 * raw dashed tags and composed (PascalCase) elements — replacing the old
 * shape-inferred "function-valued attribute on a custom tag" dispatch.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'

describe('truc:pass={{ }} on raw dashed custom-element tags', () => {
	test('a registry-known target lowers to pass()', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<basic-child truc:pass={{ label: () => 'x' }}></basic-child>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['basic-child']),
		)
		if (!component)
			throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.clientCode).toContain(
			"pass(basicChild, { label: { get: () => 'x' } })",
		)
	})

	test('a native element target is diagnosed (TSRX012)', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<span truc:pass={{ label: () => 'x' }}>ok</span>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX012')).toBe(true)
	})

	test('an unregistered dashed tag is diagnosed (TSRX012)', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<basic-child truc:pass={{ label: () => 'x' }}></basic-child>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX012')).toBe(true)
	})

	test('a bare function-valued attribute on a custom element no longer dispatches to pass() (TSRX012)', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<basic-child label={() => 'x'}></basic-child>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['basic-child']),
		)
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX012')).toBe(true)
	})

	test('a bare function-valued attribute on a native element is unaffected', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<span aria-label={() => 'x'}>ok</span>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		if (!component)
			throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.clientCode).toContain('bindAttribute')
	})

	test('a { get, set } descriptor entry lowers to a two-way pass()', () => {
		const source = `export function C({}: {})
	@{
		const value = createCell('x')
		expose({ value: value.get })
		<>
			<c-el>
				<span>{value}</span>
				<basic-child truc:pass={{ value: { get: () => value.get(), set: v => value.set(v) } }}></basic-child>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['basic-child']),
		)
		if (!component)
			throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.clientCode).toContain(
			'pass(basicChild, { value: { get: () => value.get(), set: v => value.set(v) } })',
		)
	})

	test('a bare thunk entry still emits getter-only pass()', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<basic-child truc:pass={{ label: () => 'x' }}></basic-child>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['basic-child']),
		)
		if (!component)
			throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.clientCode).toContain(
			"pass(basicChild, { label: { get: () => 'x' } })",
		)
	})

	test('truc:pass={{ }} with a non-object value is invalid (TSRX006)', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<basic-child pass="nope"></basic-child>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['basic-child']),
		)
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX006')).toBe(true)
	})
})

describe('truc:pass — namespaced host-owned attribute (LT-053)', () => {
	const source = (attr: string) => `import { Child } from './child.tsrx'

	export function C({}: {})
	@{
		const n = createCell(0)
		expose({ n: n.get })
		<>
			<c-el>
				<child-el ${attr}={{ value: () => n.get() }}></child-el>
				<p>{n}</p>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('truc:pass lowers exactly like the bare spelling, with no warning', () => {
		const { component, diagnostics } = compileComponent(
			source('truc:pass'),
			'examples/card/c.tsrx',
			new Set(['child-el']),
		)
		expect(diagnostics.filter(d => d.code === 'TSRX021')).toEqual([])
		expect(component?.clientCode).toContain('pass(')
	})

	test('bare pass still lowers, but warns TSRX021', () => {
		const { component, diagnostics } = compileComponent(
			source('pass'),
			'examples/card/c.tsrx',
			new Set(['child-el']),
		)
		const dep = diagnostics.filter(d => d.code === 'TSRX021')
		expect(dep).toHaveLength(1)
		expect(dep[0]?.severity).toBe('warning')
		expect(dep[0]?.message).toContain('truc:pass')
		// A warning, not a gate: the component still compiles this cycle.
		expect(component?.clientCode).toContain('pass(')
	})

	test('a user prop named pass on a native element is untouched', () => {
		const { diagnostics } = compileComponent(
			`export function C({}: {})
			@{
				expose({})
				<>
					<c-el><p data-pass="x">ok</p></c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'examples/card/c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.code === 'TSRX021')).toEqual([])
	})
})
