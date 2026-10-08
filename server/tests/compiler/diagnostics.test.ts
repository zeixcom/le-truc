/**
 * Diagnostics tests: the compiler's rewrite rules are the product (ADR
 * 0023) — each rule that cannot be applied must report its diagnostic, and
 * milestone gates must skip files without failing the build.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { namesDeclaredRole } from '../../compiler/first-refs'
import { assertFoldScopeClosed } from '../../compiler/fold-inputs'
import { compileComponent, compileSource } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import type { RegistryEntry } from '../../compiler/registry'
import { createSimulationRealm } from '../../compiler/sim/realm'
import { createGeneratedDir } from '../helpers/generated-corpus'
import { lineAt, textAt } from './located'

const ROOT = path.resolve(import.meta.dir, '../../..')

const wrap = (template: string): string =>
	`export function C({ tabs }: { tabs: { id: string }[] })
	@{
		const selected = createCell('a')
		expose({ selected: selected.get })
			<c-el>${template}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`

describe('extension activation (LTC009)', () => {
	const configSource = (config: string): string =>
		`export const config = ${config}
export function C({ value = '' }: { value?: string })
@{
	expose({ value: asString('') })
		<c-el value={value}><span>ok</span>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`

	test('unknown config key is LTC009', () => {
		const { diagnostics } = compileComponent(
			configSource(`{ formAssociated: true, reactivity: true }`),
			'c.tsrx',
			new Set(),
		)
		const hit = diagnostics.find(d => d.code === 'LTC009')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`reactivity`')
		expect(hit?.message).toContain('Known keys')
	})

	test('combining formAssociated and formAssociatedCheckbox is LTC009', () => {
		const { diagnostics } = compileComponent(
			configSource(`{ formAssociated: true, formAssociatedCheckbox: true }`),
			'c.tsrx',
			new Set(),
		)
		const hit = diagnostics.find(d => d.code === 'LTC009')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('ExtensionCollisionError')
	})

	test('formAssociated with a non-true literal is LTC009', () => {
		const { diagnostics } = compileComponent(
			configSource(`{ formAssociated: 'yes' }`),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(
				d => d.code === 'LTC009' && d.message.includes('must be `true`'),
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
					d.code === 'LTC009' && d.message.includes('array of string literals'),
			),
		).toBe(true)
	})

	test('observedAttributes naming a non-Parser prop is LTC009 (inert extension)', () => {
		const source = `export const config = { observedAttributes: ['label'] }
export function C({ label }: { label?: string })
@{
	expose({ label })
		<c-el><span>{label}</span>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'LTC009')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`label`')
		expect(hit?.message).toContain('inert')
	})

	test('non-object config declaration is LTC009', () => {
		const { diagnostics } = compileComponent(
			configSource(`[formAssociated]`),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(
				d => d.code === 'LTC009' && d.message.includes('object literal'),
			),
		).toBe(true)
	})

	test('asClampedInteger and asJSON are recognized parser ambients', () => {
		const source = `export function C({ max }: { max?: number })
	@{
		expose({ count: asClampedInteger(0, 10), data: asJSON({}) })
			<c-el count={max}><span>ok</span>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { asClampedInteger, asJSON } from '@zeix/le-truc'`
		const { component, diagnostics } = compileSource(source, 'c.tsrx')
		expect(diagnostics).toEqual([])
		expect(component?.exposeProps.get('count')?.parser).toBeDefined()
		expect(component?.exposeProps.get('data')?.parser).toBeDefined()
	})

	test('managed lazy child without formAssociated is LTC010', () => {
		const source = `export function C({}: {})
	@{
		expose({})
			<c-el><p class="error">{host.validationMessage}</p>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'LTC010')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('formAssociated')
	})

	test('setup side effect over a server arg is LTC005 (client-only subset)', () => {
		const source = `export function C({ note }: { note?: string })
	@{
		expose({})
		console.log(note)
			<c-el><span>ok</span>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(
				d =>
					d.code === 'LTC005' && d.message.includes('client-only side effect'),
			),
		).toBe(true)
	})
})

describe('@if conditional markup (LT-008)', () => {
	test('server-known condition compiles and renders per args', () => {
		const source = `export function C({ big }: { big?: boolean })
	@{
		expose({})
			<c-el>
				@if (big) {
					<strong>big</strong>
				} @else {
					<small>small</small>
				}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
	})

	test('@if over a reactive signal compiles to template-cloned arms (ADR 0037)', () => {
		const source = `export function C({}: {})
	@{
		const open = createCell(false)
		expose({ open: open.get })
			<c-el>
				@if (open.get()) {
					<strong>open</strong>
				}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createCell } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component?.clientCode).toContain(
			"() => ((open.get()) ? 'then' : null)",
		)
	})

	test('@if construct differing between distinguishable branches compiles (per-branch addressing, LT-118)', () => {
		const source = `export function C({ big }: { big?: boolean })
	@{
		expose({})
			<c-el>
				@if (big) {
					<strong class="a" onClick={() => {}}>a</strong>
				} @else {
					<strong class="b" onClick={() => { }}>b</strong>
				}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
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
			<c-el>
				@if (big) {
					<strong onClick={() => {}}>a</strong>
				} @else {
					<strong onClick={() => { }}>b</strong>
				}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
		}`
		const clash = compileComponent(indistinguishable, 'c.tsrx', new Set())
		const hit = clash.diagnostics.find(d => d.code === 'LTC007')
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

	test('inline: @for over deriveList reconciles (ADR 0046 s4, LT-425)', () => {
		const source = `export function C({}: {})
	@{
		const items = deriveList(() => ['a'])
			<c-el>
				<ul data-container>
					@for (const item of items; key k) {
						<li>{item}</li>
					}
				</ul>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { deriveList } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component?.clientCode).toContain('reconcile(container,')
	})

	test('inline: @for over a reactive source that is not a List warns LTC001', () => {
		const source = `export function C({}: {})
	@{
		const items = deriveCell(() => ['a'])
			<c-el>
				@for (const item of items) {
					<li>{item}</li>
				}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { deriveCell } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC001')).toBe(true)
	})

	test('key clause on a server-data @for is LTC052 (ADR 0040 s1)', () => {
		const source = `export function C({ items }: { items: string[] })
	@{
			<c-el>
				<ul>
					@for (const item of items; key k) {
						<li>{item}</li>
					}
				</ul>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC052')
		expect(hit?.severity).toBe('error')
		expect(lineAt(source, hit)).toBe(5)
		expect(textAt(source, hit)).toBe('k')
	})
})

describe('non-static element tags (LTC053, LT-213)', () => {
	test('.tsrx dynamic <{expr}> tag is LTC053, never a tag: "" element', () => {
		const source = `export function C({ level }: { level: string })
	@{
			<c-el>
				<{level}>Hi</{level}>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC053')
		expect(hit?.severity).toBe('error')
		expect(lineAt(source, hit)).toBe(4)
		expect(textAt(source, hit)).toBe('<{level}>Hi</{level}>')
		expect(hit?.message).toContain('<{level}>')
		expect(hit?.message).toContain('@else')
	})

	test('.tsx unrecognized namespaced tag <truc:element> is LTC053', () => {
		const source = `import { css } from '@zeix/le-truc-compiler/macros'
export function C({ level }: { level: string }) {
	return (
			<c-el>
				<truc:element tag={level}>Hi</truc:element>
				<style>{css\`@scope {
	:scope {
		  color: red;
		}
}\`}</style>
			</c-el>
	)
}`
		const { component, diagnostics } = compileComponentTsx(
			source,
			'c.tsx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC053')
		expect(hit?.severity).toBe('error')
		expect(lineAt(source, hit)).toBe(5)
		expect(textAt(source, hit)).toBe(
			'<truc:element tag={level}>Hi</truc:element>',
		)
		expect(hit?.message).toContain('<truc:element>')
		expect(hit?.message).toContain('? <h2>')
	})

	test('compose dispatch is unaffected: a PascalCase tag is not LTC053', () => {
		const source = fs.readFileSync(
			path.join(ROOT, 'examples/module/list/module-list.tsrx'),
			'utf8',
		)
		const { diagnostics } = compileComponent(
			source,
			'module-list.tsrx',
			new Set(['basic-button']),
		)
		expect(diagnostics.some(d => d.code === 'LTC053')).toBe(false)
	})
})

describe('<truc:try> arm shapes (LT-303, ADR 0041)', () => {
	const trySource = (boundary: string): string =>
		`import { css } from '@zeix/le-truc-compiler/macros'
import { deriveCell } from '@zeix/le-truc'
export function C({}: {}) {
	const data = deriveCell(async () => 'x')
	const fallback = (e: Error) => <p>{e.message}</p>
	expose({ data: data.get })
	return (
			<c-el>
				${boundary}
				<style>{css\`@scope {
	:scope {
		  color: red;
		}
}\`}</style>
			</c-el>
	)
}`
	const compileTry = (boundary: string) =>
		compileComponentTsx(trySource(boundary), 'c.tsx', new Set(['c-el']))

	test('inline arms compile, and <truc:try> is not LTC053', () => {
		const { component, diagnostics } = compileTry(
			'<truc:try pending={<p class="loading">…</p>} catch={e => <p class="error">{e.message}</p>}><div class="content">{data}</div></truc:try>',
		)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
	})

	test.each([
		[
			'a catch arm passed by reference',
			'<truc:try catch={fallback}><p>ok</p></truc:try>',
		],
		[
			'a block-bodied catch arrow',
			'<truc:try catch={e => { return <p>x</p> }}><p>ok</p></truc:try>',
		],
		[
			'a missing catch arm',
			'<truc:try pending={<p>…</p>}><div>{data}</div></truc:try>',
		],
		[
			'an unknown attribute',
			'<truc:try catch={e => <p>x</p>} class="x"><p>ok</p></truc:try>',
		],
	])(
		'%s is the surviving shape error (LTC005, compiler channel)',
		(_, boundary) => {
			const { component, diagnostics } = compileTry(boundary)
			expect(component).toBeNull()
			const hit = diagnostics.find(d => d.code === 'LTC005')
			expect(hit?.severity).toBe('error')
			expect(lineAt(trySource(boundary), hit)).toBe(9)
			expect(textAt(trySource(boundary), hit)).toBe(boundary)
			expect(hit?.message).toContain(
				'`<truc:try>` boundary with arms that are not inline',
			)
		},
	)

	test('an async boundary still needs one root per arm', () => {
		const { component, diagnostics } = compileTry(
			'<truc:try pending={<><p>a</p><p>b</p></>} catch={e => <p>{e.message}</p>}><div>{data}</div></truc:try>',
		)
		expect(component).toBeNull()
		expect(
			diagnostics.some(d =>
				d.message.includes(
					'`pending` arm that does not render exactly one root element',
				),
			),
		).toBe(true)
	})
})

describe('the loop empty arm (LT-212)', () => {
	const eachSource = (
		arm: string,
	): string => `export function C({ rows }: { rows: string[] })
	@{
			<c-el>
				<ul>
					@for (const row of rows) {
						<li class="row">{row}</li>
					} @empty {
						${arm}
					}
				</ul>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`

	test('a static arm compiles clean', () => {
		const { component, diagnostics } = compileComponent(
			eachSource('<li class="none">Nothing yet</li>'),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
	})

	test('a client construct inside the arm is LTC005', () => {
		const { component, diagnostics } = compileComponent(
			eachSource(
				'<li class="none"><button type="button" onClick={() => console.log(1)}>Add</button></li>',
			),
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC005')
		expect(hit?.message).toContain('`@empty` arm')
	})

	test('an arm root the item selector cannot be told apart from is LTC007', () => {
		// The body needs a client construct: a construct-free loop emits no
		// `each()` and so queries no items to tell apart (LT-322).
		const { diagnostics } = compileComponent(
			eachSource('<li class="row">Nothing yet</li>').replace(
				'<li class="row">{row}</li>',
				'<li class="row" onClick={() => console.log(1)}>{row}</li>',
			),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'LTC007')).toBe(true)
	})

	test('a non-element root in a reactive-list arm is LTC005', () => {
		const { component, diagnostics } = compileComponent(
			`import { createList } from '@zeix/le-truc'
export function C({}: {})
	@{
		const items = createList<string>([], { keyConfig: 'item' })
			<c-el>
				<ul data-container>
					@for (const item of items) {
						<li><span>{item}</span></li>
					} @empty {
						<>Nothing yet</>
					}
				</ul>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC005')
		expect(hit?.message).toContain('non-element root')
	})

	test('.tsx: a `.map()` arm outside the empty-state idiom is LTC005, not a silent drop', () => {
		for (const expr of [
			'ready ? <li class="none">none</li> : rows.map(row => <li>{row}</li>)',
			'ready && rows.map(row => <li>{row}</li>)',
			'rows.length === 0 ? <li class="none">none</li> : other.map(row => <li>{row}</li>)',
		]) {
			const { component, diagnostics } = compileComponentTsx(
				`import { css } from '@zeix/le-truc-compiler/macros'
export function C({ rows, other, ready }: { rows: string[]; other: string[]; ready: boolean }) {
	return (
			<c-el>
				<ul>{${expr}}</ul>
				<style>{css\`@scope {
	:scope {
		  color: red;
		}
}\`}</style>
			</c-el>
	)
}`,
				'c.tsx',
				new Set(),
			)
			expect(component).toBeNull()
			const hit = diagnostics.find(d => d.code === 'LTC005')
			expect(hit?.message).toContain('conditional branch')
		}
	})
})

describe('loops inside conditional branches (LT-301)', () => {
	const tsrx = (body: string): string =>
		`export function C({ rows, ready, mode }: { rows: string[]; ready: boolean; mode: string })
	@{
			<c-el>
				<ul>
					${body}
				</ul>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
	const item = '<li class="item" onClick={() => console.log(1)}>{row}</li>'

	test('.tsrx: a loop in an @if/@else or @switch branch is LTC005', () => {
		for (const [body, branch] of [
			[
				`@if (ready) { <li class="none">x</li> } @else { @for (const row of rows) { ${item} } }`,
				'@if',
			],
			[
				`@switch (mode) { @case 'a': { @for (const row of rows) { ${item} } } @default: { <li>x</li> } }`,
				'@switch',
			],
		] as const) {
			const { component, diagnostics } = compileComponent(
				tsrx(body),
				'c.tsrx',
				new Set(),
			)
			expect(component).toBeNull()
			const hit = diagnostics.find(
				d => d.code === 'LTC005' && d.message.includes('`@for` loop'),
			)
			expect(hit?.message).toContain(`\`${branch}\` branch`)
			expect(hit?.message).toContain('`@empty`')
		}
	})

	test('.tsrx: an @empty loop, or a loop under an element in a branch, stays legal', () => {
		for (const body of [
			`@for (const row of rows) { ${item} } @empty { <li class="none">x</li> }`,
			`@if (ready) { <li class="wrap"><ol>@for (const row of rows) { <li>{row}</li> }</ol></li> }`,
		]) {
			const { diagnostics } = compileComponent(tsrx(body), 'c.tsrx', new Set())
			expect(diagnostics).toEqual([])
		}
	})

	test('.tsx: a loop in a fragment arm is LTC005', () => {
		const { component, diagnostics } = compileComponentTsx(
			`import { css } from '@zeix/le-truc-compiler/macros'
export function C({ rows, ready }: { rows: string[]; ready: boolean }) {
	return (
			<c-el>
				<ul>{ready ? <li class="none">x</li> : <>{rows.map(row => <li class="item" onClick={() => console.log(1)}>{row}</li>)}</>}</ul>
				<style>{css\`@scope {
	:scope {
		  color: red;
		}
}\`}</style>
			</c-el>
	)
}`,
			'c.tsx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(
			d => d.code === 'LTC005' && d.message.includes('`.map()` loop'),
		)
		expect(hit?.message).toContain('conditional branch')
		expect(hit?.message).toContain('empty-state idiom')
	})

	test('an authored `hidden` or `data-unreconciled` on a reactive-list @empty root is LTC005', () => {
		for (const attr of ['hidden', 'data-unreconciled']) {
			const { component, diagnostics } = compileComponent(
				`import { createList } from '@zeix/le-truc'
export function C({}: {})
	@{
		const items = createList<string>([], { keyConfig: 'item' })
			<c-el>
				<ul data-container>
					@for (const item of items) {
						<li><span>{item}</span></li>
					} @empty {
						<li class="none" ${attr}>Nothing yet</li>
					}
				</ul>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`,
				'c.tsrx',
				new Set(),
			)
			expect(component).toBeNull()
			const hit = diagnostics.find(d => d.code === 'LTC005')
			expect(hit?.message).toContain(`\`${attr}\``)
		}
	})
})

describe('reactive-list rewrite rules (milestone 3)', () => {
	const listSource = (body: string): string =>
		`import { createList } from '@zeix/le-truc'
export function C({}: {})
	@{
		const items = createList<string>([], { keyConfig: 'item' })
			<c-el>
				<ul data-container>
					@for (const item of items; key k) {
						${body}
					}
				</ul>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
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

	// ADR 0046 s1: the item is a Mount Scope — a reactive attribute over the
	// item lowers into `bindItem` like any arm content, the arrow over the
	// item signal.
	test('a reactive attribute over the item lowers into bindItem (LT-423)', () => {
		const { component, diagnostics } = compileComponent(
			listSource('<li class={() => item.get()}>no</li>'),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component?.clientCode).toContain("bindAttribute(li, 'class')")
	})

	// Since LT-052 a bare `{item}` IS the slot fill — the item binding is
	// reactive by position, marked in `lowerListFor`. Since LT-215 the old
	// "must be lazy" gate is split: a non-item expression is ADMITTED when
	// it classifies server-static (a build-time value baked into the
	// extracted template), still rejected when it reads names outside
	// `serverKnown` — the slot fill has no channel for those.
	test('a bare {item} is the slot fill, not an error', () => {
		const { diagnostics } = compileComponent(
			listSource('<li>{item}</li>'),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
	})

	// The slot-fill exceptions retired (ADR 0046 s1): the shared
	// lazy-text gate owns the shape now — `bindText()` replaces the
	// element's whole `textContent`, so a lazy child beside other content
	// would erase it on the first write.
	test('a lazy child beside other content is the shared gate', () => {
		const { diagnostics } = compileComponent(
			listSource('<li>{item} static</li>'),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(d =>
				d.message.includes('A lazy text child beside other content'),
			),
		).toBe(true)
	})

	test('more than one lazy text child is the shared gate', () => {
		const { diagnostics } = compileComponent(
			listSource('<li>{item}{() => item.get()}</li>'),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(d =>
				d.message.includes('More than one lazy text child'),
			),
		).toBe(true)
	})

	test('server-known text beside the hole is the shared gate; separated elements bake (LT-215, LT-423)', () => {
		const { diagnostics } = compileComponent(
			`import { createList } from '@zeix/le-truc'
export function C({ label }: { label: string })
	@{
		const items = createList<string>([], { keyConfig: 'item' })
			<c-el>
				<ul data-container>
					@for (const item of items; key k) {
						<li>{item}{label}</li>
					}
				</ul>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`,
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(d =>
				d.message.includes('A lazy text child beside other content'),
			),
		).toBe(true)
		const separated = compileComponent(
			`import { createList } from '@zeix/le-truc'
export function C({ label }: { label: string })
	@{
		const items = createList<string>([], { keyConfig: 'item' })
			<c-el>
				<ul data-container>
					@for (const item of items; key k) {
						<li><span>{item}</span><em>{label}</em></li>
					}
				</ul>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`,
			'c.tsrx',
			new Set(),
		)
		expect(separated.diagnostics).toEqual([])
		// Server-known text bakes into the extracted template at render
		// time, so every clone carries the folded value.
		expect(separated.component?.serverCode).toContain('text(label)')
	})

	// The one-hole rule retired (ADR 0046 s1): a body that renders the item
	// nowhere compiles when the seed is a literal — only the ARG-seeded
	// harvest needs a rendered item value (the test after this one).
	test('a body rendering the item nowhere compiles with a literal seed (LT-423)', () => {
		const { component, diagnostics } = compileComponent(
			listSource('<li>static</li>'),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component?.serverCode).toContain('<template data-list="0">')
		expect(component?.clientCode).toContain(', () => {})')
	})

	test('an arg-seeded list whose body renders the item nowhere is LTC005 (LT-423)', () => {
		const { diagnostics } = compileComponent(
			`import { createList } from '@zeix/le-truc'
export function C({ initial }: { initial?: string[] })
	@{
		const items = createList<string>(initial, { keyConfig: 'item' })
			<c-el>
				<ul data-container>
					@for (const item of items) {
						<li>static</li>
					}
				</ul>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`,
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(d =>
				d.message.includes('rendering the item nowhere to read it from'),
			),
		).toBe(true)
	})

	// The `listItemHandlerFix` refusal retired (ADR 0046 s1): a handler may
	// read the item signal — `bindItem` scopes it, so `item` IS in scope.
	test('a handler reading the loop item compiles (LT-423)', () => {
		const { component, diagnostics } = compileComponent(
			listSource(
				'<li><span>{item}</span><button type="button" onClick={() => console.log(item.get())}>✕</button></li>',
			),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component?.clientCode).toContain('console.log(item.get())')
	})

	test('index binding is LTC005', () => {
		const source = `export function C({}: {})
	@{
		const items = createList<string>(['a'], { keyConfig: 'item' })
			<c-el>
				<ul>
					@for (const item of items; index i; key k) {
						<li>{item}</li>
					}
				</ul>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createList } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.message.includes('An index binding'))).toBe(
			true,
		)
	})

	test('list directly under the root is LTC005 (no container)', () => {
		const source = `export function C({}: {})
	@{
		const items = createList<string>(['a'], { keyConfig: 'item' })
			<c-el>
				@for (const item of items; key k) {
					<li>{item}</li>
				}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createList } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(d =>
				d.message.includes('container element other than the host'),
			),
		).toBe(true)
	})
})

describe('rewrite-rule enforcement', () => {
	test('loop variable inside a reactive thunk is LTC002 with hoist-first hint', () => {
		const source = wrap(
			`@for (const tab of tabs) {
				<button aria-selected={() => String(selected.get() === tab.id)}>{tab.id}</button>
			}`,
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'LTC002')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('Hoist the derived value')
		expect(hit?.message).toContain('`tab`')
	})

	test('hoisted const never rendered as a bare attribute is LTC003', () => {
		const source = wrap(
			`@for (const tab of tabs) {
				const label = tab.id
				<button aria-selected={() => String(selected.get() === label)}>{tab.id}</button>
			}`,
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'LTC003')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`label`')
		expect(hit?.message).toContain('Render it')
	})

	test('signal never rendered is a routing signal, not a diagnostic (LT-165 step 5)', () => {
		// ADR 0029 s5: LTC004 left the channel — "no harvestable site" is a
		// statement about the harness, and the tier machinery now routes on it.
		// The component still compiles, classifies Simulated (a literal
		// initializer is realm-answerable), and the generated client declares
		// the signal from its own initializer — the realm replays that module,
		// so the declaration is what makes the shape actually work.
		const source = `export function C({}: {})
	@{
		const ghost = createCell(1)
		const seen = createCell(0)
		expose({ seen: seen.get })
			<c-el><span>{seen}</span>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createCell } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.severity === 'error')).toBe(false)
		const signals = component?.entry.routingSignals ?? []
		const hit = signals.find(s => s.origin === 'LTC004')
		expect(hit?.detail).toContain('`ghost`')
		expect(hit?.resolution).toEqual({ by: 'realm' })
		expect(component?.entry.tier).toBe('simulated')
		expect(component?.clientCode).toContain('const ghost = createCell(1)')
	})

	test('signal read only in a computed reactive thunk is NOT LTC004 (LT-036)', () => {
		const source = `export function C({}: {})
@{
	const prefix = createCell('a')
	expose({})
		<c-el><span title={() => prefix.get() + '!'}>ok</span>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}
import { createCell } from '@zeix/le-truc'`
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		// Not a direct site, so no DOM read-back: both halves reuse the
		// identical initializer, like a derived callback.
		expect(component?.clientCode).toContain("createCell('a')")
	})

	test('a { get, set } pass entry missing set is invalid (LTC006)', () => {
		const source = `export function C({}: {})
	@{
		const value = createCell('x')
		expose({ value: value.get })
			<c-el truc:pass={{ value: { get: () => value.get() } }}>ok
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createCell } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.some(d => d.code === 'LTC006')).toBe(true)
	})

	test('lazy child inside @for body is gated as milestone-3', () => {
		const source = wrap(
			`@for (const tab of tabs) {
				<button><span>{selected}</span></button>
			}`,
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(d => d.message.includes('owns no template slot')),
		).toBe(true)
	})

	test('a server-static attribute inside a reactive-list body compiles clean (LT-215)', () => {
		const { diagnostics } = compileComponent(
			`import { createList } from '@zeix/le-truc'
export function C({ initial, removeLabel }: { initial?: string[]; removeLabel: string })
@{
	const items = createList<string>(initial, { keyConfig: 'item' })
	expose({})
		<c-el>
			<ul data-container>
				@for (const item of items) {
					<li aria-label={removeLabel}><span>{item}</span></li>
				}
			</ul>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`,
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics).toEqual([])
	})

	test('an item-derived attribute inside a reactive-list body still rejects, naming the offender (LT-215)', () => {
		const { diagnostics } = compileComponent(
			`import { createList } from '@zeix/le-truc'
export function C({ initial }: { initial?: string[] })
@{
	const items = createList<string>(initial, { keyConfig: 'item' })
	expose({})
		<c-el>
			<ul data-container>
				@for (const item of items) {
					<li aria-label={item}><span>{item}</span></li>
				}
			</ul>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`,
			'c.tsrx',
			new Set(['c-el']),
		)
		const hit = diagnostics.find(d =>
			d.message.includes('which is a signal, not a value'),
		)
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`aria-label`')
	})

	test('client constructs on the root element are outside the subset', () => {
		const source = `export function C({}: {})
	@{
		const n = createCell(1)
		expose({ n: n.get })
			<c-el onClick={() => n.set(0)}><span>{n}</span>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createCell } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.message.includes('root element'))).toBe(true)
	})

	test('ambiguous selector is LTC007', () => {
		const source = wrap(
			`<span>{selected}</span>
			<span>other</span>`,
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hits = diagnostics.filter(d => d.code === 'LTC007')
		expect(hits.length).toBeGreaterThan(0)
		expect(hits.some(h => h.message.includes('span'))).toBe(true)
	})

	test('a signal conditionally choosing between two constructors is LTC044', () => {
		const source = `export function C({ big = false }: { big?: boolean })
	@{
		const n = big ? deriveCell(() => 1) : createCell(0)
		expose({ n: n.get })
			<c-el><span>{n}</span>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { deriveCell, createCell } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		// Own code since LT-165's split: a format rule (ADR 0024 s12), not a
		// server-evaluation guard, so it stays an error under tiering.
		const hit = diagnostics.find(d => d.code === 'LTC044')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`n`')
		expect(hit?.message).toContain('conditionally chooses')
	})

	test('a plain setup const calling a client-only primitive routes, not errors (LT-165 step 5)', () => {
		// `first()` is deliberately excluded from this example since LT-055:
		// a two-string-literal-argument `first()` call is now the sanctioned
		// `ref={}` replacement (see the "first() element references" describe
		// block below), not a generic client-only primitive.
		//
		// ADR 0029 s5: the shape the value harness cannot run is a Simulated-
		// tier routing signal. The const lands in plainSetup, so the client
		// module still declares it (`all` resolves in the factory) and the
		// tier-aware server emit drops it.
		const source = `export function C({}: {})
	@{
		const n = createCell(1)
		const el = all('.foo')
		expose({ n: n.get })
			<c-el><span>{n}</span>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createCell } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.severity === 'error')).toBe(false)
		const signals = component?.entry.routingSignals ?? []
		const hit = signals.find(s => s.origin === 'LTC013')
		expect(hit?.detail).toContain('`el`')
		expect(hit?.detail).toContain('all')
		expect(hit?.resolution).toEqual({ by: 'realm' })
		expect(component?.entry.tier).toBe('simulated')
		// The const is referenced by nothing else in the fixture, so it is
		// dead code and the tier-aware server emit drops it rather than
		// re-declaring a call the render function cannot run.
		expect(component?.serverCode).not.toContain("all('.foo')")
	})
})

describe('React JSX near-misses (LT-054)', () => {
	const el = (body: string): string =>
		`export function C({ cond, items }: { cond: boolean; items: string[] })
	@{
		expose({})
			<c-el>${body}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
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

	test('return (<>…</>) in setup is TSRX024, not the generic LTC005', () => {
		const source = `export function C({ cond }: { cond: boolean })
	@{
		expose({})
		return (<>
			<c-el><span>{cond}</span></c-el>
			<style>@scope {
	:scope {
	  color: red;
	}
}</style>
		</>)
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX024')).toBe(true)
		expect(diagnostics.some(d => d.code === 'LTC005')).toBe(false)
	})

	test('className/htmlFor are LTC006 naming the real HTML attribute', () => {
		const source = el('<label className="x" htmlFor="y">{cond}</label>')
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hits = diagnostics.filter(d => d.code === 'LTC006')
		expect(hits.some(h => h.message.includes('`class`'))).toBe(true)
		expect(hits.some(h => h.message.includes('`for`'))).toBe(true)
	})

	test('className/htmlFor are rejected on composed elements too', () => {
		const childSource = `export function BasicChild({ label }: { label: string })
	@{
		expose({})
			<basic-child>{label}
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-child>
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
			<basic-parent>
				<BasicChild className="x" label={title} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
				d => d.code === 'LTC006' && d.message.includes('`class`'),
			),
		).toBe(true)
	})

	test('an unrecognized truc: attribute is LTC006 naming the vocabulary (LT-353)', () => {
		const source = el('<p truc:htm={cond}>x</p>')
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC006')
		expect(hit?.message).toContain('`truc:htm` is not a Le Truc attribute')
		expect(hit?.message).toContain('Use `truc:pass` and `truc:html`')
	})

	test('a retired truc:case/truc:case-type points to the ICU pattern (LT-353)', () => {
		const source = el('<span truc:case="one" truc:case-type="ordinal">x</span>')
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hits = diagnostics.filter(d => d.code === 'LTC006')
		expect(hits.map(h => h.message.split(' ')[0])).toEqual([
			'`truc:case`',
			'`truc:case-type`',
		])
		for (const hit of hits) {
			expect(hit.message).toContain('is retired (ADR 0030)')
			expect(hit.message).toContain('ICU pattern')
		}
	})

	test('a compose site accepts truc:pass only (LT-353)', () => {
		const childSource = `export function BasicChild({ label }: { label: string })
	@{
		expose({})
			<basic-child>{label}
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-child>
	}`
		const { component: child } = compileComponent(
			childSource,
			'examples/child/basic-child.tsrx',
			new Set(),
		)
		if (!child) throw new Error('child must compile')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		expose({})
			<basic-parent>
				<BasicChild truc:html={title} label={title} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(),
			undefined,
			new Map<string, RegistryEntry>([[child.entry.source, child.entry]]),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC006')
		expect(hit?.message).toContain('`truc:html` is not a Le Truc attribute')
		expect(hit?.message).toContain('Use `truc:pass`, or drop')
	})
})

describe('first(selector, required) element references (LT-055)', () => {
	const el = (setup: string, template: string): string =>
		`export function C({}: {})
	@{
		${setup}
		expose({})
			<c-el>${template}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
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
			<c-el>
				@if (multiline) {
					<textarea onInput={() => control.value} />
				} @else {
					<input onInput={() => control.value} />
				}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
	})

	test('a malformed first() call (wrong arg count/shape) is LTC025', () => {
		// One literal is the OPTIONAL form since LT-123 — malformed
		// now means neither one nor two string literals.
		const source = el("const input = first('input', 'a', 'b')", '<input />')
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'LTC025')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('const input = first(…)')
	})

	test('a selector matching no element is LTC026', () => {
		const source = el(
			"const input = first('.nonexistent', 'required')",
			'<input />',
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'LTC026')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`input`')
	})

	test('a selector using unsupported syntax is LTC026', () => {
		const source = el(
			"const input = first('c-el input', 'required')",
			'<input />',
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC026')).toBe(true)
	})

	test('a selector matching multiple, non-exclusive elements is LTC027', () => {
		const source = el(
			"const input = first('input', 'required')",
			'<input /><input />',
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'LTC027')
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
			<basic-child>{label}
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-child>
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
			<basic-parent>
				<BasicChild label={title} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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

	test('two first() names resolving to the same RAW element is LTC041 (LT-132)', () => {
		const source = `export function C({}: {})
	@{
		const a = first('input', 'a')
		const b = first('input', 'b')
		expose({})
		on(host, 'click', () => { a.focus(); b.focus() })
			<c-el><input />
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		// Before LT-132 this compiled silently: `b` never became a query,
		// and the generated client referenced an undeclared const — a tsc
		// error on GENERATED code with nothing pointing at this line.
		const dup = diagnostics.filter(d => d.code === 'LTC041')
		expect(dup).toHaveLength(1)
		expect(dup[0]?.message).toContain('`a`')
		expect(component).toBeNull()
	})

	test('two first() names resolving to the same COMPOSE site is LTC041 (LT-132)', () => {
		const childSource = `export function BasicChild({ label }: { label: string })
	@{
		expose({})
			<basic-child>{label}
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-child>
	}`
		const { component: child } = compileComponent(
			childSource,
			'examples/child/basic-child.tsrx',
			new Set(),
		)
		if (!child) throw new Error('child must compile')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		const a = first('basic-child', 'a')
		const b = first('basic-child', 'b')
		expose({})
		on(host, 'click', () => { a.focus(); b.focus() })
			<basic-parent><BasicChild label={title} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
	}`
		const { diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['basic-child']),
			undefined,
			new Map([[child.entry.source, child.entry]]),
		)
		// `ref={}` made this shape unwritable; `first()` does not.
		expect(diagnostics.filter(d => d.code === 'LTC041')).toHaveLength(1)
	})

	test('an unmatched required `first()` on a custom-element tag is LTC026 in the registry pass (LT-127)', () => {
		const source = `export function C({}: {})
	@{
		const stray = first('no-such-child', 'a child this template never composes')
		expose({})
		on(host, 'click', () => stray.focus())
			<c-el><input />
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
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
		expect(diagnostics.some(d => d.code === 'LTC026')).toBe(true)
	})
})

describe('managed form member shadowing (LT-058)', () => {
	const el = (config: string, exposeBody: string): string =>
		`export const config = ${config}
export function C({ name }: { name: string })
	@{
		expose({ ${exposeBody} })
			<c-el {name}><input />
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`

	test('exposing a member formAssociated() installs is LTC028', () => {
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
		const hit = diagnostics.find(d => d.code === 'LTC028')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`validationMessage`')
		expect(hit?.message).toContain('formAssociated()')
	})

	test('exposing defaultValue (the reset-baseline prop) is LTC028', () => {
		const source = el(
			`{ formAssociated: true }`,
			`value: asString(''), defaultValue: asString('')`,
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(
				d => d.code === 'LTC028' && d.message.includes('`defaultValue`'),
			),
		).toBe(true)
	})

	test('exposing defaultChecked on formAssociatedCheckbox() is LTC028', () => {
		const source = el(
			`{ formAssociatedCheckbox: true }`,
			`checked: asBoolean(false), defaultChecked: asBoolean(false)`,
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'LTC028')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('formAssociatedCheckbox()')
	})

	test('exposing value/checked themselves is never flagged', () => {
		const source = el(`{ formAssociated: true }`, `value: asString('')`)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC028')).toBe(false)
	})

	test('a non-form-associated component is unaffected', () => {
		const source = `export function C({}: {})
	@{
		expose({ validationMessage: asString('') })
			<c-el><span>ok</span>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { asString } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC028')).toBe(false)
	})
})

describe('inner form control must have no name (LT-059)', () => {
	const el = (template: string): string =>
		`export const config = { formAssociated: true }
export function C({ name }: { name: string })
	@{
		expose({ value: asString('') })
			<c-el {name}>${template}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`

	test('a static name on a descendant input is LTC029', () => {
		const source = el('<input name="inner" />')
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC029')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('<input>')
	})

	test('a bound (reactive) name is also LTC029', () => {
		const source = el('<textarea name={() => host.value} />')
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(
				d => d.code === 'LTC029' && d.message.includes('<textarea>'),
			),
		).toBe(true)
	})

	test('select and button are also checked', () => {
		const source = el(
			'<select name="a"></select><button name="b" type="button"></button>',
		)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hits = diagnostics.filter(d => d.code === 'LTC029')
		expect(hits.some(h => h.message.includes('<select>'))).toBe(true)
		expect(hits.some(h => h.message.includes('<button>'))).toBe(true)
	})

	test('an unnamed inner control is not flagged', () => {
		const source = el('<input />')
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC029')).toBe(false)
	})

	test('name on a non-form-control element is not flagged', () => {
		const source = el('<div name="whatever"></div>')
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC029')).toBe(false)
	})

	test('not gated behind formAssociated is unaffected', () => {
		const source = `export function C({ name }: { name: string })
	@{
		expose({})
			<c-el {name}><input name="inner" />
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC029')).toBe(false)
	})
})

describe('textarea value attribute (CHECKLIST §10, LTC030)', () => {
	test('a static value attribute on textarea is LTC030', () => {
		const source = `export function C({}: {})
	@{
		expose({})
			<c-el>
				<textarea value="hi"></textarea>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC030')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('text content')
	})

	test('a server-arg value attribute on textarea is LTC030', () => {
		const source = `export function C({ value }: { value: string })
	@{
		expose({})
			<c-el>
				<textarea value={value}></textarea>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC030')).toBe(true)
	})

	test('a reactive host-mirror value attribute on textarea is NOT flagged — paired with text content it is sound', () => {
		const source = `export function C({ value }: { value?: string })
	@{
		expose({ value: asString('') })
			<c-el {value}>
				<textarea value={() => host.value}>{value}</textarea>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { asString } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC030')).toBe(false)
	})

	test('a value attribute on input is not flagged — only textarea lacks the content attribute', () => {
		const source = `export function C({ value }: { value: string })
	@{
		expose({})
			<c-el>
				<input value={value} />
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC030')).toBe(false)
	})
})

describe('asymmetric @if branch client constructs (per-branch addressing since LT-118)', () => {
	test('a client construct on only one distinguishable branch root addresses per-branch', () => {
		const source = `export function C({ big }: { big?: boolean })
	@{
		expose({})
			<c-el>
				@if (big) {
					<strong class="plain">a</strong>
				} @else {
					<button type="button" class="act" onClick={() => {}}>b</button>
				}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
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

	test('a construct unique to one INDISTINGUISHABLE branch root stays an error (was LTC031)', () => {
		// Both roots are bare <strong> — union addressing cannot carry the
		// asymmetric construct, and per-branch guards over one selector
		// would both bind the rendered element. LTC007 keeps the hazard an
		// error, naming the fix.
		const source = `export function C({ big }: { big?: boolean })
	@{
		expose({})
			<c-el>
				@if (big) {
					<strong>a</strong>
				} @else {
					<strong onClick={() => {}}>b</strong>
				}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
		}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'LTC007')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('distinguishing')
	})

	test('an identical construct on both branch roots is not flagged', () => {
		const source = `export function C({ big }: { big?: boolean })
	@{
		expose({})
			<c-el>
				@if (big) {
					<strong onClick={() => {}}>a</strong>
				} @else {
					<strong onClick={() => {}}>b</strong>
				}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
		}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC007')).toBe(false)
	})
})

describe('default value on a non-optional prop type (CHECKLIST §10, LTC032)', () => {
	test('a default paired with a required type is LTC032', () => {
		const source = `export function C({ label = 'x' }: { label: string })
	@{
		expose({})
			<c-el>{label}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d => d.code === 'LTC032')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`label`')
		expect(hit?.message).toContain('label?:')
	})

	test('a default paired with an optional type is not flagged', () => {
		const source = `export function C({ label = 'x' }: { label?: string })
	@{
		expose({})
			<c-el>{label}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC032')).toBe(false)
	})

	test('no default value is not flagged regardless of optionality', () => {
		const source = `export function C({ label }: { label: string })
	@{
		expose({})
			<c-el>{label}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC032')).toBe(false)
	})
})

describe('impure ambients (CHECKLIST §4, LTC033 — static forms only after LT-165 step 5)', () => {
	test('a static child (no signal dependency) reading Date is a hard error — no client correction exists', () => {
		const source = `export function C({ label }: { label: string })
	@{
		expose({})
			<c-el>{label + Date.now()}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC033')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('error')
	})

	test('Math.random() in a static child is also LTC033', () => {
		const source = `export function C({}: {})
	@{
		expose({})
			<c-el>{Math.random()}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC033')).toBe(true)
	})

	test.each([
		['crypto.randomUUID()'],
		['crypto.getRandomValues(new Uint8Array(4)).join()'],
	])('%s in a static position is LTC033 (LT-314)', expr => {
		const source = `import { css } from '@zeix/le-truc-compiler/macros'
export function C({}: {}) {
	return (
			<c-el><span id={${expr}}>x</span>
				<style>{css\`@scope {
	:scope {
		  color: red;
		}
}\`}</style>
			</c-el>
	)
}`
		const { component, diagnostics } = compileComponentTsx(
			source,
			'c.tsx',
			new Set(),
		)
		expect(component).toBeNull()
		expect(
			diagnostics.filter(d => d.code === 'LTC033' && d.severity === 'error'),
		).toHaveLength(1)
	})

	describe("a server-data loop's items (LT-326)", () => {
		const PROPS = '{ items, lang }: { items: string[]; lang: string }'
		const tsx = (iterable: string) =>
			compileComponentTsx(
				`export function C(${PROPS}) {
	return (
			<c-el><ul>{${iterable}.map(a => <li>{a}</li>)}</ul>
				<style></style>
			</c-el>
	)
}`,
				'c.tsx',
				new Set(),
			)
		const tsrx = (iterable: string) =>
			compileComponent(
				`export function C(${PROPS})
	@{
		expose({})
			<c-el>
				<ul>
					@for (const a of ${iterable}) {
						<li>{a}</li>
					}
				</ul>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`,
				'c.tsrx',
				new Set(),
			)
		const errors033 = (r: ReturnType<typeof tsx>) =>
			r.diagnostics.filter(d => d.code === 'LTC033' && d.severity === 'error')

		test.each([
			['[...items].sort(() => Math.random() - 0.5)'],
			['[crypto.randomUUID()]'],
		])('%s is LTC033 on both surfaces', iterable => {
			for (const result of [tsx(iterable), tsrx(iterable)]) {
				expect(result.component).toBeNull()
				expect(errors033(result)).toHaveLength(1)
			}
		})

		test.each([
			['items'],
			['items.map(i => new Intl.NumberFormat(lang).format(i.length))'],
		])('%s still compiles on both surfaces', iterable => {
			for (const result of [tsx(iterable), tsrx(iterable)]) {
				expect(errors033(result)).toHaveLength(0)
				expect(result.component).not.toBeNull()
			}
		})
	})

	test('crypto.randomUUID() in a reactive position is omitted, not folded (LT-314)', () => {
		const source = `import { css } from '@zeix/le-truc-compiler/macros'
export function C({}: {}) {
	return (
			<c-el><span id={() => crypto.randomUUID()}>x</span>
				<style>{css\`@scope {
	:scope {
		  color: red;
		}
}\`}</style>
			</c-el>
	)
}`
		const { component, diagnostics } = compileComponentTsx(
			source,
			'c.tsx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'LTC033')).toBe(false)
		expect(component).not.toBeNull()
		expect(component?.serverCode).not.toContain('randomUUID')
	})

	test('Math.max (not Math.random) in a static child is not flagged — pure function of its args', () => {
		const source = `export function C({ a, b }: { a: number; b: number })
	@{
		expose({})
			<c-el>{Math.max(a, b)}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC033')).toBe(false)
	})

	test('a reactive attribute reading Date is omitted silently — unresolvability, not a warning (LT-165 step 5)', () => {
		// ADR 0029 s1 limb b / s5: the expression has no server answer in ANY
		// tier, so it is omitted and the client's first binding pass corrects
		// it — no diagnostic, and (this site is not semantically loaded) no
		// routing signal either: impure-ambient is not what routes a component.
		const source = `export function C({}: {})
	@{
		const length = createCell(0)
		expose({ length: length.get })
			<c-el>
				<span>{length}</span>
				<div title={() => length.get() + Date.now()}></div>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createCell } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'LTC033')).toBe(false)
		expect(diagnostics.some(d => d.severity === 'warning')).toBe(false)
		expect(component).not.toBeNull()
		expect(component?.serverCode).not.toContain('Date.now')
		// Not a routing signal: the component stays Folded — the omission is
		// per-expression, and nothing else failed phase 1.
		expect(component?.entry.tier).toBe('folded')
		expect(component?.entry.routingSignals).toHaveLength(0)
	})

	test('a purely client-side reactive expression whose deps are NOT server-known is unaffected (nothing would have folded anyway)', () => {
		const source = `export function C({}: {})
	@{
		const length = createCell(0)
		expose({ length: length.get })
			<c-el>
				<span>{length}</span>
				<button onClick={() => { const x = new Date(); length.set(x.getTime()) }}>go</button>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createCell } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC033')).toBe(false)
	})
})

describe('semantically-loaded attribute with no server default (CHECKLIST §5, LTC034 — routing signal + severe-on-Static after LT-165 step 5)', () => {
	test('hidden bound to a comparison over a host prop the root does NOT render is a routing signal, not a warning (LT-165 step 5)', () => {
		// `count` is Parser-exposed but never seeded onto <c-el> as a server
		// attribute — LT-085's derived-fold widening can't substitute it (no
		// root expression to splice in), so this stays genuinely unfoldable,
		// unlike the identical-shaped `host.count !== 0` comparison in the
		// `c-plural` fixture (fixtures/plural/, the retired basic-pluralize),
		// which DOES render `count` on its root.
		// ADR 0029 s5: unfoldable ≠ author error — the site routes Simulated
		// (the realm reads `host.count` for real) and the channel stays quiet.
		const source = `export function C({ count }: { count: number })
	@{
		expose({ count: asInteger() })
			<c-el>
				<p hidden={() => host.count !== 0}>done</p>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { asInteger } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'LTC034')).toBe(false)
		const hit = component?.entry.routingSignals.find(s => s.origin === 'LTC034')
		expect(hit?.detail).toContain('`hidden`')
		expect(hit?.resolution).toEqual({ by: 'realm' })
		expect(component?.entry.tier).toBe('simulated')
	})

	test('hidden bound to a comparison over a host prop the root DOES render folds — no diagnostic (LT-085)', () => {
		const source = `export function C({ count }: { count: number })
	@{
		expose({ count: asInteger() })
			<c-el {count}>
				<p hidden={() => host.count !== 0}>done</p>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { asInteger } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'LTC034')).toBe(false)
		// The seed is the parser applied to the attribute's serialized value
		// (LT-386) — the same evaluation the client's connect-time parse is.
		expect(component?.serverCode).toContain(
			"attr('hidden', (() => (asInteger()(attrValue(count))) !== 0)())",
		)
	})

	test('disabled bound to a derived-but-unrenderable comparison over two host props routes instead of warning', () => {
		// Both `min`/`max` are Parser-exposed and rendered — but `value` is
		// not rendered on the root, so the whole expression can't fold
		// (all-or-nothing: one unfoldable `host.<prop>` read disqualifies it).
		// No formAssociated → not the severe form → routing signal only, and
		// the realm answers the host reads, so the tier lands Simulated.
		const source = `export function C({ value, min, max }: { value: number; min: number; max: number })
	@{
		expose({ value: asInteger(), min: asInteger(), max: asInteger() })
			<c-el {min} {max}>
				<button disabled={() => host.value <= host.min}>-</button>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { asInteger } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'LTC034')).toBe(false)
		expect(
			component?.entry.routingSignals.some(s => s.origin === 'LTC034'),
		).toBe(true)
		expect(component?.entry.tier).toBe('simulated')
	})

	test('disabled on a real submittable form control inside a form-associated component stays an error on the Static tier (LT-062/LT-085, ADR 0029 s5)', () => {
		// The RNG makes the site unresolvable — the realm could not answer it
		// either, so the conjunction lands Static and the severe diagnostic
		// survives: nothing will ever render `disabled`, and "enabled and
		// submittable" regardless of intent is a correctness bug.
		const source = `export const config = { formAssociated: true }
export function C({}: {})
	@{
		const busy = createCell(false)
		expose({ value: asString('') })
			<c-el>
				<span>{busy}</span>
				<input disabled={() => busy.get() && Math.random() > 0.5} />
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createCell, asString } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC034')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('error')
		expect(hit?.message).toContain('correctness bug')
		expect(hit?.message).toContain('in any tier')
	})

	test('a severe site the realm cannot answer fires even on a Simulated-tier component (LT-184)', () => {
		// The edge the per-component scoping missed: the `disabled` thunk is
		// unresolvable in EVERY tier (a time-window lockout reading the
		// viewing moment), but another site (`hidden` over `host.busy`) is
		// realm-answerable, so the component routes Simulated. The value is
		// still omitted, shipping "enabled and submittable" on a submittable
		// control — the diagnostic must fire on the SITE's resolution, not
		// the component's tier.
		const source = `export const config = { formAssociated: true }
export function C({ busy }: { busy: boolean })
	@{
		expose({ value: asString(''), busy: asBoolean(false) })
			<c-el>
				<p hidden={() => host.busy !== false}>waiting</p>
				<input disabled={() => Date.now() < 1_000} />
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { asString, asBoolean } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC034')
		expect(hit?.severity).toBe('error')
		expect(hit?.message).toContain('in any tier')
		// The premise, pinned separately because the erroring compile returns
		// no component to read a tier off: the very same markup without
		// `formAssociated` (so nothing is severe) really does route Simulated.
		const notSevere = compileComponent(
			source.replace('export const config = { formAssociated: true }\n', ''),
			'c.tsrx',
			new Set(),
		)
		expect(notSevere.component?.entry.tier).toBe('simulated')
	})

	test('the same severe site is silenced on the Simulated tier (ADR 0029 s5: the realm renders the value)', () => {
		// Same submittable control, but the thunk is realm-answerable
		// (`host.busy` — no stub, no impurity), so no error: the realm
		// renders the value, so the diagnostic would be noise. The other
		// direction of the LT-184 pin above — assert the component really
		// did route Simulated, or the silence is vacuous.
		const source = `export const config = { formAssociated: true }
export function C({ busy }: { busy: boolean })
	@{
		expose({ value: asString(''), busy: asBoolean(false) })
			<c-el>
				<input disabled={() => host.busy !== false} />
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { asString, asBoolean } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'LTC034')).toBe(false)
		expect(diagnostics.some(d => d.severity === 'error')).toBe(false)
		expect(component?.entry.tier).toBe('simulated')
	})

	test('disabled on the same unfoldable thunk without formAssociated routes Static with no diagnostic', () => {
		// Not formAssociated → not the severe form → the site is a routing
		// signal only. Its RNG read is unresolvable, so the component itself
		// lands Static — the census record the warning used to fake.
		const source = `export function C({}: {})
	@{
		const busy = createCell(false)
		expose({})
			<c-el>
				<span>{busy}</span>
				<input disabled={() => busy.get() && Math.random() > 0.5} />
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createCell } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'LTC034')).toBe(false)
		const hit = component?.entry.routingSignals.find(s => s.origin === 'LTC034')
		expect(hit?.resolution.by).toBe('none')
		expect(component?.entry.tier).toBe('static')
	})

	test('disabled on a non-form-control element inside a form-associated component routes with no diagnostic', () => {
		// A fieldset is not a submittable control, so the site is not severe:
		// routing signal only (resolution none — the RNG), component Static.
		const source = `export const config = { formAssociated: true }
export function C({}: {})
	@{
		const busy = createCell(false)
		expose({ value: asString('') })
			<c-el>
				<span>{busy}</span>
				<fieldset disabled={() => busy.get() && Math.random() > 0.5}>
					<input />
				</fieldset>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createCell, asString } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'LTC034')).toBe(false)
		expect(component?.entry.tier).toBe('static')
	})

	test('disabled bound to a non-foldable thunk records the routing signal without a diagnostic', () => {
		const source = `export function C({}: {})
	@{
		const busy = createCell(false)
		expose({})
			<c-el>
				<span>{busy}</span>
				<button disabled={() => busy.get() && Math.random() > 0.5}>go</button>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createCell } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'LTC034')).toBe(false)
		const hit = component?.entry.routingSignals.find(s => s.origin === 'LTC034')
		expect(hit?.detail).toContain('`disabled`')
		expect(hit?.resolution.by).toBe('none')
	})

	test('a bare host-prop mirror on hidden is not flagged — it always renders from the root arg', () => {
		const source = `export function C({ open }: { open?: boolean })
	@{
		expose({ open: asBoolean(false) })
			<c-el {open}>
				<p hidden={() => host.open}>panel</p>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { asBoolean } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC034')).toBe(false)
	})

	test('a server-evaluable thunk over a signal is not flagged — it folds normally', () => {
		const source = `export function C({}: {})
	@{
		const open = createCell(false)
		expose({ open: open.get })
			<c-el>
				<span>{open}</span>
				<p hidden={() => !open.get()}>panel</p>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createCell } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC034')).toBe(false)
	})

	test('a non-loaded attribute (e.g. title) with the same non-foldable shape is not flagged', () => {
		const source = `export function C({ count }: { count: number })
	@{
		expose({ count: asInteger() })
			<c-el {count}>
				<p title={() => host.count !== 0 ? 'yes' : 'no'}>x</p>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { asInteger } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'LTC034')).toBe(false)
	})
})

describe('duplicate id across @try/@catch arms (LTC035 retired, LT-275)', () => {
	const wrapTry = (template: string): string =>
		`export function C({ status }: { status?: string })
	@{
		expose({})
			<c-el>
				${template}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`

	// Template-cloned arms (ADR 0037 s4) keep every non-winning arm out of
	// the document, so a literal id repeated across arms no longer collides.
	// The rule retired with the toggled boundary that needed it, and its
	// code left the DiagnosticCode union; what remains is LTC042, the
	// per-instance static-id warning, which is about placing the component
	// twice and says nothing about the arms colliding.
	test('the same literal id across arms raises no error, only LTC042', () => {
		const source = wrapTry(`@try {
			<p id="msg">{status.length}</p>
		} @catch (error) {
			<p id="msg">Failed</p>
		}`)
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(new Set(diagnostics.map(d => d.code))).toEqual(new Set(['LTC042']))
	})
})

describe('static ids in a template (LTC042, LT-131)', () => {
	const withBody = (body: string): string =>
		`export function C({ label, labelId = 'c-label' }: { label?: string; labelId?: string })
	@{
		expose({})
			<c-el>
				${body}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`

	test('a constant id is a warning naming the server-arg fix', () => {
		const { component, diagnostics } = compileComponent(
			withBody(
				`<p id="c-label">{label}</p>
				<meter aria-labelledby="c-label"></meter>`,
			),
			'c.tsrx',
			new Set(['c-el']),
		)
		const warn = diagnostics.filter(d => d.code === 'LTC042')
		expect(warn).toHaveLength(1)
		expect(warn[0]?.severity).toBe('warning')
		// The fix-it names a concrete arg, not just the problem.
		expect(warn[0]?.message).toContain("cLabelId = 'c-label'")
		// A warning, not an error: one instance on a page is legitimate,
		// and the compiler cannot know how many a page will place.
		expect(component).not.toBeNull()
	})

	test('an id rendered from a server arg is silent — the shape the warning asks for', () => {
		const { diagnostics } = compileComponent(
			withBody(
				`<p id={labelId}>{label}</p>
				<meter aria-labelledby={labelId}></meter>`,
			),
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.filter(d => d.code === 'LTC042')).toEqual([])
	})

	test('the ROOT element is checked too — the root is the host', () => {
		const source = `export function C({}: {})
	@{
		expose({})
			<c-el id="the-one"><input />
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.filter(d => d.code === 'LTC042')).toHaveLength(1)
	})
})

describe('setup const reading a first()-bound ref (LTC043 routing / LTC046 rendered, LT-165 step 5)', () => {
	// LT-125 historically. Every non-`first()` setup const lands in
	// `component.setup`, which the FOLDED emit re-declares VERBATIM into the
	// render function — so a const whose initializer reads a `first()`-bound
	// ref would evaluate at server-render time, where no DOM exists. ADR 0029
	// s5: that is a fact about the harness, not an author error — an
	// UNrendered const is a routing signal and the component routes Simulated.
	// The retired error survives, precisely scoped (LTC046), for the one case
	// where the const's VALUE is rendered into the markup: a static splice no
	// tier can produce and no client binding ever corrects.
	const refConst = (extra: string, setup: string, child: string): string =>
		`import { asString } from '@zeix/le-truc'
export function C({}: {})
@{
	const input = first('input', 'the control')
	${setup}
	expose({${extra}})
		<c-el>
			<input type="text" />
			<span class="label">${child}</span>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`

	test('an unrendered ref read routes Simulated and compiles', () => {
		const { component, diagnostics } = compileComponent(
			refConst('', 'const initial = input.value', 'static'),
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.some(d => d.severity === 'error')).toBe(false)
		const hit = component?.entry.routingSignals.find(s => s.origin === 'LTC043')
		expect(hit?.detail).toContain('`initial`')
		expect(hit?.detail).toContain('ref(s) input')
		expect(hit?.resolution).toEqual({ by: 'realm' })
		expect(component?.entry.tier).toBe('simulated')
		// The server module must not evaluate the ref read it cannot run: the
		// tier-aware emit drops the const instead.
		expect(component?.serverCode).not.toContain('input.value')
	})

	test('a rendered ref read is a hard error naming the site (LTC046)', () => {
		const { component, diagnostics } = compileComponent(
			refConst('', 'const initial = input.value', '{initial}'),
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC046')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('error')
		expect(hit?.message).toContain('`initial`')
		expect(hit?.message).toContain('`input`')
	})

	test('a ref also named inside expose() records the same single routing signal when unrendered', () => {
		// Pre-step-5 this was the SILENT variant: the ref got a `refStub` any-
		// stub and the module compiled clean, rendering an empty site. Under
		// tiering both spellings are the same routing fact.
		const { component } = compileComponent(
			refConst(
				' value: asString(input.value),',
				'const initial = input.value',
				'static',
			),
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(
			component?.entry.routingSignals.filter(s => s.origin === 'LTC043'),
		).toHaveLength(1)
		expect(component?.entry.tier).toBe('simulated')
	})

	test('a ref read inside a FUNCTION body does NOT fire', () => {
		// form-spinbutton's `commit`/`typed`/`stepBy` shape: a setup helper is
		// dead code server-side (defined, never called), so its ref reads never
		// evaluate. Firing here would reject the corpus.
		const source = `export function C({}: {})
@{
	const input = first('input', 'the control')
	const commit = (next: string) => { input.value = next }
	expose({})
		<c-el><input type="text" />
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['c-el']),
		)
		// LTC043 is retired onto RoutingSignalOrigin (LT-223); the pin is
		// now the absence of ANY diagnostic.
		expect(diagnostics).toEqual([])
	})

	test('a setup const that reads no ref is untouched', () => {
		const source = `export function C({ name }: { name: string })
@{
	const input = first('input', 'the control')
	const inputId = \`\${name}-input\`
	expose({})
		<c-el><input type="text" id={inputId} />
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['c-el']),
		)
		// LTC043 is retired onto RoutingSignalOrigin (LT-223); the pin is
		// now the absence of ANY diagnostic.
		expect(diagnostics).toEqual([])
	})
})

describe('LTC039 and the sanctioned override shape (LT-129)', () => {
	// The criterion (owner, 2026-08-30): warn only when the two channels carry
	// the SAME value by INDEPENDENT routes. A Parser whose fallback expression
	// reads the very site the arg renders into is bullet 2's declared
	// precedence — host attribute wins over the harvested value — not a copy.
	const overrideSource = (attrs: string, extra = ''): string =>
		`import { asNumber } from '@zeix/le-truc'
export function C({ step = 1 }: { step?: number })
@{
	const input = first('input', 'number input')
	${extra}
	expose({ step: asNumber(asNumber(1)(input.step)) })
		<c-el><input type="number" ${attrs} />
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`

	test('fallback reads the site it renders into — no warning', () => {
		const { diagnostics } = compileComponent(
			overrideSource('step={step}'),
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.filter(d => d.code === 'LTC039')).toEqual([])
	})

	test('a Parser whose fallback reads NOTHING still warns', () => {
		// The independent-copies shape: `step`'s seeding channel is the host
		// attribute alone, so rendering the arg into an owned site is a second
		// copy — form-textbox's `value` and form-tokenbox's `description`.
		const source = `import { asNumber } from '@zeix/le-truc'
export function C({ step = 1 }: { step?: number })
@{
	expose({ step: asNumber(1) })
		<c-el><input type="number" step={step} />
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.filter(d => d.code === 'LTC039')).toHaveLength(1)
	})

	test('the exclusion is per-SITE — a DIFFERENT element still warns', () => {
		// `input`'s fallback sanctions the override on the input itself. The
		// same arg rendered onto a second, unrelated element is still one value
		// through two independent channels, and must keep warning.
		const source = `import { asNumber } from '@zeix/le-truc'
export function C({ step = 1 }: { step?: number })
@{
	const input = first('input', 'number input')
	expose({ step: asNumber(asNumber(1)(input.step)) })
		<c-el>
			<input type="number" step={step} />
			<span data-step={step}></span>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.filter(d => d.code === 'LTC039')).toHaveLength(1)
	})
})

describe('LTC039 override exclusion reaches TEXT CHILDREN too (LT-139)', () => {
	// LT-129 excluded the sanctioned override on ATTRIBUTE sites only. The same
	// relationship spelled as a text child is bullet 4's canonical harvest site
	// (`<span class="label">{label}</span>`) with bullet 2's host-attribute
	// override added — two shapes the profile endorses, combined.
	test('fallback reads the span it renders into — no warning', () => {
		const source = `import { asString } from '@zeix/le-truc'
export function C({ label = '' }: { label?: string })
@{
	const labelSpan = first('span.label', 'label span')
	expose({ label: asString(labelSpan.textContent ?? '') })
		<c-el><span class="label">{label}</span>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.filter(d => d.code === 'LTC039')).toEqual([])
	})

	test('per-SITE still holds — a text child in a DIFFERENT element warns', () => {
		// `labelSpan`'s fallback sanctions the override on that span alone. The
		// same arg rendered as a second element's text is an independent copy.
		const source = `import { asString } from '@zeix/le-truc'
export function C({ label = '' }: { label?: string })
@{
	const labelSpan = first('span.label', 'label span')
	expose({ label: asString(labelSpan.textContent ?? '') })
		<c-el>
			<span class="label">{label}</span>
			<span class="echo">{label}</span>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.filter(d => d.code === 'LTC039')).toHaveLength(1)
	})

	test('a Parser with no fallback read still warns on a text child', () => {
		const source = `import { asString } from '@zeix/le-truc'
export function C({ label = '' }: { label?: string })
@{
	expose({ label: asString('') })
		<c-el><span class="label">{label}</span>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.filter(d => d.code === 'LTC039')).toHaveLength(1)
	})
})

describe('LTC039 exempts a formAssociated() reset baseline (LT-141)', () => {
	// form-textbox's real shape: `value` is Parser-exposed, rendered into an
	// owned text child (`<textarea>{value}</textarea>`), AND rendered onto
	// the root as the host attribute (`<form-textbox {value}>`) — which is
	// the RESET BASELINE `formResetCallback` reads (defaultValue), not an
	// independent second copy of the current value.
	test('formAssociated() root carrying the value attribute — no warning', () => {
		const source = `import { asString } from '@zeix/le-truc'
export const config = { formAssociated: true }
export function C({ value = '' }: { value?: string })
@{
	expose({ value: asString('') })
		<c-el value={value}><textarea>{value}</textarea>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.filter(d => d.code === 'LTC039')).toEqual([])
	})

	test('formAssociatedCheckbox() root carrying the checked attribute — no warning', () => {
		const source = `import { asBoolean } from '@zeix/le-truc'
export const config = { formAssociatedCheckbox: true }
export function C({ checked = false }: { checked?: boolean })
@{
	expose({ checked: asBoolean(false) })
		<c-el checked={checked}><input type="checkbox" checked={checked} />
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.filter(d => d.code === 'LTC039')).toEqual([])
	})

	test('formAssociated() root WITHOUT the value attribute still warns, with the baseline fix-it', () => {
		// No baseline attribute means no reset baseline — the original
		// duplication hazard (fallback-wins-on-first-bind) is real, but the
		// ordinary "drop the attribute" advice would tell the author to
		// delete the very thing formResetCallback needs, so the message must
		// say to ADD the attribute instead.
		const source = `import { asString } from '@zeix/le-truc'
export const config = { formAssociated: true }
export function C({ value = '' }: { value?: string })
@{
	expose({ value: asString('') })
		<c-el><textarea>{value}</textarea>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['c-el']),
		)
		const found = diagnostics.filter(d => d.code === 'LTC039')
		expect(found).toHaveLength(1)
		expect(found[0]?.message).toContain('reset baseline')
		expect(found[0]?.message).toContain('defaultValue')
		expect(found[0]?.message).not.toContain('drop the attribute')
	})

	test('a non-form-associated component exposing `value` still warns', () => {
		// Same site shape as form-textbox, minus formAssociated() — nothing
		// reserves `value` as a reset baseline here, so it is a plain
		// duplicate and the ordinary fix-it applies.
		const source = `import { asString } from '@zeix/le-truc'
export function C({ value = '' }: { value?: string })
@{
	expose({ value: asString('') })
		<c-el value={value}><textarea>{value}</textarea>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['c-el']),
		)
		const found = diagnostics.filter(d => d.code === 'LTC039')
		expect(found).toHaveLength(1)
		expect(found[0]?.message).toContain('drop the attribute')
	})
})

describe('LTC033 covers static/server-rendered attributes (LT-075)', () => {
	const withAttrs = (tpl: string): string => `export function C({}: {})
@{
	expose({})
		<c-el>${tpl}
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`

	test('a server-rendered attribute reading Date is a hard error', () => {
		// Same hazard as the static-CHILD form already caught: the attribute
		// renders once, server-side, forever — there is no watch() to correct
		// the build machine's clock reading.
		const { diagnostics } = compileComponent(
			withAttrs('<div title={Date.now()}></div>'),
			'c.tsrx',
			new Set(['c-el']),
		)
		const hit = diagnostics.find(d => d.code === 'LTC033')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('error')
		expect(hit?.message).toContain('title')
	})

	test('Math.random() in a server-rendered attribute is caught too', () => {
		const { diagnostics } = compileComponent(
			withAttrs('<div data-x={Math.random()}></div>'),
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(
			diagnostics.filter(d => d.code === 'LTC033' && d.severity === 'error'),
		).toHaveLength(1)
	})

	test('a REACTIVE thunk over the same ambient is omitted silently (LT-165 step 5)', () => {
		// The client's first binding pass corrects an omitted fold, so the
		// reactive form is unresolvability (ADR 0029 s1 limb b), not an author
		// error — no diagnostic, no routing signal (impure-ambient does not
		// route; the `title` site is not semantically loaded either).
		const { component, diagnostics } = compileComponent(
			withAttrs('<div title={() => String(Date.now())}></div>'),
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.filter(d => d.code === 'LTC033')).toEqual([])
		expect(diagnostics.some(d => d.severity === 'warning')).toBe(false)
		expect(component?.entry.tier).toBe('folded')
	})

	test('a pure server-rendered attribute is untouched', () => {
		const { diagnostics } = compileComponent(
			withAttrs('<div title={Math.max(1, 2)}></div>'),
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.filter(d => d.code === 'LTC033')).toEqual([])
	})
})

/* === ADR 0028's owed rules (LT-157) === */

/**
 * ADR 0028 sub-design 5 makes the compiler the primary channel and the
 * runtime a backstop. LT-155 contained the runtime half, so a condition with
 * no rule here is a condition the author now learns about from a console
 * line on a page that already degraded — these four rules are what buys
 * containment back.
 */
describe('reserved expose() key (LTC028, LT-157a)', () => {
	const exposing = (props: string): string =>
		`export function C({}: {})
@{
	expose({ ${props} })
		<c-el><span>ok</span>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`

	test('a reserved word as an expose() key is LTC028', () => {
		const { diagnostics } = compileComponent(
			exposing(`toString: 'x'`),
			'c.tsrx',
			new Set(),
		)
		const hit = diagnostics.find(d => d.code === 'LTC028')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('error')
		expect(hit?.message).toContain('`toString`')
		expect(hit?.message).toContain('reserved word or Object builtin')
	})

	test('every RESERVED_WORDS_LIST entry is covered, not just the obvious ones', () => {
		// The list is duplicated in `vocabulary.ts` (the compiler does not
		// import the runtime library), so a drift between the two is exactly
		// the failure this rule exists to prevent.
		for (const word of [
			'constructor',
			'prototype',
			'__proto__',
			'toString',
			'valueOf',
			'hasOwnProperty',
			'isPrototypeOf',
			'propertyIsEnumerable',
			'toLocaleString',
		]) {
			const { diagnostics } = compileComponent(
				exposing(`${word}: 'x'`),
				'c.tsrx',
				new Set(),
			)
			expect(
				diagnostics.some(
					d => d.code === 'LTC028' && d.message.includes(`\`${word}\``),
				),
			).toBe(true)
		}
	})

	test('the check is ungated — it does not need config.formAssociated', () => {
		// LTC028's other builder only fires for a form-associated
		// component; this one has nothing to do with form participation.
		const { diagnostics } = compileComponent(
			exposing(`valueOf: 1`),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'LTC028')).toBe(true)
	})

	test('an ordinary prop name is untouched', () => {
		const { diagnostics } = compileComponent(
			exposing(`label: 'x'`),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.code === 'LTC028')).toEqual([])
	})
})

describe('malformed selector (LTC026, LT-157b)', () => {
	const withSetup = (setup: string): string =>
		`export function C({}: {})
@{
	${setup}
	expose({})
		<c-el><button role="option">ok</button>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`

	test('a malformed all() selector is LTC026', () => {
		const { diagnostics } = compileComponent(
			withSetup(`const opts = all('button[role="option"')`),
			'c.tsrx',
			new Set(),
		)
		const hit = diagnostics.find(
			d => d.code === 'LTC026' && d.message.includes('valid CSS selector'),
		)
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('leaves a `[` unclosed')
	})

	test('a trailing combinator is LTC026', () => {
		const { diagnostics } = compileComponent(
			withSetup(`const opts = all('button >')`),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(
				d =>
					d.code === 'LTC026' && d.message.includes('ends with a combinator'),
			),
		).toBe(true)
	})

	test('the scan reaches a call nested in a handler or a defineMethod body', () => {
		// The rule's whole point: form-listbox calls `all()` from both, and
		// neither goes through setup extraction.
		const { diagnostics } = compileComponent(
			withSetup(
				`const focusFirst = () => { document.querySelector('x') }
	const m = defineMethod(() => { all('button[').item(0) })`,
			),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(
				d => d.code === 'LTC026' && d.message.includes('leaves a `[` unclosed'),
			),
		).toBe(true)
	})

	test('a selector this compiler cannot structurally verify is NOT malformed', () => {
		// `:not(…)` is outside `first-refs.ts`'s structural subset but is
		// perfectly valid CSS. Conflating "cannot verify" with "malformed"
		// would fail builds over working markup — see selector-syntax.ts.
		const { diagnostics } = compileComponent(
			withSetup(`const opts = all('button[role="option"]:not([hidden])')`),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.filter(d => d.message.includes('valid CSS selector')),
		).toEqual([])
	})
})

describe('deferred collector call (LTC045, LT-157d)', () => {
	const withSetup = (setup: string): string =>
		`export function C({}: {})
@{
	expose({})
	${setup}
		<c-el><span>ok</span>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`

	test('watch() inside a setTimeout callback is LTC045', () => {
		const { diagnostics } = compileComponent(
			withSetup(`setTimeout(() => { watch(() => 1, () => {}) }, 0)`),
			'c.tsrx',
			new Set(),
		)
		const hit = diagnostics.find(
			d => d.code === 'LTC045' && d.message.includes('NoActiveCollectorError'),
		)
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`watch(…)`')
	})

	test('on() inside a promise callback is LTC045', () => {
		const { diagnostics } = compileComponent(
			withSetup(`Promise.resolve().then(() => { on('click', () => {}) })`),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(
				d => d.code === 'LTC045' && d.message.includes('`on(…)`'),
			),
		).toBe(true)
	})

	test('a top-level client-only setup statement is untouched', () => {
		// LT-008/LT-069's sanctioned escape hatch — the collector IS active
		// there, which is the whole distinction this rule draws.
		const { diagnostics } = compileComponent(
			withSetup(`on('click', () => {})`),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.filter(d => d.message.includes('NoActiveCollectorError')),
		).toEqual([])
	})

	test('a member call that merely shares the name is untouched', () => {
		const { diagnostics } = compileComponent(
			withSetup(`queueMicrotask(() => { document.body.on('x') })`),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.filter(d => d.message.includes('NoActiveCollectorError')),
		).toEqual([])
	})

	test('an async component function is rejected outright (LTC008)', () => {
		const source = `export async function C({}: {})
@{
	expose({})
		<c-el><span>ok</span>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(
			d => d.code === 'LTC008' && d.message.includes('async'),
		)
		expect(hit).toBeDefined()
	})
})

describe('reactive-list body impure-ambient diagnostic (LT-221 §1.1, retired LT-423)', () => {
	// `Date` is a JS global, so `dependenciesOf` strips it and the offender
	// list is EMPTY. The slot-fill refusal that carried the LT-221 §1.1
	// message retired with the slot fill (ADR 0046 s1): the shape now hits
	// the shared lazy-text gate instead — `{Date.now()}` classifies server,
	// so the lazy `{item}` child stands beside other content.
	const mapBody = '{items.map(item => <li>{item} {Date.now()}</li>)}'

	test('.tsx — the retired impure-ambient refusal is the shared gate now', () => {
		const source = `import { css } from '@zeix/le-truc-compiler/macros'
import { createList } from '@zeix/le-truc'

export function C({}, { expose }: FactoryContext<{}>) {
	const items = createList([])
	expose({})
	return (
			<c-el>
				<ul>${mapBody}</ul>
				<style>{css\`@scope {
	:scope {
		  color: red;
		}
}\`}</style>
			</c-el>
	)
}`
		const { diagnostics } = compileComponentTsx(source, 'c.tsx', new Set())
		const hit = diagnostics.find(d =>
			d.message.includes('A lazy text child beside other content'),
		)
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('on <li>')
		expect(hit?.message).not.toContain('reads ,')
	})

	test('.tsrx twin — the shared gate, not the retired refusal', () => {
		const source = `export function C({}: {})
	@{
		const items = createList([])
		expose({})
			<c-el>
				<ul>
					@for (const item of items) {
						<li>{item} {Date.now()}</li>
					}
				</ul>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}
import { createList } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		const hit = diagnostics.find(d =>
			d.message.includes('A lazy text child beside other content'),
		)
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('on <li>')
		expect(hit?.message).not.toContain('reads ,')
	})
})

describe('partial-readiness invariant (LTC054, ADR 0034 s4, LT-258)', () => {
	const tsx = (
		template: string,
		{
			params = '{ label }: { label: string }',
			setup = '',
		}: { params?: string; setup?: string } = {},
	): string =>
		`export function C(${params}) {
${setup}	return (
		${template}
	)
}`
	const ltc054 = (source: string, file = 'c.tsx') => {
		const result = file.endsWith('.tsx')
			? compileComponentTsx(source, file, new Set())
			: compileComponent(source, file, new Set())
		return {
			component: result.component,
			hits: result.diagnostics.filter(d => d.code === 'LTC054'),
		}
	}

	test.each([
		[
			'a static attribute',
			'<c-el title={document.title}><span>x</span></c-el>',
			'document',
		],
		[
			'a static text child',
			'<c-el><span>{window.location.href}</span></c-el>',
			'window',
		],
		[
			'a folded reactive attribute',
			'<c-el><span title={() => navigator.language}>x</span></c-el>',
			'navigator',
		],
		[
			'a condition',
			'<c-el>{globalThis.flag ? <span>a</span> : <b>b</b>}</c-el>',
			'globalThis',
		],
	])('%s reading page context fails the build', (_, template, read) => {
		const { component, hits } = ltc054(tsx(template))
		expect(component).toBeNull()
		expect(hits).toHaveLength(1)
		expect(hits[0]?.severity).toBe('error')
		expect(hits[0]?.message).toContain(`\`${read}\``)
		expect(hits[0]?.message).toContain('page context')
	})

	test('a setup const the render evaluates is a fold input', () => {
		const source = tsx('<c-el><span>{w}</span></c-el>', {
			setup: '\tconst w = String(window.innerWidth)\n',
		})
		const { hits } = ltc054(source)
		expect(hits).toHaveLength(1)
		expect(hits[0]?.message).toContain('setup const `w`')
		expect(lineAt(source, hits[0])).toBe(2)
	})

	test('a setup helper reading page context taints the fold that calls it', () => {
		const { hits } = ltc054(
			tsx('<c-el><span>{inner(label)}</span></c-el>', {
				setup:
					'\tconst outer = () => document.title\n\tconst inner = (s: string) => s + outer()\n',
			}),
		)
		expect(hits).toHaveLength(1)
		expect(hits[0]?.message).toContain('a text child')
		expect(hits[0]?.message).toContain('`document`')
	})

	test('a helper never called by a fold is not a fold input', () => {
		const { component, hits } = ltc054(
			tsx(
				'<c-el><button type="button" onClick={() => focusActive()}>{label}</button></c-el>',
				{
					setup:
						'\tconst focusActive = () => (document.activeElement as HTMLElement | null)?.focus()\n',
				},
			),
		)
		expect(hits).toHaveLength(0)
		expect(component).not.toBeNull()
	})

	test('a reactive thunk the server does not fold is left to the client', () => {
		const { component, hits } = ltc054(
			tsx(
				'<c-el><span title={() => host.label + document.title}>x</span></c-el>',
				{
					params:
						'{ label }: { label: string }, { host, expose }: FactoryContext<{ label: string }>',
					setup: "\texpose({ label: asString('') })\n",
				},
			).replace(
				'export function',
				"import type { FactoryContext } from '@zeix/le-truc'\nimport { asString } from '@zeix/le-truc'\nexport function",
			),
		)
		expect(hits).toHaveLength(0)
		expect(component).not.toBeNull()
	})

	test('destructuring an undeclared member of the i18n record fails', () => {
		const { component, hits } = ltc054(
			tsx('<c-el><span>{page}</span></c-el>', {
				params: '{ i18n: { lang, page } }: { i18n: I18n }',
			}),
		)
		expect(component).toBeNull()
		expect(hits).toHaveLength(1)
		expect(hits[0]?.message).toContain('`page` is not a member')
		// The member list is interpolated from PAGE_AMBIENTS, not hard-coded.
		expect(hits[0]?.message).toContain(
			'`lang`, `t`, `timeZone`, `currency` and `dir`',
		)
		expect(hits[0]?.message).toContain('declare `page` as an arg')
	})

	test('a rest element over the i18n record fails', () => {
		const { hits } = ltc054(
			tsx('<c-el><span>{rest.lang}</span></c-el>', {
				params: '{ i18n: { ...rest } }: { i18n: I18n }',
			}),
		)
		expect(hits.some(h => h.message.includes('undeclared member'))).toBe(true)
	})

	test('a whole-record read outside the declared set fails', () => {
		const { hits } = ltc054(
			tsx('<c-el><span>{i18n.url}</span></c-el>', {
				params: '{ i18n }: { i18n: I18n }',
			}),
		)
		expect(hits).toHaveLength(1)
		expect(hits[0]?.message).toContain('`i18n.url`')
	})

	test('the declared ambient members pass', () => {
		const { hits } = ltc054(
			tsx('<c-el><span title={i18n.timeZone}>{i18n.lang}</span></c-el>', {
				params: '{ i18n }: { i18n: I18n }',
			}),
		)
		expect(hits).toHaveLength(0)
	})

	test('.tsrx twin: a page-context read fails the build', () => {
		const { component, hits } = ltc054(
			`export function C({ label }: { label: string })
	@{
			<c-el title={document.title}><span>{label}</span>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`,
			'c.tsrx',
		)
		expect(component).toBeNull()
		expect(hits).toHaveLength(1)
		expect(hits[0]?.message).toContain('`document`')
	})

	test('a server-data loop iterable reading page context fails the build (LT-313)', () => {
		const { component, hits } = ltc054(
			tsx(
				"<c-el><ul>{[...document.querySelectorAll('a')].map(a => <li>{a.href}</li>)}</ul></c-el>",
			),
		)
		expect(component).toBeNull()
		expect(hits).toHaveLength(1)
		expect(hits[0]?.message).toContain('the items of a loop')
		expect(hits[0]?.message).toContain('`document`')
	})

	test('.tsrx twin: a server-data loop iterable reading page context fails the build (LT-313)', () => {
		const { component, hits } = ltc054(
			`export function C({ label }: { label: string })
	@{
			<c-el><ul>
				@for (const a of [...document.querySelectorAll('a')]) {
					<li>{a.href}</li>
				}
			</ul>
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</c-el>
	}`,
			'c.tsrx',
		)
		expect(component).toBeNull()
		expect(hits).toHaveLength(1)
		expect(hits[0]?.message).toContain('the items of a loop')
	})

	test('a loop over an own arg is not a page-context read', () => {
		const { hits } = ltc054(
			tsx('<c-el><ul>{items.map(item => <li>{item}</li>)}</ul></c-el>', {
				params: '{ items }: { items: string[] }',
			}),
		)
		expect(hits).toHaveLength(0)
	})

	test('the render scope admits only own names and declared harness names', () => {
		const component = {
			tag: 'c-el',
			paramNames: ['label'],
			setup: [],
			signals: [],
			serverKnown: new Set(['label', 'isPending', 'pageUrl']),
		} as unknown as Parameters<typeof assertFoldScopeClosed>[0]
		expect(() => assertFoldScopeClosed(component)).toThrow('`pageUrl`')
	})
})

describe('the reach-in check (LTC083, ADR 0048 s2, LT-474)', () => {
	const styleTsrx = `<style>@scope {
	:scope {
		  color: red;
		}
}</style>`
	const tsrx = (childrenType: string, refs: string): string =>
		`export function C({ children = '' }: { children?: ${childrenType} })
@{
	${refs}
	expose({})
		<c-el>
			<div class="wrap">{children}</div>
			${styleTsrx}
		</c-el>
}`
	const tsx = (childrenType: string, refs: string): string =>
		`import { css } from '@zeix/le-truc-compiler/macros'

export function C({ children = '' }: { children?: ${childrenType} }, { first }: any) {
	${refs}
	expose({})
	return (
		<c-el>
			<div class="wrap">{children}</div>
			<style>{css\`@scope {
	:scope {
		  color: red;
		}
}\`}</style>
		</c-el>
	)
}`
	const reachIns = (result: {
		diagnostics: { code: string; message: string }[]
	}): { code: string; message: string }[] =>
		result.diagnostics.filter(d => d.code === 'LTC083')

	test('an optional ref that can only resolve in the content is a reach-in (.tsrx)', () => {
		const { diagnostics } = compileComponent(
			tsrx('string', `const icon = first('.icon')`),
			'c.tsrx',
			new Set(),
		)
		expect(reachIns({ diagnostics })).toHaveLength(1)
	})

	test('an optional ref that can only resolve in the content is a reach-in (.tsx)', () => {
		const { diagnostics } = compileComponentTsx(
			tsx('string', `const icon = first('.icon')`),
			'c.tsx',
			new Set(),
		)
		expect(reachIns({ diagnostics })).toHaveLength(1)
	})

	test('a required ref is a reach-in too', () => {
		const { diagnostics } = compileComponent(
			tsrx('string', `const icon = first('.icon', 'the icon')`),
			'c.tsrx',
			new Set(),
		)
		expect(reachIns({ diagnostics })).toHaveLength(1)
	})

	test('a declared role addressing the content is not a reach-in (.tsrx)', () => {
		const { diagnostics, component } = compileComponent(
			tsrx("Children<{ icon: 'span' }>", `const icon = first('.icon')`),
			'c.tsrx',
			new Set(),
		)
		expect(reachIns({ diagnostics })).toHaveLength(0)
		expect(diagnostics).toHaveLength(0)
		// The role-addressed ref queries the authored selector from the host;
		// the region re-include resolves it inside the content (ADR 0048 s1).
		expect(component?.clientCode).toContain("'.icon'")
	})

	test('a declared role addressing the content is not a reach-in (.tsx)', () => {
		const { diagnostics } = compileComponentTsx(
			tsx("Children<{ icon: 'span' }>", `const icon = first('.icon')`),
			'c.tsx',
			new Set(),
		)
		expect(reachIns({ diagnostics })).toHaveLength(0)
		expect(diagnostics).toHaveLength(0)
	})

	test('the subject compound decides: a role above the subject is a reach-in', () => {
		const { diagnostics } = compileComponent(
			tsrx("Children<{ wrap: 'div' }>", `const icon = first('.wrap .icon')`),
			'c.tsrx',
			new Set(),
		)
		expect(reachIns({ diagnostics })).toHaveLength(1)
	})

	test('a selector matching the own template is not a reach-in', () => {
		const { diagnostics } = compileComponent(
			tsrx('string', `const wrap = first('.wrap')`),
			'c.tsrx',
			new Set(),
		)
		expect(reachIns({ diagnostics })).toHaveLength(0)
	})

	test('without a {children} insertion an unmatched optional ref stays LT-123 silent', () => {
		const source = `export function C({}: {})
@{
	const icon = first('.icon')
	expose({})
		<c-el>
			<div class="wrap"></div>
			${styleTsrx}
		</c-el>
}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(reachIns({ diagnostics })).toHaveLength(0)
		expect(diagnostics).toHaveLength(0)
	})

	test('the fix names the role declaration', () => {
		const { diagnostics } = compileComponent(
			tsrx('string', `const icon = first('.icon')`),
			'c.tsrx',
			new Set(),
		)
		const hit = reachIns({ diagnostics })[0]
		expect(hit?.message).toContain('`Children<{ … }>`')
		expect(hit?.message).toContain('belongs to the parent')
	})

	test('roles and the model are read through a same-file alias', () => {
		const { component } = compileSource(
			`type Roles = { icon: 'span'; 'my-item': 'li' }
export function C({ children = '' }: { children?: Children<Roles, 'non-interactive'> })
@{
	expose({})
		<c-el>
			<div>{children}</div>
			${styleTsrx}
		</c-el>
}`,
			'c.tsrx',
		)
		expect([...(component?.childrenContract?.roles ?? [])]).toEqual([
			['icon', 'span'],
			['my-item', 'li'],
		])
		expect(component?.childrenContract?.model).toBe('non-interactive')
	})

	test('the model defaults to any when the second type argument is absent', () => {
		const { component } = compileSource(
			tsrx("Children<{ icon: 'span' }>", ''),
			'c.tsrx',
		)
		expect(component?.childrenContract?.model).toBe('any')
	})

	test('a component without the annotation runs the check with no roles', () => {
		const { component } = compileSource(tsrx('string', ''), 'c.tsrx')
		expect(component?.childrenContract).toBeUndefined()
	})

	test('the deferred leg reports the reach-in through the compose-registry pass', () => {
		const source = `export function C({ children = '' }: { children?: Children })
@{
	const box = first('form-textbox.filter')
	expose({})
		<c-el>
			{children}
			${styleTsrx}
		</c-el>
}`
		const { component } = compileSource(source, 'c.tsrx')
		expect(component?.firstRefs.get('box')?.stage).toBe('deferred')
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
			undefined,
			new Map(),
		)
		expect(reachIns({ diagnostics })).toHaveLength(1)
	})

	test('a role-classed custom-tag selector resolves on the deferred leg', () => {
		const source = `export function C({ children = '' }: { children?: Children<{ box: 'form-textbox' }> })
@{
	const box = first('.box')
	expose({})
		<c-el>
			{children}
			${styleTsrx}
		</c-el>
}`
		const { component } = compileSource(source, 'c.tsrx')
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
			undefined,
			new Map(),
		)
		expect(reachIns({ diagnostics })).toHaveLength(0)
		expect(diagnostics).toHaveLength(0)
		expect(component?.firstRefs.get('box')?.stage).toBe('unmatched')
	})

	test('a required role-addressed ref compiles and keeps its throwing query (.tsrx)', () => {
		const source = tsrx(
			"Children<{ icon: 'span' }>",
			`const icon = first('.icon', 'the icon')`,
		)
		const { component } = compileSource(source, 'c.tsrx')
		const { diagnostics, component: entry } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component?.firstRefs.get('icon')).toMatchObject({
			stage: 'unmatched',
			required: true,
		})
		// The authored reason rides the throwing query — the runtime's
		// existing required-ref check settles it at connect — not the
		// optional form.
		expect(entry?.clientCode).toContain("'.icon', 'the icon'")
	})

	test('a required role-addressed ref compiles and keeps its throwing query (.tsx)', () => {
		const { diagnostics, component } = compileComponentTsx(
			tsx(
				"Children<{ icon: 'span' }>",
				`const icon = first('.icon', 'the icon')`,
			),
			'c.tsx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		// The authored reason rides the throwing query, not the optional
		// form (`first('.icon')` would not carry the comma).
		expect(component?.clientCode).toContain("'.icon', 'the icon'")
	})

	test('a required role-classed custom-tag selector resolves on the deferred leg too', () => {
		const source = `export function C({ children = '' }: { children?: Children<{ box: 'form-textbox' }> })
@{
	const box = first('.box', 'the box')
	expose({})
		<c-el>
			{children}
			${styleTsrx}
		</c-el>
}`
		const { component } = compileSource(source, 'c.tsrx')
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
			undefined,
			new Map(),
		)
		expect(reachIns({ diagnostics })).toHaveLength(0)
		expect(diagnostics).toHaveLength(0)
		expect(component?.firstRefs.get('box')).toMatchObject({
			stage: 'unmatched',
			required: true,
		})
	})

	test('an imported roles argument is recorded unreadable and changes the fix copy', () => {
		// `Roles` has no declaration in this file — the can't-read-it
		// posture for an imported name (LTC076's).
		const source = tsrx('Children<Roles>', `const icon = first('.icon')`)
		const { component } = compileSource(source, 'c.tsrx')
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(component?.childrenContract?.unreadable).toBe(true)
		const hit = reachIns({ diagnostics })[0]
		expect(hit?.message).toContain('cannot read')
		expect(hit?.message).toContain('inline type literal')
		expect(hit?.message).not.toContain('Declare a role')
	})

	test('an imported alias of the Children type is unreadable too', () => {
		const source = `import type { MyChildren } from './roles'
export function C({ children = '' }: { children?: MyChildren })
@{
	const icon = first('.icon')
	expose({})
		<c-el>
			<div class="wrap">{children}</div>
			${styleTsrx}
		</c-el>
}`
		const { component } = compileSource(source, 'c.tsrx')
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(component?.childrenContract?.unreadable).toBe(true)
		const hit = reachIns({ diagnostics })[0]
		expect(hit?.message).toContain('cannot read')
	})

	test('a readable roles-less annotation keeps the plain fix copy', () => {
		// A bare `Children` (no roles argument) and a plain `string` declare
		// no roles — the plain "declare a role" copy is correct for both,
		// and neither is recorded unreadable.
		for (const childrenType of ['Children', 'string'] as const) {
			const source = tsrx(childrenType, `const icon = first('.icon')`)
			const { component } = compileSource(source, 'c.tsrx')
			const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
			expect(component?.childrenContract?.unreadable).toBeUndefined()
			const hit = reachIns({ diagnostics })[0]
			expect(hit?.message).toContain('Declare a role')
		}
	})

	test('a required role ref without a {children} insertion stays LTC026 (.tsrx)', () => {
		// Without an insertion the content can never arrive — statically
		// decidable, so the compiler owns it (review 2): the role bypass
		// does not apply and the required reference falls through to
		// LTC026.
		const source = `export function C({ children = '' }: { children?: Children<{ icon: 'span' }> })
@{
	const icon = first('.icon', 'the icon')
	expose({})
		<c-el>
			<div class="wrap"></div>
			${styleTsrx}
		</c-el>
}`
		const { component } = compileSource(source, 'c.tsrx')
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(reachIns({ diagnostics })).toHaveLength(0)
		expect(diagnostics.filter(d => d.code === 'LTC026')).toHaveLength(1)
		expect(component?.firstRefs.get('icon')?.stage).toBe('rejected')
	})

	test('a required role ref without a {children} insertion stays LTC026 (.tsx)', () => {
		const source = `import { css } from '@zeix/le-truc-compiler/macros'

export function C({ children = '' }: { children?: Children<{ icon: 'span' }> }, { first }: any) {
	const icon = first('.icon', 'the icon')
	expose({})
	return (
		<c-el>
			<div class="wrap"></div>
			<style>{css\`@scope {
	:scope {
		  color: red;
		}
}\`}</style>
		</c-el>
	)
}`
		const { diagnostics } = compileComponentTsx(source, 'c.tsx', new Set())
		expect(reachIns({ diagnostics })).toHaveLength(0)
		expect(diagnostics.filter(d => d.code === 'LTC026')).toHaveLength(1)
	})

	test('an optional role ref without a {children} insertion stays LT-123 silent', () => {
		const source = `export function C({ children = '' }: { children?: Children<{ icon: 'span' }> })
@{
	const icon = first('.icon')
	expose({})
		<c-el>
			<div class="wrap"></div>
			${styleTsrx}
		</c-el>
}`
		const { component } = compileSource(source, 'c.tsrx')
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics).toEqual([])
		expect(component?.firstRefs.get('icon')).toMatchObject({
			stage: 'unmatched',
			required: false,
		})
	})

	test('a required deferred role ref without a {children} insertion stays LTC026 too', () => {
		// The compose-registry leg carries the same insertion gate (review 2).
		const source = `export function C({ children = '' }: { children?: Children<{ box: 'form-textbox' }> })
@{
	const box = first('.box', 'the box')
	expose({})
		<c-el>
			<div class="wrap"></div>
			${styleTsrx}
		</c-el>
}`
		const { component } = compileSource(source, 'c.tsrx')
		const { diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
			undefined,
			new Map(),
		)
		expect(reachIns({ diagnostics })).toHaveLength(0)
		expect(diagnostics.filter(d => d.code === 'LTC026')).toHaveLength(1)
		expect(component?.firstRefs.get('box')?.stage).toBe('rejected')
	})
})

describe('the content-model check (LTC085, ADR 0048 s4, LT-477)', () => {
	const styleTsrx = `<style>@scope {
:scope {
	  color: red;
	}
}</style>`
	const styleTsx = `<style>{css\`@scope {
:scope {
	  color: red;
	}
}\`}</style>`

	const childTsrx = (childrenType: string): string =>
		`export function FormCheck({ children = '' }: { children?: ${childrenType} })
@{
	expose({})
		<form-check>
			<span class="label">{children}</span>
			${styleTsrx}
		</form-check>
}`
	const childTsx = (childrenType: string): string =>
		`import { css } from '@zeix/le-truc-compiler/macros'

export function FormCheck({ children = '' }: { children?: ${childrenType} }, {}) {
	expose({})
	return (
		<form-check>
			<span class="label">{children}</span>
			${styleTsx}
		</form-check>
	)
}`

	const parentTsrx = (
		content: string,
		specifier = '../child/form-check.tsrx',
	): string =>
		`import { FormCheck } from '${specifier}'

export function FormRow({}: {})
@{
	expose({})
		<form-row>
			<FormCheck>${content}</FormCheck>
			${styleTsrx}
		</form-row>
}`
	const parentTsx = (
		content: string,
		specifier = '../child/form-check.tsx',
	): string =>
		`import { css } from '@zeix/le-truc-compiler/macros'
import { FormCheck } from '${specifier}'

export function FormRow({}: {}, {}) {
	expose({})
	return (
		<form-row>
			<FormCheck>${content}</FormCheck>
			${styleTsx}
		</form-row>
	)
}`

	const compileChildTsrx = (
		childrenType = "Children<{}, 'non-interactive'>",
	) => {
		const { component, diagnostics } = compileComponent(
			childTsrx(childrenType),
			'examples/child/form-check.tsrx',
			new Set(),
		)
		if (!component)
			throw new Error(`child must compile: ${JSON.stringify(diagnostics)}`)
		return component
	}

	const ltc085 = (result: {
		diagnostics: { code: string; message: string }[]
	}): { code: string; message: string }[] =>
		result.diagnostics.filter(d => d.code === 'LTC085')

	test('a child declaring the model records childrenModel on its entry', () => {
		const component = compileChildTsrx()
		expect(component.entry.childrenModel).toBe('non-interactive')
		expect(component.entry.interactive).toBe(false)
	})

	test('markup a component passes at its own compose site counts toward its flag', () => {
		// FormRow renders <FormCheck><button>x</button></FormCheck>: the
		// button is FormRow's own markup (ADR 0048 s1), rendered in its
		// output, so FormRow's entry is interactive — while the receiving
		// child's flag is untouched, the button never being part of its
		// template. (The child declares no model, so the site compiles.)
		const child = compileChildTsrx('string')
		const { component, diagnostics } = compileComponent(
			parentTsrx('<button type="button">x</button>'),
			'examples/parent/form-row.tsrx',
			new Set(),
			undefined,
			new Map([[child.entry.source, child.entry]]),
		)
		expect(diagnostics).toEqual([])
		expect(component?.entry.interactive).toBe(true)
		expect(child.entry.interactive).toBe(false)
	})

	test('a button in the literal children is refused (.tsrx)', () => {
		const child = compileChildTsrx()
		const { diagnostics } = compileComponent(
			parentTsrx('<button>Save</button>'),
			'examples/parent/form-row.tsrx',
			new Set(),
			undefined,
			new Map([[child.entry.source, child.entry]]),
		)
		const hits = ltc085({ diagnostics })
		expect(hits).toHaveLength(1)
		expect(hits[0]?.message).toContain('`<button>`')
		expect(hits[0]?.message).toContain('`<form-check>`')
		expect(hits[0]?.message).toContain("'non-interactive'")
		expect(hits[0]?.message).toContain('Remove the `<button>`')
	})

	test('a button in the literal children is refused (.tsx)', () => {
		const { component: child } = compileComponentTsx(
			childTsx("Children<{}, 'non-interactive'>"),
			'examples/child/form-check.tsx',
			new Set(),
		)
		if (!child) throw new Error('child must compile')
		const { diagnostics } = compileComponentTsx(
			parentTsx('<button>Save</button>'),
			'examples/parent/form-row.tsx',
			new Set(),
			undefined,
			new Map([[child.entry.source, child.entry]]),
		)
		expect(ltc085({ diagnostics })).toHaveLength(1)
	})

	test('the interactive list decides per element', () => {
		const child = compileChildTsrx()
		const compile = (content: string) =>
			compileComponent(
				parentTsrx(content),
				'examples/parent/form-row.tsrx',
				new Set(),
				undefined,
				new Map([[child.entry.source, child.entry]]),
			)
		// Flagged: plain input, a[href], [tabindex], media with controls.
		for (const content of [
			'<input name="q" />',
			'<a href="https://example.com">x</a>',
			'<div tabindex="0">x</div>',
			'<span tabindex="1">x</span>',
			'<video controls></video>',
			'<audio controls></audio>',
			'<select></select>',
			'<textarea></textarea>',
			'<label>x</label>',
			'<details></details>',
			'<iframe></iframe>',
		]) {
			const hits = ltc085(compile(content))
			expect(hits, content).toHaveLength(1)
		}
		// Not interactive: a bare anchor, a hidden input (the `type` keyword
		// is ASCII case-insensitive), inert media, and ordinary markup — and
		// the whole site compiles clean.
		for (const content of [
			'<a>x</a>',
			'<input type="hidden" name="q" />',
			'<input type="HIDDEN" name="q" />',
			'<video></video>',
			'<span>x</span>',
		]) {
			const result = compile(content)
			expect(ltc085(result), content).toHaveLength(0)
			expect(result.diagnostics, content).toEqual([])
		}
	})

	test('an interactive component among the children is refused by its entry', () => {
		const widgetSource = `export function WidgetBox({}: {})
@{
	expose({})
		<widget-box>
			<button>Go</button>
			${styleTsrx}
		</widget-box>
}`
		const { component: widget } = compileComponent(
			widgetSource,
			'examples/widget/widget-box.tsrx',
			new Set(),
		)
		if (!widget) throw new Error('widget must compile')
		expect(widget.entry.interactive).toBe(true)
		const child = compileChildTsrx()
		const parent = `import { FormCheck } from '../child/form-check.tsrx'
import { WidgetBox } from '../widget/widget-box.tsrx'

export function FormRow({}: {})
@{
	expose({})
		<form-row>
			<FormCheck><WidgetBox /></FormCheck>
			${styleTsrx}
		</form-row>
}`
		const { diagnostics } = compileComponent(
			parent,
			'examples/parent/form-row.tsrx',
			new Set(),
			undefined,
			new Map([
				[child.entry.source, child.entry],
				[widget.entry.source, widget.entry],
			]),
		)
		const hits = ltc085({ diagnostics })
		expect(hits).toHaveLength(1)
		expect(hits[0]?.message).toContain('`<widget-box>`')
		expect(hits[0]?.message).toContain('renders interactive content')
	})

	test('interactivity closes transitively through composed children', () => {
		const leafSource = `export function LeafBox({}: {})
@{
	expose({})
		<leaf-box>
			<input name="q" />
			${styleTsrx}
		</leaf-box>
}`
		const midSource = `import { LeafBox } from '../leaf/leaf-box.tsrx'

export function MidBox({}: {})
@{
	expose({})
		<mid-box>
			<LeafBox />
			${styleTsrx}
		</mid-box>
}`
		const { component: leaf } = compileComponent(
			leafSource,
			'examples/leaf/leaf-box.tsrx',
			new Set(),
		)
		if (!leaf) throw new Error('leaf must compile')
		const { component: mid } = compileComponent(
			midSource,
			'examples/mid/mid-box.tsrx',
			new Set(['leaf-box']),
			undefined,
			new Map([[leaf.entry.source, leaf.entry]]),
		)
		if (!mid) throw new Error('mid must compile')
		// The discovery pass knows no composed child, so the transitive
		// half lands only in the registry-aware entry.
		expect(mid.entry.interactive).toBe(true)
		const child = compileChildTsrx()
		const parent = `import { FormCheck } from '../child/form-check.tsrx'
import { MidBox } from '../mid/mid-box.tsrx'

export function FormRow({}: {})
@{
	expose({})
		<form-row>
			<FormCheck><MidBox /></FormCheck>
			${styleTsrx}
		</form-row>
}`
		const { diagnostics } = compileComponent(
			parent,
			'examples/parent/form-row.tsrx',
			new Set(['leaf-box', 'mid-box']),
			undefined,
			new Map([
				[child.entry.source, child.entry],
				[leaf.entry.source, leaf.entry],
				[mid.entry.source, mid.entry],
			]),
		)
		const hits = ltc085({ diagnostics })
		expect(hits).toHaveLength(1)
		expect(hits[0]?.message).toContain('`<mid-box>`')
	})

	test('a child without the annotation runs no check', () => {
		const child = compileChildTsrx('string')
		expect(child.entry.childrenModel).toBeUndefined()
		const { diagnostics } = compileComponent(
			parentTsrx('<button>Save</button>'),
			'examples/parent/form-row.tsrx',
			new Set(),
			undefined,
			new Map([[child.entry.source, child.entry]]),
		)
		expect(diagnostics).toEqual([])
	})

	test('an unreadable model argument keeps the check off', () => {
		// The model argument is a name with no same-file declaration — tsc
		// owns it (the `Model` union constraint), the compiler does not act
		// on what it cannot read.
		const child = compileChildTsrx('Children<{}, Missing>')
		expect(child.entry.childrenModel).toBeNull()
		const { diagnostics } = compileComponent(
			parentTsrx('<button>Save</button>'),
			'examples/parent/form-row.tsrx',
			new Set(),
			undefined,
			new Map([[child.entry.source, child.entry]]),
		)
		expect(diagnostics).toEqual([])
	})

	test('the model reads through a same-file alias too', () => {
		const source = `type Model = 'non-interactive'
export function FormCheck({ children = '' }: { children?: Children<{}, Model> })
@{
	expose({})
		<form-check>
			<span class="label">{children}</span>
			${styleTsrx}
		</form-check>
}`
		const { component } = compileSource(source, 'c.tsrx')
		expect(component?.childrenContract?.model).toBe('non-interactive')
		const { component: child } = compileComponent(
			source,
			'examples/child/form-check.tsrx',
			new Set(),
		)
		if (!child) throw new Error('child must compile')
		const { diagnostics } = compileComponent(
			parentTsrx('<button>Save</button>'),
			'examples/parent/form-row.tsrx',
			new Set(),
			undefined,
			new Map([[child.entry.source, child.entry]]),
		)
		expect(ltc085({ diagnostics })).toHaveLength(1)
	})
})

describe('a required role-addressed ref at runtime (LT-474 review)', async () => {
	const fixture = (call: string): string =>
		`export function C({ children = '' }: { children?: Children<{ icon: 'span' }> })
@{
	const icon = ${call}
	expose({})
		<c-el>
			<div class="wrap">{children}</div>
			<style>@scope {
	:scope {
		  color: red;
		}
}</style>
		</c-el>
}`

	const tsxFixture = (call: string): string =>
		`import { css } from '@zeix/le-truc-compiler/macros'

export function C({ children = '' }: { children?: Children<{ icon: 'span' }> }, { first }: any) {
	${call}
	expose({})
	return (
		<c-el>
			<div class="wrap">{children}</div>
			<style>{css\`@scope {
	:scope {
		  color: red;
		}
}\`}</style>
		</c-el>
	)
}`

	const required = compileComponent(
		fixture(`first('.icon', 'the icon')`),
		'c.tsrx',
		new Set(),
	)
	const optional = compileComponent(
		fixture(`first('.icon')`),
		'c.tsrx',
		new Set(),
	)
	if (!required.component || !optional.component)
		throw new Error(
			`fixture failed to compile: ${[
				...required.diagnostics,
				...optional.diagnostics,
			]
				.map(d => d.message)
				.join('; ')}`,
		)

	const generated = createGeneratedDir('lt474-role-ref')
	afterAll(() => generated.cleanup())
	generated.emit('c-el.server.ts', required.component.serverCode)
	generated.emit('c-el-opt.server.ts', optional.component.serverCode)
	const clientPath = generated.emit(
		'c-el.client.ts',
		required.component.clientCode,
	)
	const optionalClientPath = generated.emit(
		'c-el-opt.client.ts',
		optional.component.clientCode,
	)
	type Render = { renderC: (args: unknown) => string }
	const { renderC } = await generated.importModule<Render>('c-el.server.ts')
	const { renderC: renderOptional } =
		await generated.importModule<Render>('c-el-opt.server.ts')

	const realm = createSimulationRealm()
	afterAll(() => realm.dispose())
	await realm.load(() => import(pathToFileURL(clientPath).href))
	const optionalRealm = createSimulationRealm()
	afterAll(() => optionalRealm.dispose())
	await optionalRealm.load(() => import(pathToFileURL(optionalClientPath).href))

	test('the required ref throws the authored reason when the content lacks the element', async () => {
		expect(required.diagnostics).toEqual([])
		// The parent passes content without the role's class: the query
		// finds nothing and the runtime's existing required-ref check
		// throws; the containment reports it and the component keeps its
		// server-rendered markup (ADR 0028 tier 2 reporting a tier 3 error).
		const { diagnostics } = await realm.render({
			markup: renderC({ children: '<p>nothing</p>' }),
			component: 'c-el',
		})
		const failure = diagnostics.find(
			d => d.kind === 'console' && d.message.includes('MissingElementError'),
		)
		expect(failure?.message).toContain('the icon')
	})

	test('an optional role-addressed ref stays silent on the same markup', async () => {
		expect(optional.diagnostics).toEqual([])
		const { html, diagnostics } = await optionalRealm.render({
			markup: renderOptional({ children: '<p>nothing</p>' }),
			component: 'c-el',
		})
		expect(
			diagnostics.some(d => d.message.includes('MissingElementError')),
		).toBe(false)
		expect(html).toContain('<p>nothing</p>')
	})

	// The same two pins through the `.tsx` front end — the pipeline is
	// shared, and the emitted query is what both front ends must agree on.
	const requiredTsx = compileComponentTsx(
		tsxFixture(`first('.icon', 'the icon')`),
		'c.tsx',
		new Set(),
	)
	const optionalTsx = compileComponentTsx(
		tsxFixture(`first('.icon')`),
		'c.tsx',
		new Set(),
	)
	if (!requiredTsx.component || !optionalTsx.component)
		throw new Error(
			`tsx fixture failed to compile: ${[
				...requiredTsx.diagnostics,
				...optionalTsx.diagnostics,
			]
				.map(d => d.message)
				.join('; ')}`,
		)
	generated.emit('c-el-tsx.server.ts', requiredTsx.component.serverCode)
	generated.emit('c-el-tsx-opt.server.ts', optionalTsx.component.serverCode)
	const tsxClientPath = generated.emit(
		'c-el-tsx.client.ts',
		requiredTsx.component.clientCode,
	)
	const tsxOptionalClientPath = generated.emit(
		'c-el-tsx-opt.client.ts',
		optionalTsx.component.clientCode,
	)
	const { renderC: renderTsx } =
		await generated.importModule<Render>('c-el-tsx.server.ts')
	const { renderC: renderTsxOptional } = await generated.importModule<Render>(
		'c-el-tsx-opt.server.ts',
	)
	const tsxRealm = createSimulationRealm()
	afterAll(() => tsxRealm.dispose())
	await tsxRealm.load(() => import(pathToFileURL(tsxClientPath).href))
	const tsxOptionalRealm = createSimulationRealm()
	afterAll(() => tsxOptionalRealm.dispose())
	await tsxOptionalRealm.load(
		() => import(pathToFileURL(tsxOptionalClientPath).href),
	)

	test('the required ref throws on the .tsx surface too', async () => {
		expect(requiredTsx.diagnostics).toEqual([])
		const { diagnostics } = await tsxRealm.render({
			markup: renderTsx({ children: '<p>nothing</p>' }),
			component: 'c-el',
		})
		const failure = diagnostics.find(
			d => d.kind === 'console' && d.message.includes('MissingElementError'),
		)
		expect(failure?.message).toContain('the icon')
	})

	test('an optional role-addressed ref stays silent on the .tsx surface too', async () => {
		const { html, diagnostics } = await tsxOptionalRealm.render({
			markup: renderTsxOptional({ children: '<p>nothing</p>' }),
			component: 'c-el',
		})
		expect(
			diagnostics.some(d => d.message.includes('MissingElementError')),
		).toBe(false)
		expect(html).toContain('<p>nothing</p>')
	})
})

describe('namesDeclaredRole (the reach-in subject rule, LT-474)', () => {
	test('a subject role class matches', () => {
		expect(namesDeclaredRole('.icon', new Set(['icon']))).toBe(true)
		expect(namesDeclaredRole('span.icon', new Set(['icon']))).toBe(true)
		expect(namesDeclaredRole('.wrap .icon', new Set(['icon']))).toBe(true)
	})

	test('a role above the subject does not match', () => {
		expect(namesDeclaredRole('.wrap .icon', new Set(['wrap']))).toBe(false)
	})

	test('selector lists are OR semantics', () => {
		expect(namesDeclaredRole('.a, .icon', new Set(['icon']))).toBe(true)
		expect(namesDeclaredRole('.a, .b', new Set(['icon']))).toBe(false)
	})

	test('attributes and ids are not roles', () => {
		expect(namesDeclaredRole('[data-x]', new Set(['data-x']))).toBe(false)
		expect(namesDeclaredRole('#icon', new Set(['icon']))).toBe(false)
	})

	test('an unparsable selector returns null', () => {
		expect(namesDeclaredRole('a[href', new Set(['href']))).toBeNull()
	})
})
