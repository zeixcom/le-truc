/**
 * LT-231: one function per question. Each converged answer that changed
 * is pinned here on a synthetic input, so the fix is visible — the corpus
 * itself compiles byte-identically before and after.
 */
import { describe, expect, test } from 'bun:test'
import { isSignalGetCall } from '../../compiler/analysis/harvest'
import type { AstNode } from '../../compiler/ast-node'
import { freeIdentifiers, signalGetCallName } from '../../compiler/ast-utils'
import { parseModule } from '../../compiler/core.ts'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'

/** Parse one expression. */
const expr = (code: string): AstNode => {
	const program = parseModule(`(${code})`, 'expr.ts') as unknown as AstNode
	const [stmt] = program.body as [AstNode]
	return stmt.expression as AstNode
}

/** The free names of a whole module body. */
const freeIn = (code: string): string[] =>
	[
		...freeIdentifiers(parseModule(code, 'scope.ts') as unknown as AstNode),
	].sort()

describe('freeIdentifiers covers every JS binding form (LT-231)', () => {
	test('function declarations hoist to the whole block', () => {
		expect(freeIn('g(); function g() { return h }')).toEqual(['h'])
	})

	test('a class binds its name; member keys are not reads', () => {
		expect(
			freeIn('class C extends B { m() { return C } [k] = v; static s = 1 }'),
		).toEqual(['B', 'k', 'v'])
		expect(freeIn('const D = class E { n() { return E } }')).toEqual([])
	})

	test('labels are not reads', () => {
		expect(
			freeIn(
				'outer: for (const x of xs) { if (x) continue outer; break outer }',
			),
		).toEqual(['xs'])
	})

	test('a named function expression binds its own name', () => {
		expect(
			freeIn('const a = function f(n) { return n ? f(n - 1) : 0 }'),
		).toEqual([])
	})

	test('parameter defaults and computed pattern keys are reads', () => {
		expect(freeIn('const a = (x = d, { [k]: y } = {}) => x + y')).toEqual([
			'd',
			'k',
		])
		// A default may read an earlier parameter.
		expect(freeIn('const a = (x, y = x) => y')).toEqual([])
	})
})

describe('one signal-read answer (LT-231)', () => {
	test('`sig.get()` on a bare identifier, never a computed `[get]`', () => {
		expect(signalGetCallName(expr('count.get()'))).toBe('count')
		expect(signalGetCallName(expr('count[get]()'))).toBeNull()
		expect(signalGetCallName(expr('a.b.get()'))).toBeNull()
		expect(isSignalGetCall(expr('count[get]()'), 'count')).toBe(false)
	})
})

/** Compile a loop whose item element carries `li`. */
const loopWith = (li: string) =>
	compileComponentTsx(
		`import { createCell } from '@zeix/le-truc'
export function C({ items }: { items: string[] }) {
	const c = createCell('red')
	expose({})
	return (
			<c-el>
				<ul>{items.map(item => ${li})}</ul>
				<style></style>
			</c-el>
	)
}`,
		'c.tsx',
		new Set(),
	).diagnostics.filter(d => d.severity === 'error')

describe('a loop body uses the one client-construct answer (LT-231)', () => {
	test.each([
		['a style map', '<li style={() => ({ color: c.get() })}>{item}</li>'],
		[
			'a style map on a descendant',
			'<li><b style={() => ({ color: c.get() })}>{item}</b></li>',
		],
		['a reactive html binding', '<li truc:html={() => c.get()}>{item}</li>'],
	])('%s is reported, no longer dropped in silence', (_, li) => {
		const errors = loopWith(li)
		expect(errors).toHaveLength(1)
		expect(errors[0]?.message).toContain('server-data `.map()` body')
	})

	test('the lowered kinds still compile clean', () => {
		expect(
			loopWith(
				"<li class={() => ({ on: c.get() === 'x' })} onClick={() => {}}>{item}</li>",
			),
		).toEqual([])
	})
})

/**
 * A `.tsrx` component with an LT-122 prop-bound arg: `label` is both a
 * server arg and an `expose()`d prop (harvested from the `<span>`), so
 * `title={label}` renders server-side AND binds client-side.
 */
const withPropBound = (body: string, registry = new Set<string>()) =>
	compileComponent(
		`export function C({ label, rows, flag }: { label: string; rows: string[]; flag: boolean })
@{
	const el = first('span', 'span')
	expose({ label: el.textContent ?? '' })
		<c-el>
			<span>x</span>
			${body}
			<style>:host {
	  color: red;
	}</style>
		</c-el>
}`,
		'c.tsrx',
		registry,
	)

const errorsOf = (result: ReturnType<typeof withPropBound>) =>
	result.diagnostics.filter(d => d.severity === 'error')

describe('the other client-construct answers LT-231 changed (LT-368)', () => {
	test('a prop-bound attribute in a server-data loop body is reported', () => {
		const errors = errorsOf(
			withPropBound(
				'<ul>@for (const row of rows) { <li class="row" title={label} onClick={() => {}}>{row}</li> }</ul>',
			),
		)
		expect(errors.map(d => d.code)).toEqual(['LTC005'])
		expect(errors[0]?.message).toContain(
			'The prop-bound attribute `title` on an element in a server-data `@for` body',
		)
	})

	test('a `truc:pass` binding in a server-data loop body is reported', () => {
		const errors = errorsOf(
			withPropBound(
				'<ul>@for (const row of rows) { <li class="row"><my-child truc:pass={{ label: () => host.label }}></my-child></li> }</ul>',
				new Set(['my-child']),
			),
		)
		expect(errors.map(d => d.code)).toEqual(['LTC005'])
		expect(errors[0]?.message).toContain(
			'A `pass` binding on an element in a server-data `@for` body',
		)
	})

	test('a prop-bound attribute counts in the `@if` branch signature', () => {
		// Identical roots but for the prop-bound `title`: the signatures
		// differ, so the branches route to per-branch addressing — which
		// needs a selector telling them apart (LTC007). Counted as equal,
		// they were union-addressed and the `title` binding landed on the
		// `@else` paragraph too.
		const errors = errorsOf(
			withPropBound(
				'@if (flag) { <p class="msg" title={label} onClick={() => {}}>a</p> } @else { <p class="msg" onClick={() => {}}>b</p> }',
			),
		)
		expect(errors.map(d => d.code)).toEqual(['LTC007'])
	})

	test('a prop-bound attribute is refused in an empty arm', () => {
		// The arm is never addressed client-side, so its binding would be
		// lost without a word.
		const errors = errorsOf(
			withPropBound(
				'<ul>@for (const row of rows) { <li class="row">{row}</li> } @empty { <li class="none" title={label}>none</li> }</ul>',
			),
		)
		expect(errors.map(d => d.code)).toEqual(['LTC005'])
		expect(errors[0]?.message).toContain('`@empty` arm')
	})
})

/**
 * LT-378: a `.tsrx` component with TWO LT-122 prop-bound args — `label`
 * and `desc` are each both a server arg and an `expose()`d prop, so
 * `title={label}` and `title={desc}` differ only in WHICH prop they bind.
 */
const withTwoPropBound = (body: string, registry = new Set<string>()) =>
	compileComponent(
		`export function C({ label, desc, flag }: { label: string; desc: string; flag: boolean })
@{
	const el = first('span', 'span')
	expose({ label: el.textContent ?? '', desc: 'd' })
	<c-el>
		<span>x</span>
		${body}
		<style>:host {
  color: red;
}</style>
	</c-el>
}`,
		'c.tsrx',
		registry,
	)

describe('the `@if` branch signature distinguishes binding sources (LT-378)', () => {
	test('branch roots binding DIFFERENT props to `title` are not union-addressed', () => {
		// Both roots carry `bind:title` — equal key and, before LT-378,
		// equal EMPTY text for a prop-bound `server` attribute — so the
		// branches were union-addressed onto one
		// `watch(() => host.label, bindAttribute(p, 'title'))` and the
		// `@else` paragraph showed `label`. Unequal signatures route to
		// per-branch addressing, which raises LTC007 on roots this alike.
		const errors = errorsOf(
			withTwoPropBound(
				'@if (flag) { <p class="msg" title={label} onClick={() => {}}>a</p> } @else { <p class="msg" title={desc} onClick={() => {}}>b</p> }',
			),
		)
		expect(errors.map(d => d.code)).toEqual(['LTC007'])
	})

	test('same on the `.tsx` ternary', () => {
		const result = compileComponentTsx(
			`export function C({ label, desc, flag }: { label: string; desc: string; flag: boolean }) {
	const el = first('span', 'span')
	expose({ label: el.textContent ?? '', desc: 'd' })
	return (
		<c-el>
			<span>x</span>
			{flag
				? <p class="msg" title={label} onClick={() => {}}>a</p>
				: <p class="msg" title={desc} onClick={() => {}}>b</p>}
			<style></style>
		</c-el>
	)
}`,
			'c.tsx',
			new Set(),
		)
		const errors = result.diagnostics.filter(d => d.severity === 'error')
		expect(errors.map(d => d.code)).toEqual(['LTC007'])
	})

	test('a `truc:pass` binding counts its entries in the signature', () => {
		// Same prop name, different source — before LT-378 the empty text
		// made the signatures equal and the `@else` child was passed
		// `host.label`.
		const errors = errorsOf(
			withTwoPropBound(
				'@if (flag) { <my-child class="msg" truc:pass={{ label: () => host.label }}></my-child> } @else { <my-child class="msg" truc:pass={{ label: () => host.desc }}></my-child> }',
				new Set(['my-child']),
			),
		)
		expect(errors.map(d => d.code)).toEqual(['LTC007'])
	})

	test('a reactive `truc:html` value counts in the signature', () => {
		// Before LT-378 the value text was dropped and the `@else`
		// paragraph was filled with `host.label`'s html.
		const errors = errorsOf(
			withTwoPropBound(
				'@if (flag) { <p class="msg" truc:html={() => host.label} onClick={() => {}}>a</p> } @else { <p class="msg" truc:html={() => host.desc} onClick={() => {}}>b</p> }',
			),
		)
		expect(errors.map(d => d.code)).toEqual(['LTC007'])
	})

	test('the SAME source on both roots still union-addresses', () => {
		// The negative control: `title={label}` twice — signatures equal
		// (same text now, not two empty ones), one query, one effect set,
		// whichever branch rendered.
		const errors = errorsOf(
			withTwoPropBound(
				'@if (flag) { <p class="msg" title={label} onClick={() => {}}>a</p> } @else { <p class="msg" title={label} onClick={() => {}}>b</p> }',
			),
		)
		expect(errors).toEqual([])
	})
})
