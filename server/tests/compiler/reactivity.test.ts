/**
 * Direct unit test for `reactivity.ts` (LT-051): the reactive-lift rule that
 * decides WHETHER A TEMPLATE CHILD IS REACTIVE. The line is *lexically
 * visible reactive read* vs. *read behind an opaque call boundary* — not
 * *single read* vs. *compound expression*.
 *
 * Pinned directly rather than only through goldens because both failure
 * modes are silent in a golden: an under-lift renders correct HTML that
 * never updates, and an over-lift renders correct HTML that updates
 * redundantly. Only the recorded `reactivity` class distinguishes them.
 * The dependency closure recorded beside it (ADR 0040 s7, LT-373) is pinned
 * here too: no golden reads it yet.
 */
import { describe, expect, test } from 'bun:test'
import { compileSource } from '../../compiler/frontend/tsrx/compiler'
import { markPositionallyReactive } from '../../compiler/lower-shared'
import {
	attributeReactivity,
	classifyChild,
	NO_DEPS,
} from '../../compiler/reactivity'
import { isClientConstructAttr } from '../../compiler/walk'

/** Compile a one-child fixture and return that child's IR node. */
const childOf = (body: string, setup = 'const count = createCell(0)') => {
	const { component, diagnostics } = compileSource(
		`import { createCell } from '@zeix/le-truc'
		export function C({ label }: { label: string })
		@{
			${setup}
			expose({ count: count.get })
				<c-el><p>${body}</p>
					<style>:host {
	  color: red;
	}</style>
				</c-el>
		}`,
		'c.tsrx',
	)
	const p = component?.root.children.find(
		c => c.kind === 'element' && c.tag === 'p',
	)
	if (p?.kind !== 'element') throw new Error('expected <p>')
	return { child: p.children[0], diagnostics }
}

describe('classifyChild — the lift rule', () => {
	const signals = new Set(['count', 'length'])
	const parse = (expr: string) => {
		const { component } = compileSource(
			`export function C({}: {})
			@{
				expose({})
					<c-el title={() => ${expr}}>ok
						<style>:host {
	  color: red;
	}</style>
					</c-el>
			}`,
			'c.tsrx',
		)
		const attr = component?.root.attrs.find(a => a.kind === 'reactive')
		if (attr?.kind !== 'reactive') throw new Error('expected reactive attr')
		return attr.thunk.body as Parameters<typeof classifyChild>[0]
	}

	test('a visible .get() call is a read, however compound the expression', () => {
		expect(classifyChild(parse('count.get() === 0'), signals).kind).toBe(
			'reactive',
		)
		expect(
			classifyChild(parse("'x'.replace('n', String(1 - count.get()))"), signals)
				.kind,
		).toBe('reactive')
	})

	test('a host property read is reactive', () => {
		expect(classifyChild(parse('host.validationMessage'), signals).kind).toBe(
			'reactive',
		)
	})

	test('an expression over neither signals nor host is server-rendered', () => {
		expect(classifyChild(parse("'a' + 'b'"), signals).kind).toBe('server')
	})

	test('a signal crossing a call boundary is opaque, and names the escapee', () => {
		const verdict = classifyChild(parse('fmt(9, count)'), signals)
		expect(verdict.kind).toBe('opaque')
		if (verdict.kind !== 'opaque') throw new Error('unreachable')
		expect(verdict.names).toEqual(['count'])
	})

	test('a read inside a nested callback is still lexically visible', () => {
		expect(
			classifyChild(parse('[1].filter(n => n === count.get())'), signals).kind,
		).toBe('reactive')
	})

	test('a bound name shadowing a signal is not a read', () => {
		expect(
			classifyChild(parse('[1].map(count => count + 1)'), signals).kind,
		).toBe('server')
	})
})

describe('lowerChildren — lift applied to template children', () => {
	test('{label} over a server arg stays server-rendered', () => {
		const { child, diagnostics } = childOf('{label}')
		expect(child?.kind).toBe('expr')
		if (child?.kind !== 'expr') throw new Error('unreachable')
		expect(child.reactivity).toBe('server')
		expect(diagnostics).toHaveLength(0)
	})

	test('{count.get()} lifts without the & sigil', () => {
		const { child, diagnostics } = childOf('{count.get()}')
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		expect(child.reactivity).toBe('reactive')
		expect(diagnostics).toHaveLength(0)
	})

	test('a bare signal identifier lifts', () => {
		const { child } = childOf('{count}')
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		expect(child.reactivity).toBe('reactive')
	})

	test('an explicit thunk lifts and is never inspected', () => {
		const { child, diagnostics } = childOf('{() => fmt(count)}')
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		expect(child.reactivity).toBe('reactive')
		// `count` escapes into fmt() inside the thunk — legal, because the
		// author took responsibility by writing the thunk.
		expect(diagnostics).toHaveLength(0)
	})

	test('an untraceable child is LTC017, not a silent static emit', () => {
		const { child, diagnostics } = childOf('{fmt(count)}')
		expect(diagnostics.map(d => d.code)).toEqual(['LTC017'])
		expect(diagnostics[0]?.message).toContain('{() => fmt(count)}')
		// Not lifted — but the error fails the file, so it never reaches emit.
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		expect(child.reactivity).toBe('server')
	})
})

describe('the recorded class and dependency closure (ADR 0040 s7, LT-373)', () => {
	test('a text child records the signals and server args it reads', () => {
		const { child } = childOf('{label + count.get()}')
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		expect(child.reactivity).toBe('reactive')
		expect(child.deps).toEqual({
			signals: ['count'],
			hostProps: [],
			args: ['label'],
			bound: [],
		})
	})

	test('a name a nested parameter shadows is not a dependency', () => {
		const { child } = childOf('{[1].map(label => label + count.get())}')
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		expect(child.deps.args).toEqual([])
		expect(child.deps.signals).toEqual(['count'])
	})

	test('host.<prop> reads are recorded by prop name; a computed read is not', () => {
		const { child } = childOf("{host.count + host['x']}")
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		expect(child.deps.hostProps).toEqual(['count'])
	})

	test('an LT-122 arg-and-prop site records the arg and the bound prop', () => {
		const { component, diagnostics } = compileSource(
			`export function C({ label }: { label: string })
			@{
				expose({ label: '' })
					<c-el><p>{label}</p>
						<style>:host {
	  color: red;
	}</style>
					</c-el>
			}`,
			'c.tsrx',
		)
		expect(diagnostics).toEqual([])
		const p = component?.root.children.find(c => c.kind === 'element')
		const child = p?.kind === 'element' ? p.children[0] : undefined
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		expect(child.bindsProp).toBe('label')
		expect(child.reactivity).toBe('reactive')
		expect(child.deps).toEqual({
			signals: [],
			hostProps: ['label'],
			args: ['label'],
			bound: [],
		})
	})

	test('an LT-122 arg-and-prop attribute is reactive and records the bound prop', () => {
		const { component, diagnostics } = compileSource(
			`export function C({ disabled }: { disabled: boolean })
			@{
				expose({ disabled: false })
					<c-el><button disabled={disabled}>Go</button>
						<style>:host {
	  color: red;
	}</style>
					</c-el>
			}`,
			'c.tsrx',
		)
		expect(diagnostics).toEqual([])
		const button = component?.root.children.find(c => c.kind === 'element')
		if (button?.kind !== 'element') throw new Error('expected <button>')
		const attr = button.attrs.find(a => 'name' in a && a.name === 'disabled')
		if (attr?.kind !== 'server') throw new Error('expected server attribute')
		expect(attr.bindsProp).toBe('disabled')
		expect(attributeReactivity(attr)).toBe('reactive')
		expect(isClientConstructAttr(attr)).toBe(true)
		expect(attr.deps).toEqual({
			signals: [],
			hostProps: ['disabled'],
			args: ['disabled'],
			bound: [],
		})
	})

	test('attributes: the variant is the class, each value records its closure', () => {
		const { child } = childOf(
			'<span id="s" title={label} data-n={() => count.get()} onClick={() => {}}>x</span>',
		)
		if (child?.kind !== 'element') throw new Error('expected <span>')
		const byName = (name: string) =>
			child.attrs.find(a => 'name' in a && a.name === name)
		const [id, title, n, click] = ['id', 'title', 'data-n', 'onClick'].map(
			byName,
		)
		if (!id || !title || !n || !click) throw new Error('missing attribute')
		expect(attributeReactivity(id)).toBe('static')
		expect(attributeReactivity(title)).toBe('server')
		expect(attributeReactivity(n)).toBe('reactive')
		expect(attributeReactivity(click)).toBeNull()
		expect(title.kind === 'server' && title.deps.args).toEqual(['label'])
		expect(n.kind === 'reactive' && n.deps.signals).toEqual(['count'])
	})

	test('a positional read flips the class and records the bound name', () => {
		const { child } = childOf('{label}')
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		const node = { ...child, deps: NO_DEPS }
		markPositionallyReactive([node], new Set(['label']))
		expect(node.reactivity).toBe('reactive')
		expect(node.deps.bound).toEqual(['label'])
	})
})

describe('the retired &{} sigil (LT-052)', () => {
	test('&{expr} is TSRX018 with a drop-the-sigil fix-it', () => {
		const { diagnostics } = childOf('&{count}')
		expect(diagnostics.map(d => d.code)).toContain('TSRX018')
		expect(diagnostics[0]?.message).toContain('{count}')
	})

	test("a literal & before an expression no longer swallows the '&'", () => {
		// The old sigil detection matched any JSXText ending in '&', so
		// `Q&{label}` silently ate the ampersand. It is now diagnosed rather
		// than mis-parsed.
		const { diagnostics } = childOf('Q&{label}')
		expect(diagnostics.map(d => d.code)).toContain('TSRX018')
	})

	test('a string literal naming a prop is LTC019, not silent text', () => {
		const { diagnostics } = childOf("{'count'}")
		expect(diagnostics.map(d => d.code)).toEqual(['LTC019'])
		expect(diagnostics[0]?.message).toContain('{host.count}')
	})

	test('a string literal naming nothing stays ordinary text', () => {
		const { child, diagnostics } = childOf("{'hello'}")
		expect(diagnostics).toHaveLength(0)
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		expect(child.reactivity).toBe('server')
	})
})

describe('lazy destructuring in binding position (LT-052, retired at the 0.2 pin)', () => {
	const compile = (setup: string) =>
		compileSource(
			`export function C({}: {})
			@{
				${setup}
				expose({})
					<c-el>x
						<style>:host {
	  color: red;
	}</style>
					</c-el>
			}`,
			'c.tsrx',
		).diagnostics

	// @tsrx/core 0.2 dropped lazy destructuring from the grammar entirely, so
	// `&{ … }`/`&[ … ]` no longer parse — the dedicated TSRX020 scan retired
	// with the LT-210 pin bump and the rejection is the parser's own syntax
	// error, surfaced as LTC008. Same tier-1 guarantee, one link earlier.
	test('&{ … } object pattern is a parse error (LTC008)', () => {
		const d = compile('const obj = { a: 1 }\n\t\t\t\tconst &{ a } = obj')
		expect(d.map(x => x.code)).toContain('LTC008')
		expect(d.find(x => x.code === 'LTC008')?.message).toContain(
			'Failed to parse',
		)
	})

	test('&[ … ] array pattern is a parse error (LTC008)', () => {
		const d = compile('const &[ b ] = [1]')
		expect(d.map(x => x.code)).toContain('LTC008')
	})

	test('a plain identifier const is untouched', () => {
		const d = compile('const obj = { a: 1 }\n\t\t\t\tconst b = obj.a')
		expect(d.map(x => x.code)).toEqual([])
	})

	// The setup subset only sanctions NAMED single consts (setupInits maps
	// name → init for rebinding); a destructuring pattern has no single name.
	// The 0.1.63 parse silently tolerated the shape; the 0.2.3 parse reaches
	// the subset check and rejects it honestly.
	test('a plain destructuring const is LTC005, not silently tolerated', () => {
		const d = compile('const obj = { a: 1 }\n\t\t\t\tconst { a } = obj')
		expect(d.map(x => x.code)).toEqual(['LTC005'])
		expect(d[0]?.message).toContain('outside the supported subset')
	})
})
