/**
 * The Value Harness follows the signal meaning (LT-422, ADR 0046 s3, s5):
 * a list iterates the cells it hands out, keyed exactly as Cause & Effect
 * keys the same seed; a store's fields are signals; `createSensor` is a
 * signal constructor whose `{ value }` seed is its server value.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import {
	createList as realCreateList,
	createStore as realCreateStore,
	deriveList as realDeriveList,
} from '@zeix/cause-effect'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import {
	createList,
	createSensor,
	createStore,
	deriveList,
	type ServerCell,
} from '../../compiler/runtime'
import { createGeneratedDir } from '../helpers/generated-corpus'

type Item = { id: string; label: string }
const items: Item[] = [
	{ id: 'a', label: 'Alpha' },
	{ id: 'b', label: 'Beta' },
	{ id: 'c', label: 'Gamma' },
]

/** The key configurations a list accepts, by name. */
const KEY_CONFIGS: Array<
	[string, undefined | string | ((item: Item) => string | undefined)]
> = [
	['positional', undefined],
	['string prefix', 'item'],
	['function', item => item.id],
	['function falling back', item => (item.id === 'b' ? '' : item.id)],
]

describe('ServerList iterates cells, keyed like Cause & Effect', () => {
	for (const [name, keyConfig] of KEY_CONFIGS) {
		test(`${name} keyConfig: keys, map and byKey match the real list`, () => {
			const options = keyConfig === undefined ? undefined : { keyConfig }
			const real = realCreateList(items, options)
			const realKeys = [...real.keys()]
			const list = createList(items, options)
			expect([...list.keys()]).toEqual(realKeys)
			expect(
				list.map((cell, key): [string, Item | undefined] => [key, cell.get()]),
			).toEqual(realKeys.map(key => [key, real.byKey(key)?.get()]))
			for (const key of realKeys)
				expect(list.byKey(key)?.get()).toEqual(real.byKey(key)?.get())
			expect(list.byKey('missing')).toBeUndefined()
		})
	}

	test('iteration, forEach and entries hand out cells; get() the values', () => {
		const list = createList(items, { keyConfig: 'item' })
		expect([...list].map(cell => cell.get())).toEqual(items)
		const seen: Array<[string, Item]> = []
		list.forEach((cell, key) => seen.push([key, cell.get()]))
		expect(seen).toEqual(list.entries().map(([key, cell]) => [key, cell.get()]))
		expect(list.get()).toEqual(items)
		expect(list.length).toBe(3)
		expect(list.at(1)?.get()).toEqual(items[1])
	})

	test('createItem decides the cell: a store item exposes its fields', () => {
		const list = createList(items, { createItem: createStore })
		expect(list.map(item => item.label.get())).toEqual([
			'Alpha',
			'Beta',
			'Gamma',
		])
	})

	test('deriveList returns the same cell-iterating list', () => {
		const list = deriveList(() => items, { keyConfig: item => item.id })
		expect(list.map((cell, key) => `${key}:${cell.get().label}`)).toEqual([
			'a:Alpha',
			'b:Beta',
			'c:Gamma',
		])
	})
})

describe('deriveList: a list source keyed like Cause & Effect (ADR 0046 s4)', () => {
	test('the compute form keys by its own keyConfig', () => {
		const real = realDeriveList(() => items, { keyConfig: 'd' })
		const list = deriveList(() => items, { keyConfig: 'd' })
		expect([...list.keys()]).toEqual([...real.keys()])
		expect(list.get()).toEqual(real.get())
	})

	test('the source form keeps the source keys and maps each value', () => {
		const realSource = realCreateList(items, { keyConfig: item => item.id })
		const real = realDeriveList(realSource, item => item.label.toUpperCase())
		const source = createList(items, { keyConfig: item => item.id })
		const list = deriveList(source, item => item.label.toUpperCase())
		expect([...list.keys()]).toEqual([...real.keys()])
		expect(list.get()).toEqual(real.get())
		expect(list.map((cell, key) => [key, cell.get()])).toEqual(
			real.map((signal, key) => [key, signal.get()]),
		)
	})
})

describe('createStore: fields are signals, get() the whole value', () => {
	const initial = {
		label: 'Alpha',
		count: 2,
		meta: { tag: 'x' },
		tags: ['p', 'q'],
	}

	test('primitive fields are cells, nested objects stores, arrays lists', () => {
		const store = createStore(initial)
		expect(store.get()).toEqual(initial)
		expect(store.label.get()).toBe('Alpha')
		expect(store.count.get()).toBe(2)
		expect(store.meta.tag.get()).toBe('x')
		expect(store.meta.get()).toEqual({ tag: 'x' })
		expect(store.tags.map(cell => cell.get())).toEqual(['p', 'q'])
	})

	test('field reads match the real MutableStore', () => {
		const real = realCreateStore(initial)
		const store = createStore(initial)
		expect(store.label.get()).toBe(real.label.get())
		expect(store.meta.tag.get()).toBe(real.meta.tag.get())
		expect(store.tags.get()).toEqual(real.tags.get())
	})
})

describe('createSensor: the seed is the server value', () => {
	const start = (_set: (value: string) => void) => () => {}

	test('a seeded sensor reads its seed', () => {
		const sensor: ServerCell<string> = createSensor(start, { value: 'light' })
		expect(sensor.get()).toBe('light')
	})

	test('an unseeded sensor has no server value', () => {
		expect(() => createSensor(start).get()).toThrow('has no { value } seed')
	})

	const generated = createGeneratedDir('value-harness')
	afterAll(() => generated.cleanup())
	const source = (seed: string) => `export function C({}: {})
	@{
		const mode = createSensor<string>(set => { set('dark'); return () => {} }${seed})
		expose({ mode })
			<c-el>
				<p>{() => mode.get()}</p>
				<span>{mode}</span>
				<style>:host {
	  color: red;
	}</style>
			</c-el>
	}
import { createSensor } from '@zeix/le-truc'`

	const render = async (tag: string, seed: string) => {
		const { component, diagnostics } = compileComponent(
			source(seed),
			'c.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('sensor fixture must compile')
		generated.emit(`${tag}.server.ts`, component.serverCode)
		const mod = await generated.importModule<{
			renderC: (args: object) => string
		}>(`${tag}.server.ts`)
		return { component, html: mod.renderC({}) }
	}

	test('a seeded sensor renders its seed at every read site', async () => {
		const { component, html } = await render('seeded', ", { value: 'light' }")
		expect(html).toBe('<c-el><p>light</p><span>light</span></c-el>')
		// The client declares the sensor verbatim: no harvest replaces start.
		expect(component.clientCode).toContain(
			"const mode = createSensor<string>(set => { set('dark'); return () => {} }, { value: 'light' })",
		)
		expect(component.entry.routingSignals ?? []).toEqual([])
	})

	test('an unseeded sensor is unresolvable: every read is omitted', async () => {
		const { component, html } = await render('unseeded', '')
		expect(html).toBe('<c-el><p></p><span></span></c-el>')
		expect(component.entry.routingSignals).toEqual([
			expect.objectContaining({
				origin: 'LTC013',
				resolution: expect.objectContaining({
					by: 'none',
					limb: 'not-a-server-fact',
				}),
			}),
		])
		generated.cleanup()
	})
})

describe('createSensor on the .tsx surface', () => {
	const source = (seed: string) => `import { createSensor } from '@zeix/le-truc'
import type { FactoryContext } from '@zeix/le-truc'

export type CElProps = { mode: string }

export function CEl({}: {}, { expose }: FactoryContext<CElProps>) {
	const mode = createSensor<string>(set => { set('dark'); return () => {} }${seed})
	expose({ mode })
	return (
		<c-el>
			<p>{() => mode.get()}</p>
			<style>{css\`:host {
	  color: red;
	}\`}</style>
		</c-el>
	)
}`

	test('seeded: no routing signal; unseeded: one unresolvable signal', () => {
		const seeded = compileComponentTsx(
			source(", { value: 'light' }"),
			'c-el.tsx',
			new Set(),
		)
		expect(seeded.diagnostics).toEqual([])
		expect(seeded.component?.entry.routingSignals ?? []).toEqual([])
		expect(seeded.component?.serverCode).toContain('textOf(() => mode.get())')
		const unseeded = compileComponentTsx(source(''), 'c-el.tsx', new Set())
		expect(unseeded.diagnostics).toEqual([])
		expect(unseeded.component?.entry.routingSignals).toEqual([
			expect.objectContaining({
				origin: 'LTC013',
				resolution: expect.objectContaining({ by: 'none' }),
			}),
		])
		expect(unseeded.component?.serverCode).not.toContain('mode.get()')
	})
})

describe('the emitted server loop reads the item cell', () => {
	const generated = createGeneratedDir('value-harness-loop')
	afterAll(() => generated.cleanup())

	test('the bare {item} fill renders the value, data-key the key', async () => {
		const { component, diagnostics } = compileComponent(
			`export function L({}: {})
	@{
		const items = createList<string>(['x', 'y'], { keyConfig: 'item' })
			<c-el>
				<ul data-container>
					@for (const item of items; key k) {
						<li><span>{item}</span></li>
					}
				</ul>
				<style>:host {
	  color: red;
	}</style>
			</c-el>
	}
import { createList } from '@zeix/le-truc'`,
			'l.tsrx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('list fixture must compile')
		expect(component.serverCode).toContain('text(item.get())')
		generated.emit('loop.server.ts', component.serverCode)
		const mod = await generated.importModule<{
			renderL: (args: object) => string
		}>('loop.server.ts')
		expect(mod.renderL({})).toContain(
			'<li data-key="item0"><span>x</span></li><li data-key="item1"><span>y</span></li>',
		)
	})
})
