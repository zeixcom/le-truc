/**
 * Direct unit test for `reactivity.ts` (LT-051): the reactive-lift rule that
 * decides WHETHER A TEMPLATE CHILD IS REACTIVE. The line is *lexically
 * visible reactive read* vs. *read behind an opaque call boundary* — not
 * *single read* vs. *compound expression*.
 *
 * Pinned directly rather than only through goldens because both failure
 * modes are silent in a golden: an under-lift renders correct HTML that
 * never updates, and an over-lift renders correct HTML that updates
 * redundantly. Only the `lazy` flag distinguishes them.
 */
import { describe, expect, test } from 'bun:test'
import { compileSource } from '../../tsrx/compiler'
import { classifyChild } from '../../tsrx/reactivity'

/** Compile a one-child fixture and return that child's IR node. */
const childOf = (body: string, setup = 'const count = createCell(0)') => {
	const { component, diagnostics } = compileSource(
		`import { createCell } from '@zeix/le-truc'
		export function C({ label }: { label: string })
		@{
			${setup}
			expose({ count: count.get })
			<>
				<c-el><p>${body}</p></c-el>
				<style>c-el { color: red }</style>
			</>
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
				<>
					<c-el title={() => ${expr}}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
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

	test('an expression over neither signals nor host is static', () => {
		expect(classifyChild(parse("'a' + 'b'"), signals).kind).toBe('static')
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
		).toBe('static')
	})
})

describe('lowerChildren — lift applied to template children', () => {
	test('{label} over a server arg stays static', () => {
		const { child, diagnostics } = childOf('{label}')
		expect(child?.kind).toBe('expr')
		if (child?.kind !== 'expr') throw new Error('unreachable')
		expect(child.lazy).toBe(false)
		expect(diagnostics).toHaveLength(0)
	})

	test('{count.get()} lifts without the & sigil', () => {
		const { child, diagnostics } = childOf('{count.get()}')
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		expect(child.lazy).toBe(true)
		expect(diagnostics).toHaveLength(0)
	})

	test('a bare signal identifier lifts', () => {
		const { child } = childOf('{count}')
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		expect(child.lazy).toBe(true)
	})

	test('an explicit thunk lifts and is never inspected', () => {
		const { child, diagnostics } = childOf('{() => fmt(count)}')
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		expect(child.lazy).toBe(true)
		// `count` escapes into fmt() inside the thunk — legal, because the
		// author took responsibility by writing the thunk.
		expect(diagnostics).toHaveLength(0)
	})

	test('an untraceable child is TSRX017, not a silent static emit', () => {
		const { child, diagnostics } = childOf('{fmt(count)}')
		expect(diagnostics.map(d => d.code)).toEqual(['TSRX017'])
		expect(diagnostics[0]?.message).toContain('{() => fmt(count)}')
		// Not lifted — but the error fails the file, so it never reaches emit.
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		expect(child.lazy).toBe(false)
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

	test('a string literal naming a prop is TSRX019, not silent text', () => {
		const { diagnostics } = childOf("{'count'}")
		expect(diagnostics.map(d => d.code)).toEqual(['TSRX019'])
		expect(diagnostics[0]?.message).toContain('{host.count}')
	})

	test('a string literal naming nothing stays ordinary text', () => {
		const { child, diagnostics } = childOf("{'hello'}")
		expect(diagnostics).toHaveLength(0)
		if (child?.kind !== 'expr') throw new Error('expected expr child')
		expect(child.lazy).toBe(false)
	})
})

describe('lazy destructuring in binding position (LT-052)', () => {
	const compile = (setup: string) =>
		compileSource(
			`export function C({}: {})
			@{
				${setup}
				expose({})
				<>
					<c-el>x</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		).diagnostics

	test('&{ … } object pattern is TSRX020', () => {
		const d = compile('const obj = { a: 1 }\n\t\t\t\tconst &{ a } = obj')
		expect(d.map(x => x.code)).toContain('TSRX020')
		expect(d.find(x => x.code === 'TSRX020')?.message).toContain(
			'evaluates setup eagerly',
		)
	})

	test('&[ … ] array pattern is TSRX020', () => {
		const d = compile('const &[ b ] = [1]')
		expect(d.map(x => x.code)).toContain('TSRX020')
	})

	test('a plain destructuring pattern is untouched', () => {
		const d = compile('const obj = { a: 1 }\n\t\t\t\tconst { a } = obj')
		expect(d.filter(x => x.code === 'TSRX020')).toEqual([])
	})
})
