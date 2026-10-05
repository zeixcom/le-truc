/**
 * The raw-value-source rule for formatted reactive values (D-20, HOST_PROFILE
 * data account bullet 6, LT-374). Formatted text (`1,234`, a localized date)
 * does not parse back into state, so a signal seeded from server args that
 * renders only as formatted text needs a raw value source the client
 * harvests instead — a reactive `value`/`aria-valuenow`/`datetime`
 * attribute, or the arg rendered as an attribute. Without one the compile
 * fails with LTC059 (tier 1 Prevented), on both surfaces.
 *
 * The passing fixtures connect in the simulation realm: connect is a fixed
 * point, so a client that harvested the right value re-renders exactly the
 * server's formatted text. A harvest that read the raw attribute as a
 * string would render `1234` where the server rendered `1,234`.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { pathToFileURL } from 'node:url'
import type { CompileDiagnostic } from '../../compiler/diagnostics'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { createSimulationRealm } from '../../compiler/sim/realm'
import { createGeneratedDir } from '../helpers/generated-corpus'
import { textAt } from './located'

/* === Fixture builders === */

type Spec = {
	tag?: string
	pre?: string
	params?: string
	setup: string
	/** Template content inside the root — the same spelling on both surfaces. */
	body: string
	rootAttrs?: string
}

const NAMES = "import { createState, deriveCell } from '@zeix/le-truc'"
const PARAMS =
	'{ count = 0, when = "2026-01-02" }: { count?: number; when?: string }'

const tsrxSource = ({
	tag = 'c-el',
	pre = '',
	params = PARAMS,
	setup,
	body,
	rootAttrs = '',
}: Spec) => `${NAMES}
${pre}
export function C(${params})
	@{
		${setup}
			<${tag}${rootAttrs}>${body}
				<style>:host {
	  color: red;
	}</style>
			</${tag}>
	}`

const tsxSource = ({
	tag = 'c-el',
	pre = '',
	params = PARAMS,
	setup,
	body,
	rootAttrs = '',
}: Spec) => `import { css } from '@zeix/le-truc-compiler/macros'
${NAMES}
${pre}
export function C(${params}) {
	${setup}
	return (
			<${tag}${rootAttrs}>${body}
				<style>{css\`:host {
	  color: red;
	}\`}</style>
			</${tag}>
	)
}`

const compileBoth = (spec: Spec) => ({
	tsrx: compileComponent(tsrxSource(spec), 'c.tsrx', new Set()),
	tsx: compileComponentTsx(tsxSource(spec), 'c.tsx', new Set()),
})

const errors = (diagnostics: CompileDiagnostic[]) =>
	diagnostics.filter(d => d.severity === 'error')

const STATE = 'const n = createState(count)\n\t\texpose({})'
const BUTTON =
	'<button type="button" onClick={() => n.set(n.get() + 1)}>+</button>'

/* === LTC059: one failing fixture per formatting kind === */

const MESSAGES = `export const i18n = {
	items: '{count, plural, one {# item} other {# items}}',
	price: '{amount, number}',
	due: 'Due {day, date, short}',
	named: 'Hello {name}',
} as const`
const I18N_PARAMS =
	'{ count = 0, when = "2026-01-02", i18n: { t } }: { count?: number; when?: string; i18n: I18n<typeof i18n> }'

const failing: Array<{ name: string; spec: Spec; formatting: string }> = [
	{
		name: '`Intl` in the text thunk',
		spec: {
			setup: STATE,
			body: `<p>{() => new Intl.NumberFormat('en-US').format(n.get())}</p>${BUTTON}`,
		},
		formatting: 'formatted with `Intl`',
	},
	{
		name: '`Intl` through a setup const',
		spec: {
			setup: `const fmt = new Intl.NumberFormat('en-US').format\n\t\t${STATE}`,
			body: `<p>{() => fmt(n.get())}</p>${BUTTON}`,
		},
		formatting: 'formatted with `Intl`',
	},
	{
		name: '`toLocaleString()`',
		spec: {
			setup: STATE,
			body: `<p>{() => n.get().toLocaleString('en-US')}</p>${BUTTON}`,
		},
		formatting: 'formatted with `toLocaleString()`',
	},
	{
		name: '`toLocaleDateString()`',
		spec: {
			setup: 'const d = createState(when)\n\t\texpose({})',
			body: `<p>{() => new Date(d.get()).toLocaleDateString('en-US')}</p><button type="button" onClick={() => d.set('2027-01-01')}>x</button>`,
		},
		formatting: 'formatted with `toLocaleDateString()`',
	},
	{
		name: 'a message call with a plural (number) argument',
		spec: {
			pre: MESSAGES,
			params: I18N_PARAMS,
			setup: STATE,
			body: `<p>{() => t.items({ count: n.get() })}</p>${BUTTON}`,
		},
		formatting: 'formatted with message `t.items`',
	},
	{
		name: 'a message call with a number argument',
		spec: {
			pre: MESSAGES,
			params: I18N_PARAMS,
			setup: STATE,
			body: `<p>{() => t.price({ amount: n.get() })}</p>${BUTTON}`,
		},
		formatting: 'formatted with message `t.price`',
	},
	{
		name: 'a message call with a date argument',
		spec: {
			pre: MESSAGES,
			params: I18N_PARAMS,
			setup: 'const d = createState(when)\n\t\texpose({})',
			body: `<p>{() => t.due({ day: new Date(d.get()) })}</p><button type="button" onClick={() => d.set('2027-01-01')}>x</button>`,
		},
		formatting: 'formatted with message `t.due`',
	},
	{
		name: 'a derived signal over an arg',
		spec: {
			setup: 'const n = deriveCell(() => count * 2)\n\t\texpose({})',
			body: "<p>{() => n.get().toLocaleString('en-US')}</p>",
		},
		formatting: 'formatted with `toLocaleString()`',
	},
]

describe('LTC059: a formatted-only signal with no raw value source', () => {
	for (const { name, spec, formatting } of failing)
		test(name, () => {
			for (const [surface, { component, diagnostics }] of Object.entries(
				compileBoth(spec),
			)) {
				const found = errors(diagnostics)
				expect(
					found.map(d => d.code),
					surface,
				).toEqual(['LTC059'])
				expect(found[0]?.message).toContain('is seeded from server args')
				expect(found[0]?.message).toContain(formatting)
				expect(found[0]?.message).toContain('<data value={() => …}>')
				expect(found[0]?.message).toContain('<time datetime={() => …}>')
				expect(component).toBeNull()
			}
		})

	test('the range covers the formatted text expression', () => {
		const spec = failing[2]?.spec as Spec
		const source = tsrxSource(spec)
		const hit = errors(
			compileComponent(source, 'c.tsrx', new Set()).diagnostics,
		)[0]
		expect(textAt(source, hit)).toContain("n.get().toLocaleString('en-US')")
	})

	test('a message with no number or date argument is not formatting — LTC005 stays', () => {
		const { tsrx, tsx } = compileBoth({
			pre: MESSAGES,
			params: I18N_PARAMS,
			setup: 'const n = createState(String(count))\n\t\texpose({})',
			body: '<p>{() => t.named({ name: n.get() })}</p><button type="button" onClick={() => n.set(\'x\')}>x</button>',
		})
		for (const { diagnostics } of [tsrx, tsx])
			expect(errors(diagnostics).map(d => d.code)).toEqual(['LTC005'])
	})

	test('a literal seed needs no raw source — the client reuses it', () => {
		const { tsrx, tsx } = compileBoth({
			setup: 'const n = createState(0)\n\t\texpose({})',
			body: `<p>{() => n.get().toLocaleString('en-US')}</p>${BUTTON}`,
		})
		for (const { diagnostics, component } of [tsrx, tsx]) {
			expect(errors(diagnostics)).toEqual([])
			expect(component?.clientCode).toContain('createState(0)')
		}
	})
})

/* === Raw sources: the harvest reads them, and connect round-trips === */

const passing: Array<{
	name: string
	spec: Spec
	harvest: string
	markup: string
	text: RegExp
}> = [
	{
		name: 'a reactive `<data value>` beside the number',
		spec: {
			tag: 'c-data',
			setup: STATE,
			body: `<data value={() => n.get()}>{() => n.get().toLocaleString('en-US')}</data>${BUTTON}`,
		},
		harvest: 'createState(asInteger()(String(data.value)))',
		markup:
			'<c-data><data value="1234">1,234</data><button type="button">+</button></c-data>',
		text: /<data value="1234">1,234<\/data>/,
	},
	{
		name: 'a reactive `<time datetime>` beside the date',
		spec: {
			tag: 'c-time',
			setup: 'const d = createState(when)\n\t\texpose({})',
			body: `<time datetime={() => d.get()}>{() => new Date(d.get()).toLocaleDateString('en-US', { timeZone: 'UTC' })}</time><button type="button" onClick={() => d.set('2027-01-01')}>x</button>`,
		},
		harvest: "createState(asString()(time.getAttribute('datetime')))",
		markup:
			'<c-time><time datetime="2026-01-02">1/2/2026</time><button type="button">x</button></c-time>',
		text: /<time datetime="2026-01-02">1\/2\/2026<\/time>/,
	},
	{
		name: 'the arg rendered as `<data value>` — converted back to a number',
		spec: {
			tag: 'c-arg',
			setup: STATE,
			body: `<data value={count}>{() => n.get().toLocaleString('en-US')}</data>${BUTTON}`,
		},
		harvest: "createState(Number(data.getAttribute('value') ?? ''))",
		markup:
			'<c-arg><data value="1234">1,234</data><button type="button">+</button></c-arg>',
		text: /<data value="1234">1,234<\/data>/,
	},
	{
		name: 'the arg rendered as a host attribute',
		spec: {
			tag: 'c-host',
			setup: STATE,
			rootAttrs: ' {count}',
			body: `<p>{() => n.get().toLocaleString('en-US')}</p>${BUTTON}`,
		},
		harvest: "createState(Number(host.getAttribute('count') ?? ''))",
		markup:
			'<c-host count="1234"><p>1,234</p><button type="button">+</button></c-host>',
		text: /<p>1,234<\/p>/,
	},
]

const generated = createGeneratedDir('raw-value-source')
afterAll(() => generated.cleanup())

describe('a raw value source is the harvest site', async () => {
	const realm = createSimulationRealm()
	afterAll(() => realm.dispose())
	const clients: Record<string, string> = {}
	for (const { spec } of passing) {
		const tag = spec.tag as string
		// The `.tsx` root-attribute spelling is `count={count}`.
		const tsrx = compileComponent(tsrxSource(spec), 'c.tsrx', new Set())
		const tsx = compileComponentTsx(
			tsxSource({ ...spec, rootAttrs: spec.rootAttrs ? ' count={count}' : '' }),
			'c.tsx',
			new Set(),
		)
		for (const { component, diagnostics } of [tsrx, tsx]) {
			if (!component)
				throw new Error(diagnostics.map(d => d.message).join('; '))
		}
		clients[tag] = tsrx.component?.clientCode ?? ''
		clients[`${tag}:tsx`] = tsx.component?.clientCode ?? ''
		const path = generated.emit(`${tag}.client.ts`, clients[tag] ?? '')
		await realm.load(() => import(pathToFileURL(path).href))
	}

	for (const { name, spec, harvest, markup, text } of passing) {
		const tag = spec.tag as string
		test(`${name}: both surfaces harvest from it`, () => {
			expect(clients[tag]).toContain(harvest)
			expect(clients[`${tag}:tsx`]).toContain(harvest)
		})
		test(`${name}: connect re-renders the server's formatted text`, async () => {
			const { html } = await realm.render({ markup, component: tag })
			expect(html).toMatch(text)
		})
	}
})
