/**
 * Tests for import-placement inference of plain (non-`.tsrx`) imports
 * (LT-034, ADR 0024 sub-design 14): a plain top-level import's local
 * bindings are placed into the generated server module, client module, or
 * both, inferred from where they're actually used — no manual annotation.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'

describe('plain import used only server-side', () => {
	// `serverOnlyHelper` is used only inside an `@if` condition — a
	// server-known branch decision never re-evaluated client-side.
	const source = `import { serverOnlyHelper } from '../../_common/serverOnlyHelper.ts'

	export function C({ flag }: { flag: boolean })
	@{
		const gated = serverOnlyHelper(flag)
		expose({})
		<>
			<c-el>
				@if (gated) {
					<p>shown</p>
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('lands in the server module only', () => {
		const { component, diagnostics } = compileComponent(
			source,
			'examples/card/c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component?.serverCode).toContain('serverOnlyHelper')
		expect(component?.clientCode).not.toContain('serverOnlyHelper')
	})
})

describe('plain import used only client-side', () => {
	// `clientOnlyHelper` is used only inside a `style-map` thunk, whose only
	// dependency is the ambient `host` — never server-known, so this thunk
	// never server-renders.
	const source = `import { clientOnlyHelper } from '../../_common/clientOnlyHelper.ts'

	export type CProps = { value: number }

	export function C({}: {})
	@{
		expose({ value: asNumber() })
		<>
			<c-el style={() => ({ '--x': clientOnlyHelper(host.value) })}>
				<p>&{host.value}</p>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('lands in the client module only', () => {
		const { component, diagnostics } = compileComponent(
			source,
			'examples/card/c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component?.clientCode).toContain('clientOnlyHelper')
		expect(component?.serverCode).not.toContain('clientOnlyHelper')
	})
})

describe('plain import used both server- and client-side', () => {
	// `bothHelper` is used inside a plain setup const referencing only a
	// server-known param — component.setup is emitted verbatim into both
	// generated modules, and the const is also referenced from a lazy child
	// (always client-emitted), so this import is needed in both.
	const source = `import { bothHelper } from '../../_common/bothHelper.ts'

	export function C({ count }: { count: number })
	@{
		const formatted = bothHelper(count)
		expose({})
		<>
			<c-el>
				<p>&{formatted}</p>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('lands in both modules', () => {
		const { component, diagnostics } = compileComponent(
			source,
			'examples/card/c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component?.serverCode).toContain('bothHelper')
		expect(component?.clientCode).toContain('bothHelper')
	})
})

describe('plain import used only inside a bare (non-arrow) attribute expression', () => {
	// `helper(count)` classifies as a `'server'`-kind attribute (the
	// classifier's fallback for any non-arrow `{…}` expression) — spliced
	// verbatim and unconditionally into the server module by emit-server.ts,
	// with no other usage site anywhere else in the template (LT-037).
	const source = `import { helper } from '../../_common/helper.ts'

	export function C({ count }: { count: number })
	@{
		expose({})
		<>
			<c-el data-x={helper(count)}>ok</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('lands in the server module only, with no TSRX014', () => {
		const { component, diagnostics } = compileComponent(
			source,
			'examples/card/c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(diagnostics.some(d => d.code === 'TSRX014')).toBe(false)
		expect(component?.serverCode).toContain('helper')
		expect(component?.clientCode).not.toContain('helper')
	})
})

describe('relative specifier rewriting', () => {
	const source = `import { serverOnlyHelper } from '../../_common/serverOnlyHelper.ts'

	export function C({ flag }: { flag: boolean })
	@{
		const gated = serverOnlyHelper(flag)
		expose({})
		<>
			<c-el>
				@if (gated) {
					<p>shown</p>
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('is resolved relative to the .tsrx source, then rewritten for the flat generated-modules directory', () => {
		const { component } = compileComponent(
			source,
			'examples/card/colorscale/c.tsrx',
			new Set(),
		)
		expect(component?.serverCode).toContain(
			'from "../../../examples/_common/serverOnlyHelper"',
		)
	})
})

describe('an unused plain import', () => {
	const source = `import { neverUsed } from '../../_common/neverUsed.ts'

	export function C({}: {})
	@{
		expose({})
		<>
			<c-el>ok</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('is diagnosed (TSRX014), not silently dropped', () => {
		const { diagnostics } = compileComponent(
			source,
			'examples/card/c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'TSRX014')).toBe(true)
	})
})

describe('a side-effect-only plain import', () => {
	const source = `import '../../_common/registerSomething.ts'

	export function C({}: {})
	@{
		expose({})
		<>
			<c-el>ok</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('is included in both modules (no bound name to trace usage from)', () => {
		const { component, diagnostics } = compileComponent(
			source,
			'examples/card/c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(diagnostics.some(d => d.code === 'TSRX014')).toBe(false)
		expect(component?.serverCode).toContain('registerSomething')
		expect(component?.clientCode).toContain('registerSomething')
	})
})
