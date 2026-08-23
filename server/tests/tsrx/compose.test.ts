/**
 * Component composition — server-side PascalCase invocation (ADR 0023
 * sub-design 10, LT-015). Scoped to server splicing: a capitalized JSX tag
 * bound to an `import` of another `.tsrx` module resolves against a
 * corpus-wide compose registry (keyed by resolved source path, mirroring
 * `server/effects/tsrx.ts`'s two-pass compile) and the parent's generated
 * server module imports and calls the child's `render<Name>()`.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'
import type { RegistryEntry } from '../../tsrx/registry'

const child = `export function BasicChild({ label }: { label: string })
	@{
		expose({})
		<>
			<basic-child>{label}</basic-child>
			<style>basic-child { display: block }</style>
		</>
	}`

const compileChild = (path: string, source = child) => {
	const { component, diagnostics } = compileComponent(source, path, new Set())
	if (!component)
		throw new Error(`child must compile: ${JSON.stringify(diagnostics)}`)
	return component
}

const composeRegistryOf = (...entries: RegistryEntry[]) =>
	new Map(entries.map(e => [e.source, e]))

describe('component composition (ADR 0023 sub-design 10)', () => {
	test('splices the child render call with server args', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild label={title} />
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		if (!component)
			throw new Error(`parent must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.serverCode).toContain(
			"import { renderBasicChild } from './basic-child.server'",
		)
		expect(component.serverCode).toContain(
			'renderBasicChild({ "label": title })',
		)
	})

	test('static and literal attributes pass through as server args verbatim', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({}: {})
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild label="Hello" />
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		if (!component)
			throw new Error(`parent must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.serverCode).toContain(
			'renderBasicChild({ "label": "Hello" })',
		)
	})

	test('a dashed attribute name emits a valid quoted object key', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({}: {})
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild data-testid="hello" />
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		if (!component)
			throw new Error(`parent must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.serverCode).toContain(
			'renderBasicChild({ "data-testid": "hello" })',
		)
	})

	test('nested composition — a composed component composing another', () => {
		const leaf = compileChild('examples/leaf/basic-child.tsrx')
		const midSource = `import { BasicChild } from '../leaf/basic-child.tsrx'

export function BasicMid({ label }: { label: string })
	@{
		expose({})
		<>
			<basic-mid>
				<BasicChild label={label} />
			</basic-mid>
			<style>basic-mid { display: block }</style>
		</>
	}`
		const midResult = compileComponent(
			midSource,
			'examples/mid/basic-mid.tsrx',
			new Set(),
			undefined,
			composeRegistryOf(leaf.entry),
		)
		if (!midResult.component)
			throw new Error(
				`mid must compile: ${JSON.stringify(midResult.diagnostics)}`,
			)
		const rootSource = `import { BasicMid } from '../mid/basic-mid.tsrx'

export function BasicRoot({ title }: { title: string })
	@{
		expose({})
		<>
			<basic-root>
				<BasicMid label={title} />
			</basic-root>
			<style>basic-root { display: block }</style>
		</>
	}`
		const rootResult = compileComponent(
			rootSource,
			'examples/root/basic-root.tsrx',
			new Set(),
			undefined,
			composeRegistryOf(leaf.entry, midResult.component.entry),
		)
		if (!rootResult.component)
			throw new Error(
				`root must compile: ${JSON.stringify(rootResult.diagnostics)}`,
			)
		expect(rootResult.component.serverCode).toContain(
			"import { renderBasicMid } from './basic-mid.server'",
		)
		expect(rootResult.component.serverCode).toContain(
			'renderBasicMid({ "label": title })',
		)
	})

	test('TSRX011: capitalized tag with no matching import', () => {
		const source = `export function BasicParent({}: {})
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild label="Hello" />
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'examples/parent/basic-parent.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX011')).toBe(true)
	})

	test('TSRX011: import resolves to a path the compose registry does not have', () => {
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({}: {})
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild label="Hello" />
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(),
			undefined,
			new Map(), // composeRegistry provided but empty — child never compiled
		)
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX011')).toBe(true)
	})

	const childWithChildren = `export function BasicChild({ label, children }: { label: string; children?: string })
	@{
		expose({})
		<>
			<basic-child>
				<span>{label}</span>
				{children}
			</basic-child>
			<style>basic-child { display: block }</style>
		</>
	}`

	test("children between a composed element's tags splice into the render call as the `children` server arg", () => {
		const childComponent = compileChild(
			'examples/child/basic-child.tsrx',
			childWithChildren,
		)
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild label={title}>
					<span>nope</span>
				</BasicChild>
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		if (!component)
			throw new Error(`parent must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.serverCode).toContain('const __children1: string[] = []')
		expect(component.serverCode).toContain(
			'renderBasicChild({ "label": title, children: __children1.join(\'\') })',
		)
	})

	test('a self-closing composed element passes no `children` arg', () => {
		const childComponent = compileChild(
			'examples/child/basic-child.tsrx',
			childWithChildren,
		)
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild label={title} />
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		if (!component)
			throw new Error(`parent must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.serverCode).toContain(
			'renderBasicChild({ "label": title })',
		)
		expect(component.serverCode).not.toContain('children')
	})

	test('the reserved `{children}` insertion point renders unescaped, not through esc()', () => {
		const childComponent = compileChild(
			'examples/child/basic-child.tsrx',
			childWithChildren,
		)
		expect(childComponent.serverCode).toContain('__html.push(String(children))')
		expect(childComponent.serverCode).not.toContain('esc(String(children))')
	})

	test('a construct requiring client wiring inside composed-element children is diagnosed (TSRX011)', () => {
		const childComponent = compileChild(
			'examples/child/basic-child.tsrx',
			childWithChildren,
		)
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild label={title}>
					<button onClick={() => {}}>nope</button>
				</BasicChild>
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX011')).toBe(true)
	})

	test('`pass={{ }}` on a composed element without a `ref` is diagnosed', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild label={title} pass={{ value: () => title }} />
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['basic-child']),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.code === 'TSRX012')).toBe(true)
	})

	test('`pass={{ }}` on a composed element with a `ref` lowers to pass() on the child tag', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild label={title} ref={child} pass={{ value: () => 'x' }} />
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['basic-child']),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		if (!component)
			throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.clientCode).toContain(
			"pass(child, { value: { get: () => 'x' } })",
		)
	})

	test('a raw lowercase dashed tag is unaffected by composition', () => {
		const source = `export function BasicParent({}: {})
	@{
		expose({})
		<>
			<basic-parent>
				<basic-child></basic-child>
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`
		const { component, diagnostics } = compileComponent(
			source,
			'examples/parent/basic-parent.tsrx',
			new Set(),
		)
		if (!component)
			throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
		expect(component.serverCode).toContain('<basic-child>')
	})
})
