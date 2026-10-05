/**
 * Per-field harvest of a list seeded from server args (ADR 0046 s7,
 * LT-429), on both surfaces:
 *
 * - a calctable-shaped list round-trips: the server renders the items from
 *   args, the client rebuilds each adopted item field by field — the key
 *   field from `data-key`, the rest from their first text child or reactive
 *   attribute — through the parser the item type infers, so `pricePerUnit`
 *   keeps its decimals;
 * - `harvest()` declares the parsers of an imported item type (a `Date`
 *   field round-trips through an authored parser), and the server reads the
 *   seed through;
 * - the rebuilt item is typed: a wrong parser type or a missing field is a
 *   tsc error, mapped onto the authored line;
 * - an unrendered field fails LTC072, an unparsable one LTC076, a
 *   formatted-only one LTC059;
 * - `harvest()` resolves by binding, through an item's own scopes too
 *   (LT-442's rider), and anywhere but a component-setup `createList` seed
 *   it is refused.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { createSimulationRealm } from '../../compiler/sim/realm'
import {
	fileLineColToOffset,
	fileOffsetToLineCol,
	findSpanForGeneratedOffset,
	type SourceSpan,
} from '../../compiler/spans'
import { createGeneratedDir } from '../helpers/generated-corpus'

const ROOT = path.resolve(import.meta.dir, '../../..')
const FILE = 'server/tests/compiler/fixtures/c-list'

const generated = createGeneratedDir('list-harvest')
afterAll(() => generated.cleanup())

/* === Helpers === */

type Surface = 'tsrx' | 'tsx'

type Parts = {
	/** Import lines and module-level declarations. */
	pre: string
	params: string
	/** The exposed props' type, for the `.tsx` factory context. */
	props: string
	setup: string
	/** The list declaration, the `@for`/`map` head and the item markup. */
	list: { decl: string; item: string; row: string; key?: string }
}

const sourceOf = (surface: Surface, tag: string, parts: Parts): string => {
	const { pre, params, props, setup, list } = parts
	const key = list.key ?? 'k'
	if (surface === 'tsrx')
		return `${pre}
export function C(${params})
	@{
		${list.decl}
		${setup}
		<${tag}>
			<ul data-container>
				@for (const ${list.item} of items; key ${key}) {
					${list.row}
				}
			</ul>
			<style>:host {
	  display: block;
	}</style>
		</${tag}>
	}
`
	return `${pre}
import { css } from '@zeix/le-truc-compiler/macros'
import type { FactoryContext } from '@zeix/le-truc'
export function C(${params}, { expose }: FactoryContext<${props}>) {
	${list.decl}
	${setup}
	return (
		<${tag}>
			<ul data-container>
				{items.map((${list.item}, ${key}) => (
					${list.row}
				))}
			</ul>
			<style>{css\`:host {
	  display: block;
	}\`}</style>
		</${tag}>
	)
}
`
}

const compile = (surface: Surface, tag: string, parts: Parts) => {
	const source = sourceOf(surface, tag, parts)
	const result =
		surface === 'tsrx'
			? compileComponent(source, `${FILE}.tsrx`, new Set([tag]))
			: compileComponentTsx(source, `${FILE}.tsx`, new Set([tag]))
	return { source, ...result }
}

const errorsOf = (result: ReturnType<typeof compile>) =>
	result.diagnostics.filter(d => d.severity === 'error')

const lineOf = (source: string, needle: string): number =>
	source.slice(0, source.indexOf(needle)).split('\n').length

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

const SURFACES: readonly Surface[] = ['tsrx', 'tsx']

/** `markup` as the realm serializes it: a bare attribute takes `=""`. */
const serialized = (markup: string): string =>
	markup.replace(/ (data-container)(?=[ >])/g, ' $1=""')

/* === A calctable-shaped list round-trips === */

const CALC_PRE = `import { createList, createStore, type MutableStore } from '@zeix/le-truc'
type CalcItem = {
	id: string
	description: string
	amount: number
	pricePerUnit: number
}`

const CALC: Parts = {
	pre: CALC_PRE,
	params: '{ rows = [] }: { rows?: CalcItem[] }',
	props: '{ total: number; types: string }',
	setup: `expose({
			total: () => items.get().reduce((sum, row) => sum + row.amount * row.pricePerUnit, 0),
			types: () => items.get().map(row => typeof row.pricePerUnit).join(','),
		})`,
	list: {
		decl: `const items = createList<CalcItem, MutableStore<CalcItem>>(rows, {
			keyConfig: row => row.id,
			createItem: createStore,
		})`,
		item: 'row',
		row: `<li>
						<span class="description">{row.description.get()}</span>
						<span class="amount">{row.amount.get()}</span>
						<data class="price" value={() => String(row.pricePerUnit.get())}>{row.pricePerUnit.get()}</data>
					</li>`,
	},
}

const ROWS = [
	{ id: 'a', description: 'Apples', amount: 2, pricePerUnit: 2.5 },
	{ id: 'b', description: 'Pears', amount: 3, pricePerUnit: 1.25 },
]

describe('a calctable-shaped list round-trips its fields (LT-429)', () => {
	for (const surface of SURFACES) {
		describe(surface, async () => {
			const tag = `c-calc-${surface}`
			const result = compile(surface, tag, CALC)
			const component = result.component
			if (!component) throw new Error(JSON.stringify(result.diagnostics))
			const markup = await render(component.serverCode, { rows: ROWS })
			const { realm, html, diagnostics } = await mount(
				`calc-${surface}`,
				tag,
				component.clientCode,
				markup,
			)
			afterAll(() => realm.dispose())
			const host = () =>
				realm.document.querySelector(tag) as HTMLElement & {
					total: number
					types: string
				}

			test('compiles clean', () => {
				expect(result.diagnostics).toEqual([])
			})

			test('each field reads its site through the inferred parser', () => {
				const client = component.clientCode
				expect(client).toContain(
					".map((el): CalcItem => ({\n\t\t\tid: asString()(el.getAttribute('data-key')),\n\t\t\tdescription: asString()(el.querySelector('span.description')?.textContent),\n\t\t\tamount: asNumber()(el.querySelector('span.amount')?.textContent),\n\t\t\tpricePerUnit: asNumber()(el.querySelector<ElementFromSelector<'data'>>('data')?.value),\n\t\t}))",
				)
				expect(client).toContain(
					"[...container.children].filter(el => el.hasAttribute('data-key'))",
				)
			})

			test('the server renders the items from the arg', () => {
				expect(component.serverCode).toContain(
					'createList<CalcItem, MutableStore<CalcItem>>(rows,',
				)
				expect(markup).toContain('<data value="2.5" class="price">2.5</data>')
			})

			test('connect adopts the items without touching them', () => {
				expect(diagnostics).toEqual([])
				expect(html).toBe(serialized(markup))
			})

			test('pricePerUnit keeps its decimals, as a number', () => {
				expect(host().total).toBe(2 * 2.5 + 3 * 1.25)
				expect(host().types).toBe('number,number')
			})
		})
	}
})

/* === `harvest()` declares an imported type's parsers === */

const DUE_PRE = `import { asParser, asString, createList } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'
import type { DueTask } from './list-harvest-types'`

const asDate = "asParser(v => new Date(v ?? ''))"

const dueParts = (map: string): Parts => ({
	pre: DUE_PRE,
	params: '{ tasks = [] }: { tasks?: DueTask[] }',
	props: '{ years: string }',
	setup: `expose({
			years: () => items.get().map(task => task.due.getUTCFullYear()).join(','),
		})`,
	list: {
		decl: `const items = createList<DueTask>(
			harvest(tasks, {
				${map}
			}),
			{ keyConfig: task => task.id },
		)`,
		item: 'task',
		row: `<li>
						<span class="label">{task.get().label}</span>
						<time datetime={() => String(task.get().due)}></time>
					</li>`,
	},
})

const DUE = dueParts(`id: asString(),
				label: asString(),
				due: ${asDate},`)

const TASKS = [
	{ id: 't1', label: 'File taxes', due: new Date(Date.UTC(2026, 3, 30, 12)) },
	{
		id: 't2',
		label: 'Renew passport',
		due: new Date(Date.UTC(2027, 0, 15, 12)),
	},
]

describe('harvest() declares the parsers of an imported item type (LT-429)', () => {
	for (const surface of SURFACES) {
		describe(surface, async () => {
			const tag = `c-due-${surface}`
			const result = compile(surface, tag, DUE)
			const component = result.component
			if (!component) throw new Error(JSON.stringify(result.diagnostics))
			const markup = await render(component.serverCode, { tasks: TASKS })
			const { realm, html, diagnostics } = await mount(
				`due-${surface}`,
				tag,
				component.clientCode,
				markup,
			)
			afterAll(() => realm.dispose())

			test('compiles clean', () => {
				expect(result.diagnostics).toEqual([])
			})

			test('each entry is spliced into the client as authored', () => {
				expect(component.clientCode).toContain(
					`due: ${asDate}(el.querySelector('time')?.getAttribute('datetime')),`,
				)
				expect(component.clientCode).toContain('.map((el): DueTask => ({')
				expect(component.clientCode).toContain(
					'import type { DueTask } from "../../../server/tests/compiler/fixtures/list-harvest-types"',
				)
			})

			test('the server reads the seed through, and neither module imports the marker', () => {
				expect(component.serverCode).toContain('createList<DueTask>(\n')
				expect(component.serverCode).toContain('\t\ttasks,\n')
				expect(component.serverCode).not.toContain('harvest(')
				expect(component.clientCode).not.toContain('harvest(')
				expect(component.serverCode).not.toContain('/macros')
				expect(component.clientCode).not.toContain('/macros')
			})

			test('the Date field round-trips through its authored parser', () => {
				expect(diagnostics).toEqual([])
				expect(html).toBe(serialized(markup))
				const host = realm.document.querySelector(tag) as HTMLElement & {
					years: string
				}
				expect(host.years).toBe('2026,2027')
			})
		})
	}
})

/* === The rebuilt item is typed (tsc, remapped like check:corpus) === */

type TypedFixture = {
	surface: Surface
	parts: Parts
	/** The authored text each error must be reported on the line of; null: clean. */
	at: string | null
}

const TYPED: Record<string, TypedFixture> = {}
for (const surface of SURFACES) {
	TYPED[`c-due-ok-${surface}`] = { surface, parts: DUE, at: null }
	// A field missing from the map of an imported type: the map's keys are
	// the field list, so the rebuilt item lacks `label`.
	TYPED[`c-due-missing-${surface}`] = {
		surface,
		parts: dueParts(`id: asString(),
				due: ${asDate},`),
		at: 'harvest(tasks',
	}
	// A wrong parser type: `asString()` for a `Date` field.
	TYPED[`c-due-wrong-${surface}`] = {
		surface,
		parts: dueParts(`id: asString(),
				label: asString(),
				due: asString(),`),
		at: 'due: asString()',
	}
	// The same against a same-file type: an entry overrides inference.
	TYPED[`c-calc-wrong-${surface}`] = {
		surface,
		parts: {
			...CALC,
			pre: `${CALC_PRE}
import { asString } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'`,
			list: {
				...CALC.list,
				decl: CALC.list.decl.replace(
					'(rows,',
					`(harvest(rows, {
				amount: asString(),
			}),`,
				),
			},
		},
		at: 'amount: asString()',
	}
}

const compiledTyped = new Map<
	string,
	{ source: string; clientSpans: SourceSpan[]; serverSpans: SourceSpan[] }
>()
const typedCompileErrors: string[] = []
for (const [tag, fixture] of Object.entries(TYPED)) {
	const result = compile(fixture.surface, tag, fixture.parts)
	const errors = errorsOf(result)
	if (!result.component || errors.length > 0) {
		typedCompileErrors.push(`${tag}: ${errors.map(d => d.message).join('; ')}`)
		continue
	}
	generated.emit(`${tag}.client.ts`, result.component.clientCode)
	generated.emit(`${tag}.server.ts`, result.component.serverCode)
	compiledTyped.set(tag, {
		source: result.source,
		clientSpans: result.component.clientSpans,
		serverSpans: result.component.serverSpans,
	})
}

/** Every tsc error per tag, remapped onto the authored line (or -1). */
const typecheck = (): Map<string, Array<{ half: string; line: number }>> => {
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
			...[...compiledTyped.keys()].flatMap(tag => [
				path.join(generated.relativePath, `${tag}.client.ts`),
				path.join(generated.relativePath, `${tag}.server.ts`),
			]),
		],
		{ cwd: ROOT },
	)
	const byTag = new Map<string, Array<{ half: string; line: number }>>()
	const pattern =
		/^.+\/(?<tag>[a-z-]+)\.(?<half>client|server)\.ts\((?<line>\d+),(?<col>\d+)\): error TS\d+/
	for (const raw of proc.stdout.toString().split('\n')) {
		const groups = pattern.exec(raw)?.groups
		if (!groups) continue
		const tag = groups.tag as string
		const entry = compiledTyped.get(tag)
		if (!entry) continue
		const half = groups.half as 'client' | 'server'
		const code = readFileSync(
			path.join(generated.path, `${tag}.${half}.ts`),
			'utf8',
		)
		const offset = fileLineColToOffset(
			code,
			Number(groups.line),
			Number(groups.col),
		)
		const span = findSpanForGeneratedOffset(
			half === 'client' ? entry.clientSpans : entry.serverSpans,
			offset,
		)
		const line =
			span && offset < span.generatedStart + span.length
				? fileOffsetToLineCol(
						entry.source,
						span.sourceStart + (offset - span.generatedStart),
					).line
				: -1
		const list = byTag.get(tag) ?? []
		list.push({ half, line })
		byTag.set(tag, list)
	}
	return byTag
}

describe('the rebuilt item is checked against the item type (LT-429)', () => {
	test('every fixture compiles', () => {
		expect(typedCompileErrors).toEqual([])
	})

	const reported = typecheck()

	for (const [tag, fixture] of Object.entries(TYPED)) {
		if (fixture.at === null) {
			test(`${tag}: a complete map typechecks clean`, () => {
				expect(reported.get(tag) ?? []).toEqual([])
			})
			continue
		}
		const at = fixture.at
		test(`${tag}: fails tsc at the authored line of ${at}`, () => {
			const entry = compiledTyped.get(tag)
			const errors = reported.get(tag) ?? []
			expect(errors.length).toBeGreaterThan(0)
			const line = lineOf(entry?.source ?? '', at)
			for (const error of errors) {
				expect(error.half).toBe('client')
				expect(error.line).toBe(line)
			}
		})
	}
})

/* === LTC072, LTC076, LTC059 === */

const codesOf = (result: ReturnType<typeof compile>) =>
	errorsOf(result).map(d => d.code)

describe('a field the client cannot rebuild fails the build (LT-429)', () => {
	for (const surface of SURFACES) {
		describe(surface, () => {
			test('an unrendered field is LTC072, at the item root', () => {
				const result = compile(surface, `c-nosite-${surface}`, {
					...CALC,
					list: {
						...CALC.list,
						row: `<li>
						<span class="description">{row.description.get()}</span>
						<span class="amount">{row.amount.get()}</span>
					</li>`,
					},
				})
				expect(codesOf(result)).toEqual(['LTC072'])
				const [error] = errorsOf(result)
				expect(error?.message).toContain(
					'Field `pricePerUnit` of list `items` renders nowhere in the item, so the client cannot read it back.',
				)
				expect(error?.message).toContain('`data-price-per-unit={() => …}`')
				expect(error?.location.start).toBe(result.source.indexOf('<li>'))
			})

			test('a field with a site and no inferable type is LTC076, at the seed', () => {
				const result = compile(surface, `c-noparser-${surface}`, {
					pre: `import { createList } from '@zeix/le-truc'
type Task = { id: string; due: Date }`,
					params: '{ tasks = [] }: { tasks?: Task[] }',
					props: 'Record<string, never>',
					setup: 'expose({})',
					list: {
						decl: 'const items = createList(tasks, { keyConfig: task => task.id })',
						item: 'task',
						row: '<li><time datetime={() => String(task.get().due)}></time></li>',
					},
				})
				expect(codesOf(result)).toEqual(['LTC076'])
				const [error] = errorsOf(result)
				expect(error?.message).toContain(
					'Field `due` of list `items` has type `Date`, which the compiler infers no parser from',
				)
				expect(error?.message).toContain(
					'`createList(harvest(tasks, { due: … }), …)`',
				)
				expect(error?.location.start).toBe(
					result.source.indexOf('tasks, { keyConfig'),
				)
			})

			test('an imported item type without harvest() is LTC076 for the whole item', () => {
				const result = compile(surface, `c-opaque-${surface}`, {
					...DUE,
					list: {
						...DUE.list,
						decl: 'const items = createList<DueTask>(tasks, { keyConfig: task => task.id })',
					},
				})
				expect(codesOf(result)).toEqual(['LTC076'])
				expect(errorsOf(result)[0]?.message).toContain(
					'The items of list `items` have type `DueTask`, which the compiler cannot read',
				)
			})

			test('a field rendered only formatted is LTC059', () => {
				const result = compile(surface, `c-formatted-${surface}`, {
					...CALC,
					list: {
						...CALC.list,
						row: `<li>
						<span class="description">{row.description.get()}</span>
						<span class="amount">{row.amount.get()}</span>
						<span class="price">{() => row.pricePerUnit.get().toLocaleString()}</span>
					</li>`,
					},
				})
				expect(codesOf(result)).toEqual(['LTC059'])
				expect(errorsOf(result)[0]?.message).toContain(
					'Field `pricePerUnit` of list `items` is seeded from server args but renders only as text formatted with `toLocaleString()`',
				)
			})
		})
	}
})

/* === harvest() is recognized by binding, in one position === */

describe('harvest() resolves by binding, in its one position (LT-429, LT-442 rider)', () => {
	for (const surface of SURFACES) {
		describe(surface, () => {
			test('an aliased import is the marker', () => {
				const result = compile(surface, `c-alias-${surface}`, {
					...DUE,
					pre: DUE.pre.replace('{ harvest }', '{ harvest as parsed }'),
					list: {
						...DUE.list,
						decl: DUE.list.decl.replace('harvest(', 'parsed('),
					},
				})
				expect(result.diagnostics).toEqual([])
				expect(result.component?.clientCode).toContain(`due: ${asDate}(`)
			})

			test('a literal seed refuses harvest()', () => {
				const result = compile(surface, `c-literal-${surface}`, {
					...DUE,
					list: {
						...DUE.list,
						decl: DUE.list.decl.replace('harvest(tasks,', 'harvest([],'),
					},
				})
				expect(codesOf(result)).toEqual(['LTC005'])
				expect(errorsOf(result)[0]?.message).toContain(
					'A `harvest()` seed on a list seeded with a literal',
				)
			})

			test('harvest() outside a createList seed is refused', () => {
				const result = compile(surface, `c-stray-${surface}`, {
					...DUE,
					setup: `const copy = harvest(tasks, { id: asString() })
		${DUE.setup}`,
				})
				expect(codesOf(result)).toContain('LTC005')
				expect(
					errorsOf(result).some(d =>
						d.message.includes(
							'A `harvest()` call outside the seed of a `createList()`',
						),
					),
				).toBe(true)
			})

			// A `.tsrx` `@for` body's statements are the item's setup.
			const nested = (inner: string): Parts => ({
				...DUE,
				list: {
					...DUE.list,
					row: `${inner}
					<li><span class="label">{task.get().label}</span><time datetime={() => String(task.get().due)}></time></li>`,
				},
			})

			test('a harvest() seed in an item setup is refused', () => {
				const inner = `const parts = createList(harvest([task.get().label], {}), { keyConfig: part => part })`
				const result =
					surface === 'tsrx'
						? compile(surface, `c-item-${surface}`, nested(inner))
						: compileTsxItem(`c-item-${surface}`, inner)
				expect(
					errorsOf(result).some(d =>
						d.message.includes(
							"A `harvest()` seed on a list declared in a reactive-list item's setup",
						),
					),
				).toBe(true)
			})

			test('an item-scope declaration shadows the marker', () => {
				const inner = `const harvest = (label: string) => label.toUpperCase()
					const shout = harvest(task.get().label)`
				const result =
					surface === 'tsrx'
						? compile(surface, `c-shadow-${surface}`, nested(inner))
						: compileTsxItem(`c-shadow-${surface}`, inner)
				expect(
					errorsOf(result).filter(d => d.message.includes('harvest()')),
				).toEqual([])
			})
		})
	}
})

/** A `.tsx` `DUE` list whose `map` callback has a block body with `inner`. */
function compileTsxItem(tag: string, inner: string) {
	const source = `${DUE_PRE}
import { css } from '@zeix/le-truc-compiler/macros'
import type { FactoryContext } from '@zeix/le-truc'
export function C({ tasks = [] }: { tasks?: DueTask[] }, { expose }: FactoryContext<{ years: string }>) {
	${DUE.list.decl}
	${DUE.setup}
	return (
		<${tag}>
			<ul data-container>
				{items.map((task, k) => {
					${inner}
					return <li><span class="label">{task.get().label}</span><time datetime={() => String(task.get().due)}></time></li>
				})}
			</ul>
			<style>{css\`:host {
	  display: block;
	}\`}</style>
		</${tag}>
	)
}
`
	return {
		source,
		...compileComponentTsx(source, `${FILE}.tsx`, new Set([tag])),
	}
}
