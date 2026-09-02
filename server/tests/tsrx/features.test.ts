/**
 * Language-feature tests (tsrx.dev/features parity): every construct the
 * pinned @tsrx/core 0.1.63 can parse must lower deliberately — supported or
 * gated with a diagnostic — never silently dropped. Covers @switch arms,
 * @try error boundaries, @pending async boundaries (gated), truc:html={expr}
 * dynamic rendering, and parse-error hints for the newer-grammar constructs
 * (statement-form switch, {html}/{text}/{ref} keywords, await).
 */
import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import sanitizeHtml from 'sanitize-html'
import { compileComponent } from '../../tsrx'
import { configureHtmlSanitizer } from '../../tsrx/runtime'
import { createGeneratedDir } from '../helpers/generated-tsrx'

// The runtime's default sanitizer (unconfigured state): escape everything,
// safe but inert. Tests that configure a permissive/stripping sanitizer to
// exercise `truc:html={expr}` must restore this afterward — `configureHtmlSanitizer`
// is process-wide, shared across every generated module.
const escapeAll = (html: string): string =>
	html.replace(/</g, '&lt;').replace(/>/g, '&gt;')

// A stand-in "consumer-supplied" sanitizer (what a host would wire up via
// `configureHtmlSanitizer`) — a real sanitize-html instance, since the
// runtime itself ships no sanitizer (ADR 0010's posture, mirrored
// server-side). Unlike DOMPurify, sanitize-html works on plain strings, no
// DOM required — a better fit for server-side use.
const stripDangerousMarkup = (html: string): string =>
	sanitizeHtml(html, {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat('img'),
		allowedAttributes: sanitizeHtml.defaults.allowedAttributes,
	})

const wrap = (
	template: string,
	params = '{ status, markup }: { status?: string; markup?: string }',
): string =>
	`export function C(${params})
	@{
		expose({})
		<>
			<c-el>
				${template}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

const compiled = (template: string) =>
	compileComponent(wrap(template), 'c.tsrx', new Set())

// A per-run directory, not the build pipeline's own output (LT-140).
const generated = createGeneratedDir('features')
afterAll(() => generated.cleanup())

const ensureEmitted = (tag: string, code: string): void => {
	generated.emit(`${tag}.server.ts`, code)
}

const render = async (tag: string, args: unknown): Promise<string> => {
	const mod = await generated.importModule<{
		renderC: (args: unknown) => string
	}>(`${tag}.server.ts`)
	return mod.renderC(args)
}

describe('@switch — multi-branch conditional rendering', () => {
	const source = `@switch (status) {
		@case "loading": {
			<p>Loading</p>
		}
		@case "success": {
			<p class="success">Done</p>
		}
		@default: {
			<p>Unknown</p>
		}
	}`
	const { component, diagnostics } = compiled(source)

	test('compiles cleanly and renders each arm per args', async () => {
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('switch fixture must compile')
		ensureEmitted('feat-switch', component.serverCode)
		expect(await render('feat-switch', { status: 'loading' })).toBe(
			'<c-el><p>Loading</p></c-el>',
		)
		expect(await render('feat-switch', { status: 'success' })).toBe(
			'<c-el><p class="success">Done</p></c-el>',
		)
		expect(await render('feat-switch', { status: 'other' })).toBe(
			'<c-el><p>Unknown</p></c-el>',
		)
	})

	test('arm renders exactly one match (break inside each case block)', async () => {
		expect(await render('feat-switch', { status: 'loading' })).not.toContain(
			'Unknown',
		)
	})

	test('client constructs inside arms are TSRX005 (exclusive rendering)', () => {
		const { diagnostics: d } = compiled(`@switch (status) {
			@case "a": {
				<button type="button" onClick={() => {}}>a</button>
			}
			@default: {
				<p>other</p>
			}
		}`)
		expect(d.some(diag => diag.message.includes('inside @switch arms'))).toBe(
			true,
		)
	})

	test('signal discriminant is TSRX005 (DOM keeps the rendered arm)', () => {
		const source2 = `export function C({}: {})
	@{
		const mode = createCell('a')
		expose({})
		<>
			<c-el>
				@switch (mode.get()) {
					@case "a": {
						<p>a</p>
					}
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createCell } from '@zeix/le-truc'`
		const { diagnostics: d } = compileComponent(source2, 'c.tsrx', new Set())
		expect(
			d.some(diag =>
				diag.message.includes('@switch discriminant reads signal'),
			),
		).toBe(true)
	})
})

describe('@try — error boundaries', () => {
	const source = `@try {
		<p>{status.length}</p>
	} @catch (error) {
		<p class="error">Failed</p>
	}`
	const { component, diagnostics } = compiled(source)

	test('body renders when it evaluates; catch renders on throw, no partial leak', async () => {
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('try fixture must compile')
		ensureEmitted('feat-try', component.serverCode)
		expect(await render('feat-try', { status: 'abc' })).toBe(
			'<c-el><p>3</p></c-el>',
		)
		expect(await render('feat-try', {})).toBe(
			'<c-el><p class="error">Failed</p></c-el>',
		)
	})

	test('client constructs on the body root are optionally addressed (LT-025) — guarded first(), not thrown', async () => {
		const { component, diagnostics: d } = compiled(`@try {
			<button type="button" class="go" data-len={status.length} onClick={() => {}}>go</button>
		} @catch (error) {
			<p>Failed</p>
		}`)
		expect(d).toEqual([])
		if (!component) throw new Error('optional @try body fixture must compile')
		expect(component.clientCode).toContain("first('button')")
		expect(component.clientCode).toContain('if (button)')
		ensureEmitted('feat-try-optional-body', component.serverCode)
		expect(await render('feat-try-optional-body', { status: 'abc' })).toContain(
			'<button type="button" data-len="3" class="go">go</button>',
		)
		expect(await render('feat-try-optional-body', {})).toBe(
			'<c-el><p>Failed</p></c-el>',
		)
	})

	test('client constructs on the catch-arm root are optionally addressed too (LT-025)', async () => {
		const { component, diagnostics: d } = compiled(`@try {
			<p>{status.length}</p>
		} @catch (error) {
			<button type="button" class="retry" onClick={() => {}}>retry</button>
		}`)
		expect(d).toEqual([])
		if (!component) throw new Error('optional @catch arm fixture must compile')
		expect(component.clientCode).toContain("first('button')")
		ensureEmitted('feat-try-optional-catch', component.serverCode)
		expect(await render('feat-try-optional-catch', { status: 'abc' })).toBe(
			'<c-el><p>3</p></c-el>',
		)
		expect(await render('feat-try-optional-catch', {})).toContain(
			'<button type="button" class="retry">retry</button>',
		)
	})

	test('deeper (non-root) constructs inside a @try arm are still TSRX005', () => {
		const { diagnostics: d } = compiled(`@try {
			<div class="wrap"><button type="button" onClick={() => {}}>go</button></div>
		} @catch (error) {
			<p>Failed</p>
		}`)
		expect(
			d.some(diag => diag.message.includes('must sit on its root element')),
		).toBe(true)
	})
})

describe('@pending — async boundaries (ADR 0023 sub-design 13, LT-012)', () => {
	const asyncComponent = (deriveExpr: string): string =>
		`import { deriveCell } from '@zeix/le-truc'
export function C({}: {})
	@{
		const data = deriveCell(${deriveExpr})
		expose({ data: data.get })
		<>
			<c-el>
				@try {
					<div class="content">{data}</div>
				} @pending {
					<p class="loading">Loading</p>
				} @catch (e) {
					<p class="error">{e.message}</p>
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('no @catch is diagnosed — an async boundary needs all three arms routed together', () => {
		const { diagnostics } = compileComponent(
			`export function C({}: {})
	@{
		const data = deriveCell(async () => 'x')
		expose({ data: data.get })
		<>
			<c-el>
				@try {
					<div class="content">{data}</div>
				} @pending {
					<p class="loading">Loading</p>
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { deriveCell } from '@zeix/le-truc'`,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.message.includes('requires a @catch'))).toBe(
			true,
		)
	})

	test('a @try body with no lazy reference to a deriveCell signal is diagnosed', () => {
		const { diagnostics } = compileComponent(
			`export function C({}: {})
	@{
		const data = deriveCell(async () => 'x')
		expose({ data: data.get })
		<>
			<c-el>
				@try {
					<div class="content">static</div>
				} @pending {
					<p class="loading">Loading</p>
				} @catch (e) {
					<p class="error">{e.message}</p>
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { deriveCell } from '@zeix/le-truc'`,
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(d => d.message.includes('drives isPending() routing')),
		).toBe(true)
	})

	test('pending arm renders when the async signal has no { initial } seed (isPending at render time)', async () => {
		const { component, diagnostics } = compileComponent(
			asyncComponent("async () => 'loaded'"),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('async fixture must compile')
		ensureEmitted('feat-async', component.serverCode)
		const html = await render('feat-async', {})
		expect(html).toContain('<p class="loading">Loading</p>')
		expect(html).toContain('hidden class="content"')
		expect(html).toContain('hidden class="error"')
	})

	test('the try body renders (ok) when { initial } seeds a retained value', async () => {
		const { component, diagnostics } = compileComponent(
			asyncComponent("async () => 'loaded', { initial: 'seed' }"),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('async fixture must compile')
		ensureEmitted('feat-async-ok', component.serverCode)
		const html = await render('feat-async-ok', {})
		expect(html).toContain('<div class="content">seed</div>')
		expect(html).toContain('hidden class="loading"')
		expect(html).toContain('hidden class="error"')
	})

	test('client codegen: one watch() call toggles all three roots, no client DOM creation', () => {
		const { component, diagnostics } = compileComponent(
			asyncComponent("async () => 'loaded', { initial: 'seed' }"),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		const code = component?.clientCode ?? ''
		// watch/first are FactoryContext members (destructured), not module
		// imports — only deriveCell/defineComponent come from '@zeix/le-truc'.
		expect(code).toContain('({ expose, first, watch }) => {')
		expect(code).toContain('watch(data, {')
		expect(code).toContain('ok: value => {')
		expect(code).toContain('.hidden = true')
		expect(code).toContain('.hidden = false')
		expect(code).toContain('.textContent = String(value)')
		expect(code).toContain('nil: () => {')
		expect(code).toContain('err: error => {')
		expect(code).toContain('.textContent = String(error.message)')
	})

	// LT-077 (CHECKLIST §8): `hidden`/`display:none` exclude nothing from form
	// submission, only `disabled` does. A named control living in a non-active
	// arm would otherwise submit alongside `@pending`'s own controls. Every arm
	// root is wrapped in a synthetic `<fieldset disabled>`, toggled by the same
	// condition as the arm's own `hidden` — these fixtures put a named `<input>`
	// inside each arm and check the fieldset wrapper, not just the input's own
	// attributes, carries the submission-exclusion.
	const namedControlComponent = (deriveExpr: string): string =>
		`import { deriveCell } from '@zeix/le-truc'
export function C({}: {})
	@{
		const data = deriveCell(${deriveExpr})
		expose({ data: data.get })
		<>
			<c-el>
				@try {
					<div class="content"><input name="x" value="ok" />{data}</div>
				} @pending {
					<p class="loading"><input name="x" value="pending" />Loading</p>
				} @catch (e) {
					<p class="error"><input name="x" value="error" />{e.message}</p>
				}
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

	test('server render (pending step): only the pending arm fieldset is enabled, ok/error are disabled', async () => {
		const { component, diagnostics } = compileComponent(
			namedControlComponent("async () => 'loaded'"),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('named-control fixture must compile')
		ensureEmitted('feat-async-named-pending', component.serverCode)
		const html = await render('feat-async-named-pending', {})
		// pending arm's fieldset: not disabled (attr() omits `false`/omitted attrs)
		expect(html).toContain(
			'<fieldset style="border:0;padding:0;margin:0;min-width:0"><p class="loading"',
		)
		// ok/error arms' fieldsets: disabled
		expect(html).toContain(
			'<fieldset style="border:0;padding:0;margin:0;min-width:0" disabled><div hidden class="content"',
		)
		expect(html).toContain(
			'<fieldset style="border:0;padding:0;margin:0;min-width:0" disabled><p hidden class="error"',
		)
	})

	test('server render (ok step): only the ok arm fieldset is enabled, pending/error are disabled', async () => {
		const { component, diagnostics } = compileComponent(
			namedControlComponent("async () => 'loaded', { initial: 'seed' }"),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('named-control fixture must compile')
		ensureEmitted('feat-async-named-ok', component.serverCode)
		const html = await render('feat-async-named-ok', {})
		expect(html).toContain(
			'<fieldset style="border:0;padding:0;margin:0;min-width:0"><div class="content"',
		)
		expect(html).toContain(
			'<fieldset style="border:0;padding:0;margin:0;min-width:0" disabled><p hidden class="loading"',
		)
		expect(html).toContain(
			'<fieldset style="border:0;padding:0;margin:0;min-width:0" disabled><p hidden class="error"',
		)
	})

	test("client codegen (error step, by construction): watch()'s err handler disables the ok/pending fieldsets and enables its own", () => {
		const { component, diagnostics } = compileComponent(
			namedControlComponent("async () => 'loaded', { initial: 'seed' }"),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		const code = component?.clientCode ?? ''
		// LT-086: addressed via `.parentElement`, not a `fieldset:has(...)`
		// query — `:has()` predates REQUIREMENTS.md's 2020 browser baseline.
		expect(code).toContain('div.parentElement as HTMLFieldSetElement')
		expect(
			(code.match(/p\d*\.parentElement as HTMLFieldSetElement/g) ?? []).length,
		).toBe(2)
		// err handler: pending/ok fieldsets disabled, error's own enabled —
		// this is the state a pending→error transition lands in; verified here
		// as generated code since the compiler's own test harness has no real
		// DOM/FormData to submit against (that's the corpus's Playwright specs).
		const errHandler = code.slice(
			code.indexOf('err: error => {'),
			code.indexOf('})', code.indexOf('err: error => {')),
		)
		expect(
			(errHandler.match(/Fieldset\d*\.disabled = true/g) ?? []).length,
		).toBe(2)
		expect(
			(errHandler.match(/Fieldset\d*\.disabled = false/g) ?? []).length,
		).toBe(1)
	})
})

describe('bare html={} is rejected, not silently reclassified (LT-137)', () => {
	// `html` is not a real HTML attribute. If the rename let the bare spelling
	// fall through to the ordinary-attribute path, the compiler would emit a
	// dead `html="…"` and drop the sanitize + client-bind behaviour entirely —
	// a silent downgrade of the one attribute where that matters most.
	test('bare html={markup} reports and names the new spelling', () => {
		const { diagnostics } = compiled('<article html={markup} />')
		const hit = diagnostics.find(d => d.message.includes('truc:html'))
		expect(hit).toBeDefined()
		expect(hit?.severity).toBe('error')
	})
})

describe('truc:html={expr} — dynamic rendering', () => {
	const { component, diagnostics } = compiled('<article truc:html={markup} />')

	afterEach(() => {
		configureHtmlSanitizer(escapeAll)
	})

	test('escapes markup by default when no sanitizer is configured', async () => {
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('html fixture must compile')
		ensureEmitted('feat-html', component.serverCode)
		configureHtmlSanitizer(escapeAll)
		expect(
			await render('feat-html', { markup: '<p>Rich <em>content</em></p>' }),
		).toBe(
			'<c-el><article>&lt;p&gt;Rich &lt;em&gt;content&lt;/em&gt;&lt;/p&gt;</article></c-el>',
		)
	})

	test('a configured sanitizer strips scripts, event handlers, and unsafe URLs', async () => {
		configureHtmlSanitizer(stripDangerousMarkup)
		expect(
			await render('feat-html', {
				markup:
					'<p onclick="steal()">hi</p><script>alert(1)</script><a href="javascript:x">c</a>',
			}),
		).toBe('<c-el><article><p>hi</p><a>c</a></article></c-el>')
	})

	test('reactive thunk form (LT-025) lowers to a dangerouslyBindInnerHTML watch', async () => {
		const source = `export function C({}: {})
	@{
		expose({})
		const body = createState('<b>seed</b>')
		<>
			<c-el>
				<article class="target" truc:html={() => body.get()}></article>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createState } from '@zeix/le-truc'`
		const { component, diagnostics: d } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(d).toEqual([])
		if (!component) throw new Error('reactive html fixture must compile')
		expect(component.clientCode).toContain(
			'watch(() => body.get(), dangerouslyBindInnerHTML(article))',
		)
		configureHtmlSanitizer(escapeAll)
		ensureEmitted('feat-html-reactive', component.serverCode)
		expect(await render('feat-html-reactive', {})).toBe(
			'<c-el><article class="target">&lt;b&gt;seed&lt;/b&gt;</article></c-el>',
		)
	})
})

describe('createMemo — recognized signal constructor (LT-025)', () => {
	test('derives from a rendered signal; server evaluates once, client re-derives', async () => {
		const source = `export function C({}: {})
	@{
		expose({})
		const value = createState(3)
		const doubled = createMemo(() => value.get() * 2)
		<>
			<c-el>
				<span class="value">{value}</span>
				<span class="doubled">{doubled}</span>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createState, createMemo } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('createMemo fixture must compile')
		expect(component.clientCode).toContain(
			'const doubled = createMemo(() => value.get() * 2)',
		)
		ensureEmitted('feat-create-memo', component.serverCode)
		expect(await render('feat-create-memo', {})).toBe(
			'<c-el><span class="value">3</span><span class="doubled">6</span></c-el>',
		)
	})

	test('a compute function reading host/internals is TSRX013, not broken server codegen', () => {
		const source = `export function C({}: {})
	@{
		expose({ filter: asString('') })
		const lowerFilter = createMemo(() => host.filter.toLowerCase())
		<>
			<c-el>
				<span>{lowerFilter}</span>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { asString, createMemo } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		expect(
			diagnostics.some(
				d => d.code === 'TSRX013' && d.message.includes('createMemo'),
			),
		).toBe(true)
	})
})

describe('review fixes (2026-08-22 architect pass)', () => {
	test('nested directives in branch bodies render (no silent drop)', async () => {
		const { component, diagnostics } = compiled(`@if (status) {
			<div class="outer">
				@if (status === 'a') {
					<p class="inner">A</p>
				} @else {
					@try {
						<p>{status.length}</p>
					} @catch (e) {
						<p>err</p>
					}
				}
			</div>
		}`)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('nested fixture must compile')
		ensureEmitted('feat-nested', component.serverCode)
		expect(await render('feat-nested', { status: 'a', markup: '' })).toBe(
			'<c-el><div class="outer"><p class="inner">A</p></div></c-el>',
		)
		// else-branch try renders its body
		expect(await render('feat-nested', { status: 'xy', markup: '' })).toBe(
			'<c-el><div class="outer"><p>2</p></div></c-el>',
		)
	})

	test('nested @try joins into the outer arm buffer (order + isolation)', async () => {
		const { component, diagnostics } = compiled(`@try {
			<div class="outer">
				@try {
					<p class="inner">{markup.length}</p>
				} @catch (e) {
					<p>inner-err</p>
				}
				<p class="tail">{status.length}</p>
			</div>
		} @catch (error) {
			<p>outer-err</p>
		}`)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('nested try fixture must compile')
		ensureEmitted('feat-nested-try', component.serverCode)
		// inner content renders IN PLACE inside the outer body, tail after it
		expect(
			await render('feat-nested-try', { status: 'abc', markup: 'xy' }),
		).toBe(
			'<c-el><div class="outer"><p class="inner">2</p><p class="tail">3</p></div></c-el>',
		)
		// the tail throws AFTER the nested try already buffered its content:
		// the outer catch discards the WHOLE arm — no partial inner leak
		expect(await render('feat-nested-try', { markup: 'xy' })).toBe(
			'<c-el><p>outer-err</p></c-el>',
		)
	})

	test('a configured sanitizer strips unquoted event handlers', async () => {
		configureHtmlSanitizer(stripDangerousMarkup)
		try {
			expect(
				await render('feat-html', {
					markup: '<img src=x onerror=alert(1)>',
				}),
			).toBe('<c-el><article><img src="x" /></article></c-el>')
		} finally {
			configureHtmlSanitizer(escapeAll)
		}
	})

	test('keyConfig-function returning empty string falls back like cause-effect', async () => {
		// Server/client key parity: cause-effect uses `keyConfig(item) || auto`
		// — an empty-string key must regenerate, not seed data-key="".
		const { createList } = await import('../../tsrx/runtime')
		const list = createList(['a', 'b'], {
			keyConfig: () => '',
		})
		expect(list.entries()).toEqual([
			['0', 'a'],
			['1', 'b'],
		])
	})

	test('arg-seeded harvest filters to data-key children only', () => {
		const source = `export function Seeded({ initial }: { initial?: string[] })
	@{
		const items = createList<string>(initial, { keyConfig: 'item' })
		<>
			<c-el>
				<ul data-container>
					<li class="header">static header</li>
					@for (const item of items; key k) {
						<li><span>{item}</span></li>
					}
				</ul>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createList } from '@zeix/le-truc'`
		const { component, diagnostics } = compileComponent(
			source,
			'seeded.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(component?.clientCode).toContain(
			".filter(el => el.hasAttribute('data-key')).map(el =>",
		)
	})

	test('a second reactive list in one component is TSRX005', () => {
		const source = `export function C({}: {})
	@{
		const a = createList<string>(['x'], { keyConfig: 'a' })
		const b = createList<string>(['y'], { keyConfig: 'b' })
		<>
			<c-el>
				<ul data-a>
					@for (const item of a; key k) {
						<li><span>{item}</span></li>
					}
				</ul>
				<ul data-b>
					@for (const item of b; key k2) {
						<li><span>{item}</span></li>
					}
				</ul>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}
import { createList } from '@zeix/le-truc'`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(d =>
				d.message.includes('one reactive-list @for per component'),
			),
		).toBe(true)
	})

	test('truc:html={dataRef} inside an @if branch is not a client construct', () => {
		const { diagnostics } = compiled(`@if (status) {
			<article truc:html={markup} />
		} @else {
			<article />
		}`)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
	})
})

describe('newer-grammar constructs — parse-error hints', () => {
	test('statement-form switch gets the pinned-grammar hint', () => {
		const { component, diagnostics } = compileComponent(
			wrap(`switch (status) {
			case 'loading':
				<p>Loading</p>
				break
			default:
				<p>Unknown</p>
		}`),
			'c.tsrx',
			new Set(),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'TSRX008')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('not parseable by the pinned')
		expect(hit?.message).toContain('statement-form switch')
	})

	test('`{html markup}` gets NO phantom-keyword hint (LT-137)', () => {
		// The hint used to say "{html expr} keyword is newer TSRX grammar than
		// @tsrx/core 0.1.63". No such keyword exists in any published upstream
		// release — verified against @tsrx/core 0.1.60/0.1.63, @tsrx/ripple and
		// ripple — so the hint sent the author looking for a pin upgrade that
		// would not have helped. It still fails to parse; it just no longer
		// claims a false cause.
		const { diagnostics } = compileComponent(
			wrap('<article>{html markup}</article>'),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'TSRX008')).toBe(true)
		expect(
			diagnostics.some(d => d.message.includes('{html expr} keyword')),
		).toBe(false)
	})

	test('setup await gets the hint', () => {
		const source = `export function C({ id }: { id?: string })
	@{
		const data = await load(id)
		expose({})
		<>
			<c-el><p>{data}</p></c-el>
			<style>c-el { color: red }</style>
		</}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(
				d => d.code === 'TSRX008' && d.message.includes('await'),
			),
		).toBe(true)
	})
})
