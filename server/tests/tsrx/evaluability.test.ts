/**
 * Direct unit test for `evaluability.ts` (LT-043/LT-047): the single home of
 * the server-known dependency-closure rule that decides WHAT THE SERVER
 * RENDERS. Pinned directly rather than only transitively through golden
 * tests — a divergence here is a wrong component, not a wrong message.
 */
import { describe, expect, test } from 'bun:test'
import { compileSource } from '../../tsrx/compiler'
import { dependenciesOf, isServerEvaluable } from '../../tsrx/evaluability'

describe('dependenciesOf', () => {
	test('reports signal reads, excluding JS globals', () => {
		const { component } = compileSource(
			`export function C({ n }: { n: number })
			@{
				const color = createCell('red')
				expose({ color: color.get })
				<>
					<c-el title={() => color.get() + String(n)}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		const title = component?.root.attrs.find(a => a.kind === 'reactive')
		if (title?.kind !== 'reactive') throw new Error('expected reactive attr')
		// `String` is a JS_GLOBALS member — dependenciesOf strips it;
		// freeIdentifiers alone would still report it (compiler.test.ts pins that).
		expect([...dependenciesOf(title.thunk)].sort()).toEqual(['color', 'n'])
	})

	test('an all-globals expression has an empty dependency set', () => {
		const { component } = compileSource(
			`export function C({}: {})
			@{
				expose({})
				<>
					<c-el title={() => String(Math.max(1, 2))}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		const title = component?.root.attrs.find(a => a.kind === 'reactive')
		if (title?.kind !== 'reactive') throw new Error('expected reactive attr')
		expect(dependenciesOf(title.thunk).size).toBe(0)
	})
})

describe('isServerEvaluable', () => {
	test('true when every non-global free name is in scope', () => {
		const { component } = compileSource(
			`export function C({ n }: { n: number })
			@{
				const color = createCell('red')
				expose({ color: color.get })
				<>
					<c-el title={() => color.get() + String(n)}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		const title = component?.root.attrs.find(a => a.kind === 'reactive')
		if (title?.kind !== 'reactive') throw new Error('expected reactive attr')
		expect(isServerEvaluable(title.thunk, new Set(['color', 'n']))).toBe(true)
	})

	test('false when a free name is missing from scope — DOM-is-truth omission', () => {
		const { component } = compileSource(
			`export function C({ n }: { n: number })
			@{
				const color = createCell('red')
				expose({ color: color.get })
				<>
					<c-el title={() => color.get() + String(n)}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		const title = component?.root.attrs.find(a => a.kind === 'reactive')
		if (title?.kind !== 'reactive') throw new Error('expected reactive attr')
		// `n` is deliberately withheld from scope, mirroring a thunk that reads
		// an arg-derived signal outside its own server-known closure.
		expect(isServerEvaluable(title.thunk, new Set(['color']))).toBe(false)
	})

	test('true for an empty dependency set regardless of scope', () => {
		const { component } = compileSource(
			`export function C({}: {})
			@{
				expose({})
				<>
					<c-el title={() => String(Math.max(1, 2))}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
			'c.tsrx',
		)
		const title = component?.root.attrs.find(a => a.kind === 'reactive')
		if (title?.kind !== 'reactive') throw new Error('expected reactive attr')
		expect(isServerEvaluable(title.thunk, new Set())).toBe(true)
	})
})
