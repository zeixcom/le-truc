/**
 * Direct unit test for `evaluability.ts` (LT-043/LT-047): the single home of
 * the server-known dependency-closure rule that decides WHAT THE SERVER
 * RENDERS. Pinned directly rather than only transitively through golden
 * tests — a divergence here is a wrong component, not a wrong message.
 */
import { describe, expect, test } from 'bun:test'
import { compileSource } from '../../compiler/frontend/tsrx/compiler'
import {
	containsImpureAmbient,
	dependenciesOf,
	isServerEvaluable,
} from '../../compiler/evaluability'

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

// LT-142: `Intl` is split from `Date` — `Intl.*` folds when its locale
// argument resolves to a server-known value (a server arg, a literal, or a
// server-known const); `Date` stays unconditionally impure, since
// `Date.now()`/`new Date()` have no argument that could make them
// deterministic.
describe('LT-142: Intl split from Date', () => {
	const thunkOf = (source: string) => {
		const { component } = compileSource(source, 'c.tsrx')
		const title = component?.root.attrs.find(a => a.kind === 'reactive')
		if (title?.kind !== 'reactive') throw new Error('expected reactive attr')
		return title.thunk
	}

	test('Intl.NumberFormat with a server-arg locale folds', () => {
		const thunk = thunkOf(
			`export function C({ lang }: { lang: string })
			@{
				expose({})
				<>
					<c-el title={() => new Intl.NumberFormat(lang).format(3)}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
		)
		expect(containsImpureAmbient(thunk, new Set(['lang']))).toBe(false)
		expect(isServerEvaluable(thunk, new Set(['lang']))).toBe(true)
	})

	test('Intl.NumberFormat with a literal locale folds regardless of scope', () => {
		const thunk = thunkOf(
			`export function C({}: {})
			@{
				expose({})
				<>
					<c-el title={() => new Intl.NumberFormat('en').format(3)}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
		)
		expect(containsImpureAmbient(thunk, new Set())).toBe(false)
		expect(isServerEvaluable(thunk, new Set())).toBe(true)
	})

	test('Intl.NumberFormat with an unresolvable locale stays impure', () => {
		const thunk = thunkOf(
			`export function C({ host }: { host: any })
			@{
				expose({})
				<>
					<c-el title={() => new Intl.NumberFormat(host.lang).format(3)}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
		)
		expect(containsImpureAmbient(thunk, new Set(['host']))).toBe(true)
		expect(isServerEvaluable(thunk, new Set(['host']))).toBe(false)
	})

	test('Intl.NumberFormat with no locale argument stays impure', () => {
		const thunk = thunkOf(
			`export function C({}: {})
			@{
				expose({})
				<>
					<c-el title={() => new Intl.NumberFormat().format(3)}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
		)
		expect(containsImpureAmbient(thunk, new Set())).toBe(true)
		expect(isServerEvaluable(thunk, new Set())).toBe(false)
	})

	test('Date.now() stays unconditionally impure', () => {
		const thunk = thunkOf(
			`export function C({}: {})
			@{
				expose({})
				<>
					<c-el title={() => String(Date.now())}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
		)
		expect(containsImpureAmbient(thunk, new Set())).toBe(true)
		expect(isServerEvaluable(thunk, new Set())).toBe(false)
	})

	test('the local Date constructor stays impure — it reads the build machine timezone (LT-165 step 5)', () => {
		// `new Date(y, m, d)` over server-known args reads no viewing-moment
		// fact, but the local-time constructor (and the zone-less formatter)
		// interpret in the build machine's timezone — limb (b) ambient state:
		// the rendered day must not depend on where the build ran. ADR 0030 s2
		// prescribes the `Date.UTC` + `timeZone: 'UTC'` shape instead.
		const thunk = thunkOf(
			`export function C({ y, m, d }: { y: number; m: number; d: number })
			@{
				expose({})
				<>
					<c-el title={() => new Date(y, m - 1, d).toLocaleDateString()}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
		)
		expect(containsImpureAmbient(thunk, new Set(['y', 'm', 'd']))).toBe(true)
		expect(isServerEvaluable(thunk, new Set(['y', 'm', 'd']))).toBe(false)
	})

	test('Date.UTC over server-known args is pure — the one admissible Date form (LT-165 step 5)', () => {
		// The UTC conversion is a fixed function of its arguments: no wall
		// clock, no timezone read. This is what makes LT-095's prescribed
		// `Date.UTC(y, m - 1, d)` + `timeZone: 'UTC'` blogmeta shape foldable.
		const thunk = thunkOf(
			`export function C({ y, m, d }: { y: number; m: number; d: number })
			@{
				expose({})
				<>
					<c-el title={() => new Intl.DateTimeFormat('en', { timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d))}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
		)
		expect(containsImpureAmbient(thunk, new Set(['y', 'm', 'd']))).toBe(false)
		expect(isServerEvaluable(thunk, new Set(['y', 'm', 'd']))).toBe(true)
	})

	test('an impure ambient nested inside Date.UTC arguments is still caught', () => {
		const thunk = thunkOf(
			`export function C({}: {})
			@{
				expose({})
				<>
					<c-el title={() => String(Date.UTC(2026, 0, Date.now()))}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
		)
		expect(containsImpureAmbient(thunk, new Set())).toBe(true)
	})

	test('bare Intl read outside a recognized constructor call stays impure', () => {
		const thunk = thunkOf(
			`export function C({ lang }: { lang: string })
			@{
				expose({})
				<>
					<c-el title={() => String(Intl)}>ok</c-el>
					<style>c-el { color: red }</style>
				</>
			}`,
		)
		expect(containsImpureAmbient(thunk, new Set(['lang']))).toBe(true)
	})
})
