/**
 * Diagnostics tests: the compiler's rewrite rules are the product (ADR
 * 0023) — each rule that cannot be applied must report its diagnostic, and
 * milestone gates must skip files without failing the build.
 */
import { describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { compileComponent, compileSource } from '../../tsrx'
import type { RegistryEntry } from '../../tsrx/registry'

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
			<c-el><p class="error">{host.validationMessage}</p></c-el>
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
				'<li><span>{item}</span><button type="button" onClick={() => items.remove(k)}>✕</button></li>',
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

	// Since LT-052 a bare `{item}` IS the slot fill — the item binding is
	// reactive by position, marked in `lowerListFor`. The "must be lazy"
	// gate still covers every OTHER expression in the body, which has no
	// per-item client binding.
	test('a bare {item} is the slot fill, not an error', () => {
		const { diagnostics } = compileComponent(
			listSource('<li>{item}</li>'),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
	})

	test('a non-item expression in a reactive-list body is TSRX005', () => {
		const { diagnostics } = compileComponent(
			listSource('<li>{item}{label}</li>'),
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
				'<li><span>{item}</span><button type="button" onClick={() => items.remove(item)}>✕</button></li>',
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
						<li>{item}</li>
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
					<li>{item}</li>
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
			<c-el><span>{seen}</span></c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX004')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`ghost`')
	})

	test('signal read only in a computed reactive thunk is NOT TSRX004 (LT-036)', () => {
		const source = `export function C({}: {})
@{
	const prefix = createCell('a')
	expose({})
	<>
		<c-el><span title={() => prefix.get() + '!'}>ok</span></c-el>
		<style>c-el { color: red }</style>
	</>
}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'TSRX004')).toBe(false)
		// Not a direct site, so no DOM read-back: both halves reuse the
		// identical initializer, like a derived callback.
		expect(component?.clientCode).toContain("createCell('a')")
	})

	test('a { get, set } pass entry missing set is invalid (TSRX006)', () => {
		const source = `export function C({}: {})
	@{
		const value = createCell('x')
		expose({ value: value.get })
		<>
			<c-el truc:pass={{ value: { get: () => value.get() } }}>ok</c-el>
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
				<button><span>{selected}</span></button>
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
			<c-el onClick={() => n.set(0)}><span>{n}</span></c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.message.includes('root element'))).toBe(true)
	})

	test('ambiguous selector is TSRX007', () => {
		const source = wrap(
			`<span>{selected}</span>
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
			<c-el><span>{n}</span></c-el>
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
		// `first()` is deliberately excluded from this example since LT-055:
		// a two-string-literal-argument `first()` call is now the sanctioned
		// `ref={}` replacement (see the "first() element references" describe
		// block below), not a generic client-only primitive.
		const source = `export function C({}: {})
	@{
		const n = createCell(1)
		const el = all('.foo')
		expose({ n: n.get })
		<>
			<c-el><span>{n}</span></c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX013')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`el`')
		expect(hit?.message).toContain('`all`')
	})
})

describe('React JSX near-misses (LT-054)', () => {
	const el = (body: string): string =>
		`export function C({ cond, items }: { cond: boolean; items: string[] })
	@{
		expose({})
		<>
			<c-el>${body}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('{cond && <jsx/>} is TSRX021 with an @if fix-it', () => {
		const source = el('<div>{cond && <span>yes</span>}</div>')
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'TSRX021')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('@if (cond)')
	})

	test('{cond ? <a/> : <b/>} is TSRX022 with an @if/@else fix-it', () => {
		const source = el('<div>{cond ? <span>a</span> : <span>b</span>}</div>')
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'TSRX022')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('@if (cond)')
		expect(hit?.message).toContain('@else')
	})

	test('.map() producing JSX in child position is TSRX023 with an @for fix-it', () => {
		const source = el('<ul>{items.map(i => <li>{i}</li>)}</ul>')
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'TSRX023')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('@for (const i of items)')
	})

	test('.map() over an array NOT producing JSX is not diagnosed', () => {
		const source = el("<div>{items.map(i => i).join(', ')}</div>")
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX023')).toBe(false)
	})

	test('return (<>…</>) in setup is TSRX024, not the generic TSRX005', () => {
		const source = `export function C({ cond }: { cond: boolean })
	@{
		expose({})
		return (<>
			<c-el><span>{cond}</span></c-el>
			<style>c-el { color: red }</style>
		</>)
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX024')).toBe(true)
		expect(diagnostics.some(d => d.code === 'TSRX005')).toBe(false)
	})

	test('className/htmlFor are TSRX006 naming the real HTML attribute', () => {
		const source = el('<label className="x" htmlFor="y">{cond}</label>')
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hits = diagnostics.filter(d => d.code === 'TSRX006')
		expect(hits.some(h => h.message.includes('`class`'))).toBe(true)
		expect(hits.some(h => h.message.includes('`for`'))).toBe(true)
	})

	test('className/htmlFor are rejected on composed elements too', () => {
		const childSource = `export function BasicChild({ label }: { label: string })
	@{
		expose({})
		<>
			<basic-child>{label}</basic-child>
			<style>basic-child { display: block }</style>
		</>
	}`
		const { component: child, diagnostics: childDiagnostics } =
			compileComponent(
				childSource,
				'examples/child/basic-child.tsrx',
				new Set(),
			)
		if (!child)
			throw new Error(`child must compile: ${JSON.stringify(childDiagnostics)}`)
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild className="x" label={title} />
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`
		const composeRegistry = new Map<string, RegistryEntry>([
			[child.entry.source, child.entry],
		])
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(),
			undefined,
			composeRegistry,
		)
		expect(component).toBeNull()
		expect(
			diagnostics.some(
				d => d.code === 'TSRX006' && d.message.includes('`class`'),
			),
		).toBe(true)
	})
})

describe('first(selector, required) element references (LT-055)', () => {
	const el = (setup: string, template: string): string =>
		`export function C({}: {})
	@{
		${setup}
		expose({})
		<>
			<c-el>${template}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('resolves a bare-tag selector and lowers to a ref', () => {
		const source = el(
			"const input = first('input', 'required')",
			'<input onInput={() => input.value} />',
		)
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
		expect(component?.clientCode).toContain("first('input', 'required')")
	})

	test('a selector spanning @if branches with different tags resolves', () => {
		const source = `export function C({ multiline }: { multiline: boolean })
	@{
		const control = first('input, textarea', 'text control')
		expose({})
		<>
			<c-el>
				@if (multiline) {
					<textarea onInput={() => control.value} />
				} @else {
					<input onInput={() => control.value} />
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

	test('a malformed first() call (wrong arg count/shape) is TSRX025', () => {
		const source = el("const input = first('input')", '<input />')
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX025')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('const input = first(…)')
	})

	test('a selector matching no element is TSRX026', () => {
		const source = el(
			"const input = first('.nonexistent', 'required')",
			'<input />',
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX026')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`input`')
	})

	test('a selector using unsupported syntax is TSRX026', () => {
		const source = el(
			"const input = first('c-el input', 'required')",
			'<input />',
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX026')).toBe(true)
	})

	test('a selector matching multiple, non-exclusive elements is TSRX027', () => {
		const source = el(
			"const input = first('input', 'required')",
			'<input /><input />',
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX027')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('2 elements')
	})

	test("the author's required-reason text flows into the emitted message", () => {
		const source = el(
			"const input = first('input', 'a very specific reason')",
			'<input onInput={() => input.value} />',
		)
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		expect(component?.clientCode).toContain(
			"first('input', 'a very specific reason')",
		)
	})

	test('bare ref={} on a composed element is unaffected (still supported)', () => {
		const childSource = `export function BasicChild({ label }: { label: string })
	@{
		expose({})
		<>
			<basic-child>{label}</basic-child>
			<style>basic-child { display: block }</style>
		</>
	}`
		const { component: child, diagnostics: childDiagnostics } =
			compileComponent(
				childSource,
				'examples/child/basic-child.tsrx',
				new Set(),
			)
		if (!child)
			throw new Error(`child must compile: ${JSON.stringify(childDiagnostics)}`)
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild label={title} ref={child} />
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`
		const composeRegistry = new Map([[child.entry.source, child.entry]])
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(),
			undefined,
			composeRegistry,
		)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
	})
})
