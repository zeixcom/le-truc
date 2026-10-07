/**
 * The Children Region (ADR 0048 s1, LT-472): content a parent passes as
 * `children` is the parent's markup. The server marks the child's element
 * enclosing `{children}` with `data-children="<owner-tag>"`, and the
 * structural verifier counts the region as the parent's, so a parent's
 * `first()` into its own content resolves — on both surfaces — through a
 * query that excludes the child's template and re-includes the region.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { JSDOM } from 'jsdom'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import type { RegistryEntry } from '../../compiler/registry'
import { createGeneratedDir } from '../helpers/generated-corpus'

const generated = createGeneratedDir('children-region')
afterAll(() => generated.cleanup())

/* === Helpers === */

type Compiled = ReturnType<typeof compileComponent>

const STYLE_TSRX = `<style>:host {
	  display: block;
	}</style>`
const STYLE_TSX = `<style>{css\`:host {
	  display: block;
	}\`}</style>`

/** A `.tsrx` component around `body`. */
const tsrx = (
	imports: string,
	name: string,
	tag: string,
	setup: string,
	body: string,
	params = '{ children }: { children?: string }',
): string => `${imports}
export function ${name}(${params})
	@{
		${setup}
			<${tag}>${body}
				${STYLE_TSRX}
			</${tag}>
	}
`

/** The same component on the `.tsx` surface, typed factory context. */
const tsx = (
	imports: string,
	name: string,
	tag: string,
	setup: string,
	body: string,
	params = '{ children }: { children?: string }',
): string => `${imports}
import { css } from '@zeix/le-truc-compiler/macros'
import type { FactoryContext } from '@zeix/le-truc'

export function ${name}(${params}, { expose, first, watch }: FactoryContext<Record<never, never>>) {
	${setup}
	return (
		<${tag}>${body}
			${STYLE_TSX}
		</${tag}>
	)
}
`

const registryOf = (...entries: RegistryEntry[]) =>
	new Map(entries.map(entry => [entry.source, entry]))

const compile = (
	surface: 'tsrx' | 'tsx',
	source: string,
	path: string,
	registry: Map<string, RegistryEntry> = new Map(),
): Compiled => {
	const result =
		surface === 'tsrx'
			? compileComponent(source, `${path}.tsrx`, new Set(), undefined, registry)
			: compileComponentTsx(
					source,
					`${path}.tsx`,
					new Set(),
					undefined,
					registry,
				)
	return result
}

const mustCompile = (
	compiled: Compiled,
	what: string,
): NonNullable<Compiled['component']> => {
	if (!compiled.component)
		throw new Error(
			`${what} must compile: ${JSON.stringify(compiled.diagnostics)}`,
		)
	return compiled.component
}

/** Emit each module and render `tag` through its generated server module. */
const render = async (
	modules: Array<[string, string]>,
	tag: string,
	name: string,
	args: Record<string, unknown> = {},
	owner?: string,
): Promise<string> => {
	for (const [moduleTag, code] of modules)
		generated.emit(`${moduleTag}.server.ts`, code)
	const mod = (await generated.importModule(`${tag}.server.ts`)) as Record<
		string,
		(args: Record<string, unknown>, owner?: string) => string
	>
	return (mod[`render${name}`] as (a: unknown, o?: string) => string)(
		args,
		owner,
	)
}

const SURFACES = ['tsrx', 'tsx'] as const
const IMPORT = (surface: string, name: string, path: string) =>
	`import { ${name} } from '../${path}.${surface}'`

/** `<pre><code>{children}</code></pre>` — the region is the `code`. */
const childPre = (surface: 'tsrx' | 'tsx') =>
	mustCompile(
		compile(
			surface,
			(surface === 'tsrx' ? tsrx : tsx)(
				'',
				'ChildPre',
				'child-pre',
				'expose({})',
				'<pre><code>{children}</code></pre>',
			),
			'examples/child/child-pre',
		),
		'child-pre',
	)

/** The runtime exclusion: every composed child's template, minus the owner's regions. */
const REGION = (owner: string, ...children: string[]) => {
	const at = (prefix: string) =>
		children.map(child => `${prefix}${child} *`).join(', ')
	const region = `[data-children="${owner}"]`
	return `:not(:is(${at('')}):not(:is(${region} *):not(:is(${at(`${region} `)}))))`
}

/* === The region marker and the parent's reference === */

describe('a parent reference into its own children (ADR 0048 s1)', () => {
	for (const surface of SURFACES)
		test(`${surface}: \`first('span.x')\` into content inserted at <code> resolves, and the server marks the region`, async () => {
			const child = childPre(surface)
			expect(child.entry.childrenRegion).toEqual({
				shapes: [],
				forwards: [],
				unmarked: false,
			})
			const parentSource = (surface === 'tsrx' ? tsrx : tsx)(
				IMPORT(surface, 'ChildPre', 'child/child-pre'),
				'BasicParent',
				'basic-parent',
				`const mark = first('span.x', 'the marked span')
		expose({})
		watch(() => true, () => { mark.title = 'marked' })`,
				'<ChildPre><span class="x">hi</span></ChildPre>',
				'{}: {}',
			)
			const compiled = compile(
				surface,
				parentSource,
				'examples/parent/basic-parent',
				registryOf(child.entry),
			)
			// LTC026 no longer fires: the content is the parent's markup.
			expect(compiled.diagnostics).toEqual([])
			const parent = mustCompile(compiled, 'basic-parent')
			expect(parent.clientCode).toContain(
				`first('span.x${REGION('basic-parent', 'child-pre')}', 'the marked span')`,
			)
			expect(parent.serverCode).toContain(
				'renderChildPre({ children: __children1.join(\'\') }, "basic-parent")',
			)
			const html = await render(
				[
					['child-pre', child.serverCode],
					['basic-parent', parent.serverCode],
				],
				'basic-parent',
				'BasicParent',
			)
			expect(html).toContain(
				'<child-pre><pre><code data-children="basic-parent"><span class="x">hi</span></code></pre></child-pre>',
			)
		})

	test('a page-rendered instance has no compiled owner and carries no marker', async () => {
		const child = childPre('tsrx')
		const html = await render(
			[['child-pre', child.serverCode]],
			'child-pre',
			'ChildPre',
			{ children: '<span>page</span>' },
		)
		expect(html).toBe(
			'<child-pre><pre><code><span>page</span></code></pre></child-pre>',
		)
	})

	test("a candidate the child's own markup in the region could match is dropped", () => {
		// The child's root encloses the insertion, so its own <p> shares the
		// parent's region: a bare `p` would re-include it.
		const note = mustCompile(
			compile(
				'tsrx',
				tsrx(
					'',
					'ChildNote',
					'child-note',
					'expose({})',
					'<p class="note">note</p>{children}',
				),
				'examples/child/child-note',
			),
			'child-note',
		)
		expect(note.entry.childrenRegion?.shapes).toEqual([
			{ kind: 'element', tag: 'p', attrs: { class: 'note' }, dynamic: [] },
		])
		const compiled = compile(
			'tsrx',
			tsrx(
				IMPORT('tsrx', 'ChildNote', 'child/child-note'),
				'BasicParent',
				'basic-parent',
				`const para = first('p', 'the paragraph')
		expose({})
		watch(() => true, () => { para.title = 'x' })`,
				'<ChildNote><p>hi</p></ChildNote>',
				'{}: {}',
			),
			'examples/parent/basic-parent',
			registryOf(note.entry),
		)
		expect(compiled.diagnostics.map(d => d.code)).toEqual(['LTC007'])
	})

	test("the child's markup outside the region does not block the re-include", () => {
		const split = mustCompile(
			compile(
				'tsrx',
				tsrx(
					'',
					'ChildSplit',
					'child-split',
					'expose({})',
					'<p class="intro">intro</p><div>{children}</div>',
				),
				'examples/child/child-split',
			),
			'child-split',
		)
		const compiled = compile(
			'tsrx',
			tsrx(
				IMPORT('tsrx', 'ChildSplit', 'child/child-split'),
				'BasicParent',
				'basic-parent',
				`const para = first('p', 'the paragraph')
		expose({})
		watch(() => true, () => { para.title = 'x' })`,
				'<ChildSplit><p>hi</p></ChildSplit>',
				'{}: {}',
			),
			'examples/parent/basic-parent',
			registryOf(split.entry),
		)
		expect(compiled.diagnostics).toEqual([])
		expect(mustCompile(compiled, 'basic-parent').clientCode).toContain(
			`first('p${REGION('basic-parent', 'child-split')}', 'the paragraph')`,
		)
	})
})

/* === Forwarding === */

describe('forwarded children keep their owner (ADR 0048 s1)', () => {
	test('straight through, the original owner rides along; wrapped first, the regions nest', async () => {
		const child = childPre('tsrx')
		const bare = mustCompile(
			compile(
				'tsrx',
				tsrx(
					IMPORT('tsrx', 'ChildPre', 'child/child-pre'),
					'FwdBare',
					'fwd-bare',
					'expose({})',
					'<ChildPre>{children}</ChildPre>',
				),
				'examples/fwd/fwd-bare',
				registryOf(child.entry),
			),
			'fwd-bare',
		)
		const wrap = mustCompile(
			compile(
				'tsrx',
				tsrx(
					IMPORT('tsrx', 'ChildPre', 'child/child-pre'),
					'FwdWrap',
					'fwd-wrap',
					'expose({})',
					'<ChildPre><div class="frame">{children}</div></ChildPre>',
				),
				'examples/fwd/fwd-wrap',
				registryOf(child.entry),
			),
			'fwd-wrap',
		)
		// The forwarder passes its own owner on; the wrapper owns the
		// child's region and marks its `div` with the original owner.
		expect(bare.serverCode).toContain(
			"renderChildPre({ children: __children1.join('') }, __owner)",
		)
		expect(bare.entry.childrenRegion?.forwards).toEqual([
			'examples/child/child-pre.tsrx',
		])
		expect(wrap.serverCode).toContain(
			'renderChildPre({ children: __children1.join(\'\') }, "fwd-wrap")',
		)
		const compiled = compile(
			'tsrx',
			tsrx(
				`${IMPORT('tsrx', 'FwdBare', 'fwd/fwd-bare')}\n${IMPORT('tsrx', 'FwdWrap', 'fwd/fwd-wrap')}`,
				'BasicParent',
				'basic-parent',
				`const a = first('span.a', 'the forwarded span')
		const b = first('span.b', 'the wrapped span')
		expose({})
		watch(() => true, () => { a.title = 'a'; b.title = 'b' })`,
				'<FwdBare><span class="a">a</span></FwdBare><FwdWrap><span class="b">b</span></FwdWrap>',
				'{}: {}',
			),
			'examples/parent/basic-parent',
			registryOf(child.entry, bare.entry, wrap.entry),
		)
		expect(compiled.diagnostics).toEqual([])
		const parent = mustCompile(compiled, 'basic-parent')
		expect(parent.clientCode).toContain(
			`span.a${REGION('basic-parent', 'fwd-bare', 'fwd-wrap')}`,
		)
		expect(parent.clientCode).toContain(
			`span.b${REGION('basic-parent', 'fwd-bare', 'fwd-wrap')}`,
		)
		const html = await render(
			[
				['child-pre', child.serverCode],
				['fwd-bare', bare.serverCode],
				['fwd-wrap', wrap.serverCode],
				['basic-parent', parent.serverCode],
			],
			'basic-parent',
			'BasicParent',
		)
		expect(html).toContain(
			'<fwd-bare><child-pre><pre><code data-children="basic-parent"><span class="a">a</span></code></pre></child-pre></fwd-bare>',
		)
		expect(html).toContain(
			'<fwd-wrap><child-pre><pre><code data-children="fwd-wrap"><div data-children="basic-parent" class="frame"><span class="b">b</span></div></code></pre></child-pre></fwd-wrap>',
		)
		// The emitted queries, run against the served DOM, reach exactly the
		// parent's content — through a forwarder and through a wrapper.
		const host = new JSDOM(html).window.document.querySelector(
			'basic-parent',
		) as Element
		for (const [cls, text] of [
			['a', 'a'],
			['b', 'b'],
		] as const) {
			const query = `span.${cls}${REGION('basic-parent', 'fwd-bare', 'fwd-wrap')}`
			const hits = [...host.querySelectorAll(query)]
			expect(hits.map(el => el.textContent)).toEqual([text])
		}
		// The child's own template stays excluded.
		expect(
			host.querySelectorAll(
				`pre${REGION('basic-parent', 'fwd-bare', 'fwd-wrap')}`,
			),
		).toHaveLength(0)
	})
})

/* === Extracted templates === */

describe('extracted arm and list templates carry the marker (ADR 0048 s1)', () => {
	test('an arm-held compose site: the live arm and its template', async () => {
		const child = childPre('tsrx')
		const compiled = compile(
			'tsrx',
			tsrx(
				`import { createCell } from '@zeix/le-truc'\n${IMPORT('tsrx', 'ChildPre', 'child/child-pre')}`,
				'BasicParent',
				'basic-parent',
				`const open = createCell(true)
		expose({ open })`,
				`
				@if (open.get()) {
					<ChildPre class="shown"><span class="x">hi</span></ChildPre>
				} @else {
					<p class="none">none</p>
				}`,
				'{}: {}',
			),
			'examples/parent/basic-parent',
			registryOf(child.entry),
		)
		expect(compiled.diagnostics).toEqual([])
		const parent = mustCompile(compiled, 'basic-parent')
		const html = await render(
			[
				['child-pre', child.serverCode],
				['basic-parent', parent.serverCode],
			],
			'basic-parent',
			'BasicParent',
		)
		const region =
			'<code data-children="basic-parent"><span class="x">hi</span></code>'
		// Once live, once in the `then` arm's template.
		expect(html.split(region)).toHaveLength(3)
		expect(html).toContain(
			`<template data-arms="0" data-key="then"><child-pre class="shown"><pre>${region}`,
		)
	})

	test('a list-item compose site: the extracted item template', async () => {
		const child = childPre('tsrx')
		const compiled = compile(
			'tsrx',
			tsrx(
				`import { createList } from '@zeix/le-truc'\n${IMPORT('tsrx', 'ChildPre', 'child/child-pre')}`,
				'BasicParent',
				'basic-parent',
				`const items = createList<string>(['a'], { keyConfig: s => s })
		expose({ items: () => items.get().join(',') })`,
				`
				<ul class="list">
					@for (const item of items; key k) {
						<li><ChildPre><span class="x">x</span></ChildPre></li>
					}
				</ul>`,
				'{}: {}',
			),
			'examples/parent/basic-parent',
			registryOf(child.entry),
		)
		expect(compiled.diagnostics).toEqual([])
		const parent = mustCompile(compiled, 'basic-parent')
		const html = await render(
			[
				['child-pre', child.serverCode],
				['basic-parent', parent.serverCode],
			],
			'basic-parent',
			'BasicParent',
		)
		expect(html).toContain(
			'<template data-list="0"><li><child-pre><pre><code data-children="basic-parent"><span class="x">x</span></code></pre></child-pre></li></template>',
		)
	})
})
