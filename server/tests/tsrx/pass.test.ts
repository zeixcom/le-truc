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

	test('truc:pass lowers to a pass() binding', () => {
		const { component, diagnostics } = compileComponent(
			source('truc:pass'),
			'examples/card/c.tsrx',
			new Set(['child-el']),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component?.clientCode).toContain('pass(')
	})

	// Not left to fall through: `pass={{ … }}` would classify as a server
	// attribute and render `pass="[object Object]"` — silently wrong markup.
	test('the bare pass spelling is a hard error naming the replacement', () => {
		const { diagnostics } = compileComponent(
			source('pass'),
			'examples/card/c.tsrx',
			new Set(['child-el']),
		)
		const errs = diagnostics.filter(d => d.severity === 'error')
		expect(errs).toHaveLength(1)
		expect(errs[0]?.message).toContain('truc:pass')
	})
})
