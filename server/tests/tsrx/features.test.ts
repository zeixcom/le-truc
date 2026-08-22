/**
 * Language-feature tests (tsrx.dev/features parity): every construct the
 * pinned @tsrx/core 0.1.60 can parse must lower deliberately — supported or
 * gated with a diagnostic — never silently dropped. Covers @switch arms,
 * @try error boundaries, @pending async boundaries (gated), html={expr}
 * dynamic rendering, and parse-error hints for the newer-grammar constructs
 * (statement-form switch, {html}/{text}/{ref} keywords, await).
 */
import { afterEach, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { compileComponent } from '../../tsrx'
import { configureHtmlSanitizer } from '../../tsrx/runtime'

// The runtime's default sanitizer (unconfigured state): escape everything,
// safe but inert. Tests that configure a permissive/stripping sanitizer to
// exercise `html={expr}` must restore this afterward — `configureHtmlSanitizer`
// is process-wide, shared across every generated module.
const escapeAll = (html: string): string =>
	html.replace(/</g, '&lt;').replace(/>/g, '&gt;')

// A stand-in "consumer-supplied" sanitizer (what a host would wire up via
// `configureHtmlSanitizer`, e.g. DOMPurify) — strips script blocks,
// event-handler attributes, and unsafe URL schemes, but otherwise passes
// markup through raw. Used only to exercise the hook in tests; the runtime
// itself ships no such sanitizer (ADR 0010's posture, mirrored server-side).
const stripDangerousMarkup = (html: string): string =>
	html
		.replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi, '')
		.replace(/<script\b[^>]*\/?>/gi, '')
		.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
		.replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
		.replace(/\s+on[a-z]+\s*=\s*[^\s"'`=<>]+/gi, '')
		.replace(
			/\s(href|src|action|formaction|xlink:href)\s*=\s*(["'])\s*(javascript|vbscript|data(?!:image\/(png|gif|jpeg|jpg|webp|svg\+xml)):)[^"']*\2/gi,
			'',
		)

const ROOT = path.resolve(import.meta.dir, '../../..')

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

const ensureEmitted = (tag: string, code: string): void => {
	const out = path.join(ROOT, 'server/generated/tsrx', `${tag}.server.ts`)
	fs.mkdirSync(path.dirname(out), { recursive: true })
	fs.writeFileSync(out, code)
}

const render = async (tag: string, args: unknown): Promise<string> => {
	const mod = (await import(`../../generated/tsrx/${tag}.server.ts`)) as {
		renderC: (args: unknown) => string
	}
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
	}`
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

	test('client constructs in the body are TSRX005 (element not guaranteed on error)', () => {
		const { diagnostics: d } = compiled(`@try {
			<button type="button" onClick={() => {}}>go</button>
		} @catch (error) {
			<p>Failed</p>
		}`)
		expect(d.some(diag => diag.message.includes('inside @try bodies'))).toBe(
			true,
		)
	})
})

describe('@pending — async boundaries (gated)', () => {
	test('pending arm is TSRX005 with the lowering reason', () => {
		const { diagnostics } = compiled(`@try {
			<user-profile id={1} />
		} @pending {
			<p>Loading</p>
		} @catch (e) {
			<p>Failed</p>
		}`)
		const hit = diagnostics.find(d => d.message.includes('@pending arms'))
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('isPending(signal)')
		// Async data is authorable TODAY — the message must not claim otherwise
		expect(hit?.message).toContain('deriveCell(async')
	})
})

describe('html={expr} — dynamic rendering', () => {
	const { component, diagnostics } = compiled('<article html={markup} />')

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

	test('reactive thunk form is rejected (no client-side sanitizer contract)', () => {
		const { diagnostics } = compiled('<article html={() => markup} />')
		expect(
			diagnostics.some(diag => diag.message.includes('data reference')),
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
			).toBe('<c-el><article><img src=x></article></c-el>')
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
						<li><span>&{item}</span></li>
					}
				</ul>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
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
						<li><span>&{item}</span></li>
					}
				</ul>
				<ul data-b>
					@for (const item of b; key k2) {
						<li><span>&{item}</span></li>
					}
				</ul>
			</c-el>
			<style>c-el { color: red }</style>
		</>
	}`
		const { diagnostics } = compileComponent(source, 'c.tsrx', new Set())
		expect(
			diagnostics.some(d =>
				d.message.includes('one reactive-list @for per component'),
			),
		).toBe(true)
	})

	test('html={dataRef} inside an @if branch is not a client construct', () => {
		const { diagnostics } = compiled(`@if (status) {
			<article html={markup} />
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
		expect(hit?.message).toContain('newer TSRX grammar')
		expect(hit?.message).toContain('statement-form switch')
	})

	test('{html markup} keyword gets the hint', () => {
		const { diagnostics } = compileComponent(
			wrap('<article>{html markup}</article>'),
			'c.tsrx',
			new Set(),
		)
		expect(
			diagnostics.some(
				d => d.code === 'TSRX008' && d.message.includes('{html expr} keyword'),
			),
		).toBe(true)
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
