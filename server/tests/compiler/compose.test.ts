/**
 * Component composition — server-side PascalCase invocation (ADR 0023
 * sub-design 10, LT-015). Scoped to server splicing: a capitalized JSX tag
 * bound to an `import` of another `.tsrx` module resolves against a
 * corpus-wide compose registry (keyed by resolved source path, mirroring
 * `server/effects/compile.ts`'s two-pass compile) and the parent's generated
 * server module imports and calls the child's `render<Name>()`.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { analyzeClient } from '../../compiler/analysis/plan'
import type { CompileDiagnostic } from '../../compiler/diagnostics'
import { compileComponent, compileSource } from '../../compiler/frontend/tsrx'
import type { RegistryEntry } from '../../compiler/registry'
import { createGeneratedDir } from '../helpers/generated-corpus'

// `value` is exposed from a plain literal, i.e. Slot-backed (LT-158): the
// parent fixtures below pass to it, and since LTC012 now decides a pass
// target's prop against the CHILD's own expose(), a child that exposed
// nothing would make every one of them a compile error.
const child = `export function BasicChild({ label }: { label: string })
	@{
		expose({ value: '' })
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
		// Spliced onto the child's root, not forwarded as an arg (LT-320).
		expect(component.serverCode).toContain(
			'composeHostAttrs(renderBasicChild({  }), "basic-child", { "data-testid": "hello" })',
		)
	})

	test('a dynamic data-* renders on the child root with its server expression (LT-320)', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ rowId }: { rowId: string })
	@{
		expose({})
		<>
			<basic-parent>
				<BasicChild data-row={rowId} />
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
			'composeHostAttrs(renderBasicChild({  }), "basic-child", { "data-row": rowId })',
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

	test('LTC011: capitalized tag with no matching import', () => {
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
		expect(diagnostics.some(d => d.code === 'LTC011')).toBe(true)
	})

	test('LTC011: import resolves to a path the compose registry does not have', () => {
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
		expect(diagnostics.some(d => d.code === 'LTC011')).toBe(true)
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

	test('a construct requiring client wiring inside composed-element children is diagnosed (LTC011)', () => {
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
		expect(diagnostics.some(d => d.code === 'LTC011')).toBe(true)
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
		expect(diagnostics.some(d => d.code === 'LTC012')).toBe(true)
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

	test('two same-source composed instances with no distinguishing static attr are unaddressable (LTC027, LT-127)', () => {
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
		// of LTC012 for the same two compose sites.
		expect(diagnostics.filter(d => d.code === 'LTC027')).toHaveLength(2)
		expect(diagnostics.filter(d => d.code === 'LTC012')).toHaveLength(0)
	})

	test('the same static id on two compose sites is diagnosed (LTC038, LT-090)', () => {
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
		expect(diagnostics.filter(d => d.code === 'LTC038')).toHaveLength(1)
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

describe('compose-ref attachment idempotence (LT-221 §1.4)', () => {
	// `resolveComposeRefs` attaches the synthetic `{kind: 'ref'}` attr onto
	// the shared IR — the pipeline runs it once inside `analyzeClient`, and
	// any SECOND `analyzeClient` over the same IR (a test harness, a future
	// caller) used to trip the claimed-ref check and report a spurious
	// LTC041 against the pass's own attachment.
	const parentWithRef = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		const child = first('basic-child')
		expose({})
		<>
			<basic-parent>
				<BasicChild label={title} />
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`

	test('a second analyzeClient over the same IR reports no spurious duplicate', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const composeRegistry = composeRegistryOf(childComponent.entry)
		const extracted = compileSource(
			parentWithRef,
			'examples/parent/basic-parent.tsrx',
		)
		if (!extracted.component)
			throw new Error(
				`parent must extract: ${JSON.stringify(extracted.diagnostics)}`,
			)
		const tags = new Set(['basic-child'])
		const firstRun: CompileDiagnostic[] = []
		analyzeClient(extracted.component, tags, firstRun, composeRegistry)
		expect(firstRun.filter(d => d.code === 'LTC041')).toEqual([])
		const secondRun: CompileDiagnostic[] = []
		analyzeClient(extracted.component, tags, secondRun, composeRegistry)
		expect(secondRun.filter(d => d.code === 'LTC041')).toEqual([])
	})
})

describe('compose site inside a @pending arm (LT-221 §1.4 probe)', () => {
	// `countForSelector` sums the @pending arm (async arms coexist in the
	// DOM), but `allComposeNodes`/`composeNodesBySource`/`countComposeBySource`
	// omit it — so whether the gap is reachable turns on whether a compose
	// site can legally sit in a pending arm. The arm's only shape rule is
	// "exactly one root element"; a single compose root satisfies it.
	const parent = `import { BasicChild } from '../child/basic-child.tsrx'
import { deriveCell } from '@zeix/le-truc'

export function BasicParent({}: {})
	@{
		const data = deriveCell(async () => 'x')
		const loading = first('basic-child.pending')
		expose({})
		<>
			<basic-parent>
				@try {
					<div class="content">{data}</div>
				} @pending {
					<BasicChild label={'loading'} class="pending" />
				} @catch (e) {
					<p class="error">{e.message}</p>
				}
			</basic-parent>
			<style>basic-parent { display: block }</style>
		</>
	}`

	test('a compose site in a @pending arm is rejected — the walks omit pending arms by ruling (LT-221 probe)', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const { diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['basic-child']),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		// The probe's outcome (2026-09-18): the @pending arm-shape rule
		// demands exactly one root ELEMENT — `singleRootOf` filters
		// `kind === 'element'` — so a compose site can never reach a
		// @pending arm through valid authoring. The compose walks omitting
		// the pending arm (`allComposeNodes`/`composeNodesBySource`/
		// `countComposeBySource`) is therefore consistent garbage-in
		// protection, not a live duplicate-`id`/resolution gap; the
		// review's §1.4-adjacent concern is ruled unreachable. Revisit the
		// walks in the same commit if compose-in-pending ever becomes a
		// supported shape (LT-230 settles the walk policy).
		expect(
			diagnostics.some(
				d =>
					d.severity === 'error' &&
					d.message.includes('must render exactly one root element'),
			),
		).toBe(true)
	})
})
