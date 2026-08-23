/**
 * `pass={{ }}` dispatch (ADR 0023 sub-design 10, amending sub-design 4):
 * the sole client-prop interop channel for custom-element targets, for both
 * raw dashed tags and composed (PascalCase) elements — replacing the old
 * shape-inferred "function-valued attribute on a custom tag" dispatch.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'

describe('pass={{ }} on raw dashed custom-element tags', () => {
	test('a registry-known target lowers to pass()', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<basic-child pass={{ label: () => 'x' }}></basic-child>
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
				<span pass={{ label: () => 'x' }}>ok</span>
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
				<basic-child pass={{ label: () => 'x' }}></basic-child>
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

	test('pass={{ }} with a non-object value is invalid (TSRX006)', () => {
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
