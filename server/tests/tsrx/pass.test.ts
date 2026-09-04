/**
 * `truc:pass={{ }}` dispatch (ADR 0023 sub-design 10, amending sub-design 4):
 * the sole client-prop interop channel for custom-element targets, for both
 * raw dashed tags and composed (PascalCase) elements — replacing the old
 * shape-inferred "function-valued attribute on a custom tag" dispatch.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'

describe('truc:pass={{ }} on raw dashed custom-element tags', () => {
	test('a registry-known target lowers to pass()', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<basic-child truc:pass={{ label: () => 'x' }}></basic-child>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['basic-child']),
		)
		if (!component)
			throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.clientCode).toContain(
			"pass(basicChild, { label: { get: () => 'x' } })",
		)
	})

	test('a native element target is diagnosed (TSRX012)', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<span truc:pass={{ label: () => 'x' }}>ok</span>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX012')).toBe(true)
	})

	test('an unregistered dashed tag is diagnosed (TSRX012)', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<basic-child truc:pass={{ label: () => 'x' }}></basic-child>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX012')).toBe(true)
	})

	test('a bare function-valued attribute on a custom element no longer dispatches to pass() (TSRX012)', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<basic-child label={() => 'x'}></basic-child>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['basic-child']),
		)
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX012')).toBe(true)
	})

	test('a bare function-valued attribute on a native element is unaffected', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<span aria-label={() => 'x'}>ok</span>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		if (!component)
			throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.clientCode).toContain('bindAttribute')
	})

	test('a { get, set } descriptor entry lowers to a two-way pass()', () => {
		const source = `import { createCell } from '@zeix/le-truc'

export function C({}: {})
	@{
		const value = createCell('x')
		expose({ value: value.get })
		<>
			<c-el>
				<span>{value}</span>
				<basic-child truc:pass={{ value: { get: () => value.get(), set: v => value.set(v) } }}></basic-child>
			</c-el>
			<style>c-el { color: red }</style>
			</>
		}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['basic-child']),
		)
		if (!component)
			throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.clientCode).toContain(
			'pass(basicChild, { value: { get: () => value.get(), set: v => value.set(v) } })',
		)
	})

	test('a bare thunk entry still emits getter-only pass()', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<basic-child truc:pass={{ label: () => 'x' }}></basic-child>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['basic-child']),
		)
		if (!component)
			throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.clientCode).toContain(
			"pass(basicChild, { label: { get: () => 'x' } })",
		)
	})

	test('truc:pass={{ }} with a non-object value is invalid (TSRX006)', () => {
		const source = `export function C({}: {})
	@{
		<>
			<c-el>
				<basic-child pass="nope"></basic-child>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(['basic-child']),
		)
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX006')).toBe(true)
	})
})

describe('truc:pass — namespaced host-owned attribute (LT-053)', () => {
	const source = (attr: string) => `import { createCell } from '@zeix/le-truc'
import { Child } from './child.tsrx'

	export function C({}: {})
	@{
		const n = createCell(0)
		expose({ n: n.get })
		<>
			<c-el>
				<child-el ${attr}={{ value: () => n.get() }}></child-el>
				<p>{n}</p>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('truc:pass lowers to a pass() binding', () => {
		const { component, diagnostics } = compileComponent(
			source('truc:pass'),
			'examples/card/c.tsrx',
			new Set(['child-el']),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component?.clientCode).toContain('pass(')
	})

	// Not left to fall through: `pass={{ … }}` would classify as a server
	// attribute and render `pass="[object Object]"` — silently wrong markup.
	test('the bare pass spelling is a hard error naming the replacement', () => {
		const { diagnostics } = compileComponent(
			source('pass'),
			'examples/card/c.tsrx',
			new Set(['child-el']),
		)
		const errs = diagnostics.filter(d => d.severity === 'error')
		expect(errs).toHaveLength(1)
		expect(errs[0]?.message).toContain('truc:pass')
	})
})

/* === Per-prop legality against the target's own expose() (LT-158) === */

/**
 * [ADR 0028](../../../adr/0028-tiered-error-surfacing.md) sub-design 6: a
 * `pass()` target whose prop EXISTS but is not Slot-backed is ADR 0011's own
 * motivating example, and the one shape TypeScript cannot carry — a
 * read-only prop is structurally identical to a writable one. The registry
 * now records how each `expose()` key lands on the host, which moves this
 * from Tier 2 (contained console line) to Tier 1 (build failure).
 */
describe('pass={{ }} prop legality against the target registry entry', () => {
	const childWith = ({
		imports = '',
		setup = '',
		expose: exposeBody,
		markup = '',
	}: {
		imports?: string
		setup?: string
		expose: string
		markup?: string
	}): string =>
		`${imports ? `import { ${imports} } from '@zeix/le-truc'\n\n` : ''}export function BasicChild({ label }: { label: string })
	@{
		${setup}
		expose({ ${exposeBody} })
		<>
			<basic-child>{label}${markup}</basic-child>
			<style>basic-child { display: block }</style>
		</>
	}`

	/** A `createCell` declaration plus the render site TSRX004 requires. */
	const cell = {
		imports: 'createCell',
		setup: `const v = createCell('')`,
		markup: '<span class="v">{v}</span>',
	}

	const parent = `export function BasicParent({}: {})
	@{
		<>
			<basic-parent>
				<basic-child truc:pass={{ value: () => 'x' }}></basic-child>
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`

	const compilePair = (child: Parameters<typeof childWith>[0]) => {
		const compiled = compileComponent(
			childWith(child),
			'examples/child/basic-child.tsrx',
			new Set(),
		)
		if (!compiled.component)
			throw new Error(
				`child must compile: ${JSON.stringify(compiled.diagnostics)}`,
			)
		return compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['basic-child']),
			undefined,
			new Map([[compiled.component.entry.source, compiled.component.entry]]),
		)
	}

	test('a plain-value expose is Slot-backed and passes', () => {
		const { component, diagnostics } = compilePair({ expose: `value: ''` })
		if (!component)
			throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.clientCode).toContain('pass(')
	})

	test('a Parser-backed expose is Slot-backed and passes', () => {
		// The Parser's RESULT reaches `#setAccessor`, not the Parser itself,
		// so `asString('')` lands as a mutable cell.
		const { component } = compilePair({
			imports: 'asString',
			expose: `value: asString('')`,
		})
		expect(component).not.toBeNull()
	})

	test('a `{ get, set }` descriptor is Slot-backed and passes', () => {
		const { component } = compilePair({
			...cell,
			expose: `value: { get: v.get, set: (next: string) => { v.set(next) } }`,
		})
		expect(component).not.toBeNull()
	})

	test('a `sig.get` expose is READ-ONLY and is diagnosed (TSRX012)', () => {
		// The surprise this rule exists for: `sig.get` is a bare function,
		// so `#setAccessor` wraps it in `deriveCell` — read-only however
		// mutable `sig` is. The corpus's single most common expose shape.
		const { component, diagnostics } = compilePair({
			...cell,
			expose: 'value: v.get',
		})
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'TSRX012')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`value`')
		expect(hit?.message).toContain('READ-ONLY')
	})

	test('an arrow-function expose is READ-ONLY and is diagnosed', () => {
		const { component, diagnostics } = compilePair({
			expose: `value: () => 'derived'`,
		})
		expect(component).toBeNull()
		expect(
			diagnostics.some(
				d => d.code === 'TSRX012' && d.message.includes('READ-ONLY'),
			),
		).toBe(true)
	})

	test('a defineMethod() producer is diagnosed as a method, not a property', () => {
		const { component, diagnostics } = compilePair({
			imports: 'defineMethod',
			expose: 'value: defineMethod(() => {})',
		})
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'TSRX012')
		expect(hit?.message).toContain('defineMethod()')
		expect(hit?.message).toContain('has no Slot to swap')
	})

	test('a prop the target does not expose at all is diagnosed, naming the ones it does', () => {
		const { component, diagnostics } = compilePair({ expose: `label: ''` })
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'TSRX012')
		expect(hit?.message).toContain('does not expose `value`')
		expect(hit?.message).toContain('`label`')
	})

	test('a target with no registry entry keeps the Tier 2 runtime backstop', () => {
		// A hand-written (non-.tsrx) child is registry-known via
		// `childImports` but never has an entry, and the discovery pass has
		// no compose registry at all. Silence here is the deliberate
		// answer — ADR 0028 sub-design 1 keeps the runtime check for
		// exactly this case ([M15] no-build components, foreign markup).
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['basic-child']),
		)
		expect(component).not.toBeNull()
		expect(diagnostics.filter(d => d.code === 'TSRX012')).toEqual([])
	})

	test('the registry entry records every expose() key with its kind', () => {
		const child = compileComponent(
			childWith({
				...cell,
				imports: 'createCell, defineMethod',
				expose: `value: v.get, caption: '', focus: defineMethod(() => {})`,
			}),
			'examples/child/basic-child.tsrx',
			new Set(),
		)
		if (!child.component)
			throw new Error(`must compile: ${JSON.stringify(child.diagnostics)}`)
		expect(child.component.entry.exposedProps).toEqual({
			value: 'computed',
			caption: 'slot',
			focus: 'method',
		})
	})
})
