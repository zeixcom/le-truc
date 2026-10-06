/**
 * Harvest through a key alias, witnessed by the render (ADR 0047, LT-453),
 * on both surfaces:
 *
 * - a flat host-level list seeded from args, rendered only through two
 *   levels of derived grouping, harvests per field from the alias scope:
 *   the client reads every alias root in document order across the
 *   enclosing items, and connects the list with its keys in list order;
 * - the server records the keys the alias scope renders and throws
 *   `HarvestWitnessError` when an item is missing or out of order;
 * - each ADR 0047 s1 condition is refused with LTC080, one message each,
 *   identically on both surfaces.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { HarvestWitnessError, witnessHarvest } from '../../compiler/runtime'
import { createSimulationRealm } from '../../compiler/sim/realm'
import { createGeneratedDir } from '../helpers/generated-corpus'

const ROOT = path.resolve(import.meta.dir, '../../..')
const FILE = 'server/tests/compiler/fixtures/c-alias'

const generated = createGeneratedDir('key-alias-harvest')
afterAll(() => generated.cleanup())

/* === Helpers === */

type Surface = 'tsrx' | 'tsx'
const SURFACES: readonly Surface[] = ['tsrx', 'tsx']

const PRE = `import { createList, deriveList } from '@zeix/le-truc'
type Ticker = { symbol: string; price: number; volume: number }`

const SETUP = `const tickers = createList<Ticker>(rows, { keyConfig: t => t.symbol })
		const sections = deriveList(() => [...new Set(tickers.get().map(t => t.symbol.slice(0, 1)))], { keyConfig: s => s })
		expose({ symbols: () => tickers.get().map(t => \`\${t.symbol}:\${t.price}:\${t.volume}\`).join(',') })`

/** The inner list's derivation: every ticker of the section, unless `filter` drops some. */
const symbolsOf = (filter = '') =>
	`const symbols = deriveList(() => tickers.get().filter(t => t.symbol.startsWith(sk)${filter}).map(t => t.symbol), { keyConfig: s => s })`

const ROW = `<tr>
										<th>{() => ticker.get().symbol}</th>
										<td class="price">{() => ticker.get().price}</td>
										<td class="volume">{() => ticker.get().volume}</td>
									</tr>`

const BUMP = `<button type="button" class="bump" onClick={() => { for (const k of tickers.keys()) { const t = tickers.byKey(k)!; t.set({ ...t.get(), price: t.get().price * 2 }) } }}>Bump</button>`

/** A flat list rendered through sections, then symbols, then the alias. */
const grouped = (surface: Surface, tag: string, filter = ''): string =>
	surface === 'tsrx'
		? `${PRE}
export function C({ rows = [] }: { rows?: Ticker[] })
	@{
		${SETUP}
		<${tag}>
			${BUMP}
			<div class="sections">
				@for (const section of sections; key sk) {
					${symbolsOf(filter)}
					<section>
						<h2>{() => section.get()}</h2>
						<table>
							<tbody>
								@for (const s of symbols; key k) {
									const ticker = tickers.byKey(k)!
									${ROW}
								}
							</tbody>
						</table>
					</section>
				}
			</div>
			<style>:host { display: block; }</style>
		</${tag}>
	}
`
		: `${PRE}
import type { FactoryContext } from '@zeix/le-truc'
import { css } from '@zeix/le-truc-compiler/macros'
export function C({ rows = [] }: { rows?: Ticker[] }, { expose }: FactoryContext<{ symbols: string }>) {
		${SETUP}
	return (
		<${tag}>
			${BUMP}
			<div class="sections">
				{sections.map((section, sk) => {
					${symbolsOf(filter)}
					return (
						<section>
							<h2>{() => section.get()}</h2>
							<table>
								<tbody>
									{symbols.map((s, k) => {
										const ticker = tickers.byKey(k)!
										return (
											${ROW}
										)
									})}
								</tbody>
							</table>
						</section>
					)
				})}
			</div>
			<style>{css\`:host { display: block; }\`}</style>
		</${tag}>
	)
}
`

const compile = (surface: Surface, source: string, tag: string) =>
	surface === 'tsrx'
		? compileComponent(source, `${FILE}.tsrx`, new Set([tag]))
		: compileComponentTsx(source, `${FILE}.tsx`, new Set([tag]))

/** A generated module without its provenance header. */
const body = (code: string | undefined): string =>
	(code ?? '').replace(/^\/\*\*[\s\S]*?\*\/\n/, '')

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

const settle = async () => {
	for (let i = 0; i < 20; i++) await Promise.resolve()
}

const ROWS = [
	{ symbol: 'AAA', price: 1.25, volume: 10 },
	{ symbol: 'ABC', price: 2.5, volume: 20 },
	{ symbol: 'BXY', price: 3, volume: 0 },
]

/* === A flat list through two levels of derived grouping === */

describe('a flat list harvests through its key alias (LT-453)', () => {
	const tag = 'c-grouped'
	const fromTsrx = compile('tsrx', grouped('tsrx', tag), tag)
	const fromTsx = compile('tsx', grouped('tsx', tag), tag)
	const component = fromTsrx.component
	if (!component) throw new Error(JSON.stringify(fromTsrx.diagnostics))

	test('both surfaces compile clean, to the same modules', () => {
		expect(fromTsrx.diagnostics).toEqual([])
		expect(fromTsx.diagnostics).toEqual([])
		expect(body(fromTsx.component?.serverCode)).toBe(body(component.serverCode))
		expect(body(fromTsx.component?.clientCode)).toBe(body(component.clientCode))
	})

	test('each field reads its site in the alias scope, across the enclosing items', () => {
		expect(component.clientCode).toContain(
			"const tickers = createList<Ticker>([...container.children].filter(el => el.hasAttribute('data-key')).flatMap(el => [...(el.querySelector('tbody')?.children ?? [])]).filter(el => el.hasAttribute('data-key')).map((el): Ticker => ({\n\t\t\tsymbol: asString()(el.getAttribute('data-key')),\n\t\t\tprice: asNumber()(el.querySelector('td.price')?.textContent),\n\t\t\tvolume: asNumber()(el.querySelector('td.volume')?.textContent),\n\t\t})), { keyConfig: t => t.symbol })",
		)
	})

	test('both generated modules typecheck', () => {
		const files = SURFACES.flatMap(surface => {
			const code = (surface === 'tsrx' ? fromTsrx : fromTsx).component
			return [
				generated.emit(`typed-${surface}.client.ts`, code?.clientCode ?? ''),
				generated.emit(`typed-${surface}.server.ts`, code?.serverCode ?? ''),
			]
		})
		const proc = Bun.spawnSync(
			[
				'bunx',
				'tsc',
				'--ignoreConfig',
				'--noEmit',
				'--pretty',
				'false',
				'--strict',
				'--target',
				'esnext',
				'--module',
				'esnext',
				'--moduleResolution',
				'bundler',
				'--lib',
				'esnext,dom',
				'--skipLibCheck',
				'--types',
				'node',
				...files.map(file => path.relative(ROOT, file)),
			],
			{ cwd: ROOT },
		)
		expect(proc.stdout.toString()).toBe('')
		expect(proc.exitCode).toBe(0)
	}, 60_000)

	test('the server records the alias keys and checks them at render end', () => {
		expect(component.serverCode).toContain('const __witness0: string[] = []')
		expect(component.serverCode).toContain('__witness0.push(k)')
		expect(component.serverCode).toContain(
			"witnessHarvest('c-grouped', 'tickers', tickers.keys(), __witness0)",
		)
		expect(component.clientCode).not.toContain('witness')
	})

	describe('connect', async () => {
		const markup = await render(component.serverCode, { rows: ROWS })
		const { realm, html, diagnostics } = await mount(
			'grouped',
			tag,
			component.clientCode,
			markup,
		)
		afterAll(() => realm.dispose())
		const host = () =>
			realm.document.querySelector(tag) as HTMLElement & { symbols: string }
		const prices = () =>
			[...realm.document.querySelectorAll(`${tag} td.price`)].map(
				el => el.textContent,
			)

		test('adopts both levels without touching them', () => {
			expect(diagnostics).toEqual([])
			expect(html).toBe(markup)
			expect(markup).toContain('<section data-key="B"><h2>B</h2>')
		})

		test('rebuilds the list with every key, in list order, fields parsed', () => {
			expect(host().symbols).toBe('AAA:1.25:10,ABC:2.5:20,BXY:3:0')
		})

		test('a write to the list reaches every alias site', async () => {
			;(
				realm.document.querySelector(`${tag} button.bump`) as HTMLElement
			).click()
			await settle()
			expect(prices()).toEqual(['2.5', '5', '6'])
			expect(host().symbols).toBe('AAA:2.5:10,ABC:5:20,BXY:6:0')
		})
	})
})

/* === The render witness === */

describe('the render witness (LT-453)', () => {
	test('a block the server gates off fails the render, naming the key', async () => {
		const tag = 'c-gated'
		const result = compile('tsx', grouped('tsx', tag, ' && t.volume > 0'), tag)
		expect(result.diagnostics).toEqual([])
		const serverCode = result.component?.serverCode ?? ''
		const error = await render(serverCode, { rows: ROWS }).catch(e => e)
		expect(error).toBeInstanceOf(Error)
		expect((error as Error).name).toBe('HarvestWitnessError')
		expect((error as Error).message).toBe(
			'<c-gated> rendered no item with key `BXY` of list `tickers` through its key alias, so the client would rebuild `tickers` without it. The client reads the list back from the rendered items only — render every item of `tickers` once at the alias scope, and do not gate a group off on the server.',
		)
	})

	test('an item rendered out of list order fails the render', async () => {
		const tag = 'c-ordered'
		const result = compile('tsrx', grouped('tsrx', tag), tag)
		const serverCode = result.component?.serverCode ?? ''
		const rows = [ROWS[0], ROWS[2], ROWS[1]]
		const error = await render(serverCode, { rows }).catch(e => e)
		expect((error as Error).name).toBe('HarvestWitnessError')
		expect((error as Error).message).toContain(
			'<c-ordered> rendered key `BXY` of list `tickers` out of order through its key alias: the list holds it at position 2, the render first reached it at position 3.',
		)
	})

	test('witnessHarvest: first occurrences count, an unknown key fails', () => {
		expect(() =>
			witnessHarvest('c-x', 'xs', ['a', 'b'], ['a', 'a', 'b', 'a']),
		).not.toThrow()
		expect(() => witnessHarvest('c-x', 'xs', ['a'], ['a', 'z'])).toThrow(
			HarvestWitnessError,
		)
		expect(() => witnessHarvest('c-x', 'xs', ['a'], ['a', 'z'])).toThrow(
			'rendered key `z` through the key alias of list `xs`, which holds no item with that key',
		)
		expect(() => witnessHarvest('c-x', 'xs', ['a', 'b'], [])).toThrow(
			'rendered no item with key `a`',
		)
	})
})

/* === LTC080: the four conditions === */

/** A one-level alias over a host-level `symbols` list, with `alias` as the item setup. */
const flat = (
	surface: Surface,
	parts: {
		symbols?: string
		alias?: string
		row?: string
		extra?: Record<Surface, string>
	},
): string => {
	const symbols =
		parts.symbols ??
		'const symbols = deriveList(() => tickers.get().map(t => t.symbol), { keyConfig: s => s })'
	const alias = parts.alias ?? 'const ticker = tickers.byKey(k)!'
	const row =
		parts.row ??
		`<li>
					<span class="price">{() => ticker.get().price}</span>
					<span class="volume">{() => ticker.get().volume}</span>
				</li>`
	const extra = parts.extra?.[surface] ?? ''
	if (surface === 'tsrx')
		return `${PRE}
export function C({ rows = [] }: { rows?: Ticker[] })
	@{
		const tickers = createList<Ticker>(rows, { keyConfig: t => t.symbol })
		${symbols}
		<c-flat>
			<ul class="a">
				@for (const s of symbols; key k) {
					${alias}
					${row}
				}
			</ul>
			${extra}
			<style>:host { display: block; }</style>
		</c-flat>
	}
`
	return `${PRE}
import { css } from '@zeix/le-truc-compiler/macros'
export function C({ rows = [] }: { rows?: Ticker[] }) {
	const tickers = createList<Ticker>(rows, { keyConfig: t => t.symbol })
	${symbols}
	return (
		<c-flat>
			<ul class="a">
				{symbols.map((s, k) => {
					${alias}
					return (
						${row}
					)
				})}
			</ul>
			${extra}
			<style>{css\`:host { display: block; }\`}</style>
		</c-flat>
	)
}
`
}

const ltc080 = (
	parts: Parameters<typeof flat>[1],
): { tsrx: string[]; tsx: string[] } => {
	const of = (surface: Surface) =>
		compile(surface, flat(surface, parts), 'c-flat').diagnostics.map(
			d => `${d.code}: ${d.message}`,
		)
	return { tsrx: of('tsrx'), tsx: of('tsx') }
}

describe('LTC080 refuses each unmet ADR 0047 s1 condition (LT-453)', () => {
	test('the base shape compiles clean on both surfaces', () => {
		expect(ltc080({})).toEqual({ tsrx: [], tsx: [] })
	})

	test('the aliasing list does not key each item by itself', () => {
		const found = ltc080({
			symbols:
				'const symbols = deriveList(() => tickers.get().map(t => t.symbol), { keyConfig: s => s.toLowerCase() })',
		})
		expect(found.tsx).toEqual(found.tsrx)
		expect(found.tsrx).toEqual([
			'LTC080: List `symbols`, whose items read list `tickers` through the key alias `ticker`, does not key each item by the item itself. The client rebuilds `tickers` from the keys of `symbols`, so each item must be a key of `tickers` — declare `symbols` with `keyConfig: s => s`.',
		])
	})

	test('a byKey read over another value than the loop key', () => {
		const found = ltc080({
			alias: 'const ticker = tickers.byKey(s.get())!',
		})
		expect(found.tsx).toEqual(found.tsrx)
		expect(found.tsrx).toEqual([
			'LTC080: This `tickers.byKey()` read in the item setup of list `symbols` is not a key alias, so the client cannot rebuild `tickers` from the items. A key alias reads `byKey` over the loop key, unconditionally, as its own statement — declare it as `const t = tickers.byKey(k)`, and read the item through `t`.',
		])
	})

	test('a conditional byKey read', () => {
		const found = ltc080({
			alias: 'const ticker = s.get() ? tickers.byKey(k)! : tickers.byKey(k)!',
		})
		expect(found.tsx).toEqual(found.tsrx)
		expect(found.tsrx).toHaveLength(2)
		expect(found.tsrx[0]).toStartWith(
			'LTC080: This `tickers.byKey()` read in the item setup of list `symbols` is not a key alias',
		)
	})

	test('a second alias scope', () => {
		const found = ltc080({
			extra: {
				tsrx: `<ol class="b">
				@for (const s of symbols; key k) {
					const again = tickers.byKey(k)!
					<li>{() => again.get().price}</li>
				}
			</ol>`,
				tsx: `<ol class="b">
				{symbols.map((s, k) => {
					const again = tickers.byKey(k)!
					return <li>{() => again.get().price}</li>
				})}
			</ol>`,
			},
		})
		expect(found.tsx).toEqual(found.tsrx)
		expect(found.tsrx).toEqual([
			'LTC080: List `tickers` already has the key alias `ticker` in list `symbols`, so the key alias `again` is a second one. The client rebuilds `tickers` from one alias scope, where each field has one site — read `tickers` through `ticker` only, and remove this alias.',
		])
	})

	test('a field that renders nowhere in the alias scope', () => {
		const found = ltc080({
			row: `<li>
					<span class="price">{() => ticker.get().price}</span>
				</li>`,
		})
		expect(found.tsx).toEqual(found.tsrx)
		expect(found.tsrx).toEqual([
			"LTC080: Field `volume` of list `tickers` renders nowhere in the item of its key alias `ticker`, so the client cannot read it back. The client rebuilds each item of `tickers` from the alias scope's markup — render the raw value there, reading exactly the field: `{() => ticker.get().volume}`, or `<data value={() => ticker.get().volume}>`.",
		])
	})

	test('a field rendered only formatted keeps the raw-source rule (LTC059)', () => {
		const found = ltc080({
			row: `<li>
					<span class="price">{() => ticker.get().price}</span>
					<span class="volume">{() => ticker.get().volume.toLocaleString()}</span>
				</li>`,
		})
		expect(found.tsx).toEqual(found.tsrx)
		expect(found.tsrx.map(d => d.slice(0, 6))).toEqual(['LTC059'])
	})

	test('an alias scope inside a conditional arm has no connect-time path (LTC005)', () => {
		const list = (open: string, close: string) => `${open}
				<ul class="a">
					LOOP
				</ul>
			${close}`
		const sources: Record<Surface, string> = {
			tsrx: `${PRE}
export function C({ rows = [] }: { rows?: Ticker[] })
	@{
		const tickers = createList<Ticker>(rows, { keyConfig: t => t.symbol })
		const symbols = deriveList(() => tickers.get().map(t => t.symbol), { keyConfig: s => s })
		const open = createState(true)
		<c-flat>
			${list('@if (open.get()) {', '} @else { <p>closed</p> }').replace(
				'LOOP',
				`@for (const s of symbols; key k) {
						const ticker = tickers.byKey(k)!
						<li>{() => ticker.get().price}</li>
					}`,
			)}
			<style>:host { display: block; }</style>
		</c-flat>
	}
`,
			tsx: `${PRE}
import { css } from '@zeix/le-truc-compiler/macros'
export function C({ rows = [] }: { rows?: Ticker[] }) {
	const tickers = createList<Ticker>(rows, { keyConfig: t => t.symbol })
	const symbols = deriveList(() => tickers.get().map(t => t.symbol), { keyConfig: s => s })
	const open = createState(true)
	return (
		<c-flat>
			${list('{open.get() ? (', ') : (<p>closed</p>)}').replace(
				'LOOP',
				`{symbols.map((s, k) => {
						const ticker = tickers.byKey(k)!
						return <li>{() => ticker.get().price}</li>
					})}`,
			)}
			<style>{css\`:host { display: block; }\`}</style>
		</c-flat>
	)
}
`,
		}
		for (const surface of SURFACES) {
			const found = compile(
				surface,
				sources[surface].replace(
					'{ createList, deriveList }',
					'{ createList, createState, deriveList }',
				),
				'c-flat',
			).diagnostics.map(d => `${d.code}: ${d.message}`)
			expect(found).toHaveLength(1)
			expect(found[0]).toStartWith(
				'LTC005: The key alias `ticker` of list `tickers`, inside a conditional arm',
			)
		}
	})
})
