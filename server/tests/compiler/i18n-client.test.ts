/**
 * The client message channel (ADR 0030 s9, LT-218): `t.<key>` reads in
 * client positions, the per-instance `i18n` root attribute the server
 * renders for exactly those keys, and the generated factory's preamble —
 * the source record merged under the attribute, with the evaluator inlined
 * and narrowed.
 *
 * No corpus component reads `t` client-side until LT-219, so every pin is
 * a fixture. The server half renders through a generated `i18n` module
 * with a German override catalog, so the attribute carries real per-locale
 * parsed patterns; the client half connects in the simulation realm.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { pathToFileURL } from 'node:url'
import type { CompileDiagnostic } from '../../compiler/diagnostics'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { bakeMessageEnv, formatMessage } from '../../compiler/icu/evaluate'
import { parseMessage } from '../../compiler/icu/parse'
import { createSimulationRealm } from '../../compiler/sim/realm'
import { writeI18nModule } from '../../effects/i18n'
import { createGeneratedDir } from '../helpers/generated-corpus'

/* === Fixture === */

const MESSAGES = {
	hi: 'Hi',
	folded: 'Folded',
	tasks:
		'{count, plural, offset:1 =0 {no tasks} one {# more task} other {# more tasks}} — {kind, select, urgent {urgent} other {normal}} ({ratio, number, percent}) for {name}',
}

const DE = {
	'c-el.hi': 'Hallo',
	'c-el.folded': 'Gefaltet',
	'c-el.tasks':
		'{count, plural, offset:1 =0 {keine Aufgaben} one {# weitere Aufgabe} other {# weitere Aufgaben}} — {kind, select, urgent {dringend} other {normal}} ({ratio, number, percent}) für {name}',
}

const decl = `export const i18n = ${JSON.stringify(MESSAGES)} as const`
const params = '{ i18n: { t } }: { i18n: I18n<typeof i18n> }'
const setup = 'const c = createCell(3)\n\t\texpose({ count: c.get })'
const body = [
	'<p class="folded">{t.folded}</p>',
	"<span>{() => t.tasks({ count: host.count, kind: 'urgent', ratio: 0.25, name: 'Ada' })}</span>",
	'<button title={() => t.hi}>x</button>',
].join('')

const tsrxSource = (
	b: string,
	s = setup,
	p = params,
) => `import { createCell } from '@zeix/le-truc'
${decl}
export function C(${p})
	@{
		${s}
		<>
			<c-el>${b}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

const tsxSource = (
	b: string,
	s = setup,
	p = params,
) => `import { createCell } from '@zeix/le-truc'
${decl}
export function C(${p}) {
	${s}
	return (
		<>
			<c-el>${b}</c-el>
			<style>{css\`c-el { color: red }\`}</style>
		</>
	)
}`

const compileTsrx = (b = body, s?: string, p?: string) =>
	compileComponent(tsrxSource(b, s, p), 'c.tsrx', new Set())
const compileTsx = (b = body, s?: string, p?: string) =>
	compileComponentTsx(tsxSource(b, s, p), 'c.tsx', new Set())

const errors = (diagnostics: CompileDiagnostic[]) =>
	diagnostics.filter(d => d.severity === 'error')

/* === Generated modules === */

const generated = createGeneratedDir('i18n-client')
afterAll(() => generated.cleanup())

await writeI18nModule(generated.path, {
	locales: ['en', 'de'],
	sources: new Map([['c-el', MESSAGES]]),
	overrides: new Map<string, Record<string, string>>([
		['en', {}],
		['de', DE],
	]),
	gaps: [],
})
const i18nModule = (await import(
	pathToFileURL(`${generated.path}/i18n.ts`).href
)) as {
	i18nRecord: (tag: string, lang?: string) => unknown
}

const tsrx = compileTsrx()
const tsx = compileTsx()
if (!tsrx.component || !tsx.component)
	throw new Error(
		`fixture failed to compile: ${[...tsrx.diagnostics, ...tsx.diagnostics].map(d => d.message).join('; ')}`,
	)
generated.emit('c-el.tsrx.server.ts', tsrx.component.serverCode)
generated.emit('c-el.tsx.server.ts', tsx.component.serverCode)
const clientPath = generated.emit('c-el.client.ts', tsrx.component.clientCode)

type Render = { renderC: (args: unknown) => string }
const renderTsrx = (await generated.importModule<Render>('c-el.tsrx.server.ts'))
	.renderC
const renderTsx = (await generated.importModule<Render>('c-el.tsx.server.ts'))
	.renderC
const record = (lang: string) => i18nModule.i18nRecord('c-el', lang)

/** The decoded value of the rendered root `i18n` attribute, or null. */
const i18nAttribute = (markup: string): Record<string, unknown> | null => {
	const match = markup.match(/<c-el[^>]* i18n="([^"]*)"/)
	if (!match?.[1]) return null
	const raw = match[1]
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
	return JSON.parse(raw) as Record<string, unknown>
}

/* === Tests === */

describe('analysis: `t.<key>` in client positions', () => {
	test('static reads of declared keys compile on both surfaces', () => {
		expect(errors(tsrx.diagnostics)).toEqual([])
		expect(errors(tsx.diagnostics)).toEqual([])
	})

	test.each([
		['a computed key', "<span>{() => t[host.id as 'hi']}</span>"],
		['a bare `t`', '<span>{() => String(Object.keys(t))}</span>'],
		[
			'an undeclared key',
			'<span>{() => (t as Record<string, string>).nope}</span>',
		],
	])('%s stays server-only (LTC005)', (_, b) => {
		for (const { diagnostics } of [compileTsrx(b), compileTsx(b)])
			expect(
				diagnostics.some(
					d =>
						d.code === 'LTC005' &&
						d.message.includes('server-only name(s) `t`'),
				),
			).toBe(true)
	})

	test('the whole-record spelling stays server-only', () => {
		const p = '{ i18n }: { i18n: I18n<typeof i18n> }'
		const b = '<button title={() => i18n.t.hi}>x</button>'
		for (const { diagnostics } of [
			compileTsrx(b, setup, p),
			compileTsx(b, setup, p),
		])
			expect(
				diagnostics.some(
					d => d.code === 'LTC005' && d.message.includes('`i18n`'),
				),
			).toBe(true)
	})

	test('`lang` stays server-only, pointing at `host.lang`', () => {
		const p = '{ i18n: { t, lang } }: { i18n: I18n<typeof i18n> }'
		const b = '<button title={() => lang}>x</button>'
		for (const { diagnostics } of [
			compileTsrx(b, setup, p),
			compileTsx(b, setup, p),
		])
			expect(
				diagnostics.some(
					d =>
						d.code === 'LTC005' &&
						d.message.includes('`lang`') &&
						d.message.includes('`host.lang`'),
				),
			).toBe(true)
	})
})

describe('server: the root `i18n` attribute', () => {
	test('carries only client-referenced keys — a folded key stays off it', () => {
		const attribute = i18nAttribute(renderTsrx({ i18n: record('en') }))
		expect(Object.keys(attribute ?? {}).sort()).toEqual(['hi', 'tasks'])
	})

	test('a de render bakes translated, PARSED patterns', () => {
		const attribute = i18nAttribute(renderTsrx({ i18n: record('de') }))
		expect(attribute?.hi).toBe('Hallo')
		// The AST, never the pattern: the client has no ICU parser.
		expect(Array.isArray(attribute?.tasks)).toBe(true)
		expect(JSON.stringify(attribute?.tasks)).toContain('weitere Aufgabe')
		expect(JSON.stringify(attribute)).not.toContain('{count, plural')
	})

	test('both surfaces render identical attribute bytes', () => {
		for (const lang of ['en', 'de']) {
			const a = renderTsrx({ i18n: record(lang) }).match(/ i18n="[^"]*"/)?.[0]
			const b = renderTsx({ i18n: record(lang) }).match(/ i18n="[^"]*"/)?.[0]
			expect(a).toBeDefined()
			expect(b).toBe(a)
		}
	})

	test('absent when no client position reads a message', () => {
		const { component } = compileTsrx('<p class="folded">{t.folded}</p>')
		expect(component?.serverCode).not.toContain('clientMessages')
		expect(component?.clientCode).not.toContain("getAttribute('i18n')")
	})
})

describe('baking the record into a serialized message', () => {
	// The client formats a baked message without the record; the server
	// evaluator must give the same string either way.
	const env = { lang: 'de', timeZone: 'Europe/Zurich', currency: 'CHF' }
	test.each([
		MESSAGES.tasks,
		'{price, number, currency} am {when, date, long}',
		'{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}',
	])('%s', pattern => {
		const parsed = parseMessage(pattern)
		if (!parsed.ok) throw new Error(parsed.error)
		const args = {
			count: 3,
			kind: 'urgent',
			ratio: 0.25,
			name: 'Ada',
			price: 12.5,
			when: Date.UTC(2026, 0, 2),
			n: 2,
		}
		expect(
			formatMessage(bakeMessageEnv(parsed.message, env), args, { lang: 'en' }),
		).toBe(formatMessage(parsed.message, args, env))
	})
})

describe('client: the inlined, narrowed evaluator', () => {
	test('a component with no plural message emits no Intl.PluralRules', () => {
		const b =
			"<button title={() => t.hi} onClick={() => console.log(t.greet({ name: 'x' }))}>x</button>"
		const s = setup
		const src = tsrxSource(b, s).replace(
			decl,
			"export const i18n = { hi: 'Hi', greet: 'Hello {name}' } as const",
		)
		const { component, diagnostics } = compileComponent(
			src,
			'c.tsrx',
			new Set(),
		)
		expect(errors(diagnostics)).toEqual([])
		expect(component?.clientCode).toContain('__i18nFormat')
		expect(component?.clientCode).not.toContain('Intl.')
	})

	test('the plural fixture does emit it', () => {
		expect(tsrx.component?.clientCode).toContain('new Intl.PluralRules(')
	})
})

describe('client: connect in the simulation realm', async () => {
	const realm = createSimulationRealm()
	afterAll(() => realm.dispose())
	await realm.load(() => import(pathToFileURL(clientPath).href))

	const connect = async (markup: string) => {
		const result = await realm.render({ markup, component: 'c-el' })
		return result
	}
	// jsdom serializes the no-break space `Intl` puts before a German `%`.
	const spanText = (html: string) =>
		html.match(/<span>([^<]*)<\/span>/)?.[1]?.replace(/&nbsp;/g, '\u00a0')
	const titleOf = (html: string) => html.match(/<button title="([^"]*)"/)?.[1]

	test('the attribute speaks the render locale, and the client agrees with the server fold', async () => {
		const markup = renderTsrx({ i18n: record('de') })
		const { html } = await connect(markup)
		expect(titleOf(html)).toBe('Hallo')
		// One evaluator walk on both sides: the client's inlined, narrowed
		// copy renders the plural/select/number message exactly as the
		// server evaluator does for the same record and arguments.
		const { t } = record('de') as {
			t: { tasks: (args: Record<string, unknown>) => string }
		}
		expect(spanText(html)).toBe(
			t.tasks({ count: 3, kind: 'urgent', ratio: 0.25, name: 'Ada' }),
		)
		expect(spanText(html)).toContain('weitere Aufgaben')
	})

	test('a client-created instance (attribute stripped) speaks the source locale', async () => {
		const markup = renderTsrx({ i18n: record('de') }).replace(
			/ i18n="[^"]*"/,
			'',
		)
		const { html } = await connect(markup)
		expect(titleOf(html)).toBe('Hi')
		expect(spanText(html)).toContain('more tasks')
	})

	test('a malformed attribute warns in DEV_MODE and falls back to the source record', async () => {
		const previous = process.env.DEV_MODE
		process.env.DEV_MODE = 'true'
		try {
			const markup = renderTsrx({ i18n: record('de') }).replace(
				/ i18n="[^"]*"/,
				' i18n="{broken"',
			)
			const { html, diagnostics } = await connect(markup)
			expect(titleOf(html)).toBe('Hi')
			expect(
				diagnostics.some(
					d => d.kind === 'console' && d.message.includes('not valid JSON'),
				),
			).toBe(true)
		} finally {
			process.env.DEV_MODE = previous
		}
	})
})
