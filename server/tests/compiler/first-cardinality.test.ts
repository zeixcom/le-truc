/**
 * `first()` cardinality is decided by the SITE (LT-123), plus the
 * two output-shape loosenings that travelled with it.
 *
 * - one selector literal is the OPTIONAL form (`undefined` when
 *   absent), two literals the REQUIRED one (throws with the
 *   authored reason);
 * - the structural check (LTC026) is enforced for REQUIRED refs
 *   only — an optional ref may address markup the PAGE authored,
 *   which this component's own template says nothing about;
 * - a REQUIRED ref whose only match sits in a branch that may not
 *   render is required in name only: the analysis has always
 *   addressed it with a non-throwing query under a presence guard
 *   (LT-008/LT-025), so the reason string can never be thrown
 *   (LTC040);
 * - the `@{ }` output is the bare root element; a `<style>` block is
 *   its child, and a fragment root is LTC060 (LT-375).
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../compiler/frontend/tsrx'

const compile = (setup: string, template: string) =>
	compileComponent(
		`export function C({ badge = '' }: { badge?: string })
@{
	${setup}
	expose({ x: '' })
		<c-el>${template}
			<style>@scope {
	:scope { color: red }
}</style>
		</c-el>
}`,
		'c.tsrx',
		new Set(['c-el']),
	)

/** Every `const x = first('sel')` (optional) query in the client. */
const maybeQueries = (code: string): string[] =>
	[...code.matchAll(/const \w+ = first\('([^']*)'\)/g)].map(m => m[1] ?? '')

describe('the optional form (LT-123)', () => {
	test('a single selector literal is accepted and queried non-throwing', () => {
		const { component, diagnostics } = compile(
			`const b = first('span.badge')`,
			`<span class="badge" hidden={() => host.x === ''}>y</span>`,
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(maybeQueries(component?.clientCode ?? '').length).toBe(1)
	})

	test('an optional ref matching nothing structural is NOT an error', () => {
		const { component, diagnostics } = compile(
			`const extra = first('span.page-authored')`,
			`<span class="badge">y</span>`,
		)
		expect(diagnostics.some(d => d.code === 'LTC026')).toBe(false)
		// The client still queries it — the author declared the
		// const, and setup may read it. The AUTHORED selector is
		// the runtime selector: there is nothing structural to
		// resynthesize it from.
		expect(component?.clientCode).toContain(
			"const extra = first('span.page-authored')",
		)
	})

	test('a REQUIRED ref matching nothing structural is still LTC026', () => {
		const { diagnostics } = compile(
			`const extra = first('span.nope', 'required')`,
			`<span class="badge">y</span>`,
		)
		expect(diagnostics.some(d => d.code === 'LTC026')).toBe(true)
	})

	test('neither one nor two literals is still LTC025', () => {
		const { diagnostics } = compile(
			`const b = first('span.badge', 'a', 'b')`,
			`<span class="badge">y</span>`,
		)
		const hit = diagnostics.find(d => d.code === 'LTC025')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('one or two string literals')
	})
})

describe('LTC040 — a required reason that can never be thrown (LT-123)', () => {
	test('a required ref whose only match sits in a single-branch @if warns', () => {
		const { component, diagnostics } = compile(
			`const b = first('span.badge', 'need the badge')`,
			`@if (badge) { <span class="badge" hidden={() => host.x === ''}>y</span> }`,
		)
		const hit = diagnostics.find(d => d.code === 'LTC040')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('warning')
		// The query is non-throwing either way — the warning is
		// about the dead string, not a behaviour change.
		expect(maybeQueries(component?.clientCode ?? '').length).toBe(1)
	})

	test('a required ref matching unconditional markup does not warn', () => {
		const { diagnostics } = compile(
			`const b = first('span.badge', 'need the badge')`,
			`<span class="badge" hidden={() => host.x === ''}>y</span>`,
		)
		expect(diagnostics.some(d => d.code === 'LTC040')).toBe(false)
	})

	test('an @if/@else branch is not optional — both branches render something', () => {
		const { diagnostics } = compile(
			`const b = first('span.badge', 'need the badge')`,
			`@if (badge) { <span class="badge" hidden={() => host.x === ''}>y</span> } @else { <span class="badge" hidden={() => host.x === ''}>n</span> }`,
		)
		expect(diagnostics.some(d => d.code === 'LTC040')).toBe(false)
	})
})

describe('output shape (LT-123)', () => {
	const shape = (output: string) =>
		compileComponent(
			`export function C({ label }: { label: string })
@{
	expose({ x: '' })
	${output}
}`,
			'c.tsrx',
			new Set(['c-el']),
		)

	test('a bare root element with no <style> compiles', () => {
		const { component, diagnostics } = shape(
			`<c-el><span>{label}</span></c-el>`,
		)
		expect(diagnostics).toEqual([])
		expect(component?.css).toBe('')
		expect(component?.serverCode).toContain('<c-el>')
	})

	test('a fragment root is LTC060, whether or not it carries a <style>', () => {
		// Owner ruling 2026-09-29 (ADR 0032 s1, LT-375): the template's root is
		// the host element, there is no fragment root.
		for (const output of [
			`<>
			<c-el><span>{label}</span></c-el>
		</>`,
			`<>
			<c-el><span>{label}</span></c-el>
			<style>@scope {
	:scope { color: red }
}</style>
		</>`,
		]) {
			const { component, diagnostics } = shape(output)
			expect(component).toBeNull()
			expect(diagnostics).toHaveLength(1)
			expect(diagnostics[0]?.code).toBe('LTC060')
			expect(diagnostics[0]?.severity).toBe('error')
			expect(diagnostics[0]?.message).toContain(
				'Drop the fragment so that the host element is the root',
			)
		}
	})

	test('the <style> block as a child of the root carries the CSS through', () => {
		const { component, diagnostics } = shape(
			`<c-el>
			<span>{label}</span>
			<style>@scope {
	:scope { color: red }
}</style>
		</c-el>`,
		)
		expect(diagnostics).toEqual([])
		expect(component?.css).toContain('color: red')
		// The style placeholder is hoisted out of the root's children — it
		// never reaches the emitted markup.
		expect(component?.serverCode).not.toContain('<style')
	})

	test('output that is not an element is LTC008', () => {
		const { diagnostics } = shape(`<style>@scope {
	:scope {
	  color: red;
	}
}</style>`)
		expect(diagnostics.some(d => d.code === 'LTC008')).toBe(true)
	})
})
