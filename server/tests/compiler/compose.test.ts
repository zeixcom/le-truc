/**
 * Component composition — server-side PascalCase invocation (ADR 0024
 * sub-design 10, LT-015). Scoped to server splicing: a capitalized JSX tag
 * bound to an `import` of another `.tsrx` module resolves against a
 * corpus-wide compose registry (keyed by resolved source path, mirroring
 * `server/effects/compile.ts`'s two-pass compile) and the parent's generated
 * server module imports and calls the child's `render<Name>()`.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { analyzeClient } from '../../compiler/analysis/plan'
import type { LocalDiagnostic } from '../../compiler/diagnostics'
import { compileComponent, compileSource } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import type { InternalRegistryEntry } from '../../compiler/registry'
import { createGeneratedDir } from '../helpers/generated-corpus'

// `value` is exposed from a plain literal, i.e. Slot-backed (LT-158): the
// parent fixtures below pass to it, and since LTC012 now decides a pass
// target's prop against the CHILD's own expose(), a child that exposed
// nothing would make every one of them a compile error.
const child = `export function BasicChild({ label }: { label: string })
	@{
		expose({ value: '' })
			<basic-child>{label}
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-child>
	}`

const compileChild = (path: string, source = child) => {
	const { component, diagnostics } = compileComponent(source, path, new Set())
	if (!component)
		throw new Error(`child must compile: ${JSON.stringify(diagnostics)}`)
	return component
}

const composeRegistryOf = (...entries: InternalRegistryEntry[]) =>
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

describe('component composition (ADR 0024 sub-design 10)', () => {
	test('splices the child render call with server args', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		expose({})
			<basic-parent>
				<BasicChild label={title} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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

	test('an unkeyed composed element beside a reactive-list loop in its container is LTC074 (LT-186)', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { createList } from '@zeix/le-truc'
import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({}: {})
	@{
		const items = createList<string>([], { keyConfig: 'item' })
		expose({})
			<basic-parent>
				<ul data-container>
					<BasicChild label="Hello" />
					@for (const item of items) { <li>{item}</li> }
				</ul>
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC074')
		expect(hit?.message).toContain('<BasicChild>')
		expect(hit?.message).toContain('composed element cannot carry')
	})

	test('static and literal attributes pass through as server args verbatim', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({}: {})
	@{
		expose({})
			<basic-parent>
				<BasicChild label="Hello" />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			<basic-parent>
				<BasicChild data-testid="hello" />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			<basic-parent>
				<BasicChild data-row={rowId} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			<basic-mid>
				<BasicChild label={label} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-mid>
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
			<basic-root>
				<BasicMid label={title} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-root>
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
			<basic-parent>
				<BasicChild label="Hello" />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			<basic-parent>
				<BasicChild label="Hello" />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			<basic-child>
				<span>{label}</span>
				{children}
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-child>
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
			<basic-parent>
				<BasicChild label={title}>
					<span>nope</span>
				</BasicChild>
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			// The region owner rides as the second argument (ADR 0048 s1).
			'renderBasicChild({ "label": title, children: __children1.join(\'\') }, "basic-parent")',
		)
		// The child's root encloses the insertion: it carries the marker,
		// and only when a compiled owner passed its tag.
		expect(childComponent.serverCode).toContain('__owner?: string): string {')
		expect(childComponent.serverCode).toContain(
			"attr('data-children', __owner)",
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
			<basic-parent>
				<BasicChild label={title} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			<basic-parent>
				<BasicChild label={title}>
					<button onClick={() => {}}>nope</button>
				</BasicChild>
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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

	describe('`truc:pass={{ }}` needs no `first()` declaration (LT-338)', () => {
		const tsrxParent = (
			declare: string,
		) => `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		${declare}
		expose({})
			<basic-parent>
				<BasicChild class="a" label={title} truc:pass={{ value: () => 'x' }} />
				<BasicChild class="b" label={title} truc:pass={{ value: () => 'y' }} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
	}`
		const tsxParent = (
			declare: string,
		) => `import { css } from '@zeix/le-truc-compiler/macros'
import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string }) {
	${declare}
	expose({})
	return (
			<basic-parent>
				<BasicChild class="a" label={title} truc:pass={{ value: () => 'x' }} />
				<BasicChild class="b" label={title} truc:pass={{ value: () => 'y' }} />
				<style>{css\`@scope {
	:scope {
		  display: block;
		}
}\`}</style>
			</basic-parent>
	)
}`
		const declared = [
			// A required reference whose reason is the default message: the
			// auto-addressed query is required, with that same message.
			"const basicChild = first('basic-child.a', 'basic-parent: basic-child.a missing')",
			"const basicChild2 = first('basic-child.b', 'basic-parent: basic-child.b missing')",
		].join('\n')
		const surfaces = [
			{
				name: '.tsrx',
				source: tsrxParent,
				compile: (source: string) =>
					compileComponent(
						source,
						'examples/parent/basic-parent.tsrx',
						new Set(['basic-child']),
						undefined,
						composeRegistryOf(
							compileChild('examples/child/basic-child.tsrx').entry,
						),
					),
			},
			{
				name: '.tsx',
				source: tsxParent,
				compile: (source: string) =>
					compileComponentTsx(
						source,
						'examples/parent/basic-parent.tsx',
						new Set(['basic-child']),
						undefined,
						composeRegistryOf(
							compileChild('examples/child/basic-child.tsrx').entry,
						),
					),
			},
		]
		for (const surface of surfaces)
			test(`${surface.name}: a reference-less site compiles to the same client as a declared one`, () => {
				const bare = surface.compile(surface.source(''))
				const withRefs = surface.compile(surface.source(declared))
				expect(bare.diagnostics.filter(d => d.severity === 'error')).toEqual([])
				expect(
					withRefs.diagnostics.filter(d => d.severity === 'error'),
				).toEqual([])
				if (!bare.component || !withRefs.component)
					throw new Error('both must compile')
				expect(bare.component.clientCode).toContain(
					"const basicChild = first('basic-child.a'",
				)
				expect(bare.component.clientCode).toContain(
					"pass(basicChild, { value: { get: () => 'x' } })",
				)
				expect(bare.component.clientCode).toContain(
					"pass(basicChild2, { value: { get: () => 'y' } })",
				)
				expect(bare.component.clientCode).toBe(withRefs.component.clientCode)
			})
	})

	describe('same-class sites share one query when their `truc:pass` objects are identical (LT-319)', () => {
		// A site's own `label="…"` literal replaces the shared `label={title}`.
		const site = (extra: string) =>
			`<BasicChild class="x"${extra.includes('label=') ? '' : ' label={title}'}${extra} />`
		const sites = (a: string, b: string) =>
			[site(a), site(b)].join('\n\t\t\t\t')
		const tsrxParent = (
			a: string,
			b: string,
			declare = '',
		) => `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		${declare}
		expose({})
			<basic-parent>
				${sites(a, b)}
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
	}`
		const tsxParent = (
			a: string,
			b: string,
			declare = '',
		) => `import { css } from '@zeix/le-truc-compiler/macros'
import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string }) {
	${declare}
	expose({})
	return (
			<basic-parent>
				${sites(a, b)}
				<style>{css\`@scope {
	:scope {
		  display: block;
		}
}\`}</style>
			</basic-parent>
	)
}`
		const registry = () =>
			composeRegistryOf(compileChild('examples/child/basic-child.tsrx').entry)
		const surfaces = [
			{
				name: '.tsrx',
				compile: (a: string, b: string, declare?: string) =>
					compileComponent(
						tsrxParent(a, b, declare),
						'examples/parent/basic-parent.tsrx',
						new Set(['basic-child']),
						undefined,
						registry(),
					),
			},
			{
				name: '.tsx',
				compile: (a: string, b: string, declare?: string) =>
					compileComponentTsx(
						tsxParent(a, b, declare),
						'examples/parent/basic-parent.tsx',
						new Set(['basic-child']),
						undefined,
						registry(),
					),
			},
		]
		for (const surface of surfaces) {
			test(`${surface.name}: identical objects lower to one pass() over an all() query`, () => {
				const { component, diagnostics } = surface.compile(
					" truc:pass={{ value: () => 'v' }}",
					" truc:pass={{  value:  () =>  'v'  }}",
				)
				expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
				if (!component) throw new Error('must compile')
				expect(component.clientCode).toContain(
					"const basicChilds = all('basic-child.x', 'basic-parent: basic-child.x missing')",
				)
				expect(
					component.clientCode.match(/pass\(basicChilds, /g) ?? [],
				).toHaveLength(1)
			})
			test(`${surface.name}: differing objects stay unaddressable`, () => {
				const { component, diagnostics } = surface.compile(
					" truc:pass={{ value: () => 'v' }}",
					" truc:pass={{ value: () => 'w' }}",
				)
				expect(component).toBeNull()
				const hit = diagnostics.find(d =>
					d.message.includes('textually identical'),
				)
				expect(hit?.severity).toBe('error')
			})
			for (const [label, a, b] of [
				['first', ' id="one"', ''],
				['second', '', ' id="one"'],
			])
				test(`${surface.name}: a member with its own unique clause (${label}) keeps the other site unaddressable (LT-339)`, () => {
					const { component, diagnostics } = surface.compile(
						`${a} truc:pass={{ value: () => 'v' }}`,
						`${b} truc:pass={{ value: () => 'v' }}`,
					)
					expect(component).toBeNull()
					expect(
						diagnostics.filter(
							d =>
								d.code === 'LTC007' &&
								d.message.includes('textually identical'),
						),
					).toHaveLength(1)
				})
			test(`${surface.name}: a group member with its own first() never compiles silently (LT-339)`, () => {
				// `[label="a"]` is unique, but `label` is not a discriminator
				// attribute, so neither site has a unique clause of its own.
				const { component, diagnostics } = surface.compile(
					` label="a" truc:pass={{ value: () => 'v' }}`,
					" truc:pass={{ value: () => 'v' }}",
					`const own = first('basic-child[label="a"]', 'the a child')`,
				)
				expect(component).toBeNull()
				expect(
					diagnostics.some(d => d.code === 'LTC007' || d.code === 'LTC027'),
				).toBe(true)
			})
			test(`${surface.name}: a group member without truc:pass stays unaddressable`, () => {
				const { component, diagnostics } = surface.compile(
					" truc:pass={{ value: () => 'v' }}",
					'',
				)
				expect(component).toBeNull()
				expect(
					diagnostics.some(d => d.message.includes('textually identical')),
				).toBe(true)
			})
		}
	})

	test('`truc:pass={{ }}` on a composed element addressed by first() lowers to pass() on the child tag', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		const child = first('basic-child', 'the composed child')
		expose({})
			<basic-parent>
				<BasicChild label={title} truc:pass={{ value: () => 'x' }} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			<basic-parent>
				<BasicChild label={title} truc:pass={{ value: () => shout('x') }} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			<basic-parent>
				<BasicChild class="a" label={title} truc:pass={{ value: () => 'x' }} />
				<BasicChild class="b" label={title} truc:pass={{ value: () => 'y' }} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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

	describe('a raw element of the child tag counts against the compose site (LT-496)', () => {
		const parentWith = (
			site: string,
			raws: string,
		) => `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		expose({})
			<basic-parent>
				${raws}
				${site}
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
	}`
		const compileParent = (parent: string) =>
			compileComponent(
				parent,
				'examples/parent/basic-parent.tsrx',
				new Set(['basic-child']),
				undefined,
				composeRegistryOf(
					compileChild('examples/child/basic-child.tsrx').entry,
				),
			)

		test('a compose site after a raw same-tag element emits the discriminated selector', () => {
			const { component, diagnostics } = compileParent(
				parentWith(
					`<BasicChild class="submit" label={title} truc:pass={{ value: () => 'x' }} />`,
					'<basic-child class="clear"></basic-child>',
				),
			)
			if (!component)
				throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
			expect(component.clientCode).toContain("first('basic-child.submit'")
			expect(component.clientCode).not.toContain("first('basic-child'")
		})

		test('a raw same-tag element in an arm counts too', () => {
			const { component, diagnostics } = compileParent(
				parentWith(
					`<BasicChild class="submit" label={title} truc:pass={{ value: () => 'x' }} />`,
					'@if (title) { <basic-child class="clear"></basic-child> }',
				),
			)
			if (!component)
				throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
			expect(component.clientCode).toContain("first('basic-child.submit'")
		})

		test('a class the raw element shares is no discriminator — the site is refused (LTC007)', () => {
			const { component, diagnostics } = compileParent(
				parentWith(
					`<BasicChild class="btn" label={title} truc:pass={{ value: () => 'x' }} />`,
					'<basic-child class="btn"></basic-child>',
				),
			)
			expect(component).toBeNull()
			const refused = diagnostics.filter(d => d.code === 'LTC007')
			expect(refused).toHaveLength(1)
			expect(refused[0]?.message).toContain(
				'Give the site a class no other <basic-child> carries.',
			)
		})

		test('an indistinguishable pair is refused (LTC007)', () => {
			const { component, diagnostics } = compileParent(
				parentWith(
					`<BasicChild label={title} truc:pass={{ value: () => 'x' }} />`,
					'<basic-child></basic-child>',
				),
			)
			expect(component).toBeNull()
			expect(diagnostics.filter(d => d.code === 'LTC007')).toHaveLength(1)
		})

		test('a compose site with no raw same-tag element keeps the bare tag', () => {
			const { component, diagnostics } = compileParent(
				parentWith(
					`<BasicChild class="submit" label={title} truc:pass={{ value: () => 'x' }} />`,
					'<div class="clear"></div>',
				),
			)
			if (!component)
				throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
			expect(component.clientCode).toContain("first('basic-child'")
		})
	})

	describe('the remaining raw-same-tag blind spots (LT-498)', () => {
		const parentWith = (
			body: string,
			imports = '',
		) => `import { BasicChild } from '../child/basic-child.tsrx'
${imports}
export function BasicParent({ title }: { title: string })
	@{
		expose({})
			<basic-parent>
				${body}
				<style>@scope {
	:where(:scope) {
	  display: block;
	}
}</style>
			</basic-parent>
	}`
		const childEntry = () =>
			compileChild('examples/child/basic-child.tsrx').entry
		const compileParent = (parent: string, ...extra: InternalRegistryEntry[]) =>
			compileComponent(
				parent,
				'examples/parent/basic-parent.tsrx',
				new Set(['basic-child']),
				undefined,
				composeRegistryOf(childEntry(), ...extra),
			)

		test('a sibling whose own clause a raw element takes joins the shared pass', () => {
			const pass = `truc:pass={{ value: () => 'x' }}`
			const { component, diagnostics } = compileParent(
				parentWith(
					`<basic-child class="a"></basic-child>
				<BasicChild class="btn a" label={title} ${pass} />
				<BasicChild class="btn" label={title} ${pass} />`,
				),
			)
			if (!component)
				throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
			expect(component.clientCode).toContain("all('basic-child.btn'")
			expect(component.clientCode).not.toContain("first('basic-child.a'")
		})

		// A child whose own template renders <basic-child>: raw, and through
		// a composed grandchild.
		const cardWith = (inner: string, imports = '') =>
			compileChild(
				'examples/card/basic-card.tsrx',
				`${imports}export function BasicCard({ label }: { label: string })
	@{
		<basic-card>
			${inner}
			<style>@scope {
	:where(:scope) {
	  display: block;
	}
}</style>
		</basic-card>
	}`,
			).entry

		test('a composed child that renders the tag is excluded, not refused', () => {
			const card = cardWith('<basic-child>{label}</basic-child>')
			const { component, diagnostics } = compileParent(
				parentWith(
					`<BasicCard label={title} />
				<BasicChild label={title} truc:pass={{ value: () => 'x' }} />`,
					"import { BasicCard } from '../card/basic-card.tsrx'",
				),
				card,
			)
			if (!component)
				throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
			expect(component.clientCode).toContain(
				"first('basic-child:not(basic-card *)'",
			)
		})

		test('the tag rendered through a composed grandchild is excluded too', () => {
			const card = cardWith(
				'<BasicChild label={label} />',
				"import { BasicChild } from '../child/basic-child.tsrx'\n",
			)
			const { component, diagnostics } = compileParent(
				parentWith(
					`<BasicCard label={title} />
				<BasicChild label={title} truc:pass={{ value: () => 'x' }} />`,
					"import { BasicCard } from '../card/basic-card.tsrx'",
				),
				card,
			)
			if (!component)
				throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
			expect(component.clientCode).toContain(
				"first('basic-child:not(basic-card *)'",
			)
		})

		test('a clause the composed child’s element cannot carry needs no exclusion', () => {
			const card = cardWith('<basic-child class="inner">{label}</basic-child>')
			const { component, diagnostics } = compileParent(
				parentWith(
					`<BasicCard label={title} />
				<BasicChild class="outer" label={title} truc:pass={{ value: () => 'x' }} />
				<BasicChild class="other" label={title} truc:pass={{ value: () => 'y' }} />`,
					"import { BasicCard } from '../card/basic-card.tsrx'",
				),
				card,
			)
			if (!component)
				throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
			expect(component.clientCode).toContain("first('basic-child.outer'")
		})
	})

	test('compose-site class/id are materialized on the child root in the rendered HTML (LT-090)', async () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'

export function BasicParent({ title }: { title: string })
	@{
		const childA = first('basic-child.a', 'the first child')
		const childB = first('basic-child#second', 'the second child')
		expose({})
			<basic-parent>
				<BasicChild class="a" label={title} truc:pass={{ value: () => 'x' }} />
				<BasicChild class="b" id="second" label={title} truc:pass={{ value: () => 'y' }} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			<basic-parent>
				<BasicChild label={title} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			<basic-parent>
				<BasicChild label={title} truc:pass={{ value: () => child.value }} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			<basic-parent>
				<BasicChild label={title} truc:pass={{ value: () => 'x' }} />
				<BasicChild label={title} truc:pass={{ value: () => 'y' }} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			<basic-parent>
				<BasicChild id="dup" label={title} />
				<BasicChild id="dup" label={title} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			<basic-parent>
				<basic-child></basic-child>
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
			<basic-parent>
				<BasicChild label={title} />
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
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
		const firstRun: LocalDiagnostic[] = []
		analyzeClient(extracted.component, tags, firstRun, composeRegistry)
		expect(firstRun.filter(d => d.code === 'LTC041')).toEqual([])
		const secondRun: LocalDiagnostic[] = []
		analyzeClient(extracted.component, tags, secondRun, composeRegistry)
		expect(secondRun.filter(d => d.code === 'LTC041')).toEqual([])
	})
})

describe('compose site inside a @pending arm (LT-221 §1.4 probe, overruled by LT-460)', () => {
	// The LT-221 probe refused a compose site as a @pending arm root: the
	// arm-shape rule filtered `kind === 'element'`, so a single compose
	// root could never satisfy it, and the compose walks omitting pending
	// arms was ruled consistent garbage-in protection. LT-460 overruled
	// that (owner: bug — the arm root path was never routed through compose
	// lowering): an arm root that is a compose site lowers as a compose
	// site, and `data-key` splices onto the child's rendered root through
	// the same `composeHostAttrs` path as `class`/`id`/`data-*`. Pinned
	// below, in the arm-positions band.
})

describe('compose site nested below a @pending root (LT-230 walk policy)', () => {
	// Every walk enters `@pending` arms (walk.ts): the arm's markup renders —
	// the winner live, the other arms as inert templates (ADR 0037 s4) — so a
	// compose site nested below its root coexists in the DOM with the body's.
	const parentWith = (
		pendingChild: string,
	) => `import { BasicChild } from '../child/basic-child.tsrx'
import { deriveCell } from '@zeix/le-truc'

export function BasicParent({}: {})
	@{
		const data = deriveCell(async () => 'x')
		expose({})
			<basic-parent>
				<BasicChild label={'a'} id="dup" />
				@try {
					<div class="content">{data}</div>
				} @pending {
					<div class="pending">${pendingChild}</div>
				} @catch (e) {
					<p class="error">{e.message}</p>
				}
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
	}`

	test('a duplicate compose id across the body and a nested pending site is reported', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const { diagnostics } = compileComponent(
			parentWith(`<BasicChild label={'loading'} id="dup" />`),
			'examples/parent/basic-parent.tsrx',
			new Set(['basic-child']),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		expect(diagnostics.filter(d => d.code === 'LTC038')).toHaveLength(1)
	})

	test('an unresolved composed child nested in a pending arm is reported', () => {
		const { diagnostics } = compileComponent(
			parentWith(`<BasicChild label={'loading'} />`),
			'examples/parent/basic-parent.tsrx',
			new Set(['basic-child']),
			undefined,
			new Map(),
		)
		// Both sites — the body's and the nested pending one.
		expect(diagnostics.filter(d => d.code === 'LTC011')).toHaveLength(2)
	})
})

describe('compose sites in arm positions (LT-460)', () => {
	// An arm root that is a compose site lowers as a compose site, and the
	// children of a compose site render inside every binding scope that
	// encloses the site. The async boundary is the one scope whose
	// templates sit OUTSIDE the catch binding, so the sanctioned
	// binding-scope read is the catch parameter — written by the live arm,
	// baked empty in the inert templates, and rebound on the client through
	// the boundary's err watch on a parent-authored message element inside
	// the composed content.

	// A child that renders the reserved `{children}` substitution — the
	// composed content's message element must exist in the child's DOM for
	// the arm-scoped `first()` to reach it.
	const childrenChild = `export function ChildrenChild({ label, children }: {
	label: string
	children?: string
})
	@{
		expose({ value: '' })
			<children-child>{label}{children}</children-child>
	}`
	const compileChildrenChild = () => {
		const { component, diagnostics } = compileComponent(
			childrenChild,
			'examples/child/children-child.tsrx',
			new Set(['children-child']),
		)
		if (!component)
			throw new Error(`child must compile: ${JSON.stringify(diagnostics)}`)
		return component
	}

	const asyncParent = (pendingArm: string, catchArm: string) =>
		`import { deriveCell } from '@zeix/le-truc'

export function BasicParent({}: {})
	@{
		const data = deriveCell(async () => 'x')
		expose({})
			<basic-parent>
				@try {
					<div class="content">{data}</div>
				} @pending {
					${pendingArm}
				} @catch (e) {
					${catchArm}
				}
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
	}`

	const withImports = (imports: string, parent: string): string =>
		parent.replace(
			"import { deriveCell } from '@zeix/le-truc'",
			`${imports}\nimport { deriveCell } from '@zeix/le-truc'`,
		)

	test('an arm-root compose site keys the child root and reconciles on flip', async () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = withImports(
			"import { BasicChild } from '../child/basic-child.tsrx'",
			asyncParent(
				'<BasicChild label={"loading"} class="pending" />',
				'<p class="error">{e.message}</p>',
			),
		)
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['basic-child']),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('parent must compile')
		// The live nil arm: `data-key` spliced onto the child's rendered
		// root, beside the authored `class`.
		expect(component.serverCode).toContain(
			'composeHostAttrs(renderBasicChild({ "label": "loading" }), "basic-child", { "class": "pending", "data-key": "nil" })',
		)
		// The inert template carries the arm content, unkeyed — the
		// `<template data-key>` names the arm.
		expect(component.serverCode).toContain(
			'composeHostAttrs(renderBasicChild({ "label": "loading" }), "basic-child", { "class": "pending" })',
		)
		// The client switches arms through `reconcile()`'s arm form.
		expect(component.clientCode).toContain('reconcile(')
		// In-process execution: the child root carries `data-key` in the
		// served DOM (the pending state wins at first render).
		ensureEmitted('basic-child', childComponent.serverCode)
		ensureEmitted('basic-parent', component.serverCode)
		const mod = await generated.importModule('basic-parent.server.ts')
		const html = (
			mod as { renderBasicParent: (args: Record<string, unknown>) => string }
		).renderBasicParent({})
		expect(html).toContain('<basic-child class="pending" data-key="nil">')
	})

	test('a catch-parameter read in composed content renders server-side and rebinding is planned (the LT-460 miscompile regression)', async () => {
		const childComponent = compileChildrenChild()
		const parent = withImports(
			"import { ChildrenChild } from '../child/children-child.tsrx'",
			asyncParent(
				'<div class="loading">loading</div>',
				'<div class="wrapper"><ChildrenChild label={"failed"}><p class="error">{e.message}</p></ChildrenChild></div>',
			),
		)
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['children-child']),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('parent must compile')
		// The LIVE err arm evaluates the read where `e` is bound...
		expect(component.serverCode).toContain('text(e.message)')
		// ...exactly once: the err arm TEMPLATE bakes the site empty —
		// before LT-460 the generated module read `e` there, out of scope
		// (TS2552 under check:corpus; a ReferenceError at execution).
		expect(component.serverCode.match(/text\(e\.message\)/g)).toHaveLength(1)
		// The client rebinds through the boundary's err watch, targeting the
		// parent-authored message element inside the composed content.
		expect(component.clientCode).toContain("'p.error'")
		expect(component.clientCode).toContain(
			'err: error => bindText(errMessage)(error.message)',
		)
		// Execution must not throw (the pre-fix module read `e` outside the
		// catch callback while rendering the err template).
		ensureEmitted('children-child', childComponent.serverCode)
		ensureEmitted('basic-parent', component.serverCode)
		const mod = await generated.importModule('basic-parent.server.ts')
		const html = (
			mod as { renderBasicParent: (args: Record<string, unknown>) => string }
		).renderBasicParent({})
		expect(html).toContain('<p class="error"></p>')
	})

	test('a composed callout as the catch arm root: the message renders server-side, bakes empty in the template, and the child root carries data-key (the module-lazyload conversion shape)', () => {
		const callout = `export function CardCallout({ kind, children }: {
	kind?: string
	children?: string
})
	@{
		expose({ value: '' })
			<card-callout class={kind}>{children}</card-callout>
	}`
		const childComponent = compileComponent(
			callout,
			'examples/card/callout/card-callout.tsrx',
			new Set(['card-callout']),
		)
		if (!childComponent.component)
			throw new Error(
				`child must compile: ${JSON.stringify(childComponent.diagnostics)}`,
			)
		const parent = withImports(
			"import { CardCallout } from '../card/callout/card-callout.tsrx'",
			asyncParent(
				'<div class="loading">loading</div>',
				'<CardCallout class="danger">\n\t\t\t\t\t\t\t<p class="error" role="alert">{e.message}</p>\n\t\t\t\t\t\t</CardCallout>',
			),
		)
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['card-callout']),
			undefined,
			composeRegistryOf(childComponent.component.entry),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('parent must compile')
		// The composed callout IS the err arm root: data-key and the
		// discriminator splice onto the child's rendered root.
		expect(component.serverCode).toContain(
			'"class": "danger", "data-key": "err"',
		)
		// The message read is bound in the live arm, baked empty in the
		// err template (the miscompile regression), and the arm-scoped
		// write targets the parent-authored message element by role.
		expect(component.serverCode.match(/text\(e\.message\)/g)).toHaveLength(1)
		expect(component.clientCode).toContain('first(\'p[role="alert"]\'')
		ensureEmitted('card-callout', childComponent.component.serverCode)
		ensureEmitted('basic-parent', component.serverCode)
	})

	test('a bare-tag message element inside composed content is refused — the child renders markup the compiler cannot see (LT-460 rework)', () => {
		// The child's own label <p> shares the tag with the parent-authored
		// message element; a bare `p` selector would hit the child's markup
		// on an err flip and overwrite the label instead of the message.
		const labeledChild = `export function ChildrenChild({ label, children }: {
	label: string
	children?: string
})
	@{
		expose({ value: '' })
			<children-child><p>{label}</p>{children}</children-child>
	}`
		const childComponent = compileComponent(
			labeledChild,
			'examples/child/children-child.tsrx',
			new Set(['children-child']),
		)
		if (!childComponent.component)
			throw new Error(
				`child must compile: ${JSON.stringify(childComponent.diagnostics)}`,
			)
		const parent = withImports(
			"import { ChildrenChild } from '../child/children-child.tsrx'",
			asyncParent(
				'<div class="loading">loading</div>',
				'<ChildrenChild label={"failed"}><p>{e.message}</p></ChildrenChild>',
			),
		)
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['children-child']),
			undefined,
			composeRegistryOf(childComponent.component.entry),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC005')
		expect(hit?.severity).toBe('error')
		expect(hit?.message).toContain(
			'message element <p> inside composed content has no `role`, `class`, `id` or `data-*` attribute',
		)
		expect(hit?.message).toContain('distinguishing attribute')
	})

	test('a reactive construct nested below the PENDING root is refused — the deep construct walk covers the pending arm (LT-460 rework round 2)', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { deriveCell } from '@zeix/le-truc'

export function BasicParent({ busy }: { busy: boolean })
	@{
		const data = deriveCell(async () => 'x')
		expose({})
			<basic-parent>
				@try {
					<div class="content">{data}</div>
				} @pending {
					<div class="loading"><span class={() => (host.busy ? 'b' : null)}>loading</span></div>
				} @catch (e) {
					<p class="error">{e.message}</p>
				}
			</basic-parent>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['basic-child']),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		// Regression: splitting the deep-construct check per arm in the
		// first rework left the pending arm with `hasOwnConstruct` only,
		// so this compiled silently and planned no client code for the
		// span.
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC005')
		expect(hit?.severity).toBe('error')
		expect(hit?.message).toContain(
			'A client construct in the `@pending` arm of an async boundary',
		)
		expect(hit?.message).toContain(
			'Nothing watches the pending arm once the signal resolves',
		)
	})

	test('a lazy child DIRECTLY inside composed content is refused with the wrap-in-an-element fix (LT-460 rework)', () => {
		const childComponent = compileChildrenChild()
		const parent = withImports(
			"import { ChildrenChild } from '../child/children-child.tsrx'",
			asyncParent(
				'<div class="loading">loading</div>',
				'<ChildrenChild label={"failed"}>{e.message}</ChildrenChild>',
			),
		)
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['children-child']),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC005')
		expect(hit?.severity).toBe('error')
		expect(hit?.message).toContain('A client construct below the root element')
		// The generic "move it onto the arm's root element" advice is
		// impossible here — the fix names the wrapper element instead.
		expect(hit?.message).toContain('wrap the read in an element of your own')
	})

	test('a compose arm root of a REACTIVE conditional keys the child root and plans the arm mount (LT-460 rework)', async () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const parent = `import { BasicChild } from '../child/basic-child.tsrx'
import { createCell } from '@zeix/le-truc'

export function BasicParent({}: {})
	@{
		const open = createCell(true)
		expose({})
			<basic-parent>
				@if (open.get()) {
					<BasicChild label={"open"} class="branch" />
				} @else {
					<div class="closed">closed</div>
				}
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['basic-child']),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('parent must compile')
		// The live winner's child root carries the arm key; the inert
		// then-template holds the composed arm unkeyed.
		expect(component.serverCode).toContain(
			'"class": "branch", "data-key": "then"',
		)
		expect(component.serverCode).toContain(
			'composeHostAttrs(renderBasicChild({ "label": "open" }), "basic-child", { "class": "branch" })',
		)
		// The client switches arms through `reconcile()`'s arm form; with no
		// constructs on the compose root the mount itself is a no-op body,
		// so the key thunk carries the arm switching.
		expect(component.clientCode).toContain("? 'then' : 'else'")
		// Execution: the true arm renders, keyed on the child's root.
		ensureEmitted('basic-child', childComponent.serverCode)
		ensureEmitted('basic-parent', component.serverCode)
		const mod = await generated.importModule('basic-parent.server.ts')
		const html = (
			mod as { renderBasicParent: (args: Record<string, unknown>) => string }
		).renderBasicParent({})
		expect(html).toContain('<basic-child class="branch" data-key="then">')
	})

	test('a catch-parameter read in a compose ARG is refused — the child renders args itself (no client write channel)', () => {
		const childComponent = compileChild('examples/child/basic-child.tsrx')
		const { component, diagnostics } = compileComponent(
			withImports(
				"import { BasicChild } from '../child/basic-child.tsrx'",
				asyncParent(
					'<div class="loading">loading</div>',
					'<BasicChild label={e.message} class="error" />',
				),
			),
			'examples/parent/basic-parent.tsrx',
			new Set(['basic-child']),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC005')
		expect(hit?.severity).toBe('error')
		expect(hit?.message).toContain(
			'`label` arg reading the catch parameter `e`',
		)
		expect(hit?.message).toContain('composed content')
	})

	test('a server-data loop variable in composed content renders per iteration, in scope', async () => {
		const childComponent = compileChildrenChild()
		const parent = `import { ChildrenChild } from '../child/children-child.tsrx'

export function BasicParent({ rows }: { rows: string[] })
	@{
		expose({})
			<basic-parent>
				<ul>
					@for (const row of rows) {
						<li><ChildrenChild label={row}><p class="cell">{row}</p></ChildrenChild></li>
					}
				</ul>
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['children-child']),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('parent must compile')
		// The composed content's read evaluates inside the render loop,
		// where the loop variable is bound.
		expect(component.serverCode).toContain('text(row)')
		ensureEmitted('children-child', childComponent.serverCode)
		ensureEmitted('basic-parent', component.serverCode)
		const mod = await generated.importModule('basic-parent.server.ts')
		const html = (
			mod as { renderBasicParent: (args: Record<string, unknown>) => string }
		).renderBasicParent({ rows: ['a', 'b'] })
		expect(html).toContain('<p class="cell">a</p>')
		expect(html).toContain('<p class="cell">b</p>')
	})

	test('a list item or key read in composed content stays refused (LTC075) — the template renders once, outside the item mount', () => {
		const childComponent = compileChildrenChild()
		const parent = `import { ChildrenChild } from '../child/children-child.tsrx'
import { createList } from '@zeix/le-truc'

export function BasicParent({}: {})
	@{
		const items = createList(['a'])
		expose({})
			<basic-parent>
				<ul>
					@for (const item of items; key item) {
						<li><ChildrenChild label={'x'}><p class="cell">{item}</p></ChildrenChild></li>
					}
				</ul>
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
	}`
		const { diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['children-child']),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		expect(diagnostics.filter(d => d.code === 'LTC075')).toHaveLength(1)
	})

	test('a catch-parameter read in composed content compiles in a SYNC boundary too (the binding exists at the template position)', () => {
		const childComponent = compileChildrenChild()
		const parent = `import { ChildrenChild } from '../child/children-child.tsrx'

export function BasicParent({}: {})
	@{
		expose({})
			<basic-parent>
				@try {
					<div class="ok">ok</div>
				} @catch (e) {
					<div class="wrapper"><ChildrenChild label={"failed"}><p class="error">{e.message}</p></ChildrenChild></div>
				}
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</basic-parent>
	}`
		const { component, diagnostics } = compileComponent(
			parent,
			'examples/parent/basic-parent.tsrx',
			new Set(['children-child']),
			undefined,
			composeRegistryOf(childComponent.entry),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('parent must compile')
		// The sync catch arm emits inside the catch callback, so the read
		// stays in scope in every emission position.
		expect(component.serverCode).toContain('text(e.message)')
	})

	test('an arm-root compose site compiles on the .tsx surface (the boundary arms are attribute positions there)', () => {
		const childTsx = `export function BasicChild({ label }: { label: string }) {
	expose({ value: '' })
	return <basic-child>{label}</basic-child>
}`
		const { component: childComponent, diagnostics: childDiags } =
			compileComponentTsx(childTsx, 'examples/child/basic-child.tsx', new Set())
		if (!childComponent)
			throw new Error(`child must compile: ${JSON.stringify(childDiags)}`)
		const parent = `import { BasicChild } from '../child/basic-child.tsx'
import { deriveCell } from '@zeix/le-truc'

export function BasicParent({}: {}) {
	const data = deriveCell(async () => 'x')
	expose({})
	return <basic-parent>
		<truc:try
			pending={<div class="loading">loading</div>}
			catch={e => <BasicChild label={"failed"} class="error" />}>
			<div class="content">{data}</div>
		</truc:try>
	</basic-parent>
}`
		const { component, diagnostics } = compileComponentTsx(
			parent,
			'examples/parent/basic-parent.tsx',
			new Set(['basic-child']),
			undefined,
			new Map([[childComponent.entry.source, childComponent.entry]]),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('parent must compile')
		expect(component.serverCode).toContain(
			'"class": "error", "data-key": "err"',
		)
	})
})

describe('compose arm roots plan their `truc:pass` entries (LT-481)', () => {
	// LT-460 made a compose site legal as an arm root but never planned its
	// `truc:pass` entries: the arm walk checked only the root's DESCENDANTS
	// against `unmountableInArm`, so a pass on the root was neither refused
	// nor lowered — the silent drop LT-470's remedy ("make the condition
	// reactive: the composed child then renders as its arm's root") steered
	// authors into. The entries now plan as `pass()` effects in the arm's
	// mount against the arm element parameter — the arm root IS the child's
	// rendered element, so no query or local is minted — and a `first()` on
	// the site stays refused.

	// A child that renders its passed prop, so a flip test can see the
	// pass: `value` is exposed from a plain literal, i.e. Slot-backed
	// (LT-158), and `{host.value}` is the reactive lazy child over it.
	const valueChild = `export function ValueChild({}: {})
	@{
		expose({ value: '' })
			<value-child>{host.value}
				<style>@scope {
	:scope {
		  display: block;
		}
}</style>
			</value-child>
	}`
	const valueChildTsx = `export function ValueChild({}: {}) {
	expose({ value: '' })
	return <value-child>{host.value}</value-child>
}`
	const compileValueChild = () => {
		const { component, diagnostics } = compileComponent(
			valueChild,
			'examples/child/value-child.tsrx',
			new Set(['value-child']),
		)
		if (!component)
			throw new Error(`child must compile: ${JSON.stringify(diagnostics)}`)
		return component
	}
	const compileValueChildTsxEntry = (): InternalRegistryEntry => {
		const { component, diagnostics } = compileComponentTsx(
			valueChildTsx,
			'examples/child/value-child.tsx',
			new Set(['value-child']),
		)
		if (!component)
			throw new Error(`child must compile: ${JSON.stringify(diagnostics)}`)
		return component.entry
	}

	const IF_PARENT_TSRX = `import { createCell } from '@zeix/le-truc'
import { ValueChild } from '../child/value-child.tsrx'

export function BasicParent({}: {})
	@{
		const mode = createCell('a')
		expose({ mode })
			<basic-parent>
				@if (mode.get() === 'a') {
					<ValueChild truc:pass={{ value: () => 'from-a' }} />
				} @else {
					<ValueChild truc:pass={{ value: () => 'from-b' }} />
				}
			</basic-parent>
	}`
	const IF_PARENT_TSX = `import { createCell } from '@zeix/le-truc'
import { ValueChild } from '../child/value-child.tsx'

export function BasicParent({}: {}) {
	const mode = createCell('a')
	expose({ mode })
	return <basic-parent>
		{mode.get() === 'a' ? (
			<ValueChild truc:pass={{ value: () => 'from-a' }} />
		) : (
			<ValueChild truc:pass={{ value: () => 'from-b' }} />
		)}
	</basic-parent>
}`

	const BOUNDARY_PARENT_TSRX = `import { deriveCell } from '@zeix/le-truc'
import { ValueChild } from '../child/value-child.tsrx'

export function BasicParent({}: {})
	@{
		const data = deriveCell(async () => 'x')
		expose({})
			<basic-parent>
				@try {
					<div class="content">{data}</div>
				} @pending {
					<ValueChild truc:pass={{ value: () => 'loading' }} />
				} @catch (e) {
					<ValueChild truc:pass={{ value: () => 'failed' }} />
				}
			</basic-parent>
	}`
	const BOUNDARY_PARENT_TSX = `import { deriveCell } from '@zeix/le-truc'
import { ValueChild } from '../child/value-child.tsx'

export function BasicParent({}: {}) {
	const data = deriveCell(async () => 'x')
	expose({})
	return <basic-parent>
		<truc:try
			pending={<ValueChild truc:pass={{ value: () => 'loading' }} />}
			catch={e => <ValueChild truc:pass={{ value: () => 'failed' }} />}>
			<div class="content">{data}</div>
		</truc:try>
	</basic-parent>
}`

	const compileParent = (
		source: string,
		childEntry: InternalRegistryEntry,
		surface: 'tsrx' | 'tsx' = 'tsrx',
	) =>
		surface === 'tsrx'
			? compileComponent(
					source,
					'examples/parent/basic-parent.tsrx',
					new Set(['value-child']),
					undefined,
					composeRegistryOf(childEntry),
				)
			: compileComponentTsx(
					source,
					'examples/parent/basic-parent.tsx',
					new Set(['value-child']),
					undefined,
					new Map([[childEntry.source, childEntry]]),
				)

	test('a reactive @if arm root plans its entries in the arm mount, querying nothing from the host, on both surfaces', () => {
		const childComponent = compileValueChild()
		for (const surface of ['tsrx', 'tsx'] as const) {
			const { component, diagnostics } = compileParent(
				surface === 'tsrx' ? IF_PARENT_TSRX : IF_PARENT_TSX,
				surface === 'tsrx' ? childComponent.entry : compileValueChildTsxEntry(),
				surface,
			)
			expect(diagnostics).toEqual([])
			if (!component) throw new Error('parent must compile')
			// The arm root IS the child's element: the mount casts the arm
			// element parameter and passes against it — no host query.
			expect(component.clientCode).toContain(
				"const valueChild = armElement as ElementFromSelector<'value-child'>",
			)
			expect(component.clientCode).toContain(
				"pass(valueChild, { value: { get: () => 'from-a' } })",
			)
			expect(component.clientCode).toContain(
				"pass(valueChild2, { value: { get: () => 'from-b' } })",
			)
			expect(component.clientCode).not.toContain('first("value-child')
		}
	})

	test('the passed value binds on the adopted arm and again on a cloned arm after a flip', async () => {
		const childComponent = compileValueChild()
		const { component, diagnostics } = compileParent(
			IF_PARENT_TSRX,
			childComponent.entry,
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('parent must compile')
		ensureEmitted('value-child', childComponent.serverCode)
		ensureEmitted('basic-parent', component.serverCode)
		const mod = await generated.importModule('basic-parent.server.ts')
		const markup = (
			mod as { renderBasicParent: (args: Record<string, unknown>) => string }
		).renderBasicParent({})
		// The server folds the initial winner: the adopted arm renders the
		// child live, keyed; the other arm sits in its inert template.
		expect(markup).toContain('<value-child')
		expect(markup).toContain('data-key="then"')

		const { pathToFileURL } = await import('node:url')
		const { createSimulationRealm } = await import('../../compiler/sim/realm')
		const settle = async () => {
			for (let i = 0; i < 20; i++) await Promise.resolve()
		}
		const childPath = generated.emit(
			'lt481-value-child.client.ts',
			childComponent.clientCode,
		)
		const parentPath = generated.emit(
			'lt481-basic-parent.client.ts',
			component.clientCode,
		)
		const realm = createSimulationRealm()
		try {
			await realm.load(() => import(pathToFileURL(childPath).href))
			await realm.load(() => import(pathToFileURL(parentPath).href))
			const { html } = await realm.render({ markup, component: 'basic-parent' })
			expect(html).toContain('<value-child')
			const child = () =>
				realm.document.querySelector('value-child') as HTMLElement
			const host = () =>
				realm.document.querySelector('basic-parent') as HTMLElement & {
					mode: string
				}
			await settle()
			// The adopted arm: the pass swapped the signal into the child's
			// slot at its mount.
			expect(child().textContent).toBe('from-a')
			// The flip clones the other arm, inserts it, THEN mounts it —
			// the pass meets an upgraded child and binds again.
			host().mode = 'b'
			await settle()
			expect(child().textContent).toBe('from-b')
		} finally {
			realm.dispose()
		}
	})

	test('an async boundary plans the pending and catch compose roots in their branches, on both surfaces', () => {
		const childComponent = compileValueChild()
		for (const surface of ['tsrx', 'tsx'] as const) {
			const { component, diagnostics } = compileParent(
				surface === 'tsrx' ? BOUNDARY_PARENT_TSRX : BOUNDARY_PARENT_TSX,
				surface === 'tsrx' ? childComponent.entry : compileValueChildTsxEntry(),
				surface,
			)
			expect(diagnostics).toEqual([])
			if (!component) throw new Error('parent must compile')
			// The nil arm gains a mount branch with the pass; the err arm's
			// branch emits the root local and the pass beside its err watch
			// channel (absent here — no catch-parameter read).
			expect(component.clientCode).toContain(`} else if (armKey === 'nil') {`)
			expect(component.clientCode).toContain(
				"pass(valueChild, { value: { get: () => 'loading' } })",
			)
			expect(component.clientCode).toContain(`} else if (armKey === 'err') {`)
			expect(component.clientCode).toContain(
				"pass(valueChild2, { value: { get: () => 'failed' } })",
			)
			expect(component.clientCode).not.toContain('first("value-child')
		}
	})

	test('a `first()` on a compose arm root is refused on both surfaces', () => {
		const childComponent = compileValueChild()
		const REFUSAL_TSRX = `import { createCell } from '@zeix/le-truc'
import { ValueChild } from '../child/value-child.tsrx'

export function BasicParent({}: {})
	@{
		const mode = createCell('a')
		const child = first('value-child')
		expose({ mode })
			<basic-parent>
				@if (mode.get() === 'a') {
					<ValueChild truc:pass={{ value: () => 'x' }} />
				} @else {
					<p class="empty">empty</p>
				}
			</basic-parent>
	}`
		const REFUSAL_TSX = `import { createCell } from '@zeix/le-truc'
import { ValueChild } from '../child/value-child.tsx'

export function BasicParent({}: {}) {
	const mode = createCell('a')
	const child = first('value-child')
	expose({ mode })
	return <basic-parent>
		{mode.get() === 'a' ? (
			<ValueChild truc:pass={{ value: () => 'x' }} />
		) : (
			<p class="empty">empty</p>
		)}
	</basic-parent>
}`
		for (const surface of ['tsrx', 'tsx'] as const) {
			const { diagnostics } = compileParent(
				surface === 'tsrx' ? REFUSAL_TSRX : REFUSAL_TSX,
				surface === 'tsrx' ? childComponent.entry : compileValueChildTsxEntry(),
				surface,
			)
			const hits = diagnostics.filter(
				d =>
					d.severity === 'error' &&
					d.message.includes(
						'`first()` reference to <value-child> as the root of an arm',
					),
			)
			expect(hits).toHaveLength(1)
		}
	})
})

describe('a pass entry on a boundary compose root in a list item refuses setup-const reads (LT-483)', () => {
	// The pending/err compose roots' pass entries rode `badFreeNames`, the
	// host-level rule, where the ok arm's constructs now read
	// `fx.scopeBadNames` (LT-483): inside a reactive-list item the entry is
	// LTC005's list-body face, like a pass on a composed child anywhere else
	// in an item. The probe compiled clean BEFORE the alignment — the const
	// was emitted and worked — so the point is the uniform authoring rule.
	const valueChild = `export function ValueChild({}: {})
	@{
		expose({ value: '' })
			<value-child>{host.value}
				<style>@scope {
	:scope {
		  display: block;
		}
	}</style>
			</value-child>
	}`
	const valueChildTsx = `export function ValueChild({}: {}) {
	expose({ value: '' })
	return <value-child>{host.value}</value-child>
}`
	const compileValueChild = () => {
		const { component, diagnostics } = compileComponent(
			valueChild,
			'examples/child/value-child.tsrx',
			new Set(['value-child']),
		)
		if (!component)
			throw new Error(`child must compile: ${JSON.stringify(diagnostics)}`)
		return component
	}
	const compileValueChildTsxEntry = (): InternalRegistryEntry => {
		const { component, diagnostics } = compileComponentTsx(
			valueChildTsx,
			'examples/child/value-child.tsx',
			new Set(['value-child']),
		)
		if (!component)
			throw new Error(`child must compile: ${JSON.stringify(diagnostics)}`)
		return component.entry
	}

	const ITEM_PARENT_TSRX = `import { createList, deriveCell } from '@zeix/le-truc'
import { ValueChild } from '../child/value-child.tsrx'

export function BasicParent({}: {})
	@{
		const items = createList<string>(['a'], { keyConfig: s => s })
		const data = deriveCell(async () => 'x')
		const label = 'loading'
		expose({})
			<basic-parent>
				<ul class="list">
					@for (const item of items) {
						<li>
							@try {
								<b class="value">{data}</b>
							} @pending {
								<ValueChild truc:pass={{ value: () => label }} />
							} @catch (e) {
								<i class="error">{e.message}</i>
							}
						</li>
					}
				</ul>
			</basic-parent>
	}`
	const ITEM_PARENT_TSX = `import { createList, deriveCell } from '@zeix/le-truc'
import { ValueChild } from '../child/value-child.tsx'

export function BasicParent({}: {}) {
	const items = createList<string>(['a'], { keyConfig: s => s })
	const data = deriveCell(async () => 'x')
	const label = 'loading'
	expose({})
	return <basic-parent>
		<ul class="list">
			{items.map(item => (
				<li><truc:try
					pending={<ValueChild truc:pass={{ value: () => label }} />}
					catch={e => <i class="error">{e.message}</i>}><b class="value">{data}</b></truc:try></li>
			))}
		</ul>
	</basic-parent>
}`

	test('a pending compose root’s pass entry reading a setup const is LTC005, on both surfaces', () => {
		const childComponent = compileValueChild()
		for (const surface of ['tsrx', 'tsx'] as const) {
			const { component, diagnostics } =
				surface === 'tsrx'
					? compileComponent(
							ITEM_PARENT_TSRX,
							'examples/parent/basic-parent.tsrx',
							new Set(['value-child']),
							undefined,
							composeRegistryOf(childComponent.entry),
						)
					: compileComponentTsx(
							ITEM_PARENT_TSX,
							'examples/parent/basic-parent.tsx',
							new Set(['value-child']),
							undefined,
							new Map([
								[
									compileValueChildTsxEntry().source,
									compileValueChildTsxEntry(),
								],
							]),
						)
			expect(component).toBeNull()
			expect(diagnostics.map(d => d.code)).toEqual(['LTC005'])
			expect(diagnostics[0]?.message).toContain(
				'Pass entry `value` references `label`, which a list body cannot read',
			)
		}
	})
})
