/**
 * Reactive conditions as template-cloned arms (ADR 0037, LT-274) and the
 * async boundary on the same mechanism (ADR 0037 s4, LT-276), end to end:
 *
 * - both surfaces lower one authored conditional to byte-identical modules;
 * - the IR's initial winner (ADR 0043 s4) takes its three forms;
 * - the server renders the winner live beside inert `<template>` arms, and
 *   the skeleton is byte-identical across the three tiers (ADR 0029 s4);
 * - the generated client adopts the server's winner without touching it
 *   (the designed connect diff is empty), then switches arms as signals
 *   change — re-entry clones afresh, and arm effects die with their arm;
 * - placement and shape refusals.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { pathToFileURL } from 'node:url'
import { emitServerModule } from '../../compiler/emit-server'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileSource } from '../../compiler/frontend/tsrx/compiler'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import type { ComponentIR, TemplateNode } from '../../compiler/ir'
import { createSimulationRealm } from '../../compiler/sim/realm'
import type { EvaluationTier } from '../../compiler/tier'
import { walkTemplate } from '../../compiler/walk'
import { createGeneratedDir } from '../helpers/generated-corpus'

const generated = createGeneratedDir('reactive-conditions')
afterAll(() => generated.cleanup())

/* === Fixtures === */

const TOGGLE_TSRX = `import { createCell } from '@zeix/le-truc'

export function Toggle({ label }: { label: string })
	@{
		const open = createCell(false)
		expose({ open: open.get })
		<>
			<c-toggle>
				<h2 class="title">{label}</h2>
				<div class="box">
					@if (open.get()) {
						<section class="panel">
							<button type="button" class="close" onClick={() => { open.set(false) }}>Close</button>
						</section>
					} @else {
						<button type="button" class="opener" onClick={() => { open.set(true) }}>Open</button>
					}
				</div>
			</c-toggle>
			<style>c-toggle { display: block }</style>
		</>
	}
`

const TOGGLE_TSX = `import { createCell } from '@zeix/le-truc'
import type { FactoryContext } from '@zeix/le-truc'

export function Toggle(
	{ label }: { label: string },
	{ expose }: FactoryContext<{ open: boolean }>,
) {
	const open = createCell(false)
	expose({ open: open.get })
	return (
		<>
			<c-toggle>
				<h2 class="title">{label}</h2>
				<div class="box">
					{open.get() ? (
						<section class="panel">
							<button type="button" class="close" onClick={() => { open.set(false) }}>Close</button>
						</section>
					) : (
						<button type="button" class="opener" onClick={() => { open.set(true) }}>Open</button>
					)}
				</div>
			</c-toggle>
			<style>{css\`c-toggle { display: block }\`}</style>
		</>
	)
}
`

/** A one-file component around `body`, `.tsrx` spelling. */
const tsrx = (
	body: string,
	{
		params = '{}: {}',
		setup = '',
		pre = "import { asBoolean, createCell, deriveCell } from '@zeix/le-truc'",
	} = {},
): string => `${pre}
export function C(${params})
	@{
		${setup}
		<>
			<c-el>${body}</c-el>
			<style>c-el { color: red }</style>
		</>
	}`

const compile = (source: string) =>
	compileComponent(source, 'c.tsrx', new Set())

const errors = (source: string) =>
	compile(source).diagnostics.filter(d => d.severity === 'error')

const conditionals = (root: TemplateNode) => {
	const out: Array<Extract<TemplateNode, { kind: 'conditional' }>> = []
	walkTemplate(root, node => {
		if (node.kind === 'conditional') out.push(node)
	})
	return out
}

const irOf = (source: string): ComponentIR => {
	const { component, diagnostics } = compileSource(source, 'c.tsrx')
	if (!component)
		throw new Error(`fixture must lower: ${JSON.stringify(diagnostics)}`)
	return component as ComponentIR
}

let renderCount = 0
/** Emit `serverCode` and call its render function with `args`. */
const render = async (
	serverCode: string,
	name: string,
	args: unknown,
): Promise<string> => {
	const file = `render-${++renderCount}.server.ts`
	generated.emit(file, serverCode)
	const mod =
		await generated.importModule<Record<string, (a: unknown) => string>>(file)
	return (mod[`render${name}`] as (a: unknown) => string)(args)
}

/* === Surfaces === */

describe('both surfaces lower one reactive conditional identically', () => {
	const fromTsrx = compileComponent(TOGGLE_TSRX, 'c-toggle.tsrx', new Set())
	const fromTsx = compileComponentTsx(TOGGLE_TSX, 'c-toggle.tsx', new Set())

	test('both compile clean', () => {
		expect(fromTsrx.diagnostics).toEqual([])
		expect(fromTsx.diagnostics).toEqual([])
	})

	test('server modules are byte-identical (bar the provenance header)', () => {
		expect(
			fromTsx.component?.serverCode.replace('c-toggle.tsx', 'c-toggle.tsrx'),
		).toBe(fromTsrx.component?.serverCode as string)
	})

	test("the client switches through reconcile()'s arm form", () => {
		const code = fromTsrx.component?.clientCode ?? ''
		expect(code).toContain(
			`reconcile(div, div.querySelectorAll<HTMLTemplateElement>(':scope > template[data-arms="0"]'), () => (open.get() ? 'then' : 'else'), (armElement, armKey, first) => {`,
		)
		expect(code).toContain("if (armKey === 'then') {")
		expect(code).toContain("} else if (armKey === 'else') {")
		expect(code).toContain(
			"const button = first('button', 'c-toggle: button missing')",
		)
		expect(code).toContain(
			"const button2 = armElement as ElementFromSelector<'button'>",
		)
		expect(code).toContain(
			"import type { ElementFromSelector } from '@zeix/le-truc'",
		)
		// The same calls on the `.tsx` side (its factory parameter differs).
		expect(fromTsx.component?.clientCode).toContain(
			`() => (open.get() ? 'then' : 'else')`,
		)
	})
})

/* === The initial winner (ADR 0043 s4) === */

describe('the initial winner', () => {
	test('a literal initializer folds to a constant arm', () => {
		const [node] = conditionals(
			irOf(
				tsrx('@if (open.get()) { <p>a</p> } @else { <b>b</b> }', {
					setup:
						'const open = createCell(false)\n\t\texpose({ open: open.get })',
				}),
			).root,
		)
		expect(node?.mode).toBe('reactive')
		expect(node?.initial).toEqual({ constant: 'else' })
	})

	test('an empty winning arm is no arm', () => {
		const [node] = conditionals(
			irOf(
				tsrx('@if (open.get()) { <p>a</p> }', {
					setup:
						'const open = createCell(false)\n\t\texpose({ open: open.get })',
				}),
			).root,
		)
		expect(node?.initial).toEqual({ constant: null })
	})

	test('an initializer over server args selects with a portable `when`', () => {
		const [node] = conditionals(
			irOf(
				tsrx('@if (open.get()) { <p>a</p> } @else { <b>b</b> }', {
					params: '{ start }: { start: number }',
					setup:
						'const open = createCell(start > 2)\n\t\texpose({ open: open.get })',
				}),
			).root,
		)
		expect(node?.initial).toEqual({
			select: [{ when: '((start > 2))', key: 'then' }],
			otherwise: 'else',
		})
	})

	test('a Parser-backed host read selects through the root attribute', () => {
		const [node] = conditionals(
			irOf(
				`import { asBoolean } from '@zeix/le-truc'
export function C({ open }: { open?: boolean })
	@{
		expose({ open: asBoolean() })
		<>
			<c-el open={open}>@if (host.open) { <p>a</p> }</c-el>
			<style>c-el { color: red }</style>
		</>
	}`,
			).root,
		)
		expect(node?.initial).toEqual({
			select: [{ when: '(open)', key: 'then' }],
			otherwise: null,
		})
	})

	test('a literal switch picks its case at compile time', () => {
		const [node] = conditionals(
			irOf(
				tsrx(
					"@switch (m.get()) { @case 'a': { <p>a</p> } @case 'b': { <p>b</p> } @default: { <p>c</p> } }",
					{ setup: "const m = createCell('b')\n\t\texpose({ m: m.get })" },
				),
			).root,
		)
		expect(node?.arms.map(arm => arm.key)).toEqual([
			'case:a',
			'case:b',
			'default',
		])
		expect(node?.initial).toEqual({ constant: 'case:b' })
	})

	test('a derived signal folds through the value harness', () => {
		const [node] = conditionals(
			irOf(
				tsrx('@if (big.get()) { <p>a</p> }', {
					setup:
						'const count = createCell(3)\n\t\tconst big = deriveCell(() => count.get() > 2)\n\t\texpose({ count: count.get })',
				}),
			).root,
		)
		expect(node?.initial).toEqual({ fold: true })
	})

	test('a server-known condition selects over its args', () => {
		const [node] = conditionals(
			irOf(
				tsrx('@if (level === 2) { <h2>a</h2> } @else { <h3>b</h3> }', {
					params: '{ level }: { level: number }',
				}),
			).root,
		)
		expect(node?.mode).toBe('server')
		expect(node?.initial).toEqual({
			select: [{ when: '(level === 2)', key: 'then' }],
			otherwise: 'else',
		})
	})
})

/* === Server render === */

describe('the server renders the winner beside the inert arms', () => {
	test('a constant winner, keyed, then one template per rendering arm', async () => {
		const { component } = compileComponent(
			TOGGLE_TSRX,
			'c-toggle.tsrx',
			new Set(),
		)
		const html = await render(component?.serverCode ?? '', 'Toggle', {
			label: 'Hi',
		})
		expect(html).toBe(
			'<c-toggle><h2 class="title">Hi</h2><div class="box">' +
				'<button data-key="else" type="button" class="opener">Open</button>' +
				'<template data-arms="0" data-key="then"><section class="panel"><button type="button" class="close">Close</button></section></template>' +
				'<template data-arms="0" data-key="else"><button type="button" class="opener">Open</button></template>' +
				'</div></c-toggle>',
		)
	})

	test('an arg-dependent winner folds per render', async () => {
		const { component, diagnostics } = compile(
			tsrx(
				'<i class="n" data-start={start}>n</i>@if (open.get()) { <p class="a">a</p> } @else { <b>b</b> }',
				{
					params: '{ start }: { start: number }',
					setup:
						'const open = createCell(start > 2)\n\t\texpose({ open: open.get })',
				},
			),
		)
		expect(diagnostics).toEqual([])
		const code = component?.serverCode ?? ''
		expect(await render(code, 'C', { start: 5 })).toContain(
			'</i><p data-key="then" class="a">a</p><template',
		)
		expect(await render(code, 'C', { start: 1 })).toContain(
			'</i><b data-key="else">b</b><template',
		)
		// The client seeds the signal from the arg's DOM site, so its first
		// key agrees with the server's winner.
		expect(component?.clientCode).toContain("getAttribute('data-start')")
	})

	test('a test no server phase can evaluate renders no live arm and routes the component', async () => {
		const { component, diagnostics } = compile(
			tsrx('@if (host.width > 10) { <p class="a">a</p> }', {
				setup: 'expose({ width: 0 })',
			}),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(await render(component?.serverCode ?? '', 'C', {})).toBe(
			'<c-el><template data-arms="0" data-key="then"><p class="a">a</p></template></c-el>',
		)
		expect(component?.entry.tier).not.toBe('folded')
		expect(component?.entry.routingSignals.map(s => s.detail)).toContain(
			'the initial arm of a conditional that reads a signal has no server-renderable value',
		)
	})

	test('a reactive switch keys its arms by their literal values', async () => {
		const { component, diagnostics } = compile(
			tsrx(
				"@switch (m.get()) { @case 'a': { <p>a</p> } @case 2: { <p>two</p> } @default: { <p>other</p> } }",
				{ setup: 'const m = createCell<string | number>(2)\n\t\texpose({})' },
			),
		)
		expect(diagnostics).toEqual([])
		const html = await render(component?.serverCode ?? '', 'C', {})
		expect(html).toBe(
			'<c-el><p data-key="case:2">two</p>' +
				'<template data-arms="0" data-key="case:a"><p>a</p></template>' +
				'<template data-arms="0" data-key="case:2"><p>two</p></template>' +
				'<template data-arms="0" data-key="default"><p>other</p></template></c-el>',
		)
		expect(component?.clientCode).toContain(
			"() => { switch (m.get()) { case 'a': return 'case:a'; case 2: return 'case:2'; default: return 'default' } }",
		)
	})

	test('the skeleton is byte-identical across the three tiers (ADR 0029 s4)', async () => {
		const source = tsrx(
			'@if (open.get()) { <p class="a">a</p> } @else { <b>b</b> }',
			{
				params: '{ start }: { start: number }',
				setup:
					'const open = createCell(start > 2)\n\t\texpose({ open: open.get })',
			},
		)
		const component = irOf(source)
		const renders: string[] = []
		for (const tier of ['folded', 'simulated', 'static'] as EvaluationTier[]) {
			const { code } = emitServerModule(component, {
				runtimeImport: '../../compiler/runtime',
				sourcePath: 'c.tsrx',
				tier,
			})
			renders.push(await render(code, 'C', { start: 5 }))
		}
		expect(renders[1]).toBe(renders[0] as string)
		expect(renders[2]).toBe(renders[0] as string)
	})
})

/* === Beside a reactive list === */

test('a reactive list beside an arm set queries its own item template', () => {
	const { component, diagnostics } = compile(
		tsrx(
			'<div class="head">@if (open.get()) { <p class="a">a</p> }</div><ul data-container>@for (const item of items) { <li>{item}</li> }</ul>',
			{
				setup:
					"const open = createCell(false)\n\t\tconst items = createList<string>([], { keyConfig: 'item' })\n\t\texpose({ open: open.get })",
				pre: "import { createCell, createList } from '@zeix/le-truc'",
			},
		),
	)
	expect(diagnostics).toEqual([])
	// `first('template')` would match the arm template that precedes it.
	expect(component?.clientCode).toContain(
		"const template = first('template:not([data-arms])',",
	)
})

/* === The client, in the simulation realm === */

describe('the client adopts the winner and switches arms', async () => {
	const { component } = compileComponent(
		TOGGLE_TSRX,
		'c-toggle.tsrx',
		new Set(),
	)
	if (!component) throw new Error('toggle must compile')
	const clientPath = generated.emit('c-toggle.client.ts', component.clientCode)
	const markup = await render(component.serverCode, 'Toggle', { label: 'Hi' })
	const realm = createSimulationRealm()
	afterAll(() => realm.dispose())
	await realm.load(() => import(pathToFileURL(clientPath).href))

	const settle = async () => {
		for (let i = 0; i < 20; i++) await Promise.resolve()
	}

	test('the connect diff is empty: the server winner is adopted, not replaced', async () => {
		const { html, diagnostics } = await realm.render({
			markup,
			component: 'c-toggle',
		})
		expect(diagnostics).toEqual([])
		expect(html).toBe(markup)
	})

	test('an event in the live arm switches arms, and re-entry clones afresh', async () => {
		const { document } = realm
		const box = () => document.querySelector('c-toggle .box') as HTMLElement
		const opener = box().querySelector('button.opener') as HTMLButtonElement
		opener.click()
		await settle()
		expect(box().querySelector('button.opener')).toBeNull()
		expect(box().firstElementChild?.outerHTML).toBe(
			'<section class="panel" data-key="then"><button type="button" class="close">Close</button></section>',
		)
		// The cloned arm's own mount bound its handler.
		;(box().querySelector('button.close') as HTMLButtonElement).click()
		await settle()
		const reopened = box().querySelector('button.opener')
		expect(reopened).not.toBeNull()
		expect(reopened).not.toBe(opener)
		expect(
			box().querySelectorAll(':scope > [data-key]:not(template)').length,
		).toBe(1)
		// The disposed arm's listener died with it: clicking the detached
		// opener no longer reaches the signal.
		opener.click()
		await settle()
		expect(box().querySelector('button.opener')).toBe(reopened)
	})
})

describe('the async boundary switches arms as its task settles (LT-276)', async () => {
	// `step` drives the task from outside: 0 never settles (pending), 1
	// resolves, 2 rejects.
	const { component, diagnostics } = compile(
		tsrx(
			'<div class="frame">@try { <div class="content">{data}</div> } @pending { <p class="loading">Loading</p> } @catch (e) { <p class="error">{e.message}</p> }</div>',
			{
				setup: `const step = createCell(0)
		const data = deriveCell(async () => {
			const at = step.get()
			if (at === 0) return new Promise<string>(() => {})
			if (at === 2) throw new Error('boom')
			return 'loaded'
		})
		expose({ step, data: data.get })`,
			},
		),
	)
	if (!component) throw new Error(JSON.stringify(diagnostics))
	const clientPath = generated.emit('c-el.client.ts', component.clientCode)
	const markup = await render(component.serverCode, 'C', {})
	const realm = createSimulationRealm()
	afterAll(() => realm.dispose())
	await realm.load(() => import(pathToFileURL(clientPath).href))
	const settle = async () => {
		for (let i = 0; i < 20; i++) await Promise.resolve()
	}
	const live = () =>
		realm.document
			.querySelector('c-el .frame')
			?.querySelectorAll(':scope > [data-key]:not(template)') ?? []
	const host = () =>
		realm.document.querySelector('c-el') as HTMLElement & { step: number }

	test('the pending arm renders on the server and is adopted', async () => {
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(markup).toContain('<p data-key="nil" class="loading">Loading</p>')
		const { html } = await realm.render({ markup, component: 'c-el' })
		expect(html).toBe(markup)
	})

	test('resolve: the ok arm replaces the pending arm and shows the value', async () => {
		host().step = 1
		await settle()
		expect([...live()].map(el => el.outerHTML)).toEqual([
			'<div class="content" data-key="ok">loaded</div>',
		])
	})

	test('reject: the err arm replaces the ok arm and shows the message', async () => {
		host().step = 2
		await settle()
		expect([...live()].map(el => el.outerHTML)).toEqual([
			'<p class="error" data-key="err">boom</p>',
		])
	})
})

/* === Refusals === */

describe('placement and shape refusals', () => {
	const setup = 'const open = createCell(false)\n\t\texpose({ open: open.get })'

	test('inside a server-data loop body', () => {
		const found = errors(
			tsrx(
				'<ul>@for (const item of items) { <li>@if (open.get()) { <b>{item}</b> }</li> }</ul>',
				{ params: '{ items }: { items: string[] }', setup },
			),
		)
		expect(found.map(d => d.message).join('\n')).toContain(
			'inside a server-data `@for` body',
		)
	})

	test('a first() reference into an arm', () => {
		const found = errors(
			tsrx('<div class="box">@if (open.get()) { <p class="a">a</p> }</div>', {
				setup: `${setup}\n\t\tconst para = first('p.a')`,
			}),
		)
		expect(found.map(d => d.message).join('\n')).toContain(
			"inside a reactive conditional's arm",
		)
	})

	test('a client construct in control flow nested in an arm', () => {
		const found = errors(
			tsrx(
				'<div class="box">@if (open.get()) { <section>@if (ok) { <button type="button" onClick={() => {}}>x</button> }</section> }</div>',
				{ params: '{ ok }: { ok: boolean }', setup },
			),
		)
		expect(found.map(d => d.message).join('\n')).toContain(
			'A client construct in a nested control-flow branch inside a `@if` branch of a condition that reads a signal',
		)
	})

	test('a text-only arm', () => {
		const found = errors(
			tsrx('<div class="box">@if (open.get()) { <>text</> }</div>', { setup }),
		)
		expect(found.map(d => d.message).join('\n')).toContain(
			'does not render exactly one root element',
		)
	})

	test('static markup and server conditionals inside an arm stay legal', () => {
		expect(
			errors(
				tsrx(
					'<div class="box">@if (open.get()) { <section><h3>t</h3>@if (ok) { <p>x</p> }</section> }</div>',
					{ params: '{ ok }: { ok: boolean }', setup },
				),
			),
		).toEqual([])
	})
})
