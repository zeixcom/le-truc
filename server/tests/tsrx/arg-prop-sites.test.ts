/**
 * The arg-and-prop coincidence (LT-122).
 *
 * A component whose props are harvested from its own server-rendered
 * children needs one site to do three jobs: render the value (from
 * the server arg), let the client harvest it back at connect
 * (ADR 0003, DOM-is-truth), and rebind it when the prop is written
 * afterwards. Before this, each spelling covered part of it —
 * `{label}` rendered but never rebound, `{host.label}` rebound but
 * rendered EMPTY — which is what pushed LT-092 into duplicating the
 * value onto a host attribute and LT-117 into a template-less mode.
 *
 * So: an expression naming BOTH a server arg and an `expose()`d prop
 * of that name is reactive by position. The server emission is
 * untouched (it still splices the arg); the client gets the effect
 * the `host.<name>` spelling would have produced.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'

const compile = (
	setup: string,
	template: string,
	params = '{ label }: { label: string }',
) =>
	compileComponent(
		`export function C(${params})
@{
	const el = first('span', 'span')
	${setup}
	<>
		<c-el>${template}</c-el>
		<style>c-el { color: red }</style>
	</>
}`,
		'c.tsrx',
		new Set(['c-el']),
	)

describe('text sites (LT-122)', () => {
	test('an arg that is also an exposed prop renders server-side AND binds client-side', () => {
		const { component, diagnostics } = compile(
			`expose({ label: el.textContent ?? '' })`,
			`<span>{label}</span>`,
		)
		expect(diagnostics).toEqual([])
		// Server: the ARG is spliced, exactly as before this rule.
		expect(component?.serverCode).toContain('esc(String(label))')
		// Client: the PROP is watched — the spelling `{host.label}`
		// would have produced, against the same site.
		expect(component?.clientCode).toContain(
			'watch(() => host.label, bindText(el))',
		)
	})

	test('an arg that is NOT an exposed prop stays render-only', () => {
		const { component, diagnostics } = compile(
			`expose({ other: el.textContent ?? '' })`,
			`<span>{label}</span>`,
		)
		expect(diagnostics).toEqual([])
		expect(component?.serverCode).toContain('esc(String(label))')
		expect(component?.clientCode).not.toContain('watch(')
	})

	test('an exposed prop that is NOT an arg stays render-only', () => {
		const { component, diagnostics } = compile(
			`const other = 'x'
	expose({ other: el.textContent ?? '' })`,
			`<span>{other}</span>`,
		)
		expect(diagnostics).toEqual([])
		expect(component?.clientCode).not.toContain('watch(() => host.other')
	})

	test('a site inside a single-branch @if binds under the existing presence guard', () => {
		const { component, diagnostics } = compile(
			`expose({ label: el.textContent ?? '', badge: '' })`,
			`<span>{label}</span>@if (badge) { <b class="badge">{badge}</b> }`,
			`{ label, badge = '' }: { label: string; badge?: string }`,
		)
		expect(diagnostics).toEqual([])
		const client = component?.clientCode ?? ''
		// The optional branch keeps its non-throwing query and guard
		// (LT-008/LT-025 machinery) — this rule only supplies the source.
		expect(client).toMatch(/const \w+ = first\('b'\)\n/)
		expect(client).toContain('watch(() => host.badge, bindText(')
		// …and the server still renders the branch from the arg.
		expect(component?.serverCode).toContain('esc(String(badge))')
	})
})

describe('attribute sites (LT-122)', () => {
	test('a bare-arg attribute renders server-side AND binds as a property', () => {
		const { component, diagnostics } = compile(
			`expose({ disabled: el.hidden })`,
			`<button type="button" disabled={disabled}>x</button><span>y</span>`,
			`{ disabled = false }: { disabled?: boolean }`,
		)
		expect(diagnostics).toEqual([])
		expect(component?.serverCode).toContain("attr('disabled', disabled)")
		// Attribute dispatch: `disabled` on a <button> is not a
		// dirty-flag control attribute, so `bindAttribute`'s
		// boolean path (toggleAttribute) is the right write.
		expect(component?.clientCode).toContain("bindAttribute(button, 'disabled')")
		expect(component?.clientCode).toContain('watch(() => host.disabled,')
	})

	test('the same attribute on a custom element is still rejected', () => {
		const { diagnostics } = compile(
			`expose({ disabled: el.hidden })`,
			`<other-el disabled={disabled}></other-el><span>y</span>`,
			`{ disabled = false }: { disabled?: boolean }`,
		)
		expect(diagnostics.some(d => d.code === 'TSRX012')).toBe(true)
	})
})

describe('TSRX039 — one value, two channels (LT-122)', () => {
	test('a Parser-exposed prop also rendered from its own arg warns', () => {
		const { diagnostics } = compileComponent(
			`import { asString } from '@zeix/le-truc'
export function C({ label }: { label: string })
@{
	expose({ label: asString('') })
	<>
		<c-el><span>{label}</span></c-el>
		<style>c-el { color: red }</style>
	</>
}`,
			'c.tsrx',
			new Set(['c-el']),
		)
		const hit = diagnostics.find(d => d.code === 'TSRX039')
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('warning')
		expect(hit?.message).toContain('asString')
		expect(hit?.message).toContain('ships twice')
	})

	test('harvesting the same prop from the site instead is clean', () => {
		const { diagnostics } = compile(
			`expose({ label: el.textContent ?? '' })`,
			`<span>{label}</span>`,
		)
		expect(diagnostics.some(d => d.code === 'TSRX039')).toBe(false)
	})
})
