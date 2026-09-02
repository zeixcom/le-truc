/**
 * Component composition — server-side PascalCase invocation (ADR 0023
 * sub-design 10, LT-015). Scoped to server splicing: a capitalized JSX tag
 * bound to an `import` of another `.tsrx` module resolves against a
 * corpus-wide compose registry (keyed by resolved source path, mirroring
 * `server/effects/tsrx.ts`'s two-pass compile) and the parent's generated
 * server module imports and calls the child's `render<Name>()`.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { compileComponent } from '../../tsrx'
import type { RegistryEntry } from '../../tsrx/registry'
import { createGeneratedDir } from '../helpers/generated-tsrx'

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

// Generated server modules must exist for in-process execution (LT-090);
// the effect normally writes them, tests must not depend on a prior build.
// Same harness as server.golden.test.ts — a per-run directory, never the
// build pipeline's own output (LT-140).
const generated = createGeneratedDir('compose')
afterAll(() => generated.cleanup())
const ensureEmitted = (tag: string, code: string): void => {
	generated.emit(`${tag}.server.ts`, code)
}

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

	test('`truc:pass={{ }}` on a composed element without a `ref` is diagnosed', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild label={title} truc:pass={{ value: () => title }} />
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

	test('`truc:pass={{ }}` on a composed element addressed by first() lowers to pass() on the child tag', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		const child = first('basic-child', 'the composed child')
		expose({})
		<>
			<basic-parent>
				<BasicChild label={title} truc:pass={{ value: () => 'x' }} />
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

	test('a plain setup const used only inside a compose pass thunk is placed client-side (LT-088)', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		const shout = (s: string) => s.toUpperCase()
		const child = first('basic-child', 'the composed child')
		expose({})
		<>
			<basic-parent>
				<BasicChild label={title} truc:pass={{ value: () => shout('x') }} />
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
			'const shout = (s: string) => s.toUpperCase()',
		)
		expect(component.clientCode).toContain(
			"pass(child, { value: { get: () => shout('x') } })",
		)
	})

	test('two same-source composed instances discriminated by a static class each get their own ref (LT-089)', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		const childA = first('basic-child.a', 'the first child')
		const childB = first('basic-child.b', 'the second child')
		expose({})
		<>
			<basic-parent>
				<BasicChild class="a" label={title} truc:pass={{ value: () => 'x' }} />
				<BasicChild class="b" label={title} truc:pass={{ value: () => 'y' }} />
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
			"const childA = first('basic-child.a'",
		)
		expect(component.clientCode).toContain(
			"const childB = first('basic-child.b'",
		)
		expect(component.clientCode).toContain(
			"pass(childA, { value: { get: () => 'x' } })",
		)
		expect(component.clientCode).toContain(
			"pass(childB, { value: { get: () => 'y' } })",
		)
	})

	test('compose-site class/id are materialized on the child root in the rendered HTML (LT-090)', async () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		const childA = first('basic-child.a', 'the first child')
		const childB = first('basic-child#second', 'the second child')
		expose({})
		<>
			<basic-parent>
				<BasicChild class="a" label={title} truc:pass={{ value: () => 'x' }} />
				<BasicChild class="b" id="second" label={title} truc:pass={{ value: () => 'y' }} />
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
		// Render through the generated server module (same in-process
		// execution as server.golden.test.ts) — the discriminator the client
		// selector relies on (`first('basic-child.a')`) must exist in the
		// served DOM, not just in the query string.
		ensureEmitted('basic-child', childComponent.serverCode)
		ensureEmitted('basic-parent', component.serverCode)
		const mod = await generated.importModule('basic-parent.server.ts')
		const html = (
			mod as { renderBasicParent: (args: Record<string, unknown>) => string }
		).renderBasicParent({ title: 'Hi' })
		expect(html).toContain('<basic-child class="a">Hi</basic-child>')
		expect(html).toContain(
			'<basic-child class="b" id="second">Hi</basic-child>',
		)
	})

	test('an OPTIONAL first() naming a tag this template never composes is queried verbatim (LT-123/LT-127)', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		const stray = first('other-child')
		expose({})
		on(host, 'click', () => stray?.focus())
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
			new Set(['basic-child']),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		if (!component)
			throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
		// "May be absent" includes "the page, not this template, authors it"
		// — the same latitude an unmatched optional RAW selector gets.
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component.clientCode).toContain("first('other-child')")
	})

	test('a deferred first() reference is not mistaken for a server-only name in the registry-discovery pass (LT-127)', () => {
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		const child = first('basic-child', 'the composed child')
		expose({})
		<>
			<basic-parent>
				<BasicChild label={title} truc:pass={{ value: () => child.value }} />
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`
		// No composeRegistry: this is pass 1, which only harvests each file's
		// own registry entry. It must not reject the file — pass 2 never gets
		// to compile a file pass 1 dropped.
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['basic-child']),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component).not.toBeNull()
	})

	test('two same-source composed instances with no distinguishing static attr are unaddressable (TSRX027, LT-127)', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		const childA = first('basic-child', 'the first child')
		const childB = first('basic-child', 'the second child')
		expose({})
		<>
			<basic-parent>
				<BasicChild label={title} truc:pass={{ value: () => 'x' }} />
				<BasicChild label={title} truc:pass={{ value: () => 'y' }} />
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
		// One diagnostic per unresolvable reference, and no second helping
		// of TSRX012 for the same two compose sites.
		expect(diagnostics.filter(d => d.code === 'TSRX027')).toHaveLength(2)
		expect(diagnostics.filter(d => d.code === 'TSRX012')).toHaveLength(0)
	})

	test('the same static id on two compose sites is diagnosed (TSRX038, LT-090)', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild id="dup" label={title} />
				<BasicChild id="dup" label={title} />
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
		expect(diagnostics.filter(d => d.code === 'TSRX038')).toHaveLength(1)
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
