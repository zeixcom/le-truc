/**
 * Per-item setup (ADR 0046 s2, s5; LT-426), end to end on both surfaces:
 *
 * - the block body of a `.tsx` `map` callback and the statements of a
 *   `.tsrx` `@for` body are the item's setup, classified by the
 *   component-setup rules with the item and key as known names;
 * - a plain const runs in both phases: per initial item in the server's
 *   loop, per entering item in `bindItem` — an attribute over the item's
 *   consts is set once at clone, like a key-derived one;
 * - a signal declared over the item is evaluated once per initial item by
 *   the value harness and per item on the client; a `createSensor` seed is
 *   its server value, and a condition over it switches arms in the item;
 * - `first()` naming the item root resolves to the element parameter;
 * - a client-only side effect runs in `bindItem` only;
 * - a `deriveList` declared in the item drives a nested list.
 *
 * The refusals are pinned for parity in `tsx/diagnostic-parity.test.ts`.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { pathToFileURL } from 'node:url'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { createSimulationRealm } from '../../compiler/sim/realm'
import { createGeneratedDir } from '../helpers/generated-corpus'

const generated = createGeneratedDir('item-setup')
afterAll(() => generated.cleanup())

/* === Helpers === */

const STYLE_TSRX = `<style>:host {
	  display: block;
	}</style>`
const STYLE_TSX = `<style>{css\`:host {
	  display: block;
	}\`}</style>`

/** A `.tsrx` component `C` around `body`. */
const tsrx = (pre: string, setup: string, body: string): string => `${pre}
export function C({}: {})
	@{
		${setup}
			<c-el>${body}
				${STYLE_TSRX}
			</c-el>
	}
`

/** A `.tsx` component `C` around `body`, typed factory context. */
const tsx = (
	pre: string,
	context: string,
	setup: string,
	body: string,
): string => `${pre}
import type { FactoryContext } from '@zeix/le-truc'

export function C({}: {}, { ${context} }: FactoryContext<{}>) {
	${setup}
	return (
			<c-el>${body}
				${STYLE_TSX}
			</c-el>
	)
}
`

/** Both surfaces compiled, with their diagnostics. */
const compileBoth = (sources: { tsrx: string; tsx: string }) => ({
	fromTsrx: compileComponent(sources.tsrx, 'c.tsrx', new Set()),
	fromTsx: compileComponentTsx(sources.tsx, 'c.tsx', new Set()),
})

/** A generated module without its provenance header. */
const body = (code: string | undefined): string =>
	(code ?? '').replace(/^\/\*\*[\s\S]*?\*\/\n/, '')

let renderCount = 0
/** Emit `serverCode` and call its render function. */
const render = async (serverCode: string): Promise<string> => {
	const file = `render-${++renderCount}.server.ts`
	generated.emit(file, serverCode)
	const mod =
		await generated.importModule<Record<string, (a: unknown) => string>>(file)
	return (mod.renderC as (a: unknown) => string)({})
}

/** `markup` as the realm serializes it: boolean attributes take `=""`. */
const serialized = (markup: string): string =>
	markup.replace(/ (data-unreconciled|hidden)(?=[ >])/g, ' $1=""')

const settle = async () => {
	for (let i = 0; i < 20; i++) await Promise.resolve()
}

/** Load `clientCode` into a fresh realm and render `markup` into it. */
const mount = async (name: string, clientCode: string, markup: string) => {
	const clientPath = generated.emit(`${name}.client.ts`, clientCode)
	const realm = createSimulationRealm()
	await realm.load(() => import(pathToFileURL(clientPath).href))
	const rendered = await realm.render({ markup, component: 'c-el' })
	return { realm, ...rendered }
}

/* === Consts, signals, a root ref, a sensor and a side effect per item === */

const PRE =
	"import { createList, createMemo, createSensor, createStore, type MutableStore } from '@zeix/le-truc'\ntype Task = { title: string; done: boolean }"
const TASKS = `const tasks = createList<Task, MutableStore<Task>>([{ title: 'a', done: false }, { title: 'b', done: true }], { keyConfig: t => t.title, createItem: createStore })`
const ITEM_SETUP = `const id = \`task-\${k}\`
						const label = createMemo(() => \`\${task.title.get()}\${task.done.get() ? ' (done)' : ''}\`)
						const row = first('li')
						const picked = createSensor<boolean>(set => {
							const pick = () => set(true)
							row.addEventListener('pick', pick)
							return () => row.removeEventListener('pick', pick)
						}, { value: false })
						watch(label, text => { row.title = text })`
const ITEM_BODY = (arm: string) => `<li>
							<input type="checkbox" id={id} />
							<label for={id} class="label">{() => label.get()}</label>
							<button type="button" class="finish" onClick={() => { task.done.set(true) }}>finish</button>
							${arm}
						</li>`

const SETUP = {
	tsrx: tsrx(
		PRE,
		`${TASKS}
		expose({})`,
		`
				<button type="button" class="add" onClick={() => { tasks.add({ title: 'c', done: false }) }}>Add</button>
				<ul class="tasks">
					@for (const task of tasks; key k) {
						${ITEM_SETUP}
						${ITEM_BODY('@if (picked.get()) { <b class="picked" data-for={id}>picked</b> } @else { <i class="idle">idle</i> }')}
					}
				</ul>`,
	),
	tsx: tsx(
		PRE,
		'expose, first, watch',
		`${TASKS}
	expose({})`,
		`
				<button type="button" class="add" onClick={() => { tasks.add({ title: 'c', done: false }) }}>Add</button>
				<ul class="tasks">
					{tasks.map((task, k) => {
						${ITEM_SETUP}
						return (
							${ITEM_BODY('{picked.get() ? <b class="picked" data-for={id}>picked</b> : <i class="idle">idle</i>}')}
						)
					})}
				</ul>`,
	),
}

describe('per-item setup: consts, signals, a root ref, a sensor', async () => {
	const { fromTsrx, fromTsx } = compileBoth(SETUP)
	const component = fromTsrx.component
	if (!component) throw new Error(JSON.stringify(fromTsrx.diagnostics))
	const markup = await render(component.serverCode)
	const { realm, html, diagnostics } = await mount(
		'setup',
		component.clientCode,
		markup,
	)
	afterAll(() => realm.dispose())
	const item = (key: string) =>
		realm.document.querySelector(
			`c-el ul.tasks > li[data-key="${key}"]`,
		) as HTMLElement
	const template = markup.slice(markup.indexOf('<template data-list="0">'))

	test('both surfaces compile clean, to the same modules', () => {
		expect(fromTsrx.diagnostics).toEqual([])
		expect(fromTsx.diagnostics).toEqual([])
		expect(body(fromTsx.component?.serverCode)).toBe(body(component.serverCode))
		expect(body(fromTsx.component?.clientCode)).toBe(body(component.clientCode))
	})

	test("the server declares the item's consts and signals per initial item, not its ref or side effect", () => {
		const loop = component.serverCode.slice(
			component.serverCode.indexOf('for (const [k, task] of tasks.entries())'),
		)
		expect(loop).toContain('const id = `task-${k}`')
		expect(loop).toContain('const label = createMemo(')
		expect(loop).toContain('const picked = createSensor<boolean>(')
		// The sensor's start callback names the client's ref: stubbed.
		expect(loop).toContain('const row: any = refStub')
		expect(component.serverCode).not.toContain('watch(label')
	})

	test('each live item renders its const attributes, memo text and the sensor seed arm', () => {
		expect(markup).toContain('<input type="checkbox" id="task-a">')
		expect(markup).toContain(
			'<label for="task-b" class="label">b (done)</label>',
		)
		expect(markup).toContain('<i data-key="else" class="idle">idle</i>')
	})

	test("the template bakes the item's const attributes and memo text empty", () => {
		expect(template).toContain('<input type="checkbox">')
		expect(template).toContain('<label class="label"></label>')
	})

	test('bindItem mounts the setup in source order, the root ref as the element parameter', () => {
		const client = component.clientCode
		expect(client).toContain(
			'reconcile(container, host.querySelector<HTMLTemplateElement>(\':scope > template[data-list="0"]\')!, tasks, (_element, task, k, first) => {',
		)
		expect(client).toContain(
			"const row = _element as ElementFromSelector<'li'>",
		)
		const order = [
			'const id = `task-${k}`',
			'const label = createMemo(',
			'const row = _element',
			'const picked = createSensor<boolean>(',
			'watch(label, text => { row.title = text })',
			"input.setAttribute('id', id)",
			"label2.setAttribute('for', id)",
		].map(line => client.indexOf(line))
		expect(order.every(at => at >= 0)).toBe(true)
		expect([...order].sort((x, y) => x - y)).toEqual(order)
	})

	test("connect adopts every item, changing nothing but what the item's side effect writes", () => {
		expect(diagnostics).toEqual([])
		expect(html).toBe(
			serialized(markup).replace(
				/<li data-key="(a|b)"/g,
				(open, key) => `${open} title="${key === 'a' ? 'a' : 'b (done)'}"`,
			),
		)
		expect(item('a').title).toBe('a')
		expect(item('b').title).toBe('b (done)')
	})

	test('a per-item memo follows its item', async () => {
		;(item('a').querySelector('button.finish') as HTMLElement).click()
		await settle()
		expect(item('a').querySelector('label')?.textContent).toBe('a (done)')
		expect(item('a').title).toBe('a (done)')
	})

	test('a per-item sensor switches its arm in its own item only', async () => {
		item('b').dispatchEvent(new realm.window.Event('pick'))
		await settle()
		// The arm's mount sets its attribute over the item's const.
		expect(item('b').querySelector('b.picked')?.getAttribute('data-for')).toBe(
			'task-b',
		)
		expect(item('a').querySelector('i.idle')).not.toBeNull()
	})

	test('a cloned item runs its own setup: its consts set at clone, its memo and side effect bound', async () => {
		;(realm.document.querySelector('c-el button.add') as HTMLElement).click()
		await settle()
		const c = item('c')
		expect(c.querySelector('input')?.id).toBe('task-c')
		expect(c.querySelector('label')?.getAttribute('for')).toBe('task-c')
		expect(c.querySelector('label')?.textContent).toBe('c')
		expect(c.title).toBe('c')
		expect(c.querySelector('i.idle')).not.toBeNull()
		c.dispatchEvent(new realm.window.Event('pick'))
		await settle()
		expect(c.querySelector('b.picked')).not.toBeNull()
	})
})

/* === A nested list over an item-declared deriveList === */

const GROUPS = `const groups = createList<Group, MutableStore<Group>>([{ name: 'x', tags: 'p q' }, { name: 'y', tags: '' }], { keyConfig: g => g.name, createItem: createStore })`
const GROUP_PRE =
	"import { createList, createStore, deriveList, type MutableStore } from '@zeix/le-truc'\ntype Group = { name: string; tags: string }"
const GROUP_SETUP =
	"const tags = deriveList(() => group.tags.get().split(' ').filter(Boolean), { keyConfig: t => t })"

const NESTED = {
	tsrx: tsrx(
		GROUP_PRE,
		`${GROUPS}
		expose({})`,
		`
				<button type="button" class="add" onClick={() => { groups.add({ name: 'z', tags: 'r' }) }}>Add</button>
				<ul class="groups">
					@for (const group of groups; key g) {
						${GROUP_SETUP}
						<li>
							<span class="name">{() => group.name.get()}</span>
							<button type="button" class="tag" onClick={() => { group.tags.set(\`\${group.tags.get()} s\`) }}>tag</button>
							<ul class="tags">
								@for (const tag of tags; key t) {
									<li class="tag">{() => tag.get()}</li>
								} @empty {
									<li class="none">none</li>
								}
							</ul>
						</li>
					}
				</ul>`,
	),
	tsx: tsx(
		GROUP_PRE,
		'expose',
		`${GROUPS}
	expose({})`,
		`
				<button type="button" class="add" onClick={() => { groups.add({ name: 'z', tags: 'r' }) }}>Add</button>
				<ul class="groups">
					{groups.map((group, g) => {
						${GROUP_SETUP}
						return (
							<li>
								<span class="name">{() => group.name.get()}</span>
								<button type="button" class="tag" onClick={() => { group.tags.set(\`\${group.tags.get()} s\`) }}>tag</button>
								<ul class="tags">
									{tags.length === 0 ? (
										<li class="none">none</li>
									) : (
										tags.map((tag, t) => <li class="tag">{() => tag.get()}</li>)
									)}
								</ul>
							</li>
						)
					})}
				</ul>`,
	),
}

describe('a nested list over an item-declared deriveList', async () => {
	const { fromTsrx, fromTsx } = compileBoth(NESTED)
	const component = fromTsrx.component
	if (!component) throw new Error(JSON.stringify(fromTsrx.diagnostics))
	const markup = await render(component.serverCode)
	const { realm, html, diagnostics } = await mount(
		'nested',
		component.clientCode,
		markup,
	)
	afterAll(() => realm.dispose())
	const group = (key: string) =>
		realm.document.querySelector(
			`c-el ul.groups > li[data-key="${key}"]`,
		) as HTMLElement
	const tagsOf = (key: string) =>
		[...group(key).querySelectorAll('li.tag[data-key]')].map(
			el => el.textContent,
		)

	test('both surfaces compile clean, to the same modules', () => {
		expect(fromTsrx.diagnostics).toEqual([])
		expect(fromTsx.diagnostics).toEqual([])
		expect(body(fromTsx.component?.serverCode)).toBe(body(component.serverCode))
		expect(body(fromTsx.component?.clientCode)).toBe(body(component.clientCode))
	})

	test("each live group renders its own list's items; the outer template renders none", () => {
		expect(markup).toContain(
			'<ul class="tags"><li data-key="p" class="tag">p</li><li data-key="q" class="tag">q</li>',
		)
		const template = markup.slice(markup.indexOf('<template data-list="0">'))
		expect(template).not.toContain('data-key="p"')
		expect(template).toContain('<template data-list="1">')
	})

	test('the nested list reconciles over the item-declared List in the item mount', () => {
		expect(component.clientCode).toContain(
			'const tags = deriveList(() => group.tags.get()',
		)
		expect(component.clientCode).toMatch(
			/reconcile\(ul, li\.querySelector<HTMLTemplateElement>\(':scope > template\[data-list="1"\]'\)!, tags,/,
		)
	})

	test('connect adopts both levels without touching them', () => {
		expect(diagnostics).toEqual([])
		expect(html).toBe(serialized(markup))
		expect(tagsOf('x')).toEqual(['p', 'q'])
		expect((group('y').querySelector('li.none') as HTMLElement).hidden).toBe(
			false,
		)
	})

	test('a change to the item re-derives its own list', async () => {
		;(group('y').querySelector('button.tag') as HTMLElement).click()
		await settle()
		expect(tagsOf('y')).toEqual(['s'])
		expect((group('y').querySelector('li.none') as HTMLElement).hidden).toBe(
			true,
		)
		expect(tagsOf('x')).toEqual(['p', 'q'])
	})

	test('a cloned group derives and reconciles its own list', async () => {
		;(realm.document.querySelector('c-el button.add') as HTMLElement).click()
		await settle()
		expect(tagsOf('z')).toEqual(['r'])
		;(group('z').querySelector('button.tag') as HTMLElement).click()
		await settle()
		expect(tagsOf('z')).toEqual(['r', 's'])
	})
})

/* === The `.tsrx` signal shorthand over a per-item signal === */

describe('the `.tsrx` shorthand over a per-item signal', async () => {
	const source = tsrx(
		"import { createList, createMemo } from '@zeix/le-truc'",
		`const items = createList<string>(['a', 'b'], { keyConfig: s => s })
		expose({})`,
		`
				<ul class="list">
					@for (const item of items; key k) {
						const loud = createMemo(() => item.get().toUpperCase())
						<li><span>{loud}</span></li>
					}
				</ul>`,
	)
	const { component, diagnostics } = compileComponent(
		source,
		'c.tsrx',
		new Set(),
	)
	if (!component) throw new Error(JSON.stringify(diagnostics))
	const markup = await render(component.serverCode)

	test('the server reads the signal per initial item, the client watches it', () => {
		expect(diagnostics).toEqual([])
		expect(markup).toContain(
			'<li data-key="a"><span>A</span></li><li data-key="b"><span>B</span></li>',
		)
		expect(component.clientCode).toContain('watch(loud, bindText(span))')
	})
})
