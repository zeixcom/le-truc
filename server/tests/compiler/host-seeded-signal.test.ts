/**
 * A signal initializer reading a Parser-backed `host` prop (LT-451), on both
 * surfaces. The shape — `expose({ seed: asJSON(…) })`, then
 * `createList(host.seed, { keyConfig })` under a root `seed={…}` — compiled
 * clean and miscompiled three ways; each is pinned here:
 *
 * - the server folds `host.seed` through `hostSeedExpr` (the parser applied
 *   to the rendered root attribute), so the render shows the items instead
 *   of evaluating against `refStub`;
 * - the client emits setup in source order, so `createList` runs after
 *   `expose()` has installed `seed`, and connect raises nothing;
 * - a substituted declaration keeps the call's other arguments, so the
 *   client's list is keyed by `keyConfig` and `byKey` resolves.
 *
 * A prop with no server truth (no root attribute) routes per ADR 0029
 * instead: the signal leaves the server scope and the component goes to the
 * realm. A literal-free list rendered directly over `host.seed` takes the
 * verbatim route, as a literal seed does.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { createSimulationRealm } from '../../compiler/sim/realm'
import { createGeneratedDir } from '../helpers/generated-corpus'

const FILE = 'server/tests/compiler/fixtures/c-host-seeded'

const generated = createGeneratedDir('host-seeded-signal')
afterAll(() => generated.cleanup())

/* === Helpers === */

type Surface = 'tsrx' | 'tsx'

const SURFACES: readonly Surface[] = ['tsrx', 'tsx']

const PRE = `import { asJSON, createList, deriveList } from '@zeix/le-truc'
type Row = { symbol: string; price: number }`

type Shape = {
	/** The root's attributes, as authored. */
	rootAttrs: string
	/** The setup statements after `expose()`. */
	setup: string
	/** The list the template maps over, and its item markup. */
	list: string
	item: string
	row: string
}

const sourceOf = (surface: Surface, tag: string, shape: Shape): string => {
	const { rootAttrs, setup, list, item, row } = shape
	const expose = `expose({
		seed: asJSON<Row[]>([]),
		price: () => tickers.byKey('b')?.get().price ?? -1,
	})`
	if (surface === 'tsrx')
		return `${PRE}
export function C({ rows = [] }: { rows?: Row[] })
	@{
		${expose}
		${setup}
		<${tag} ${rootAttrs}>
			<ul data-container>
				@for (const ${item} of ${list}; key k) {
					${row}
				}
			</ul>
		</${tag}>
	}
`
	return `${PRE}
import type { FactoryContext } from '@zeix/le-truc'
export function C(
	{ rows = [] }: { rows?: Row[] },
	{ expose, host }: FactoryContext<{ seed: Row[]; price: number }>,
) {
	${expose}
	${setup}
	return (
		<${tag} ${rootAttrs}>
			<ul data-container>
				{${list}.map((${item}, k) => (
					${row}
				))}
			</ul>
		</${tag}>
	)
}
`
}

const compile = (surface: Surface, tag: string, shape: Shape) => {
	const source = sourceOf(surface, tag, shape)
	const result =
		surface === 'tsrx'
			? compileComponent(source, `${FILE}.tsrx`, new Set([tag]))
			: compileComponentTsx(source, `${FILE}.tsx`, new Set([tag]))
	const component = result.component
	if (!component) throw new Error(JSON.stringify(result.diagnostics))
	return { diagnostics: result.diagnostics, component }
}

let renderCount = 0
/** Emit `serverCode` and call its render function with `args`. */
const render = async (serverCode: string, args: unknown): Promise<string> => {
	const file = `render-${++renderCount}.server.ts`
	generated.emit(file, serverCode)
	const mod =
		await generated.importModule<Record<string, (a: unknown) => string>>(file)
	return (mod.renderC as (a: unknown) => string)(args)
}

/** Load `clientCode` into a fresh realm and render `markup` into it. */
const mount = async (
	name: string,
	tag: string,
	clientCode: string,
	markup: string,
) => {
	const clientPath = generated.emit(`${name}.client.ts`, clientCode)
	const realm = createSimulationRealm()
	await realm.load(() => import(pathToFileURL(clientPath).href))
	const rendered = await realm.render({ markup, component: tag })
	return { realm, ...rendered }
}

const ROWS = [
	{ symbol: 'a', price: 1.5 },
	{ symbol: 'b', price: 2.25 },
]

const KEYED = `const tickers = createList<Row>(host.seed, { keyConfig: item => item.symbol })`

/* === The ticker shape: an unrendered list, a derived one rendered === */

const TICKER: Shape = {
	rootAttrs: 'seed={JSON.stringify(rows)}',
	setup: `${KEYED}
		const symbols = deriveList(() => [...tickers.keys()], { keyConfig: s => s })`,
	list: 'symbols',
	item: 'symbol',
	row: `<li>{() => \`\${k}: \${tickers.byKey(k)?.get().price}\`}</li>`,
}

describe('a list seeded from a Parser-backed host prop (LT-451)', () => {
	for (const surface of SURFACES) {
		describe(surface, async () => {
			const tag = `c-ticker-${surface}`
			const { diagnostics, component } = compile(surface, tag, TICKER)
			const markup = await render(component.serverCode, { rows: ROWS })
			const mounted = await mount(
				`ticker-${surface}`,
				tag,
				component.clientCode,
				markup,
			)
			afterAll(() => mounted.realm.dispose())

			test('compiles clean, in the Folded tier', () => {
				expect(diagnostics).toEqual([])
				expect(component.entry.tier).toBe('folded')
			})

			test('the server folds host.seed through the parser and renders the items', () => {
				expect(component.serverCode).toContain(
					'createList<Row>((asJSON([])(attrValue(JSON.stringify(rows)))), { keyConfig: item => item.symbol })',
				)
				expect(markup).toContain('<li data-key="a">a: 1.5</li>')
				expect(markup).toContain('<li data-key="b">b: 2.25</li>')
			})

			test('the client declares the list after expose(), with its options', () => {
				const client = component.clientCode
				const declared = client.indexOf(
					'const tickers = createList<Row>(host.seed, { keyConfig: item => item.symbol })',
				)
				expect(declared).toBeGreaterThan(-1)
				expect(client.indexOf('expose({')).toBeLessThan(declared)
				expect(client.indexOf('const symbols = deriveList(')).toBeGreaterThan(
					declared,
				)
			})

			test('connect raises nothing and keeps the rendered items', () => {
				expect(mounted.diagnostics).toEqual([])
				expect(mounted.html).toBe(
					markup.replace(' data-container>', ' data-container="">'),
				)
			})

			test('byKey resolves by the configured key', () => {
				const host = mounted.realm.document.querySelector(
					tag,
				) as HTMLElement & {
					price: number
				}
				expect(host.price).toBe(2.25)
			})
		})
	}
})

/* === A prop with no server truth routes per ADR 0029 === */

describe('a host prop with no root attribute routes the signal to the realm (LT-451)', () => {
	for (const surface of SURFACES) {
		test(surface, async () => {
			const tag = `c-unfolded-${surface}`
			const { diagnostics, component } = compile(surface, tag, {
				...TICKER,
				rootAttrs: 'data-unfolded',
			})
			expect(diagnostics).toEqual([])
			expect(component.entry.tier).toBe('simulated')
			expect(
				component.entry.routingSignals.map(signal => [
					signal.origin,
					signal.detail,
				]),
			).toEqual([
				[
					'LTC013',
					"`tickers`'s createList() initializer reads host with no server value",
				],
			])
			// No site renders the unresolvable list; the client evaluates it
			// itself, after expose().
			const markup = await render(component.serverCode, { rows: ROWS })
			expect(markup).not.toContain('1.5')
			const client = component.clientCode
			expect(client.indexOf('expose({')).toBeLessThan(
				client.indexOf(`const tickers = createList<Row>(host.seed,`),
			)
		})
	}
})

/* === A list rendered directly over host.seed === */

describe('a list rendered directly over a Parser-backed host prop (LT-451)', () => {
	for (const surface of SURFACES) {
		describe(surface, async () => {
			const tag = `c-direct-${surface}`
			const { diagnostics, component } = compile(surface, tag, {
				rootAttrs: 'seed={JSON.stringify(rows)}',
				setup: KEYED,
				list: 'tickers',
				item: 'ticker',
				row: `<li>{() => String(ticker.get().price)}</li>`,
			})
			const markup = await render(component.serverCode, { rows: ROWS })
			const mounted = await mount(
				`direct-${surface}`,
				tag,
				component.clientCode,
				markup,
			)
			afterAll(() => mounted.realm.dispose())

			test('compiles clean and renders the items keyed by keyConfig', () => {
				expect(diagnostics).toEqual([])
				expect(component.entry.tier).toBe('folded')
				expect(markup).toContain('<li data-key="b">2.25</li>')
			})

			test('the client reuses the declaration verbatim and connects', () => {
				expect(component.clientCode).toContain(KEYED)
				expect(mounted.diagnostics).toEqual([])
				const host = mounted.realm.document.querySelector(
					tag,
				) as HTMLElement & {
					price: number
				}
				expect(host.price).toBe(2.25)
			})
		})
	}
})

/* === A substituted declaration keeps the call's other arguments === */

describe('a harvested declaration keeps its options argument (LT-451)', () => {
	const sources: Record<Surface, string> = {
		tsrx: `import { createState } from '@zeix/le-truc'
export function C({ label = '' }: { label?: string })
	@{
		const text = createState(label, { equals: (a, b) => a === b })
		<c-opts>
			<span>{() => text.get()}</span>
		</c-opts>
	}
`,
		tsx: `import { createState } from '@zeix/le-truc'
export function C({ label = '' }: { label?: string }) {
	const text = createState(label, { equals: (a, b) => a === b })
	return (
		<c-opts>
			<span>{() => text.get()}</span>
		</c-opts>
	)
}
`,
	}
	for (const surface of SURFACES) {
		test(surface, () => {
			const result =
				surface === 'tsrx'
					? compileComponent(sources.tsrx, `${FILE}.tsrx`, new Set(['c-opts']))
					: compileComponentTsx(sources.tsx, `${FILE}.tsx`, new Set(['c-opts']))
			expect(result.diagnostics).toEqual([])
			expect(result.component?.clientCode).toContain(
				'const text = createState(asString()(span.textContent), { equals: (a, b) => a === b })',
			)
		})
	}
})
