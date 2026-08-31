/**
 * Tests for harvest sites that live on the component ROOT (LT-115, NOTES
 * LT-092/LT-114): `first()` searches DESCENDANTS only (`src/helpers/dom.ts`
 * `queryOne` uses `root.querySelector`), so a harvest plan that synthesizes a
 * query for the root's own tag emits `first('<own-tag>')` — which throws
 * `MissingElementError` for the component's own root at activation, with no
 * compile-time diagnostic. Two analysis sites could produce that:
 *
 * 1. `paramDomRead`'s attribute-site walk (ADR 0023 sub-design 12) matched the
 *    root's own server attributes first — the usual case, since args render as
 *    root attributes — planning a query named after the component's own tag
 *    (basic-pluralize / basic-gauge both hit this; a regrouping-era edit had
 *    dropped LT-024's `site.el !== component.root` guard).
 * 2. Pass 3's direct text-site branch for a signal-IDENTIFIER lazy root child
 *    (`<my-el>{sig}</my-el>`, LT-114's interplay note) — the same self-query,
 *    planned even though LT-114's root branch correctly binds the watch against
 *    the ambient `host`.
 *
 * The fix routes BOTH root-site variants through the ambient `host` (never a
 * query-table entry; `harvestInitializer` passes unknown query names through
 * verbatim) and, for the reactivity half of LT-115: when the substituted arg is
 * ALSO an exposed Parser prop rendered on the root, a `deriveCell` body reads
 * `host.<prop>` — the exposed prop's Slot, a TRACKED reactive source — instead
 * of an untracked `getAttribute` read that froze post-connect updates.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'

const compile = (setup: string, params: string, rootAttrs: string) =>
	compileComponent(
		`import { asNumber, createCell, deriveCell } from '@zeix/le-truc'

export function C(${params})
@{
${setup}
	<>
		<c-el ${rootAttrs}></c-el>

		<style>c-el { color: red }</style>
	</>
}`,
		'c.tsrx',
		new Set(),
	)

describe('root-attribute arg harvest reads the ambient host, never a self-query (paramDomRead)', () => {
	test('a deriveCell over a root-rendered arg reads host.getAttribute — no first("<own-tag>")', () => {
		const { component, diagnostics } = compile(
			`	const label = deriveCell(() => String(lang).toUpperCase())
	expose({})`,
			'{ lang = "en" }: { lang?: string }',
			'lang={lang}',
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component).not.toBeNull()
		expect(component?.clientCode).toContain(
			"String((host.getAttribute('lang') ?? '')).toUpperCase()",
		)
		// The illegal self-query is gone — no query for the component's own tag.
		expect(component?.clientCode).not.toContain("first('c-el'")
		// `host` must be destructured from the factory context for that read.
		expect(component?.clientCode).toMatch(/\(\{[^}]*\bhost\b[^}]*}\) =>/)
	})

	test('an arg rendered on a NESTED element still queries that element (unchanged route)', () => {
		const { component, diagnostics } = compileComponent(
			`import { deriveCell } from '@zeix/le-truc'
export function C({ max = '10' }: { max?: string })
@{
	const label = deriveCell(() => Number(max) * 2)
	expose({})
	<>
		<c-el>
			<meter max={max}></meter>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		// The nested site wins over the root's own rendering of the arg — the
		// element query is legitimate (descendant scope) and stays.
		expect(component?.clientCode).toContain(
			"Number((meter.getAttribute('max') ?? '')) * 2",
		)
		expect(component?.clientCode).toContain("first('meter'")
		expect(component?.clientCode).not.toContain("first('c-el'")
	})
})

describe('an exposed Parser prop arg seeds derived signals through the prop Slot (LT-115 freeze fix)', () => {
	test('a deriveCell over an exposed prop arg reads host.<prop> — a tracked reactive source', () => {
		const { component, diagnostics } = compile(
			`	const qualification = deriveCell(() => ({ doubled: Number(value) * 2 }))
	expose({ value: asNumber() })`,
			'{ value = 0 }: { value?: number }',
			'value={value}',
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component).not.toBeNull()
		// The arg read is routed through the exposed prop's Slot, not the
		// (untracked) content attribute — post-connect property writes and
		// observedAttributes re-parses re-derive the signal.
		expect(component?.clientCode).toContain('Number(host.value) * 2')
		expect(component?.clientCode).not.toContain("getAttribute('value')")
		expect(component?.clientCode).not.toContain("first('c-el'")
	})

	test('an EAGER createCell over the same arg still reads the DOM — it runs before expose() installs the prop', () => {
		const { component, diagnostics } = compile(
			`	const seed = createCell(String(value))
	expose({ value: asNumber() })`,
			'{ value = 0 }: { value?: number }',
			'value={value}',
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		// Eager initializers execute at declaration, BEFORE expose() installs
		// the Slot-backed property — a host.<prop> read there would be
		// undefined. The DOM (attribute) read is the only sound seed.
		expect(component?.clientCode).toContain(
			"createCell(String((host.getAttribute('value') ?? '')))",
		)
		expect(component?.clientCode).not.toContain('String(host.value)')
	})
})

describe('a signal-identifier lazy root child harvests via the ambient host (Pass 3 direct text-site)', () => {
	test('the text harvest reads host.textContent — no first("<own-tag>") self-query', () => {
		const { component, diagnostics } = compileComponent(
			`import { createCell } from '@zeix/le-truc'
export function C({}: {})
@{
	const greeting = createCell('Hello')
	expose({})
	<>
		<c-el>{greeting}</c-el>

		<style>c-el { color: red }</style>
	</>
}`,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component).not.toBeNull()
		// LT-114's root branch already plans the watch against the ambient
		// host; the harvest now agrees instead of throwing at activation.
		expect(component?.clientCode).toContain('watch(greeting, bindText(host))')
		expect(component?.clientCode).toContain('asString()(host.textContent)')
		expect(component?.clientCode).not.toContain("first('c-el'")
	})
})
