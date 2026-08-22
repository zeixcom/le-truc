/**
 * Diagnostics tests: the compiler's rewrite rules are the product (ADR
 * 0023) — each rule that cannot be applied must report its diagnostic, and
 * milestone gates must skip files without failing the build.
 */
import { describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { compileComponent } from '../../tsrx'

const ROOT = path.resolve(import.meta.dir, '../../..')

const wrap = (template: string): string =>
	`export function C({ tabs }: { tabs: { id: string }[] })
	@{
		const selected = createCell('a')
		expose({ selected: selected.get })
		<>
			<c-el>${template}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

describe('milestone gates', () => {
	test('module-list: reactive @for is TSRX001, file skipped, not an error', () => {
		const source = fs.readFileSync(
			path.join(ROOT, 'examples/module/list/module-list.tsrx'),
			'utf8',
		)
		const { component, diagnostics } = compileComponent(source, 'module-list.tsrx', new Set())
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX001' && d.severity === 'warning')).toBe(
			true,
		)
		expect(diagnostics.some(d => d.severity === 'error')).toBe(false)
	})

	test('inline: @for over a declared List warns TSRX001', () => {
		const source = `export function C({}: {})
	@{
		const items = createList<string>([], { keyConfig: 'item' })
		expose({})
		<>
			<c-el>
				@for (const item of items; key k) {
					<li>{item}</li>
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX001')).toBe(true)
	})
})

describe('rewrite-rule enforcement', () => {
	test('loop variable inside a reactive thunk is TSRX002 with hoist-first hint', () => {
		const source = wrap(
			`@for (const tab of tabs) {
				<button aria-selected={() => String(selected.get() === tab.id)}>{tab.id}</button>
			}`,
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX002')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('Hoist the derived value')
		expect(hit?.message).toContain('`tab`')
	})

	test('hoisted const never rendered as a bare attribute is TSRX003', () => {
		const source = wrap(
			`@for (const tab of tabs) {
				const label = tab.id
				<button aria-selected={() => String(selected.get() === label)}>{tab.id}</button>
			}`,
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX003')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`label`')
		expect(hit?.message).toContain('Render it')
	})

	test('signal never rendered is TSRX004 (no harvestable site)', () => {
		const source = `export function C({}: {})
	@{
		const ghost = createCell(1)
		const seen = createCell(0)
		expose({ seen: seen.get })
		<>
			<c-el><span>&{seen}</span></c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX004')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`ghost`')
	})

	test('mediated { get, set } attribute is gated as milestone-3', () => {
		const source = `export function C({}: {})
	@{
		const value = createCell('x')
		expose({ value: value.get })
		<>
			<c-el value={{ get: () => value.get(), set: (v: string) => value.set(v) }}>ok</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX006')).toBe(true)
	})

	test('lazy child inside @for body is gated as milestone-3', () => {
		const source = wrap(
			`@for (const tab of tabs) {
				<button><span>&{selected}</span></button>
			}`,
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(d => d.message.includes('template slots')),
		).toBe(true)
	})

	test('client constructs on the root element are outside the subset', () => {
		const source = `export function C({}: {})
	@{
		const n = createCell(1)
		expose({ n: n.get })
		<>
			<c-el onClick={() => n.set(0)}><span>&{n}</span></c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(d => d.message.includes('root element')),
		).toBe(true)
	})

	test('ambiguous selector is TSRX007', () => {
		const source = wrap(
			`<span>&{selected}</span>
			<span>other</span>`,
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hits = diagnostics.filter(d => d.code === 'TSRX007')
		expect(hits.length).toBeGreaterThan(0)
		expect(hits.some(h => h.message.includes('span'))).toBe(true)
	})
})
