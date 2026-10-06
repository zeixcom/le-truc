/**
 * Mount Scopes nest (ADR 0046 s1–s2, LT-424), end to end on both surfaces:
 *
 * - a reactive list inside a reactive conditional's arm, an arm set inside a
 *   list item, and a list inside a list item each compile clean on both
 *   surfaces, to byte-identical modules;
 * - the server renders a nested construct live inside a live scope and
 *   inert inside a template; every list template is hoisted to the host's
 *   end, one copy per instance at any depth, rendered with every enclosing
 *   scope unbound, so a list container may be a Mount Scope root (ADR 0046
 *   s2, LT-454) — arm templates stay beside their arm;
 * - the generated client adopts the server's markup at both levels without
 *   touching it, then clones at both levels as signals change;
 * - a selector bound in a scope matches nothing in a nested scope's
 *   content: proved by the probe, or synthesized as a `:scope >` child path,
 *   or refused (LTC007, fixed by a unique class);
 * - a server-data loop inside a scope lowers to a static query against the
 *   scope root, never `all()`;
 * - the `@empty` arm binds its reactive attributes in the scope that holds
 *   its list.
 *
 * The remaining refusals and the lifted ones are pinned for parity in
 * `tsx/diagnostic-parity.test.ts`.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { pathToFileURL } from 'node:url'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { createSimulationRealm } from '../../compiler/sim/realm'
import { createGeneratedDir } from '../helpers/generated-corpus'

const generated = createGeneratedDir('mount-scopes')
afterAll(() => generated.cleanup())

/* === Helpers === */

const STYLE_TSRX = `<style>:host {
	  display: block;
	}</style>`
const STYLE_TSX = `<style>{css\`:host {
	  display: block;
	}\`}</style>`

/** A `.tsrx` component `C` around `body`. */
const tsrx = (
	pre: string,
	setup: string,
	body: string,
	params = '{}: {}',
): string => `${pre}
export function C(${params})
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
	props: string,
	setup: string,
	body: string,
	params = '{}: {}',
): string => `${pre}
import { css } from '@zeix/le-truc-compiler/macros'
import type { FactoryContext } from '@zeix/le-truc'

export function C(${params}, { expose }: FactoryContext<${props}>) {
	${setup}
	return (
			<c-el>${body}
				${STYLE_TSX}
			</c-el>
	)
}
`

/** Both surfaces compiled, with their error diagnostics. */
const compileBoth = (sources: { tsrx: string; tsx: string }) => {
	const fromTsrx = compileComponent(sources.tsrx, 'c.tsrx', new Set())
	const fromTsx = compileComponentTsx(sources.tsx, 'c.tsx', new Set())
	return { fromTsrx, fromTsx }
}

/** A generated module without its provenance header. */
const body = (code: string | undefined): string =>
	(code ?? '').replace(/^\/\*\*[\s\S]*?\*\/\n/, '')

let renderCount = 0
/** Emit `serverCode` and call its render function. */
const render = async (
	serverCode: string,
	args: unknown = {},
): Promise<string> => {
	const file = `render-${++renderCount}.server.ts`
	generated.emit(file, serverCode)
	const mod =
		await generated.importModule<Record<string, (a: unknown) => string>>(file)
	return (mod.renderC as (a: unknown) => string)(args)
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

/* === A reactive list inside an arm === */

const LIST_IN_ARM = {
	tsrx: tsrx(
		"import { createCell, createList } from '@zeix/le-truc'",
		`const open = createCell(true)
		const items = createList<string>(['a', 'b'], { keyConfig: s => s })
		expose({ open, items: () => items.get().join(',') })`,
		`
				<button type="button" class="add" onClick={() => { items.add('c') }}>Add</button>
				<div class="box">
					@if (open.get()) {
						<section class="panel">
							<ul class="list">
								@for (const item of items; key k) {
									<li><span class="label">{item}</span><button type="button" class="remove" onClick={() => { items.remove(k) }}>x</button></li>
								} @empty {
									<li class="none">none</li>
								}
							</ul>
						</section>
					}
				</div>`,
	),
	tsx: tsx(
		"import { createCell, createList } from '@zeix/le-truc'",
		'{ open: boolean; items: string }',
		`const open = createCell(true)
	const items = createList<string>(['a', 'b'], { keyConfig: s => s })
	expose({ open, items: () => items.get().join(',') })`,
		`
				<button type="button" class="add" onClick={() => { items.add('c') }}>Add</button>
				<div class="box">
					{open.get() ? (
						<section class="panel">
							<ul class="list">
								{items.length === 0 ? (
									<li class="none">none</li>
								) : (
									items.map((item, k) => (
										<li><span class="label">{item}</span><button type="button" class="remove" onClick={() => { items.remove(k) }}>x</button></li>
									))
								)}
							</ul>
						</section>
					) : null}
				</div>`,
	),
}

describe('a reactive list inside an arm', async () => {
	const { fromTsrx, fromTsx } = compileBoth(LIST_IN_ARM)
	const component = fromTsrx.component
	if (!component) throw new Error(JSON.stringify(fromTsrx.diagnostics))
	const markup = await render(component.serverCode)
	const { realm, html, diagnostics } = await mount(
		'list-in-arm',
		component.clientCode,
		markup,
	)
	afterAll(() => realm.dispose())
	const box = () => realm.document.querySelector('c-el .box') as HTMLElement
	const host = () =>
		realm.document.querySelector('c-el') as HTMLElement & { open: boolean }
	const labels = () =>
		[...box().querySelectorAll('li[data-key] .label')].map(el => el.textContent)

	test('both surfaces compile clean, to the same modules', () => {
		expect(fromTsrx.diagnostics).toEqual([])
		expect(fromTsx.diagnostics).toEqual([])
		expect(body(fromTsx.component?.serverCode)).toBe(body(component.serverCode))
		expect(body(fromTsx.component?.clientCode)).toBe(body(component.clientCode))
	})

	test("the list binds in the arm's mount, its template queried from the host", () => {
		expect(component.clientCode).toContain(
			'reconcile(ul, host.querySelector<HTMLTemplateElement>(\':scope > template[data-list="0"]\')!, items,',
		)
	})

	test('the live arm renders its items; the arm template renders none', () => {
		const [live, rest = ''] = markup.split('<template data-arms="0"')
		const armTemplate = rest.slice(0, rest.indexOf('<template data-list="0">'))
		expect(live).toContain('<li data-key="a">')
		expect(armTemplate).not.toContain('data-key="a"')
		// The list template is not copied into the live arm or the arm
		// template: one copy, the host's last child (ADR 0046 s2).
		expect(markup.split('<template data-list="0">').length - 1).toBe(1)
		expect(markup).toMatch(
			/<template data-list="0">[\s\S]*<\/template><\/c-el>$/,
		)
	})

	test('connect adopts the arm and its items without touching them', () => {
		expect(diagnostics).toEqual([])
		expect(html).toBe(serialized(markup))
	})

	test('an added item clones into the adopted arm, and binds', async () => {
		;(realm.document.querySelector('c-el button.add') as HTMLElement).click()
		await settle()
		expect(labels()).toEqual(['a', 'b', 'c'])
		;(
			box().querySelector('li[data-key="c"] button.remove') as HTMLElement
		).click()
		await settle()
		expect(labels()).toEqual(['a', 'b'])
	})

	test('re-entry clones the arm, and the list clones its items inside it', async () => {
		host().open = false
		await settle()
		expect(box().querySelector('section')).toBeNull()
		host().open = true
		await settle()
		expect(labels()).toEqual(['a', 'b'])
		;(
			box().querySelector('li[data-key="a"] button.remove') as HTMLElement
		).click()
		await settle()
		expect(labels()).toEqual(['b'])
		;(
			box().querySelector('li[data-key="b"] button.remove') as HTMLElement
		).click()
		await settle()
		expect((box().querySelector('li.none') as HTMLElement).hidden).toBe(false)
	})
})

/* === An arm set inside a list item === */

const TASKS = `const tasks = createList<Task, MutableStore<Task>>([{ title: 'a', done: false }, { title: 'b', done: true }], { keyConfig: t => t.title, createItem: createStore })`

const ARM_IN_ITEM = {
	tsrx: tsrx(
		"import { createList, createStore, type MutableStore } from '@zeix/le-truc'\ntype Task = { title: string; done: boolean }",
		`${TASKS}
		expose({})`,
		`
				<button type="button" class="add" onClick={() => { tasks.add({ title: 'c', done: true }) }}>Add</button>
				<ul class="tasks">
					@for (const task of tasks; key k) {
						<li id={k}>
							<span class="title">{() => task.title.get()}</span>
							@if (task.done.get()) {
								<button type="button" class="undo" data-for={k} onClick={() => { task.done.set(false) }}>undo</button>
							} @else {
								<button type="button" class="finish" onClick={() => { task.done.set(true) }}>finish</button>
							}
						</li>
					}
				</ul>`,
	),
	tsx: tsx(
		"import { createList, createStore, type MutableStore } from '@zeix/le-truc'\ntype Task = { title: string; done: boolean }",
		'{}',
		`${TASKS}
	expose({})`,
		`
				<button type="button" class="add" onClick={() => { tasks.add({ title: 'c', done: true }) }}>Add</button>
				<ul class="tasks">
					{tasks.map((task, k) => (
						<li id={k}>
							<span class="title">{() => task.title.get()}</span>
							{task.done.get() ? (
								<button type="button" class="undo" data-for={k} onClick={() => { task.done.set(false) }}>undo</button>
							) : (
								<button type="button" class="finish" onClick={() => { task.done.set(true) }}>finish</button>
							)}
						</li>
					))}
				</ul>`,
	),
}

describe('an arm set inside a list item', async () => {
	const { fromTsrx, fromTsx } = compileBoth(ARM_IN_ITEM)
	const component = fromTsrx.component
	if (!component) throw new Error(JSON.stringify(fromTsrx.diagnostics))
	const markup = await render(component.serverCode)
	const { realm, html, diagnostics } = await mount(
		'arm-in-item',
		component.clientCode,
		markup,
	)
	afterAll(() => realm.dispose())
	const item = (key: string) =>
		realm.document.querySelector(
			`c-el ul.tasks > li[data-key="${key}"]`,
		) as HTMLElement
	const armOf = (key: string) =>
		item(key).querySelector(':scope > button[data-key]') as HTMLElement

	test('both surfaces compile clean, to the same modules', () => {
		expect(fromTsrx.diagnostics).toEqual([])
		expect(fromTsx.diagnostics).toEqual([])
		expect(body(fromTsx.component?.serverCode)).toBe(body(component.serverCode))
		expect(body(fromTsx.component?.clientCode)).toBe(body(component.clientCode))
	})

	test('each live item renders its own winner; the item template renders none and bakes the key empty', () => {
		expect(markup).toContain(
			'<button data-key="else" type="button" class="finish">',
		)
		expect(markup).toContain(
			'<button data-key="then" type="button" data-for="b" class="undo">',
		)
		const template = markup.slice(markup.indexOf('<template data-list="0">'))
		expect(template).not.toContain('data-key="then" type')
		// The arm templates stay beside their arm, inside the item template;
		// the item template itself is the host's last child (ADR 0046 s2).
		expect(template).toContain(
			'<template data-arms="0" data-key="then"><button type="button" class="undo">',
		)
		expect(template).toMatch(/<\/li><\/template><\/c-el>$/)
	})

	test('the arm set switches in the item root, and the arm mount sets the key-derived attribute', () => {
		expect(component.clientCode).toContain(
			"reconcile(li, li.querySelectorAll<HTMLTemplateElement>(':scope > template[data-arms=\"0\"]'), () => ((task.done.get()) ? 'then' : 'else'),",
		)
		expect(component.clientCode).toMatch(
			/button\d*\.setAttribute\('data-for', k\)/,
		)
	})

	test('connect adopts every item and its arm without touching them', () => {
		expect(diagnostics).toEqual([])
		expect(html).toBe(serialized(markup))
	})

	test("an adopted item's arm flips, and re-entry clones afresh", async () => {
		const finish = armOf('a')
		finish.click()
		await settle()
		expect(armOf('a').className).toBe('undo')
		expect(armOf('a').dataset.for).toBe('a')
		armOf('a').click()
		await settle()
		expect(armOf('a').className).toBe('finish')
		expect(armOf('a')).not.toBe(finish)
	})

	test('a cloned item clones its arm by its own state', async () => {
		;(realm.document.querySelector('c-el button.add') as HTMLElement).click()
		await settle()
		expect(item('c').id).toBe('c')
		expect(armOf('c').className).toBe('undo')
		expect(armOf('c').dataset.for).toBe('c')
		armOf('c').click()
		await settle()
		expect(armOf('c').className).toBe('finish')
	})
})

/* === A key-derived attribute in a server branch of a nested arm === */

const BRANCH_KEY = {
	tsrx: tsrx(
		"import { createList, createStore, type MutableStore } from '@zeix/le-truc'\ntype Task = { title: string; done: boolean }",
		`${TASKS}
		expose({})`,
		`
				<button type="button" class="add" onClick={() => { tasks.add({ title: 'c', done: true }) }}>Add</button>
				<ul class="tasks">
					@for (const task of tasks; key k) {
						<li>
							<button type="button" class="toggle" onClick={() => { task.done.set(!task.done.get()) }}>toggle</button>
							@if (task.done.get()) {
								<p class="done">@if (verbose) { <b class="mark" data-for={k}>done</b> }</p>
							}
						</li>
					}
				</ul>`,
		'{ verbose }: { verbose: boolean }',
	),
	tsx: tsx(
		"import { createList, createStore, type MutableStore } from '@zeix/le-truc'\ntype Task = { title: string; done: boolean }",
		'{}',
		`${TASKS}
	expose({})`,
		`
				<button type="button" class="add" onClick={() => { tasks.add({ title: 'c', done: true }) }}>Add</button>
				<ul class="tasks">
					{tasks.map((task, k) => (
						<li>
							<button type="button" class="toggle" onClick={() => { task.done.set(!task.done.get()) }}>toggle</button>
							{task.done.get() ? (
								<p class="done">{verbose ? <b class="mark" data-for={k}>done</b> : null}</p>
							) : null}
						</li>
					))}
				</ul>`,
		'{ verbose }: { verbose: boolean }',
	),
}

describe('a key-derived attribute in a server branch of an arm nested in an item', async () => {
	const { fromTsrx, fromTsx } = compileBoth(BRANCH_KEY)
	const component = fromTsrx.component
	if (!component) throw new Error(JSON.stringify(fromTsrx.diagnostics))

	test('both surfaces compile clean, to the same modules', () => {
		expect(fromTsrx.diagnostics).toEqual([])
		expect(fromTsx.diagnostics).toEqual([])
		expect(body(fromTsx.component?.serverCode)).toBe(body(component.serverCode))
		expect(body(fromTsx.component?.clientCode)).toBe(body(component.clientCode))
	})

	test("the arm's mount sets it through a non-throwing query", () => {
		expect(component.clientCode).toContain("first('b')")
		expect(component.clientCode).toMatch(
			/b\d*\?\.setAttribute\('data-for', k\)/,
		)
	})

	for (const verbose of [true, false])
		describe(`with the branch ${verbose ? 'taken' : 'not taken'}`, async () => {
			const markup = await render(component.serverCode, { verbose })
			const { realm, html, diagnostics } = await mount(
				`branch-key-${verbose}`,
				component.clientCode,
				markup,
			)
			afterAll(() => realm.dispose())
			const item = (key: string) =>
				realm.document.querySelector(
					`c-el ul.tasks > li[data-key="${key}"]`,
				) as HTMLElement
			const mark = (key: string) =>
				item(key).querySelector('p.done b.mark') as HTMLElement | null

			test('connect adopts without touching the markup', () => {
				expect(diagnostics).toEqual([])
				expect(html).toBe(serialized(markup))
				expect(mark('b')?.dataset.for).toBe(verbose ? 'b' : undefined)
			})

			test('a re-entered arm carries the key again', async () => {
				;(item('a').querySelector('button.toggle') as HTMLElement).click()
				await settle()
				expect(item('a').querySelector('p.done')).not.toBeNull()
				expect(mark('a')?.dataset.for).toBe(verbose ? 'a' : undefined)
			})

			test('a cloned item clones its arm with the key set', async () => {
				;(
					realm.document.querySelector('c-el button.add') as HTMLElement
				).click()
				await settle()
				expect(item('c').querySelector('p.done')).not.toBeNull()
				expect(mark('c')?.dataset.for).toBe(verbose ? 'c' : undefined)
			})
		})
})

/* === A list inside a list item, with a reactive `@empty` arm === */

const LIST_IN_ITEM = {
	tsrx: tsrx(
		"import { createCell, createList } from '@zeix/le-truc'",
		`const groups = createList<string>(['g1', 'g2'], { keyConfig: s => s })
		const tags = createList<string>(['x', 'y'], { keyConfig: s => s })
		const height = createCell(10)
		expose({ height })`,
		`
				<button type="button" class="group" onClick={() => { groups.add('g3') }}>Group</button>
				<button type="button" class="tag" onClick={() => { tags.add('z') }}>Tag</button>
				<ul class="groups">
					@for (const group of groups; key g) {
						<li>
							<span>{group}</span>
							<ol class="tags">
								@for (const tag of tags; key t) {
									<li data-group={g}><span>{tag}</span><button type="button" onClick={() => { tags.remove(t) }}>x</button></li>
								} @empty {
									<li class="placeholder" style={() => ({ height: \`\${height.get()}px\` })}>none</li>
								}
							</ol>
						</li>
					}
				</ul>`,
	),
	tsx: tsx(
		"import { createCell, createList } from '@zeix/le-truc'",
		'{ height: number }',
		`const groups = createList<string>(['g1', 'g2'], { keyConfig: s => s })
	const tags = createList<string>(['x', 'y'], { keyConfig: s => s })
	const height = createCell(10)
	expose({ height })`,
		`
				<button type="button" class="group" onClick={() => { groups.add('g3') }}>Group</button>
				<button type="button" class="tag" onClick={() => { tags.add('z') }}>Tag</button>
				<ul class="groups">
					{groups.map((group, g) => (
						<li>
							<span>{group}</span>
							<ol class="tags">
								{tags.length === 0 ? (
									<li class="placeholder" style={() => ({ height: \`\${height.get()}px\` })}>none</li>
								) : (
									tags.map((tag, t) => (
										<li data-group={g}><span>{tag}</span><button type="button" onClick={() => { tags.remove(t) }}>x</button></li>
									))
								)}
							</ol>
						</li>
					))}
				</ul>`,
	),
}

describe('a list inside a list item', async () => {
	const { fromTsrx, fromTsx } = compileBoth(LIST_IN_ITEM)
	const component = fromTsrx.component
	if (!component) throw new Error(JSON.stringify(fromTsrx.diagnostics))
	const markup = await render(component.serverCode)
	const { realm, html, diagnostics } = await mount(
		'list-in-item',
		component.clientCode,
		markup,
	)
	afterAll(() => realm.dispose())
	const group = (key: string) =>
		realm.document.querySelector(
			`c-el ul.groups > li[data-key="${key}"]`,
		) as HTMLElement
	const tagsOf = (key: string) =>
		[...group(key).querySelectorAll('ol.tags > li[data-key]')].map(
			el =>
				`${el.getAttribute('data-group')}:${el.querySelector('span')?.textContent}`,
		)
	const click = (selector: string) =>
		(realm.document.querySelector(`c-el ${selector}`) as HTMLElement).click()

	test('both surfaces compile clean, to the same modules', () => {
		expect(fromTsrx.diagnostics).toEqual([])
		expect(fromTsx.diagnostics).toEqual([])
		expect(body(fromTsx.component?.serverCode)).toBe(body(component.serverCode))
		expect(body(fromTsx.component?.clientCode)).toBe(body(component.clientCode))
	})

	test('each template renders once, at the host end, with every enclosing scope unbound', () => {
		// One copy per instance — none in the live items, none inside the
		// outer template (ADR 0046 s2) — in document order of N.
		expect(markup.split('<template data-list="1">').length - 1).toBe(1)
		const templates = markup.slice(markup.indexOf('<template data-list="0">'))
		expect(templates).toMatch(
			/^<template data-list="0">[\s\S]*<\/template><template data-list="1">[\s\S]*<\/template><\/c-el>$/,
		)
		// No items, and no outer key baked into the inner template: the inner
		// mount writes `data-group` on every adopt and clone.
		expect(templates).not.toContain('data-key=')
		expect(templates).not.toContain('data-group=')
	})

	test("the item's own text binds through a synthesized child path", () => {
		// The nested items' `<span>`s are in the item's possible content, so
		// a bare `span` would bind the first tag's; no class separates them.
		expect(component.clientCode).toContain(
			"first(':scope > span', 'c-el: :scope > span missing')",
		)
	})

	test("the `@empty` arm's reactive style binds in the item's mount", () => {
		expect(component.clientCode).toMatch(
			/watch\(\(\) => \(\{ height: `\$\{height\.get\(\)\}px` \}\), bindStyle\(li\d*, \['height'\]\)\)/,
		)
	})

	test('connect adopts both levels without touching them', () => {
		expect(diagnostics).toEqual([])
		expect(html).toBe(serialized(markup))
	})

	test('an added tag clones into every adopted group', async () => {
		click('button.tag')
		await settle()
		expect(tagsOf('g1')).toEqual(['g1:x', 'g1:y', 'g1:z'])
		expect(tagsOf('g2')).toEqual(['g2:x', 'g2:y', 'g2:z'])
	})

	test('an added group clones, with its inner list cloned inside it', async () => {
		click('button.group')
		await settle()
		expect(
			(group('g3').querySelector(':scope > span') as HTMLElement).textContent,
		).toBe('g3')
		expect(tagsOf('g3')).toEqual(['g3:x', 'g3:y', 'g3:z'])
		// A cloned inner item's handler is bound.
		;(
			group('g3').querySelector('li[data-key="z"] button') as HTMLElement
		).click()
		await settle()
		expect(tagsOf('g1')).toEqual(['g1:x', 'g1:y'])
	})

	test('an emptied inner list shows its placeholder at the reactive height', async () => {
		click('ul.groups li[data-key="x"] button')
		await settle()
		click('ul.groups li[data-key="y"] button')
		await settle()
		const placeholder = group('g3').querySelector(
			'li.placeholder',
		) as HTMLElement
		expect(placeholder.hidden).toBe(false)
		expect(placeholder.style.height).toBe('10px')
		;(
			realm.document.querySelector('c-el') as HTMLElement & {
				height: number
			}
		).height = 24
		await settle()
		expect(placeholder.style.height).toBe('24px')
	})
})

/* === A list whose container is the item root (LT-454) === */

const ROWS_IN_TBODY = {
	tsrx: tsrx(
		"import { createList } from '@zeix/le-truc'",
		`const groups = createList<string>(['g1', 'g2'], { keyConfig: s => s })
		const rows = createList<string>(['x', 'y'], { keyConfig: s => s })
		expose({})`,
		`
				<button type="button" class="group" onClick={() => { groups.add('g3') }}>Group</button>
				<button type="button" class="row" onClick={() => { rows.add('z') }}>Row</button>
				<table class="grid">
					@for (const group of groups; key g) {
						<tbody>
							@for (const row of rows; key r) {
								<tr data-group={g}><td class="name">{row}</td><td class="act"><button type="button" onClick={() => { rows.remove(r) }}>x</button></td></tr>
							} @empty {
								<tr class="none"><td>none</td></tr>
							}
						</tbody>
					}
				</table>`,
	),
	tsx: tsx(
		"import { createList } from '@zeix/le-truc'",
		'{}',
		`const groups = createList<string>(['g1', 'g2'], { keyConfig: s => s })
	const rows = createList<string>(['x', 'y'], { keyConfig: s => s })
	expose({})`,
		`
				<button type="button" class="group" onClick={() => { groups.add('g3') }}>Group</button>
				<button type="button" class="row" onClick={() => { rows.add('z') }}>Row</button>
				<table class="grid">
					{groups.map((group, g) => (
						<tbody>
							{rows.length === 0 ? (
								<tr class="none"><td>none</td></tr>
							) : (
								rows.map((row, r) => (
									<tr data-group={g}><td class="name">{row}</td><td class="act"><button type="button" onClick={() => { rows.remove(r) }}>x</button></td></tr>
								))
							)}
						</tbody>
					))}
				</table>`,
	),
}

describe('a list whose container is the item root', async () => {
	const { fromTsrx, fromTsx } = compileBoth(ROWS_IN_TBODY)
	const component = fromTsrx.component
	if (!component) throw new Error(JSON.stringify(fromTsrx.diagnostics))
	const markup = await render(component.serverCode)
	const { realm, html, diagnostics } = await mount(
		'rows-in-tbody',
		component.clientCode,
		markup,
	)
	afterAll(() => realm.dispose())
	const group = (key: string) =>
		realm.document.querySelector(
			`c-el table.grid > tbody[data-key="${key}"]`,
		) as HTMLElement
	const rowsOf = (key: string) =>
		[...group(key).querySelectorAll(':scope > tr[data-key]')].map(
			el =>
				`${el.getAttribute('data-group')}:${el.querySelector('td.name')?.textContent}`,
		)
	const click = (selector: string) =>
		(realm.document.querySelector(`c-el ${selector}`) as HTMLElement).click()

	test('both surfaces compile clean, to the same modules', () => {
		expect(fromTsrx.diagnostics).toEqual([])
		expect(fromTsx.diagnostics).toEqual([])
		expect(body(fromTsx.component?.serverCode)).toBe(body(component.serverCode))
		expect(body(fromTsx.component?.clientCode)).toBe(body(component.clientCode))
	})

	test('the inner list reconciles the item root, its template queried from the host', () => {
		expect(component.clientCode).toMatch(
			/reconcile\(tbody\d*, host\.querySelector<HTMLTemplateElement>\(':scope > template\[data-list="1"\]'\)!, rows,/,
		)
	})

	test('the live items render their rows; the templates sit at the host end, unbound', () => {
		expect(markup).toContain('<tr data-key="x" data-group="g1">')
		expect(markup).toContain('<tr data-key="y" data-group="g2">')
		const templates = markup.slice(markup.indexOf('<template data-list="0">'))
		expect(templates).toMatch(/<\/template><\/c-el>$/)
		expect(templates.split('<template data-list="1">').length - 1).toBe(1)
		expect(templates).not.toContain('data-key=')
		expect(templates).not.toContain('data-group=')
		// No template is left inside the table.
		expect(markup.slice(0, markup.indexOf('</table>'))).not.toContain(
			'<template',
		)
	})

	test('connect adopts both levels with no realm diagnostics', () => {
		expect(diagnostics).toEqual([])
		expect(html).toBe(serialized(markup))
	})

	test('an added row clones into every adopted group', async () => {
		click('button.row')
		await settle()
		expect(rowsOf('g1')).toEqual(['g1:x', 'g1:y', 'g1:z'])
		expect(rowsOf('g2')).toEqual(['g2:x', 'g2:y', 'g2:z'])
	})

	test('a cloned group reconciles its own rows, with the outer key set', async () => {
		click('button.group')
		await settle()
		expect(rowsOf('g3')).toEqual(['g3:x', 'g3:y', 'g3:z'])
		;(
			group('g3').querySelector('tr[data-key="z"] button') as HTMLElement
		).click()
		await settle()
		expect(rowsOf('g3')).toEqual(['g3:x', 'g3:y'])
		expect(rowsOf('g1')).toEqual(['g1:x', 'g1:y'])
		click('table.grid tr[data-key="x"] button')
		await settle()
		click('table.grid tr[data-key="y"] button')
		await settle()
		const none = group('g3').querySelector('tr.none') as HTMLElement
		expect(none.hidden).toBe(false)
	})
})

/* === A list in a server branch of an item (LT-454, LT-455) === */

const LIST_IN_BRANCH = {
	tsrx: tsrx(
		"import { createList } from '@zeix/le-truc'",
		`const groups = createList<string>(['g1'], { keyConfig: s => s })
		const tags = createList<string>(['x'], { keyConfig: s => s })
		expose({})`,
		`
				<button type="button" class="group" onClick={() => { groups.add('g2') }}>Group</button>
				<button type="button" class="tag" onClick={() => { tags.add('y') }}>Tag</button>
				<ul class="groups">
					@for (const group of groups) {
						<li><span>{group}</span>@if (show) { <ol class="tags">@for (const tag of tags) { <li>{tag}</li> } @empty { <li class="placeholder">none</li> }</ol> }</li>
					}
				</ul>`,
		'{ show }: { show: boolean }',
	),
	tsx: tsx(
		"import { createList } from '@zeix/le-truc'",
		'{}',
		`const groups = createList<string>(['g1'], { keyConfig: s => s })
	const tags = createList<string>(['x'], { keyConfig: s => s })
	expose({})`,
		`
				<button type="button" class="group" onClick={() => { groups.add('g2') }}>Group</button>
				<button type="button" class="tag" onClick={() => { tags.add('y') }}>Tag</button>
				<ul class="groups">
					{groups.map(group => (
						<li><span>{group}</span>{show ? <ol class="tags">{tags.length === 0 ? <li class="placeholder">none</li> : tags.map(tag => <li>{tag}</li>)}</ol> : null}</li>
					))}
				</ul>`,
		'{ show }: { show: boolean }',
	),
}

describe('a list in a server branch of an item', async () => {
	const { fromTsrx, fromTsx } = compileBoth(LIST_IN_BRANCH)
	const component = fromTsrx.component
	if (!component) throw new Error(JSON.stringify(fromTsrx.diagnostics))

	test('both surfaces compile clean, to the same modules', () => {
		expect(fromTsrx.diagnostics).toEqual([])
		expect(fromTsx.diagnostics).toEqual([])
		expect(body(fromTsx.component?.serverCode)).toBe(body(component.serverCode))
		expect(body(fromTsx.component?.clientCode)).toBe(body(component.clientCode))
	})

	test('its hoisted template ships exactly when the branch renders', async () => {
		const shown = await render(component.serverCode, { show: true })
		expect(shown.split('<template data-list="1">').length - 1).toBe(1)
		expect(shown).toContain('<ol class="tags"><li data-key="x">')
		const hidden = await render(component.serverCode, { show: false })
		expect(hidden).not.toContain('<ol')
		expect(hidden).not.toContain('<template data-list="1">')
		// The outer template still ships, folding the same branch.
		expect(hidden).toContain(
			'<template data-list="0"><li><span></span></li></template>',
		)
	})

	test('the item mount queries the branch-held container optionally and guards the nested mount', () => {
		expect(component.clientCode).toMatch(/const ol = first\('ol'\)/)
		expect(component.clientCode).toMatch(
			/const li = first\('li\.placeholder'\)/,
		)
		expect(component.clientCode).toMatch(/if \(ol\) \{/)
	})

	for (const shown of [false, true])
		describe(`with the branch ${shown ? 'taken' : 'not taken'}`, async () => {
			const markup = await render(component.serverCode, { show: shown })
			const { realm, html, diagnostics } = await mount(
				`list-in-branch-${shown}`,
				component.clientCode,
				markup,
			)
			afterAll(() => realm.dispose())
			const item = (key: string) =>
				realm.document.querySelector(
					`c-el ul.groups > li[data-key="${key}"]`,
				) as HTMLElement
			const click = (selector: string) =>
				(
					realm.document.querySelector(`c-el ${selector}`) as HTMLElement
				).click()
			const tagsIn = (key: string) =>
				[...item(key).querySelectorAll('ol.tags > li[data-key]')].map(
					el => el.textContent,
				)

			test('connect binds the item without a realm diagnostic', () => {
				expect(diagnostics).toEqual([])
				expect(html).toBe(serialized(markup))
				expect(
					(item('g1').querySelector(':scope > span') as HTMLElement)
						.textContent,
				).toBe('g1')
			})

			if (shown)
				test('the nested list adopts and clones as before', async () => {
					expect(tagsIn('g1')).toEqual(['x'])
					// The @empty watch binds under the guard: tags non-empty,
					// the placeholder stays hidden.
					expect(
						(item('g1').querySelector('li.placeholder') as HTMLElement | null)
							?.hidden,
					).toBe(true)
					click('button.tag')
					await settle()
					expect(tagsIn('g1')).toEqual(['x', 'y'])
					click('button.group')
					await settle()
					expect(tagsIn('g2')).toEqual(['x', 'y'])
				})
			else
				test('an added outer item clones and binds its own content', async () => {
					click('button.group')
					await settle()
					expect(
						(item('g2').querySelector(':scope > span') as HTMLElement)
							.textContent,
					).toBe('g2')
					expect(item('g2').querySelector('ol.tags')).toBeNull()
				})
		})
})

/* === A list whose container is the arm root (LT-454) === */

const LIST_AS_ARM = {
	tsrx: tsrx(
		"import { createCell, createList } from '@zeix/le-truc'",
		`const open = createCell(true)
		const items = createList<string>(['a', 'b'], { keyConfig: s => s })
		expose({ open })`,
		`
				<button type="button" class="add" onClick={() => { items.add('c') }}>Add</button>
				<div class="box">
					@if (open.get()) {
						<ul class="list">
							@for (const item of items) {
								<li>{item}</li>
							}
						</ul>
					}
				</div>`,
	),
	tsx: tsx(
		"import { createCell, createList } from '@zeix/le-truc'",
		'{ open: boolean }',
		`const open = createCell(true)
	const items = createList<string>(['a', 'b'], { keyConfig: s => s })
	expose({ open })`,
		`
				<button type="button" class="add" onClick={() => { items.add('c') }}>Add</button>
				<div class="box">
					{open.get() ? (
						<ul class="list">
							{items.map(item => (
								<li>{item}</li>
							))}
						</ul>
					) : null}
				</div>`,
	),
}

describe('a list whose container is the arm root', async () => {
	const { fromTsrx, fromTsx } = compileBoth(LIST_AS_ARM)
	const component = fromTsrx.component
	if (!component) throw new Error(JSON.stringify(fromTsrx.diagnostics))
	const markup = await render(component.serverCode)
	const { realm, html, diagnostics } = await mount(
		'list-as-arm',
		component.clientCode,
		markup,
	)
	afterAll(() => realm.dispose())
	const items = () =>
		[...realm.document.querySelectorAll('c-el .box ul.list > li')].map(
			el => el.textContent,
		)

	test('both surfaces compile clean, to the same modules', () => {
		expect(fromTsrx.diagnostics).toEqual([])
		expect(fromTsx.diagnostics).toEqual([])
		expect(body(fromTsx.component?.serverCode)).toBe(body(component.serverCode))
		expect(body(fromTsx.component?.clientCode)).toBe(body(component.clientCode))
	})

	test('the arm template stays beside its arm; the list template is hoisted', () => {
		const box = markup.slice(markup.indexOf('<div class="box">'))
		expect(box).toMatch(/^<div class="box"><ul data-key="then" class="list">/)
		expect(box.slice(0, box.indexOf('</div>'))).toContain(
			'<template data-arms="0" data-key="then"><ul class="list"></ul></template>',
		)
		expect(markup).toMatch(
			/<\/div><template data-list="0"><li><\/li><\/template><\/c-el>$/,
		)
	})

	test('connect adopts with no realm diagnostics', () => {
		expect(diagnostics).toEqual([])
		expect(html).toBe(serialized(markup))
	})

	test('re-entry clones the arm, and the list reconciles inside it', async () => {
		const host = realm.document.querySelector('c-el') as HTMLElement & {
			open: boolean
		}
		host.open = false
		await settle()
		expect(items()).toEqual([])
		host.open = true
		await settle()
		expect(items()).toEqual(['a', 'b'])
		;(realm.document.querySelector('c-el button.add') as HTMLElement).click()
		await settle()
		expect(items()).toEqual(['a', 'b', 'c'])
	})
})

/* === Server-data loops and boundaries inside scopes === */

describe('a server-data loop inside an arm', () => {
	const sources = {
		tsrx: tsrx(
			"import { createCell } from '@zeix/le-truc'",
			`const open = createCell(true)
		const picked = createCell('')
		expose({ open, picked })`,
			`
				<div class="box">
					@if (open.get()) {
						<nav class="tabs">
							@for (const tab of tabs) {
								<button type="button" class="tab" onClick={() => { picked.set('x') }}>{tab}</button>
							}
						</nav>
					}
				</div>`,
			'{ tabs }: { tabs: string[] }',
		),
		tsx: tsx(
			"import { createCell } from '@zeix/le-truc'",
			'{ open: boolean; picked: string }',
			`const open = createCell(true)
	const picked = createCell('')
	expose({ open, picked })`,
			`
				<div class="box">
					{open.get() ? (
						<nav class="tabs">
							{tabs.map(tab => (
								<button type="button" class="tab" onClick={() => { picked.set('x') }}>{tab}</button>
							))}
						</nav>
					) : null}
				</div>`,
			'{ tabs }: { tabs: string[] }',
		),
	}
	const { fromTsrx, fromTsx } = compileBoth(sources)

	test('both surfaces compile clean, to the same client', () => {
		expect(fromTsrx.diagnostics).toEqual([])
		expect(fromTsx.diagnostics).toEqual([])
		expect(body(fromTsx.component?.clientCode)).toBe(
			body(fromTsrx.component?.clientCode),
		)
	})

	test('lowers to a static query against the arm root — no all(), no each()', () => {
		const client = fromTsrx.component?.clientCode ?? ''
		expect(client).toContain(
			"for (const tab of nav.querySelectorAll<ElementFromSelector<'button'>>('button')) {",
		)
		expect(client).not.toContain('all(')
		expect(client).not.toContain('each(')
	})
})

describe('an async boundary inside a list item', () => {
	const pre = "import { createList, deriveCell } from '@zeix/le-truc'"
	const setup = `const items = createList<string>(['a'], { keyConfig: s => s })
		const data = deriveCell(async () => 'ok')`
	const sources = {
		tsrx: tsrx(
			pre,
			`${setup}
		expose({})`,
			`
				<ul class="list">
					@for (const item of items) {
						<li><span class="label">{item}</span>@try { <b class="value">{data}</b> } @pending { <i class="wait">…</i> } @catch (e) { <i class="error">{e.message}</i> }</li>
					}
				</ul>`,
		),
		tsx: tsx(
			pre,
			'{}',
			`${setup}
	expose({})`,
			`
				<ul class="list">
					{items.map(item => (
						<li><span class="label">{item}</span><truc:try pending={<i class="wait">…</i>} catch={e => <i class="error">{e.message}</i>}><b class="value">{data}</b></truc:try></li>
					))}
				</ul>`,
		),
	}
	const { fromTsrx, fromTsx } = compileBoth(sources)

	test('both surfaces compile clean, to the same modules', () => {
		expect(fromTsrx.diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(fromTsx.diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(body(fromTsx.component?.clientCode)).toBe(
			body(fromTsrx.component?.clientCode),
		)
		expect(body(fromTsx.component?.serverCode)).toBe(
			body(fromTsrx.component?.serverCode),
		)
	})

	test("the boundary switches in the item's mount, and the item template carries its arm templates only", () => {
		expect(fromTsrx.component?.clientCode).toContain(
			'reconcile(li, li.querySelectorAll<HTMLTemplateElement>(\':scope > template[data-arms="0"]\'), () => {',
		)
		const server = fromTsrx.component?.serverCode ?? ''
		const template = server.slice(server.indexOf('<template data-list="0">'))
		expect(template).not.toContain('isPending')
		expect(template).toContain('data-arms')
	})
})

/* === The cross-scope proof === */

describe('a selector bound in a scope matches nothing in a nested scope', () => {
	const sources = (inner: string, innerTsx: string) => ({
		tsrx: tsrx(
			"import { createList } from '@zeix/le-truc'",
			`const items = createList<string>([], { keyConfig: s => s })
		const tags = createList<string>([], { keyConfig: s => s })
		expose({})`,
			`
				<ul class="items">
					@for (const item of items) {
						<li>${inner}<ol class="tags">@for (const tag of tags) { <li><b><span>{tag}</span></b></li> }</ol></li>
					}
				</ul>`,
		),
		tsx: tsx(
			"import { createList } from '@zeix/le-truc'",
			'{}',
			`const items = createList<string>([], { keyConfig: s => s })
	const tags = createList<string>([], { keyConfig: s => s })
	expose({})`,
			`
				<ul class="items">
					{items.map(item => (
						<li>${innerTsx}<ol class="tags">{tags.map(tag => <li><b><span>{tag}</span></b></li>)}</ol></li>
					))}
				</ul>`,
		),
	})

	test('a class separates the elements: the probe proves it', () => {
		const { fromTsrx, fromTsx } = compileBoth(
			sources(
				'<b><span class="own">{item}</span></b>',
				'<b><span class="own">{item}</span></b>',
			),
		)
		expect(fromTsrx.diagnostics).toEqual([])
		expect(fromTsx.diagnostics).toEqual([])
		expect(fromTsrx.component?.clientCode).toContain("first('span.own',")
	})

	test('no class separates them: a `:scope >` child path is synthesized', () => {
		const { fromTsrx, fromTsx } = compileBoth(
			sources('<b><span>{item}</span></b>', '<b><span>{item}</span></b>'),
		)
		expect(fromTsrx.diagnostics).toEqual([])
		expect(fromTsx.diagnostics).toEqual([])
		expect(fromTsrx.component?.clientCode).toContain(
			"first(':scope > b > span',",
		)
	})

	test('neither does: LTC007, fixed by a unique class, on both surfaces', () => {
		const twice =
			'<b><span>{item}</span></b><b><span>{() => item.get()}</span></b>'
		const { fromTsrx, fromTsx } = compileBoth(sources(twice, twice))
		for (const diagnostics of [fromTsrx.diagnostics, fromTsx.diagnostics]) {
			const ltc007 = diagnostics.filter(d => d.code === 'LTC007')
			expect(ltc007.length).toBeGreaterThan(0)
			for (const d of ltc007)
				expect(d.message).toContain('Give it a unique `class`')
		}
		expect(fromTsx.diagnostics.filter(d => d.code === 'LTC007').length).toBe(
			fromTsrx.diagnostics.filter(d => d.code === 'LTC007').length,
		)
	})
})
