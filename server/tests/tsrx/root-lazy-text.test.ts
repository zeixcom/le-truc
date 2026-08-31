/**
 * Tests for lazy text children directly on the component ROOT (LT-114):
 * `emitTopEffects`'s root branch special-cased only `style-map`/`class-map`
 * attributes, so the root's lazy text children were never visited — the
 * generated client emitted no `watch(source, bindText(...))` at all and the
 * component rendered permanently empty on hydration-only pages (a silent
 * omission, no diagnostic; found cutting basic-number over, NOTES LT-092).
 *
 * The fix mirrors the style-map/class-map root exemptions: the lazy child is
 * bound against the ambient `host`, with the same impure-ambient fold check
 * the nested path applies. Because `bindText` replaces the element's ENTIRE
 * textContent, a lazy root child is only emitable as the root's sole content
 * child — multiple lazy children (last-write-wins) and static text or element
 * siblings (wiped on first write) are rejected with diagnostics instead.
 *
 * Note: fixtures deliberately drive reactivity through `host.<prop>` reads
 * and `deriveCell` signals. A bare signal-IDENTIFIER lazy root child hits
 * the HARVEST pass's own root handling — fixed in LT-115 alongside the
 * `paramDomRead` root sites (see root-harvest.test.ts): the text harvest now
 * reads `host.textContent` instead of emitting `first('<own-tag>')`.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'

const compile = (body: string) => {
	const source = `import { asNumber, deriveCell } from '@zeix/le-truc'

export function C({}: {})
@{
	expose({ value: asNumber() })
	<>
		<c-el>${body}</c-el>

		<style>c-el { color: red }</style>
	</>
}`
	return compileComponent(source, 'c.tsrx', new Set())
}

describe('a single lazy text child on the component root (LT-114)', () => {
	test('an authored thunk child binds client-side via the ambient host', () => {
		const { component, diagnostics } = compile('{() => String(host.value)}')
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component).not.toBeNull()
		expect(component?.clientCode).toContain(
			'watch(() => String(host.value), bindText(host))',
		)
		// The root is addressed as the ambient `host` — never a self-query.
		expect(component?.clientCode).not.toContain('first(')
		// `host` must be destructured from the factory context.
		expect(component?.clientCode).toMatch(/\(\{[^}]*\bhost\b[^}]*}\) =>/)
	})

	test('a bare host-member read is auto-wrapped into a watch thunk (LT-038)', () => {
		const { component, diagnostics } = compile('{host.value}')
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component?.clientCode).toContain(
			'watch(() => host.value, bindText(host))',
		)
	})

	test('coexists with the style-map root exemption (text and style target different surfaces)', () => {
		const source = `import { asNumber } from '@zeix/le-truc'

export function C({}: {})
@{
	expose({ value: asNumber() })
	<>
		<c-el style={() => ({ color: host.value > 0 ? 'green' : 'red' })}>{host.value}</c-el>

		<style>c-el { color: red }</style>
	</>
}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component?.clientCode).toContain(
			'watch(() => host.value, bindText(host))',
		)
		expect(component?.clientCode).toContain('bindStyle(host, ')
	})
})

describe('multiple lazy root children (LT-114)', () => {
	test('are rejected — bindText replaces the whole textContent, last write would win', () => {
		const { component, diagnostics } = compile('{host.value}{host.value}')
		const hit = diagnostics.find(
			d =>
				d.code === 'TSRX005' &&
				d.message.includes('Multiple lazy text children'),
		)
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('error')
		// No watch-text may be emitted for an unaddressable mix.
		expect(component?.clientCode ?? '').not.toContain('bindText')
	})
})

describe('nested lazy-text mixes (LT-115, the LT-114 hazard-flag mirror)', () => {
	const nested = (inner: string) =>
		compileComponent(
			`import { asNumber } from '@zeix/le-truc'

export function C({}: {})
@{
	expose({ value: asNumber() })
	<>
		<c-el>
			<span class="out">${inner}</span>
		</c-el>

		<style>c-el { color: red }</style>
	</>
}`,
			'c.tsrx',
			new Set(),
		)

	test('multiple lazy children on one NESTED element are rejected — the writes race last-write-wins', () => {
		const { component, diagnostics } = nested('{host.value}{host.value}')
		const hit = diagnostics.find(
			d =>
				d.code === 'TSRX005' &&
				d.message.includes('Multiple lazy text children on <span>'),
		)
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('error')
		expect(component?.clientCode ?? '').not.toContain('bindText')
	})

	test('a static+lazy mix on a NESTED element is rejected — the first write wipes the static text', () => {
		const { component, diagnostics } = nested('Total: {host.value}')
		const hit = diagnostics.find(
			d =>
				d.code === 'TSRX005' &&
				d.message.includes("must be <span>'s only content"),
		)
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('error')
		expect(component?.clientCode ?? '').not.toContain('bindText')
	})

	test('an element sibling beside the lazy child is rejected too — textContent writes remove element children', () => {
		const { component, diagnostics } = nested('{host.value}<b>fixed</b>')
		const hit = diagnostics.find(
			d =>
				d.code === 'TSRX005' &&
				d.message.includes("must be <span>'s only content"),
		)
		expect(hit).toBeDefined()
		expect(component?.clientCode ?? '').not.toContain('bindText')
	})

	test("a nested element's sole lazy child still binds normally", () => {
		const { component, diagnostics } = nested('{host.value}')
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component?.clientCode).toContain(
			'watch(() => host.value, bindText(span))',
		)
	})
})

describe('a static+lazy text mix on the component root (LT-114)', () => {
	test('is rejected — the first bindText write would wipe the static text', () => {
		const { component, diagnostics } = compile('Total: {host.value}')
		const hit = diagnostics.find(
			d => d.code === 'TSRX005' && d.message.includes('only content'),
		)
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('error')
		expect(component?.clientCode ?? '').not.toContain('bindText')
	})

	test('an element sibling beside the lazy child is rejected too — textContent writes remove element children', () => {
		const { component, diagnostics } = compile('<span>fixed</span>{host.value}')
		const hit = diagnostics.find(
			d => d.code === 'TSRX005' && d.message.includes('only content'),
		)
		expect(hit).toBeDefined()
		expect(component?.clientCode ?? '').not.toContain('bindText')
	})
})

describe('the impure-ambient fold check on a lazy root child (CHECKLIST §4, TSRX033)', () => {
	const impure = `import { deriveCell } from '@zeix/le-truc'

export function C({}: {})
@{
	expose({})
	const length = deriveCell(() => 42)
	<>
		<c-el>{length.get() + Date.now()}</c-el>

		<style>c-el { color: red }</style>
	</>
}`
	const pure = impure.replace('Date.now()', '1')

	test('a would-have-folded child reading Date is a WARNING — the client corrects the omission', () => {
		const { component, diagnostics } = compileComponent(
			impure,
			'c.tsrx',
			new Set(),
		)
		const hit = diagnostics.find(d => d.code === 'TSRX033')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('warning')
		// A warning must not fail the build, and the watch is still emitted.
		expect(component).not.toBeNull()
		expect(component?.clientCode).toContain('bindText(host)')
		expect(component?.serverCode).not.toContain('Date.now')
	})

	test('the same child without an impure ambient folds and emits no warning', () => {
		const { component, diagnostics } = compileComponent(
			pure,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'TSRX033')).toBe(false)
		expect(component?.clientCode).toContain('bindText(host)')
	})
})
