/**
 * The Children Region (ADR 0048 s1, LT-472): content a parent passes as
 * `children` is the parent's markup. The server marks the child's element
 * enclosing `{children}` with `data-children="<owner-tag>"`, and the
 * structural verifier counts the region as the parent's, so a parent's
 * `first()` into its own content resolves — on both surfaces — through a
 * query that excludes the child's own markup and re-includes the region.
 * Since LT-512 the exclusion needs no `data-children` marker where the
 * child's own markup cannot match: the reference ships as authored.
 * A `truc:html` attribute on a content element is the parent's own
 * sanitized binding (LT-492): the data-reference form splices
 * server-side, the reactive thunk plans as a host watch against the
 * region — and only where the host walk reaches the site.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import createDOMPurify, { type WindowLike } from 'dompurify'
import { JSDOM } from 'jsdom'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import type { InternalRegistryEntry } from '../../compiler/registry'
import { configureHtmlSanitizer } from '../../compiler/runtime'
import { createGeneratedDir } from '../helpers/generated-corpus'

const generated = createGeneratedDir('children-region')
afterAll(() => generated.cleanup())

/* === Helpers === */

type Compiled = ReturnType<typeof compileComponent>

const STYLE_TSRX = `<style>@scope {
	:scope {
		  display: block;
		}
}</style>`
const STYLE_TSX = `<style>{css\`@scope {
	:scope {
		  display: block;
		}
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

const registryOf = (...entries: InternalRegistryEntry[]) =>
	new Map(entries.map(entry => [entry.source, entry]))

const compile = (
	surface: 'tsrx' | 'tsx',
	source: string,
	path: string,
	registry: Map<string, InternalRegistryEntry> = new Map(),
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
		test(`${surface}: a reference into content whose child cannot match ships the authored selector, and the server marks the region (LT-512)`, async () => {
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
			// child-pre renders only `child-pre`, `pre` and `code` — no clash
			// for `span.x`, so the query ships as authored, no marker needed.
			expect(parent.clientCode).toContain(`first('span.x', 'the marked span')`)
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
			// The shipped query reaches exactly the passed content.
			const host = new JSDOM(html).window.document.querySelector(
				'basic-parent',
			) as Element
			expect(host.querySelector('span.x')?.textContent).toBe('hi')
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

	test(`a reference whose child's own markup can match keeps the region-aware exclusion`, async () => {
		// ChildSplit's own `<p class="intro">` can match a bare `p`, so the
		// query must exclude the child's template and re-include the region
		// (LT-512: the element case is unchanged) — the content `p` still
		// resolves, the intro `p` stays out.
		for (const surface of SURFACES) {
			const split = mustCompile(
				compile(
					surface,
					(surface === 'tsrx' ? tsrx : tsx)(
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
				surface,
				(surface === 'tsrx' ? tsrx : tsx)(
					IMPORT(surface, 'ChildSplit', 'child/child-split'),
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
			const parent = mustCompile(compiled, 'basic-parent')
			const query = `p${REGION('basic-parent', 'child-split')}`
			expect(parent.clientCode).toContain(`first('${query}', 'the paragraph')`)
			const html = await render(
				[
					['child-split', split.serverCode],
					['basic-parent', parent.serverCode],
				],
				'basic-parent',
				'BasicParent',
			)
			const host = new JSDOM(html).window.document.querySelector(
				'basic-parent',
			) as Element
			const hits = [...host.querySelectorAll(query)]
			expect(hits.map(el => el.textContent)).toEqual(['hi'])
		}
	})
})

/* === The template proper beside compose content === */

describe('a reference in the template proper beside compose content (LT-512)', () => {
	for (const surface of SURFACES)
		test(`${surface}: the child's exclusion is kept even where its own markup cannot match`, async () => {
			// The plain probe never sees compose content, so the `children`
			// shape keeps child-pre excluded even though its own markup
			// (`child-pre`, `pre`, `code`) cannot match the selector: an
			// element the parent passes that DID match would otherwise bind
			// first (the client's querySelector takes the first match in
			// document order).
			const child = childPre(surface)
			const parentSource = (surface === 'tsrx' ? tsrx : tsx)(
				IMPORT(surface, 'ChildPre', 'child/child-pre'),
				'BasicParent',
				'basic-parent',
				`const slot = first('button[data-slot="outer"]', 'the outer button')
		expose({})
		watch(() => true, () => { slot.title = 'outer' })`,
				`<ChildPre><button type="button" class="overlay">in</button></ChildPre>
				<button type="button" class="overlay" data-slot="outer">out</button>`,
				'{}: {}',
			)
			const compiled = compile(
				surface,
				parentSource,
				'examples/parent/basic-parent',
				registryOf(child.entry),
			)
			expect(compiled.diagnostics).toEqual([])
			const parent = mustCompile(compiled, 'basic-parent')
			expect(parent.clientCode).toContain(
				`first('button[data-slot="outer"]:not(child-pre *)', 'the outer button')`,
			)
			const html = await render(
				[
					['child-pre', child.serverCode],
					['basic-parent', parent.serverCode],
				],
				'basic-parent',
				'BasicParent',
			)
			const host = new JSDOM(html).window.document.querySelector(
				'basic-parent',
			) as Element
			expect(
				host.querySelector('button[data-slot="outer"]:not(child-pre *)')
					?.textContent,
			).toBe('out')
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
		// No shape of either forwarder's own markup matches a `span.*`, so
		// both queries ship as authored (LT-512) — the marker never enters
		// the client.
		expect(parent.clientCode).toContain(`first('span.a', 'the forwarded span')`)
		expect(parent.clientCode).toContain(`first('span.b', 'the wrapped span')`)
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
		// The shipped queries, run against the served DOM, reach exactly the
		// parent's content — through a forwarder and through a wrapper.
		const host = new JSDOM(html).window.document.querySelector(
			'basic-parent',
		) as Element
		for (const [cls, text] of [
			['a', 'a'],
			['b', 'b'],
		] as const) {
			const hits = [...host.querySelectorAll(`span.${cls}`)]
			expect(hits.map(el => el.textContent)).toEqual([text])
		}
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

/* === The parent's own sanitized binding (ADR 0048 s1, LT-492) === */

describe('a `truc:html` attribute in the content (LT-492)', () => {
	// `configureHtmlSanitizer` is process-wide and shared with the library's
	// client half (LT-138): a test that configures one restores the
	// fail-closed default (escape everything) before the next.
	const purify = createDOMPurify(new JSDOM('').window as unknown as WindowLike)
	const stripDangerousMarkup = (html: string): string => purify.sanitize(html)

	for (const surface of SURFACES)
		test(`${surface}: a static arg renders sanitized into the children string`, async () => {
			const child = childPre(surface)
			const compiled = compile(
				surface,
				(surface === 'tsrx' ? tsrx : tsx)(
					IMPORT(surface, 'ChildPre', 'child/child-pre'),
					'BasicParent',
					'basic-parent',
					'expose({})',
					'<ChildPre><div truc:html={start} /></ChildPre>',
					'{ start }: { start?: string }',
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
				{ start: '<p>Rich <em>content</em></p>' },
			)
			// Unconfigured, the sanitizer's fail-closed default escapes the
			// markup — the same single channel the template proper uses.
			expect(html).toContain(
				'<code data-children="basic-parent"><div>&lt;p&gt;Rich &lt;em&gt;content&lt;/em&gt;&lt;/p&gt;</div></code>',
			)
		})

	test('a configured sanitizer strips a script from the content markup', async () => {
		configureHtmlSanitizer(stripDangerousMarkup)
		try {
			const child = childPre('tsrx')
			const compiled = compile(
				'tsrx',
				tsrx(
					IMPORT('tsrx', 'ChildPre', 'child/child-pre'),
					'BasicParent',
					'basic-parent',
					'expose({})',
					'<ChildPre><div truc:html={start} /></ChildPre>',
					'{ start }: { start?: string }',
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
				{
					start: '<p onclick="steal()">hi</p><script>alert(1)</script>',
				},
			)
			expect(html).toContain(
				'<code data-children="basic-parent"><div><p>hi</p></div></code>',
			)
		} finally {
			configureHtmlSanitizer(undefined)
		}
	})

	for (const surface of SURFACES)
		test(`${surface}: a reactive thunk plans a host watch against the region`, async () => {
			const child = childPre(surface)
			const compiled = compile(
				surface,
				(surface === 'tsrx' ? tsrx : tsx)(
					`import { createState } from '@zeix/le-truc'\n${IMPORT(surface, 'ChildPre', 'child/child-pre')}`,
					'BasicParent',
					'basic-parent',
					`const body = createState('<b>seed</b>')
		expose({})`,
					'<ChildPre><article class="pane" truc:html={() => body.get()} /></ChildPre>',
					'{}: {}',
				),
				'examples/parent/basic-parent',
				registryOf(child.entry),
			)
			expect(compiled.diagnostics).toEqual([])
			const parent = mustCompile(compiled, 'basic-parent')
			// The watch addresses the content element through the same
			// sanitized sink the template proper uses (LT-025), under the
			// tag-derived query name an unreferenced element gets.
			expect(parent.clientCode).toContain(
				'watch(() => body.get(), dangerouslyBindInnerHTML(article, { sanitize: sanitizeHtml }))',
			)
			// The value harness renders the seed server-side, escaped — both
			// halves share one sanitizer configuration (LT-138).
			const html = await render(
				[
					['child-pre', child.serverCode],
					['basic-parent', parent.serverCode],
				],
				'basic-parent',
				'BasicParent',
			)
			expect(html).toContain(
				'<article class="pane">&lt;b&gt;seed&lt;/b&gt;</article>',
			)
		})

	test('the static arg stays legal in scopes the host walk does not reach', async () => {
		// The data-reference form needs no client half, so a server-rendered
		// branch folds it like any server expression — only the REACTIVE
		// thunk is scope-refused below.
		const child = childPre('tsrx')
		const compiled = compile(
			'tsrx',
			tsrx(
				IMPORT('tsrx', 'ChildPre', 'child/child-pre'),
				'BasicParent',
				'basic-parent',
				'expose({})',
				`@if (open) {
					<ChildPre><div truc:html={start} /></ChildPre>
				}`,
				'{ open, start }: { open?: boolean; start?: string }',
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
			{ open: true, start: '<p>Rich</p>' },
		)
		expect(html).toContain('<div>&lt;p&gt;Rich&lt;/p&gt;</div>')
	})

	// The host walk plans content constructs only at a host-direct compose
	// site; anywhere else the reactive thunk would be a silently inert watch,
	// so the whole-template placement check refuses it. Shared walk code —
	// the `.tsrx` spelling carries the matrix.
	for (const [, setup, body, params, enclosure] of [
		[
			'an arm',
			`const open = createCell(true)
		const body = createState('<b>seed</b>')
		expose({})`,
			`@if (open.get()) {
			<ChildPre><article truc:html={() => body.get()} /></ChildPre>
		} @else {
			<p class="none">none</p>
		}`,
			'{}: {}',
			'inside an arm',
		],
		[
			'a reactive-list item',
			`const items = createList<string>(['a'], { keyConfig: s => s })
		const body = createState('<b>seed</b>')
		expose({})`,
			`<ul class="list">
			@for (const item of items; key k) {
				<li><ChildPre><article truc:html={() => body.get()} /></ChildPre></li>
			}
		</ul>`,
			'{}: {}',
			'inside a reactive-list loop body',
		],
		[
			'a server-data loop body',
			"const body = createState('<b>seed</b>')\n\t\texpose({})",
			`<ul class="list">
			@for (const row of rows) {
				<li><ChildPre><article truc:html={() => body.get()} /></ChildPre></li>
			}
		</ul>`,
			'{ rows }: { rows?: string[] }',
			'inside a server-data loop body',
		],
		[
			'a server-rendered branch',
			"const body = createState('<b>seed</b>')\n\t\texpose({})",
			`@if (open) {
			<ChildPre><article truc:html={() => body.get()} /></ChildPre>
		}`,
			'{ open }: { open?: boolean }',
			'inside a server-rendered branch',
		],
	] as const)
		test(`a reactive thunk in composed content ${enclosure} is refused`, () => {
			const child = childPre('tsrx')
			const compiled = compile(
				'tsrx',
				tsrx(
					`import { createCell, createList, createState } from '@zeix/le-truc'\n${IMPORT('tsrx', 'ChildPre', 'child/child-pre')}`,
					'BasicParent',
					'basic-parent',
					setup,
					body,
					params,
				),
				'examples/parent/basic-parent',
				registryOf(child.entry),
			)
			expect(compiled.component).toBeNull()
			const hit = compiled.diagnostics.find(
				d =>
					d.code === 'LTC005' &&
					d.message.includes('`truc:html`') &&
					d.message.includes(enclosure),
			)
			expect(hit).toBeDefined()
		})
})

/* === The args annotation's type import (LT-479) === */

describe('a `Children<…>` args annotation re-imports its type (LT-479)', () => {
	for (const surface of SURFACES)
		test(`${surface}: the emitted server module imports Children from the runtime package`, () => {
			const params = `{ children = '' }: { children?: Children<{}, 'non-interactive'> }`
			const child = mustCompile(
				compile(
					surface,
					(surface === 'tsrx' ? tsrx : tsx)(
						"import type { Children } from '@zeix/le-truc'",
						'ChildLabel',
						'child-label',
						'expose({})',
						'<span class="label">{children}</span>',
						params,
					),
					'examples/child/child-label',
				),
				'child-label',
			)
			expect(child.serverCode).toContain(
				`import type { Children } from '@zeix/le-truc'`,
			)
			// A plain-string children arg imports nothing.
			const plain = mustCompile(
				compile(
					surface,
					(surface === 'tsrx' ? tsrx : tsx)(
						'',
						'ChildPlain',
						'child-plain',
						'expose({})',
						'<span class="label">{children}</span>',
					),
					'examples/child/child-plain',
				),
				'child-plain',
			)
			expect(plain.serverCode).not.toContain(`from '@zeix/le-truc'`)
		})
})
