/**
 * Diagnostics tests: the compiler's rewrite rules are the product (ADR
 * 0023) — each rule that cannot be applied must report its diagnostic, and
 * milestone gates must skip files without failing the build.
 */
import { describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { compileComponent, compileSource } from '../../tsrx'

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

describe('extension activation (TSRX009)', () => {
	const configSource = (config: string): string =>
		`export const config = ${config}
export function C({ value = '' }: { value?: string })
@{
	expose({ value: asString('') })
	<>
		<c-el value={value}><span>ok</span></c-el>
		<style>c-el { color: red }</style>
	</>
}`

	test('unknown config key is TSRX009', () => {
		const { diagnostics } = compileComponent(
			configSource(`{ formAssociated: true, reactivity: true }`),
			'c.tsrx',
			new Set(),
		)
		const hit = diagnostics.find(d => d.code === 'TSRX009')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`reactivity`')
		expect(hit?.message).toContain('Known keys')
	})

	test('combining formAssociated and formAssociatedCheckbox is TSRX009', () => {
		const { diagnostics } = compileComponent(
			configSource(`{ formAssociated: true, formAssociatedCheckbox: true }`),
			'c.tsrx',
			new Set(),
		)
		const hit = diagnostics.find(d => d.code === 'TSRX009')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('ExtensionCollisionError')
	})

	test('formAssociated with a non-true literal is TSRX009', () => {
		const { diagnostics } = compileComponent(
			configSource(`{ formAssociated: 'yes' }`),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(
				d => d.code === 'TSRX009' && d.message.includes('must be `true`'),
			),
		).toBe(true)
	})

	test('observedAttributes must be an array of string literals', () => {
		const { diagnostics } = compileComponent(
			configSource(`{ observedAttributes: 'value' }`),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(
				d =>
					d.code === 'TSRX009' &&
					d.message.includes('array of string literals'),
			),
		).toBe(true)
	})

	test('observedAttributes naming a non-Parser prop is TSRX009 (inert extension)', () => {
		const source = `export const config = { observedAttributes: ['label'] }
export function C({ label }: { label?: string })
@{
	expose({ label })
	<>
		<c-el><span>{label}</span></c-el>
		<style>c-el { color: red }</style>
	</>
}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX009')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`label`')
		expect(hit?.message).toContain('inert')
	})

	test('non-object config declaration is TSRX009', () => {
		const { diagnostics } = compileComponent(
			configSource(`[formAssociated]`),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(
				d => d.code === 'TSRX009' && d.message.includes('object literal'),
			),
		).toBe(true)
	})

	test('asClampedInteger and asJSON are recognized parser ambients', () => {
		const source = `export function C({ max }: { max?: number })
	@{
		expose({ count: asClampedInteger(0, 10), data: asJSON({}) })
		<>
			<c-el count={max}><span>ok</span></c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileSource(source, 'c.tsrx')
		expect(diagnostics).toEqual([])
		expect(component?.parserExposeProps.has('count')).toBe(true)
		expect(component?.parserExposeProps.has('data')).toBe(true)
	})

	test('managed lazy child without formAssociated is TSRX010', () => {
		const source = `export function C({}: {})
	@{
		expose({})
		<>
			<c-el><p class="error">&{'validationMessage'}</p></c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX010')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('formAssociated')
	})

	test('setup side effect over a server arg is TSRX005 (client-only subset)', () => {
		const source = `export function C({ note }: { note?: string })
	@{
		expose({})
		console.log(note)
		<>
			<c-el><span>ok</span></c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(
				d => d.code === 'TSRX005' && d.message.includes('side effects'),
			),
		).toBe(true)
	})
})

describe('@if conditional markup (LT-008)', () => {
	test('server-known condition compiles and renders per args', () => {
		const source = `export function C({ big }: { big?: boolean })
	@{
		expose({})
		<>
			<c-el>
				@if (big) {
					<strong>big</strong>
				} @else {
					<small>small</small>
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
	})

	test('@if over a reactive signal is TSRX005', () => {
		const source = `export function C({}: {})
	@{
		const open = createCell(false)
		expose({ open: open.get })
		<>
			<c-el>
				@if (open.get()) {
					<strong>open</strong>
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(
				d =>
					d.code === 'TSRX005' &&
					d.message.includes('signal(s)') &&
					d.message.includes('initially rendered branch'),
			),
		).toBe(true)
	})

	test('@if construct differing between branches is TSRX005', () => {
		const source = `export function C({ big }: { big?: boolean })
	@{
		expose({})
		<>
			<c-el>
				@if (big) {
					<strong onClick={() => {}}>a</strong>
				} @else {
					<strong onClick={() => { }}>b</strong>
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(d => d.message.includes('branch constructs differ')),
		).toBe(true)
	})
})

describe('milestone gates', () => {
	test('module-list compiles cleanly now (reactive @for → reconcile)', () => {
		const source = fs.readFileSync(
			path.join(ROOT, 'examples/module/list/module-list.tsrx'),
			'utf8',
		)
		const { component, diagnostics } = compileComponent(
			source,
			'module-list.tsrx',
			new Set(['basic-button']),
		)
		expect(component).not.toBeNull()
		expect(diagnostics).toEqual([])
	})

	test('inline: @for over deriveList still warns TSRX001', () => {
		const source = `export function C({}: {})
	@{
		const items = deriveList(() => ['a'])
		<>
			<c-el>
				@for (const item of items; key k) {
					<li>&{item}</li>
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX001')).toBe(true)
	})
})

describe('reactive-list rewrite rules (milestone 3)', () => {
	const listSource = (body: string): string =>
		`export function C({}: {})
	@{
		const items = createList<string>([], { keyConfig: 'item' })
		<>
			<c-el>
				<ul data-container>
					@for (const item of items; key k) {
						${body}
					}
				</ul>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('well-formed body compiles: hole, statics, key-bound event', () => {
		const { component, diagnostics } = compileComponent(
			listSource(
				'<li><span>&{item}</span><button type="button" onClick={() => items.remove(k)}>✕</button></li>',
			),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
	})

	test('reactive attribute inside the body is TSRX005', () => {
		const { diagnostics } = compileComponent(
			listSource('<li class={() => item}>no</li>'),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(
				d => d.code === 'TSRX005' && d.message.includes('Dynamic attribute'),
			),
		).toBe(true)
	})

	test('non-lazy item expression is TSRX005', () => {
		const { diagnostics } = compileComponent(
			listSource('<li>{item}</li>'),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.message.includes('must be lazy'))).toBe(true)
	})

	test('missing or duplicated item hole is TSRX005', () => {
		const { diagnostics } = compileComponent(
			listSource('<li>static</li>'),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.message.includes('exactly once'))).toBe(true)
	})

	test('handler referencing the loop item is TSRX005 (bindItem Signal)', () => {
		const { diagnostics } = compileComponent(
			listSource(
				'<li><span>&{item}</span><button type="button" onClick={() => items.remove(item)}>✕</button></li>',
			),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(
				d =>
					d.code === 'TSRX005' && d.message.includes('Signal, not the value'),
			),
		).toBe(true)
	})

	test('index binding is TSRX005', () => {
		const source = `export function C({}: {})
	@{
		const items = createList<string>(['a'], { keyConfig: 'item' })
		<>
			<c-el>
				<ul>
					@for (const item of items; index i; key k) {
						<li>&{item}</li>
					}
				</ul>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.message.includes('Index bindings'))).toBe(
			true,
		)
	})

	test('list directly under the root is TSRX005 (no container)', () => {
		const source = `export function C({}: {})
	@{
		const items = createList<string>(['a'], { keyConfig: 'item' })
		<>
			<c-el>
				@for (const item of items; key k) {
					<li>&{item}</li>
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(d =>
				d.message.includes('container element distinct from the host'),
			),
		).toBe(true)
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

	test('a { get, set } pass entry missing set is invalid (TSRX006)', () => {
		const source = `export function C({}: {})
	@{
		const value = createCell('x')
		expose({ value: value.get })
		<>
			<c-el pass={{ value: { get: () => value.get() } }}>ok</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.some(d => d.code === 'TSRX006')).toBe(true)
	})

	test('lazy child inside @for body is gated as milestone-3', () => {
		const source = wrap(
			`@for (const tab of tabs) {
				<button><span>&{selected}</span></button>
			}`,
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.message.includes('template slots'))).toBe(
			true,
		)
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
		expect(diagnostics.some(d => d.message.includes('root element'))).toBe(true)
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

	test('a signal conditionally choosing between two constructors is TSRX013', () => {
		const source = `export function C({ big = false }: { big?: boolean })
	@{
		const n = big ? deriveCell(() => 1) : createCell(0)
		expose({ n: n.get })
		<>
			<c-el><span>&{n}</span></c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX013')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`n`')
		expect(hit?.message).toContain('conditionally chooses')
	})

	test('a plain setup const calling a client-only primitive directly is TSRX013', () => {
		const source = `export function C({}: {})
	@{
		const n = createCell(1)
		const el = first('.foo')
		expose({ n: n.get })
		<>
			<c-el><span>&{n}</span></c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX013')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`el`')
		expect(hit?.message).toContain('`first`')
	})
})
