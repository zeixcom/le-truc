/**
 * Tests for the Web Components Community Protocol in `.tsrx` (LT-035, ADR
 * 0024 sub-design 15): `requestContext()` on the consumer side,
 * `provideContexts()` on the provider side.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'

describe('requestContext() — consumer side', () => {
	const source = `import { MEDIA_MOTION } from '../../context/media/context-media.ts'

	export function C({}: {})
	@{
		const motion = requestContext(MEDIA_MOTION, 'unknown')
		expose({})
		<>
			<c-el>
				<span class="motion">&{motion}</span>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('renders the fallback server-side, watches the real signal client-side', () => {
		const { component, diagnostics } = compileComponent(
			source,
			'examples/card/c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(diagnostics.some(d => d.code === 'TSRX004')).toBe(false)
		// Server: no ancestor DOM to walk — renders the fallback directly, via
		// a substituted createCell(fallback), never the real requestContext call.
		expect(component?.serverCode).toContain(
			"const motion = createCell('unknown')",
		)
		expect(component?.serverCode).not.toContain('requestContext')
		// Client: the real call, watched exactly like any other signal.
		expect(component?.clientCode).toContain(
			"const motion = requestContext(MEDIA_MOTION, 'unknown')",
		)
		expect(component?.clientCode).toContain('watch(motion, bindText(')
		// requestContext is a FactoryContext member, destructured in the
		// factory signature — never imported from '@zeix/le-truc'.
		expect(component?.clientCode).toMatch(/\(\{[^}]*requestContext[^}]*\}\)/)
		expect(component?.clientCode).not.toMatch(
			/import \{[^}]*requestContext[^}]*\} from '@zeix\/le-truc'/,
		)
	})

	test('places the plain-imported Context object in both modules', () => {
		const { component } = compileComponent(
			source,
			'examples/card/c.tsrx',
			new Set(),
		)
		expect(component?.clientCode).toContain('MEDIA_MOTION')
	})
})

describe('requestContext() — reactive attribute referencing the context signal', () => {
	const source = `import { MEDIA_THEME } from '../../context/media/context-media.ts'

	export function C({}: {})
	@{
		const theme = requestContext(MEDIA_THEME, 'light')
		expose({})
		<>
			<c-el>
				<span class={() => theme.get()}>&{theme}</span>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('the context signal is server-known, so the reactive attribute server-renders too', () => {
		const { component, diagnostics } = compileComponent(
			source,
			'examples/card/c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component?.serverCode).toContain(
			"attr('class', (() => theme.get())())",
		)
	})
})

describe('requestContext() — misuse diagnostics', () => {
	test('wrong argument count is TSRX015', () => {
		const source = `export function C({}: {})
		@{
			const motion = requestContext('motion')
			expose({})
			<>
				<c-el>ok</c-el>
				<style>c-el { color: red }</style>
			</>
		}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX015')).toBe(true)
	})

	test('a fallback referencing a non-server-known name is TSRX016', () => {
		const source = `export function C({}: {})
		@{
			const motion = requestContext('motion', host.value)
			expose({})
			<>
				<c-el>ok</c-el>
				<style>c-el { color: red }</style>
			</>
		}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX016')).toBe(true)
	})

	test('requestContext nested inside a plain setup const is TSRX013', () => {
		const source = `export function C({}: {})
		@{
			const wrapped = [requestContext('motion', 'unknown')]
			expose({})
			<>
				<c-el>ok</c-el>
				<style>c-el { color: red }</style>
			</>
		}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX013')).toBe(true)
	})
})

describe('provideContexts() — provider side', () => {
	const source = `export function C({}: {})
	@{
		const count = createCell(0)
		expose({ count: count.get })
		provideContexts(['count'])
		<>
			<c-el>&{count}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('lowers to a bare client-only setup statement, never runs server-side', () => {
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component?.clientCode).toContain("provideContexts(['count'])")
		expect(component?.serverCode).not.toContain('provideContexts')
	})

	test('provideContexts is destructured from the factory context, not imported', () => {
		const { component } = compileComponent(source, 'c.tsrx', new Set())
		expect(component?.clientCode).toMatch(/\(\{[^}]*provideContexts[^}]*\}\)/)
		expect(component?.clientCode).not.toMatch(
			/import \{[^}]*provideContexts[^}]*\} from '@zeix\/le-truc'/,
		)
	})

	test('assigning its result to a const is TSRX013 (client-only primitive in a plain setup const)', () => {
		const badSource = `export function C({}: {})
		@{
			const count = createCell(0)
			expose({ count: count.get })
			const p = provideContexts(['count'])
			<>
				<c-el>&{count}</c-el>
				<style>c-el { color: red }</style>
			</>
		}`
		const { diagnostics } = compileComponent(badSource, 'c.tsrx', new Set())
		expect(diagnostics.some(d => d.code === 'TSRX013')).toBe(true)
	})
})
