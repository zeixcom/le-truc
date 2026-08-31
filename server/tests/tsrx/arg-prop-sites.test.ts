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

/**
 * The SERVER half of the same coincidence (LT-118).
 *
 * `hostDerivedFold` (LT-085) lets a thunk reading only `host.<prop>`
 * members render an initial value server-side, by splicing each read
 * for the prop's server truth. Its `foldable` set was Parser-exposed
 * props only — the host attribute is their seed, so the root
 * attribute's expression IS the value.
 *
 * A HARVESTED prop has the same guarantee from the other direction:
 * the arg renders the site, the site seeds the prop at connect, so
 * the ARG is that prop's server truth. Without this, a component that
 * follows the data account (harvest, don't duplicate onto a host
 * attribute) pays for it with TSRX034 — every `hidden` thunk reading
 * the harvested prop silently drops out of the initial HTML, which is
 * exactly the pre-JS flash the fold exists to prevent.
 */
describe('host-derived folds over a harvested prop (LT-118)', () => {
	const compileZero = (exposeText: string, extraParams = '') =>
		compileComponent(
			`export function C({ zero = '' }: { zero?: string${extraParams} })
@{
	const zeroSpan = first('span.zero')
	expose({ ${exposeText} })
	<>
		<c-el>
			<span class="zero">{zero}</span>
			<b hidden={() => Boolean(host.zero)}>x</b>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`,
			'c.tsrx',
			new Set(['c-el']),
		)

	test('a thunk over a harvested prop folds to the arg server-side', () => {
		const { component, diagnostics } = compileZero(
			`zero: zeroSpan?.textContent ?? ''`,
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		// The fold splices `host.zero` for the arg that renders its site.
		expect(component?.serverCode).toContain('(() => Boolean((zero)))()')
	})

	test('no TSRX034 — the initial `hidden` is server-renderable', () => {
		const { diagnostics } = compileZero(`zero: zeroSpan?.textContent ?? ''`)
		expect(diagnostics.some(d => d.code === 'TSRX034')).toBe(false)
	})

	test('the client still binds the thunk', () => {
		const { component } = compileZero(`zero: zeroSpan?.textContent ?? ''`)
		expect(component?.clientCode).toContain('() => Boolean(host.zero)')
	})

	test('a prop that is NOT arg-rendered stays unfoldable', () => {
		// `other` is exposed but no site renders it from a same-named arg,
		// so the server has no truth to splice — omission, not a guess.
		const { component, diagnostics } = compileComponent(
			`export function C({ zero = '' }: { zero?: string })
@{
	const zeroSpan = first('span.zero')
	expose({ zero: zeroSpan?.textContent ?? '', other: '' })
	<>
		<c-el>
			<span class="zero">{zero}</span>
			<b hidden={() => Boolean(host.other)}>x</b>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`,
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.some(d => d.code === 'TSRX034')).toBe(true)
		expect(component?.serverCode).not.toContain('Boolean(other)')
	})
})

/**
 * Ref-presence folds (LT-118).
 *
 * The hand-written twin gated its whole zero-state affordance on
 * `const zero = first('.zero'); if (zero) { … }` — a local ref, not a
 * reactive prop, and certainly not public API. A compiled component
 * should be able to say the same thing: `hidden={() => Boolean(zeroSpan)
 * && host.value === 0}` on an element OUTSIDE the branch that renders
 * `.zero`.
 *
 * The client half already worked (a ref is in scope in the factory). The
 * server half did not: a ref name is not server-known, so the whole thunk
 * fell out of the initial HTML (TSRX034) — a real pre-JS flash, and the
 * pressure that made an earlier draft expose `zero` as a public prop just
 * to have something server-known to read. But the server DOES decide the
 * answer: it renders `.zero` exactly when the `@if (zero)` it sits in is
 * taken, so the ref's presence folds to that branch's own condition.
 */
describe('ref-presence folds (LT-118)', () => {
	const compileGate = (template: string, gate: string) =>
		compileComponent(
			`export function C({ zero = '' }: { zero?: string })
@{
	const zeroSpan = first('span.zero')
	expose({ value: asNumber(0) })
	<>
		<c-el>
			<b hidden={${gate}}>x</b>
			${template}
		</c-el>
		<style>c-el { color: red }</style>
	</>
}
import { asNumber } from '@zeix/le-truc'`,
			'c.tsrx',
			new Set(['c-el']),
		)

	test('a ref inside a single-branch @if folds to that branch condition', () => {
		const { component, diagnostics } = compileGate(
			`@if (zero) { <span class="zero">{zero}</span> }`,
			`() => Boolean(zeroSpan)`,
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(diagnostics.some(d => d.code === 'TSRX034')).toBe(false)
		expect(component?.serverCode).toContain('Boolean(((zero)))')
	})

	test('a ref read composes with a host-prop read in one thunk', () => {
		// The two substitutable sets are consulted together — mixing them is
		// the shape the real corpus uses (form-spinbutton's `hidden={() =>
		// Boolean(zeroSpan) && host.value === 0}`). `value` needs its root
		// attribute here to be a foldable host prop in the first place.
		const { component, diagnostics } = compileComponent(
			`export function C({ zero = '', value = 0 }: { zero?: string; value?: number })
@{
	const zeroSpan = first('span.zero')
	expose({ value: asNumber(0) })
	<>
		<c-el {value}>
			<b hidden={() => Boolean(zeroSpan) && host.value === 0}>x</b>
			@if (zero) { <span class="zero">{zero}</span> }
		</c-el>
		<style>c-el { color: red }</style>
	</>
}
import { asNumber } from '@zeix/le-truc'`,
			'c.tsrx',
			new Set(['c-el']),
		)
		expect(diagnostics.some(d => d.code === 'TSRX034')).toBe(false)
		expect(component?.serverCode).toContain(
			'Boolean(((zero))) && (value) === 0',
		)
	})

	test('the client still gates on the ref itself', () => {
		const { component } = compileGate(
			`@if (zero) { <span class="zero">{zero}</span> }`,
			`() => Boolean(zeroSpan) && host.value === 0`,
		)
		expect(component?.clientCode).toContain('() => Boolean(zeroSpan)')
	})

	test('a ref in an @else arm folds to the NEGATED condition', () => {
		const { component, diagnostics } = compileGate(
			`@if (zero) { <i>y</i> } @else { <span class="zero">n</span> }`,
			`() => Boolean(zeroSpan)`,
		)
		expect(diagnostics.some(d => d.code === 'TSRX034')).toBe(false)
		expect(component?.serverCode).toContain('Boolean((!(zero)))')
	})

	test('an unconditionally rendered ref folds to true', () => {
		const { component, diagnostics } = compileGate(
			`<span class="zero">y</span>`,
			`() => Boolean(zeroSpan)`,
		)
		expect(diagnostics.some(d => d.code === 'TSRX034')).toBe(false)
		expect(component?.serverCode).toContain('Boolean((true))')
	})

	test('a ref matching nothing in the template folds to false', () => {
		// The server rendered no such element, so its presence is decided:
		// only a PAGE could supply it, and the server did not.
		const { component, diagnostics } = compileGate(
			`<span class="elsewhere">y</span>`,
			`() => Boolean(zeroSpan)`,
		)
		expect(diagnostics.some(d => d.code === 'TSRX034')).toBe(false)
		expect(component?.serverCode).toContain('Boolean((false))')
	})
})
