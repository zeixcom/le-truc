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
	}
import { asClampedInteger, asJSON } from '@zeix/le-truc'`
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
	}
import { createCell } from '@zeix/le-truc'`
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

	test('@if construct differing between distinguishable branches compiles (per-branch addressing, LT-118)', () => {
		const source = `export function C({ big }: { big?: boolean })
	@{
		expose({})
		<>
			<c-el>
				@if (big) {
					<strong class="a" onClick={() => {}}>a</strong>
				} @else {
					<strong class="b" onClick={() => { }}>b</strong>
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
		// Indistinguishable roots (no distinguishing static attribute) keep
		// the error — per-branch guards could not tell the branches apart,
		// and both guards would bind the one rendered element.
		const indistinguishable = `export function C({ big }: { big?: boolean })
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
		const clash = compileComponent(indistinguishable, 'c.tsrx', new Set())
		const hit = clash.diagnostics.find(d => d.code === 'TSRX007')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('distinguishing')
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
	}
import { deriveList } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX001')).toBe(true)
	})
})

describe('reactive-list rewrite rules (milestone 3)', () => {
	const listSource = (body: string): string =>
		`import { createList } from '@zeix/le-truc'
export function C({}: {})
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
	}
import { createList } from '@zeix/le-truc'`
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
	}
import { createList } from '@zeix/le-truc'`
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
	}
import { createCell } from '@zeix/le-truc'`
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
}
import { createCell } from '@zeix/le-truc'`
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
	}
import { createCell } from '@zeix/le-truc'`
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
	}
import { createCell } from '@zeix/le-truc'`
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
	}
import { deriveCell, createCell } from '@zeix/le-truc'`
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
	}
import { createCell } from '@zeix/le-truc'`
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
		// One literal is the OPTIONAL form since LT-123 — malformed
		// now means neither one nor two string literals.
		const source = el("const input = first('input', 'a', 'b')", '<input />')
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

	test('a bare `first()` reference addresses a composed element (LT-127)', () => {
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
		const child = first('basic-child', 'the composed child')
		expose({})
		<>
			<basic-parent>
				<BasicChild label={title} />
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
		// The selector the client queries is the compiler's own synthesis
		// from the registry tag, not the author's text — the same contract
		// raw-element `first()` has always had.
		expect(component?.clientCode).toContain(
			"first('basic-child', 'the composed child')",
		)
	})

	test('an unmatched required `first()` on a custom-element tag is TSRX026 in the registry pass (LT-127)', () => {
		const source = `export function C({}: {})
	@{
		const stray = first('no-such-child', 'a child this template never composes')
		expose({})
		on(host, 'click', () => stray.focus())
		<>
			<c-el><input /></c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		// `compileSource` alone cannot decide this — the tag could belong to
		// a composed child — so the deferral must not swallow the error.
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
			undefined,
			new Map(),
		)
		expect(diagnostics.some(d => d.code === 'TSRX026')).toBe(true)
	})
})

describe('managed form member shadowing (LT-058)', () => {
	const el = (config: string, exposeBody: string): string =>
		`export const config = ${config}
export function C({ name }: { name: string })
	@{
		expose({ ${exposeBody} })
		<>
			<c-el {name}><input /></c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('exposing a member formAssociated() installs is TSRX028', () => {
		const source = el(
			`{ formAssociated: true }`,
			`value: asString(''), validationMessage: asString('')`,
		)
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'TSRX028')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`validationMessage`')
		expect(hit?.message).toContain('formAssociated()')
	})

	test('exposing defaultValue (the reset-baseline prop) is TSRX028', () => {
		const source = el(
			`{ formAssociated: true }`,
			`value: asString(''), defaultValue: asString('')`,
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(
				d => d.code === 'TSRX028' && d.message.includes('`defaultValue`'),
			),
		).toBe(true)
	})

	test('exposing defaultChecked on formAssociatedCheckbox() is TSRX028', () => {
		const source = el(
			`{ formAssociatedCheckbox: true }`,
			`checked: asBoolean(false), defaultChecked: asBoolean(false)`,
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX028')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('formAssociatedCheckbox()')
	})

	test('exposing value/checked themselves is never flagged', () => {
		const source = el(`{ formAssociated: true }`, `value: asString('')`)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX028')).toBe(false)
	})

	test('a non-form-associated component is unaffected', () => {
		const source = `export function C({}: {})
	@{
		expose({ validationMessage: asString('') })
		<>
			<c-el><span>ok</span></c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { asString } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX028')).toBe(false)
	})
})

describe('inner form control must have no name (LT-059)', () => {
	const el = (template: string): string =>
		`export const config = { formAssociated: true }
export function C({ name }: { name: string })
	@{
		expose({ value: asString('') })
		<>
			<c-el {name}>${template}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('a static name on a descendant input is TSRX029', () => {
		const source = el('<input name="inner" />')
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'TSRX029')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('<input>')
	})

	test('a bound (reactive) name is also TSRX029', () => {
		const source = el('<textarea name={() => host.value} />')
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(
				d => d.code === 'TSRX029' && d.message.includes('<textarea>'),
			),
		).toBe(true)
	})

	test('select and button are also checked', () => {
		const source = el(
			'<select name="a"></select><button name="b" type="button"></button>',
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hits = diagnostics.filter(d => d.code === 'TSRX029')
		expect(hits.some(h => h.message.includes('<select>'))).toBe(true)
		expect(hits.some(h => h.message.includes('<button>'))).toBe(true)
	})

	test('an unnamed inner control is not flagged', () => {
		const source = el('<input />')
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX029')).toBe(false)
	})

	test('name on a non-form-control element is not flagged', () => {
		const source = el('<div name="whatever"></div>')
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX029')).toBe(false)
	})

	test('not gated behind formAssociated is unaffected', () => {
		const source = `export function C({ name }: { name: string })
	@{
		expose({})
		<>
			<c-el {name}><input name="inner" /></c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX029')).toBe(false)
	})
})

describe('textarea value attribute (CHECKLIST §10, TSRX030)', () => {
	test('a static value attribute on textarea is TSRX030', () => {
		const source = `export function C({}: {})
	@{
		expose({})
		<>
			<c-el>
				<textarea value="hi"></textarea>
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
		const hit = diagnostics.find(d => d.code === 'TSRX030')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('text content')
	})

	test('a server-arg value attribute on textarea is TSRX030', () => {
		const source = `export function C({ value }: { value: string })
	@{
		expose({})
		<>
			<c-el>
				<textarea value={value}></textarea>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX030')).toBe(true)
	})

	test('a reactive host-mirror value attribute on textarea is NOT flagged — paired with text content it is sound', () => {
		const source = `export function C({ value }: { value?: string })
	@{
		expose({ value: asString('') })
		<>
			<c-el {value}>
				<textarea value={() => host.value}>{value}</textarea>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { asString } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX030')).toBe(false)
	})

	test('a value attribute on input is not flagged — only textarea lacks the content attribute', () => {
		const source = `export function C({ value }: { value: string })
	@{
		expose({})
		<>
			<c-el>
				<input value={value} />
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX030')).toBe(false)
	})
})

describe('asymmetric @if branch client constructs (per-branch addressing since LT-118)', () => {
	test('a client construct on only one distinguishable branch root addresses per-branch', () => {
		const source = `export function C({ big }: { big?: boolean })
	@{
		expose({})
		<>
			<c-el>
				@if (big) {
					<strong class="plain">a</strong>
				} @else {
					<button type="button" class="act" onClick={() => {}}>b</button>
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
		// The constructed @else root is addressed with its own non-throwing
		// query inside an existence guard; the static @if root is not
		// addressed at all.
		expect(component?.clientCode).toContain("const button = first('button')")
		expect(component?.clientCode).toContain('if (button) {')
	})

	test('a construct unique to one INDISTINGUISHABLE branch root stays an error (was TSRX031)', () => {
		// Both roots are bare <strong> — union addressing cannot carry the
		// asymmetric construct, and per-branch guards over one selector
		// would both bind the rendered element. TSRX007 keeps the hazard an
		// error, naming the fix.
		const source = `export function C({ big }: { big?: boolean })
	@{
		expose({})
		<>
			<c-el>
				@if (big) {
					<strong>a</strong>
				} @else {
					<strong onClick={() => {}}>b</strong>
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
		}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX007')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('distinguishing')
	})

	test('an identical construct on both branch roots is not flagged', () => {
		const source = `export function C({ big }: { big?: boolean })
	@{
		expose({})
		<>
			<c-el>
				@if (big) {
					<strong onClick={() => {}}>a</strong>
				} @else {
					<strong onClick={() => {}}>b</strong>
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
		}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX007')).toBe(false)
	})
})

describe('default value on a non-optional prop type (CHECKLIST §10, TSRX032)', () => {
	test('a default paired with a required type is TSRX032', () => {
		const source = `export function C({ label = 'x' }: { label: string })
	@{
		expose({})
		<>
			<c-el>{label}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX032')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`label`')
		expect(hit?.message).toContain('label?:')
	})

	test('a default paired with an optional type is not flagged', () => {
		const source = `export function C({ label = 'x' }: { label?: string })
	@{
		expose({})
		<>
			<c-el>{label}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX032')).toBe(false)
	})

	test('no default value is not flagged regardless of optionality', () => {
		const source = `export function C({ label }: { label: string })
	@{
		expose({})
		<>
			<c-el>{label}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX032')).toBe(false)
	})
})

describe('impure server fold (CHECKLIST §4, TSRX033)', () => {
	test('a static child (no signal dependency) reading Date is a hard error — no client correction exists', () => {
		const source = `export function C({ label }: { label: string })
	@{
		expose({})
		<>
			<c-el>{label + Date.now()}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'TSRX033')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('error')
	})

	test('Math.random() in a static child is also TSRX033', () => {
		const source = `export function C({}: {})
	@{
		expose({})
		<>
			<c-el>{Math.random()}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX033')).toBe(true)
	})

	test('Math.max (not Math.random) in a static child is not flagged — pure function of its args', () => {
		const source = `export function C({ a, b }: { a: number; b: number })
	@{
		expose({})
		<>
			<c-el>{Math.max(a, b)}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX033')).toBe(false)
	})

	test('a reactive attribute that would otherwise fold, reading Date, is a WARNING — the client corrects the omission', () => {
		const source = `export function C({}: {})
	@{
		const length = createCell(0)
		expose({ length: length.get })
		<>
			<c-el>
				<span>{length}</span>
				<div title={() => length.get() + Date.now()}></div>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createCell } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		const hit = diagnostics.find(d => d.code === 'TSRX033')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('warning')
		expect(hit?.message).toContain('`title`')
		// A warning must not fail the build — the omission is safe.
		expect(component).not.toBeNull()
		expect(component?.serverCode).not.toContain('Date.now')
	})

	test('a purely client-side reactive expression whose deps are NOT server-known is unaffected (nothing would have folded anyway)', () => {
		const source = `export function C({}: {})
	@{
		const length = createCell(0)
		expose({ length: length.get })
		<>
			<c-el>
				<span>{length}</span>
				<button onClick={() => { const x = new Date(); length.set(x.getTime()) }}>go</button>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createCell } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX033')).toBe(false)
	})
})

describe('semantically-loaded attribute has no server default (CHECKLIST §5, TSRX034)', () => {
	test('hidden bound to a comparison over a host prop the root does NOT render is a warning, not an error', () => {
		// `count` is Parser-exposed but never seeded onto <c-el> as a server
		// attribute — LT-085's derived-fold widening can't substitute it (no
		// root expression to splice in), so this stays genuinely unfoldable,
		// unlike the identical-shaped `host.count !== 0` comparison in
		// basic-pluralize.tsrx (which DOES render `count` on its root).
		const source = `export function C({ count }: { count: number })
	@{
		expose({ count: asInteger() })
		<>
			<c-el>
				<p hidden={() => host.count !== 0}>done</p>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { asInteger } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		const hit = diagnostics.find(d => d.code === 'TSRX034')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('warning')
		expect(hit?.message).toContain('visible')
		// A warning must not fail the build.
		expect(component).not.toBeNull()
	})

	test('hidden bound to a comparison over a host prop the root DOES render folds — no diagnostic (LT-085)', () => {
		const source = `export function C({ count }: { count: number })
	@{
		expose({ count: asInteger() })
		<>
			<c-el {count}>
				<p hidden={() => host.count !== 0}>done</p>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { asInteger } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'TSRX034')).toBe(false)
		expect(component?.serverCode).toContain(
			"attr('hidden', (() => (count) !== 0)())",
		)
	})

	test('disabled bound to a derived-but-unrenderable comparison over two host props stays unfoldable', () => {
		// Both `min`/`max` are Parser-exposed and rendered — but `value` is
		// not rendered on the root, so the whole expression can't fold
		// (all-or-nothing: one unfoldable `host.<prop>` read disqualifies it).
		const source = `export function C({ value, min, max }: { value: number; min: number; max: number })
	@{
		expose({ value: asInteger(), min: asInteger(), max: asInteger() })
		<>
			<c-el {min} {max}>
				<button disabled={() => host.value <= host.min}>-</button>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { asInteger } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX034')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('warning')
	})

	test('disabled on a real submittable form control inside a form-associated component escalates to an error (LT-062/LT-085)', () => {
		const source = `export const config = { formAssociated: true }
export function C({}: {})
	@{
		const busy = createCell(false)
		expose({ value: asString('') })
		<>
			<c-el>
				<span>{busy}</span>
				<input disabled={() => busy.get() && Math.random() > 0.5} />
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createCell, asString } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX034')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('error')
		expect(hit?.message).toContain('correctness bug')
	})

	test('disabled on the same unfoldable thunk without formAssociated stays a warning', () => {
		const source = `export function C({}: {})
	@{
		const busy = createCell(false)
		expose({})
		<>
			<c-el>
				<span>{busy}</span>
				<input disabled={() => busy.get() && Math.random() > 0.5} />
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createCell } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX034')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('warning')
	})

	test('disabled on a non-form-control element inside a form-associated component stays a warning', () => {
		const source = `export const config = { formAssociated: true }
export function C({}: {})
	@{
		const busy = createCell(false)
		expose({ value: asString('') })
		<>
			<c-el>
				<span>{busy}</span>
				<fieldset disabled={() => busy.get() && Math.random() > 0.5}>
					<input />
				</fieldset>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createCell, asString } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX034')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('warning')
	})

	test('disabled bound to a non-foldable thunk names the enabled-and-submittable risk', () => {
		const source = `export function C({}: {})
	@{
		const busy = createCell(false)
		expose({})
		<>
			<c-el>
				<span>{busy}</span>
				<button disabled={() => busy.get() && Math.random() > 0.5}>go</button>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createCell } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX034')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('enabled AND submittable')
	})

	test('a bare host-prop mirror on hidden is not flagged — it always renders from the root arg', () => {
		const source = `export function C({ open }: { open?: boolean })
	@{
		expose({ open: asBoolean(false) })
		<>
			<c-el {open}>
				<p hidden={() => host.open}>panel</p>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { asBoolean } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX034')).toBe(false)
	})

	test('a server-evaluable thunk over a signal is not flagged — it folds normally', () => {
		const source = `export function C({}: {})
	@{
		const open = createCell(false)
		expose({ open: open.get })
		<>
			<c-el>
				<span>{open}</span>
				<p hidden={() => !open.get()}>panel</p>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createCell } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX034')).toBe(false)
	})

	test('a non-loaded attribute (e.g. title) with the same non-foldable shape is not flagged', () => {
		const source = `export function C({ count }: { count: number })
	@{
		expose({ count: asInteger() })
		<>
			<c-el {count}>
				<p title={() => host.count !== 0 ? 'yes' : 'no'}>x</p>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { asInteger } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX034')).toBe(false)
	})
})

describe('duplicate id across @try/@catch arms (CHECKLIST §8, TSRX035)', () => {
	const wrapTry = (template: string): string =>
		`export function C({ status }: { status?: string })
	@{
		expose({})
		<>
			<c-el>
				${template}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('the same literal id on the @try body and @catch arm is TSRX035', () => {
		const source = wrapTry(`@try {
			<p id="msg">{status.length}</p>
		} @catch (error) {
			<p id="msg">Failed</p>
		}`)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'TSRX035')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('id="msg"')
		expect(hit?.message).toContain('@try body')
		expect(hit?.message).toContain('@catch arm')
	})

	test('a duplicate id on a NESTED element (not just the arm root) is still TSRX035', () => {
		const source = wrapTry(`@try {
			<div><span id="inner">{status.length}</span></div>
		} @catch (error) {
			<div><span id="inner">Failed</span></div>
		}`)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX035')).toBe(true)
	})

	test('distinct ids across arms are not flagged', () => {
		const source = wrapTry(`@try {
			<p id="msg-ok">{status.length}</p>
		} @catch (error) {
			<p id="msg-error">Failed</p>
		}`)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX035')).toBe(false)
	})
})
