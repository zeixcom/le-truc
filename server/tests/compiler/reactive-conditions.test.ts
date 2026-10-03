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
				<style>:host {
	  display: block;
	}</style>
			</c-toggle>
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
				<style>{css\`:host {
	  display: block;
	}\`}</style>
			</c-toggle>
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
			<c-el>${body}
				<style>:host {
	  color: red;
	}</style>
			</c-el>
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
			`reconcile(div, div.querySelectorAll<HTMLTemplateElement>(':scope > template[data-arms="0"]'), () => ((open.get()) ? 'then' : 'else'), (armElement, armKey, first) => {`,
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
			`() => ((open.get()) ? 'then' : 'else')`,
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
		// LT-385g: pinned on a fixture the FULL pipeline accepts — a cell
		// seeded from a server arg needs the arg's DOM site (`data-mode`),
		// and a string comparison keeps the generated client typecheckable
		// (the number-spelled `start > 2` seeded `(getAttribute() ?? '') > 2`,
		// a string/number relation tsc refuses).
		const [node] = conditionals(
			irOf(
				tsrx('@if (open.get()) { <p>a</p> } @else { <b>b</b> }', {
					params: '{ mode }: { mode: string }',
					setup:
						"const open = createCell(mode === 'wide')\n\t\texpose({ open: open.get })",
				}).replace('<c-el>', '<c-el data-mode={mode}>'),
			).root,
		)
		expect(node?.initial).toEqual({
			select: [{ when: "((mode === 'wide'))", key: 'then' }],
			otherwise: 'else',
		})
	})

	test('a Parser-backed host read folds — the portable grammar admits no parser call (LT-386)', () => {
		// The prop's server truth is the parser applied to the attribute's
		// rendered value (`asBoolean()(open)`) — a call, so the portable
		// rewrite refuses and the conditional folds through the value
		// harness, whose spliced seed applies the parser. The pre-LT-386
		// `select: [{ when: '(open)' }]` answer substituted the RAW
		// attribute expression — for `asInteger()` a string/number relation
		// the server answers differently from the client's parsed prop.
		const [node] = conditionals(
			irOf(
				`import { asBoolean } from '@zeix/le-truc'
export function C({ open }: { open?: boolean })
	@{
		expose({ open: asBoolean() })
			<c-el open={open}>@if (host.open) { <p>a</p> }
				<style>:host {
	  color: red;
	}</style>
			</c-el>
	}`,
			).root,
		)
		expect(node?.initial).toEqual({ fold: true })
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
		// Case keys are value-typed (LT-385d): `case:` + the literal's JSON,
		// so `@case 1` and `@case '1'` stay distinct keys.
		expect(node?.arms.map(arm => arm.key)).toEqual([
			'case:"a"',
			'case:"b"',
			'default',
		])
		expect(node?.initial).toEqual({ constant: 'case:"b"' })
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
		// The parser's fallback reads a `first()` ref (the HOST_PROFILE
		// children-are-data idiom) — no server truth to splice, so the
		// conditional routes off the host-derived fold (LT-386): an
		// LTC034-origin signal, never a wrong winner.
		const { component, diagnostics } = compile(
			tsrx(
				'<input type="number" />@if (host.width > 10) { <p class="a">a</p> }',
				{
					pre: "import { asInteger } from '@zeix/le-truc'",
					setup:
						"const input = first('input')\n\t\texpose({ width: asInteger(input.value) })",
				},
			),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(await render(component?.serverCode ?? '', 'C', {})).toBe(
			'<c-el><input type="number"><template data-arms="0" data-key="then"><p class="a">a</p></template></c-el>',
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
		// String literals JSON-quote their key (LT-385d); the attribute
		// escapes the quotes.
		expect(html).toBe(
			'<c-el><p data-key="case:2">two</p>' +
				'<template data-arms="0" data-key="case:&quot;a&quot;"><p>a</p></template>' +
				'<template data-arms="0" data-key="case:2"><p>two</p></template>' +
				'<template data-arms="0" data-key="default"><p>other</p></template></c-el>',
		)
		expect(component?.clientCode).toContain(
			"() => { switch (m.get()) { case 'a': return 'case:\"a\"'; case 2: return 'case:2'; default: return 'default' } }",
		)
	})

	test('a number case and its string spelling stay distinct keys (LT-385d)', () => {
		const [node] = conditionals(
			irOf(
				tsrx(
					"@switch (m.get()) { @case 1: { <p>n</p> } @case '1': { <p>s</p> } }",
					{
						setup: 'const m = createCell<string | number>(1)\n\t\texpose({})',
					},
				),
			).root,
		)
		expect(node?.arms.map(arm => arm.key)).toEqual(['case:1', 'case:"1"'])
	})

	test('a ternary test keeps its own parens in the key thunk (LT-385b)', () => {
		// `() => (${test} ? 'then' : 'else')` let a ternary, comma or
		// assignment test bind into the branches and return a non-key; the
		// emitted test is parenthesized now.
		const { component } = compile(
			tsrx("@if (open.get() ? 'x' : 'y') { <p>a</p> } @else { <b>b</b> }", {
				setup: 'const open = createCell(true)\n\t\texpose({ open: open.get })',
			}),
		)
		expect(component?.clientCode).toContain(
			"() => ((open.get() ? 'x' : 'y') ? 'then' : 'else')",
		)
	})

	test('a losing arm bakes lazy text empty; the live winner keeps its values (LT-385c)', async () => {
		// The null-guard idiom: the `then` arm's lazy child reads
		// `user.get()!.name`, and `user` is null at render — the template
		// must bake the site empty, not evaluate it under the wrong
		// condition.
		const { component, diagnostics } = compile(
			tsrx('@if (user.get()) { <p>{() => user.get()!.name}</p> }', {
				setup:
					'const user = deriveCell(() => null as { name: string } | null)\n\t\texpose({})',
			}),
		)
		expect(diagnostics).toEqual([])
		const html = await render(component?.serverCode ?? '', 'C', {})
		expect(html).toBe(
			'<c-el><template data-arms="0" data-key="then"><p></p></template></c-el>',
		)
		// The live winner evaluates as before.
		const resolved = compile(
			tsrx('@if (user.get()) { <p>{() => user.get()!.name}</p> }', {
				setup:
					"const user = deriveCell(() => ({ name: 'Ada' }))\n\t\texpose({})",
			}),
		)
		const liveHtml = await render(resolved.component?.serverCode ?? '', 'C', {})
		expect(liveHtml).toBe(
			'<c-el><p data-key="then">Ada</p>' +
				'<template data-arms="0" data-key="then"><p></p></template></c-el>',
		)
	})

	test('a losing arm bakes reactive attributes and class maps empty (LT-385c)', async () => {
		const { component, diagnostics } = compile(
			tsrx(
				'@if (user.get()) { <p data-name={() => user.get()!.name} class={() => ({ big: user.get() !== null })}>x</p> }',
				{
					setup:
						'const user = deriveCell(() => null as { name: string } | null)\n\t\texpose({})',
				},
			),
		)
		expect(diagnostics).toEqual([])
		const html = await render(component?.serverCode ?? '', 'C', {})
		expect(html).toBe(
			'<c-el><template data-arms="0" data-key="then"><p>x</p></template></c-el>',
		)
	})

	test('the skeleton is byte-identical across the three tiers (ADR 0029 s4)', async () => {
		// LT-385g: the same compiling fixture the `select` test pins — the
		// retired `createCell(start > 2)` spelling is refused by a full
		// compile (LTC005's server-only face: the initializer reads a server
		// arg with no DOM site to seed from).
		const source = tsrx(
			'@if (open.get()) { <p class="a">a</p> } @else { <b>b</b> }',
			{
				params: '{ mode }: { mode: string }',
				setup:
					"const open = createCell(mode === 'wide')\n\t\texpose({ open: open.get })",
			},
		).replace('<c-el>', '<c-el data-mode={mode}>')
		const component = irOf(source)
		const renders: string[] = []
		for (const tier of ['folded', 'simulated', 'static'] as EvaluationTier[]) {
			const { code } = emitServerModule(component, {
				runtimeImport: '../../compiler/runtime',
				sourcePath: 'c.tsrx',
				tier,
			})
			renders.push(await render(code, 'C', { mode: 'wide' }))
		}
		expect(renders[1]).toBe(renders[0] as string)
		expect(renders[2]).toBe(renders[0] as string)
	})
})

/* === The initial winner agrees with the client's first key (LT-386) === */

describe('a Parser-backed seed folds through the parser (LT-386)', async () => {
	// The LT-274 review's miscompile: the fold substituted the RAW attribute
	// expression, folding `'3' === 3` to `else` while the client's parsed
	// prop (`asInteger('3') === 3`) picks `then` — a replacement at connect
	// on a component the census calls Folded. The spliced seed now applies
	// the parser, so both sides answer the same truth.
	const { component, diagnostics } = compile(
		tsrx(
			'@if (host.count === 3) { <p class="a">three</p> } @else { <b class="b">other</b> }',
			{
				params: '{ n }: { n: number }',
				pre: "import { asInteger } from '@zeix/le-truc'",
				setup: 'expose({ count: asInteger() })',
			},
		).replace('<c-el>', '<c-el count={String(n)}>'),
	)
	if (!component) throw new Error(JSON.stringify(diagnostics))
	const code = component.serverCode

	test('the server folds the test through the parser factory', async () => {
		expect(diagnostics).toEqual([])
		// `attrValue` serializes the attribute the way `attr()` renders it —
		// the string a connect-time parse would read.
		expect(code).toContain('if ((asInteger()(attrValue(String(n)))) === 3)')
		expect(await render(code, 'C', { n: 3 })).toContain(
			'<p data-key="then" class="a">three</p>',
		)
		expect(await render(code, 'C', { n: 4 })).toContain(
			'<b data-key="else" class="b">other</b>',
		)
	})

	test("the client's first key agrees: the connect diff is empty", async () => {
		const clientPath = generated.emit(
			'c-el-parser.client.ts',
			component.clientCode,
		)
		const markup = await render(code, 'C', { n: 3 })
		const realm = createSimulationRealm()
		afterAll(() => realm.dispose())
		await realm.load(() => import(pathToFileURL(clientPath).href))
		const { html, diagnostics: realmDiags } = await realm.render({
			markup,
			component: 'c-el',
		})
		expect(realmDiags).toEqual([])
		expect(html).toBe(markup)
	})
})

describe('a static expose() initializer folds to a constant (LT-386)', async () => {
	// `#initSignals` evaluates the initializer once as the prop's client
	// seed — the attribute never seeds a plain-value prop — so the
	// initializer expression IS the prop's server truth. Pre-LT-386 the
	// conditional rendered no live arm AND routed the component Simulated.
	test('the initial winner is the constant arm, on a Folded component', async () => {
		const [node] = conditionals(
			irOf(
				tsrx(
					'@if (host.count === 3) { <p class="a">three</p> } @else { <b class="b">other</b> }',
					{ setup: 'expose({ count: 5 })' },
				),
			).root,
		)
		expect(node?.initial).toEqual({ constant: 'else' })

		const { component, diagnostics } = compile(
			tsrx(
				'@if (host.count === 3) { <p class="a">three</p> } @else { <b class="b">other</b> }',
				{ setup: 'expose({ count: 5 })' },
			),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(component?.entry.tier).toBe('folded')
		expect(component?.entry.routingSignals).toEqual([])
		expect(await render(component?.serverCode ?? '', 'C', {})).toContain(
			'<b data-key="else" class="b">other</b>',
		)
	})

	test('an unsatisfiable static test renders no live arm, still Folded', async () => {
		const { component, diagnostics } = compile(
			tsrx('@if (host.width > 10) { <p class="a">a</p> }', {
				setup: 'expose({ width: 0 })',
			}),
		)
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		expect(await render(component?.serverCode ?? '', 'C', {})).toBe(
			'<c-el><template data-arms="0" data-key="then"><p class="a">a</p></template></c-el>',
		)
		expect(component?.entry.tier).toBe('folded')
		expect(component?.entry.routingSignals).toEqual([])
	})

	test('a select names keyOf(arm) — null for an arm that renders nothing', () => {
		const [node] = conditionals(
			irOf(
				tsrx('@if (host.big) { } @else { <b class="b">other</b> }', {
					params: '{ n }: { n: number }',
					setup: 'expose({ big: n > 2 })',
				}),
			).root,
		)
		expect(node?.initial).toEqual({
			select: [{ when: '((n > 2))', key: null }],
			otherwise: 'else',
		})
	})

	test("the client's first key agrees: the connect diff is empty", async () => {
		const { component, diagnostics } = compile(
			tsrx(
				'@if (host.count === 3) { <p class="a">three</p> } @else { <b class="b">other</b> }',
				{ setup: 'expose({ count: 5 })' },
			),
		)
		if (!component) throw new Error(JSON.stringify(diagnostics))
		const clientPath = generated.emit(
			'c-el-static.client.ts',
			component.clientCode,
		)
		const markup = await render(component.serverCode, 'C', {})
		const realm = createSimulationRealm()
		afterAll(() => realm.dispose())
		await realm.load(() => import(pathToFileURL(clientPath).href))
		const { html, diagnostics: realmDiags } = await realm.render({
			markup,
			component: 'c-el',
		})
		expect(realmDiags).toEqual([])
		expect(html).toBe(markup)
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

test('boundary templates bake their value sites empty while pending (LT-385c)', async () => {
	// The boundary's grammar admits exactly one client-written site per arm
	// — the recognized value child on the arm root (`emitArmRoot`); deeper
	// constructs are LTC005. LT-276 already bakes that one site empty in the
	// templates (the live winner writes it); this pins the emptiness — the
	// pending task's `get()` must never be evaluated for a template.
	const { component, diagnostics } = compile(
		tsrx(
			'<div class="frame">@try { <div class="content">{data}</div> } @pending { <p class="loading">Loading</p> } @catch (e) { <p class="error">{e.message}</p> }</div>',
			{
				setup: `const data = deriveCell(async () => new Promise<string>(() => {}))
		expose({})`,
			},
		),
	)
	expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
	const html = await render(component?.serverCode ?? '', 'C', {})
	expect(html).toBe(
		'<c-el><div class="frame">' +
			'<p data-key="nil" class="loading">Loading</p>' +
			'<template data-arms="0" data-key="ok"><div class="content"></div></template>' +
			'<template data-arms="0" data-key="nil"><p class="loading">Loading</p></template>' +
			'<template data-arms="0" data-key="err"><p class="error"></p></template>' +
			'</div></c-el>',
	)
})

describe('two adjacent arm sets keep their templates to themselves (LT-385a)', async () => {
	// The review's miscompile: the second set renders no live arm (b false),
	// so its anchor's previousElementSibling is the FIRST set's template —
	// adopted for its `data-key`, then removed when the key stayed null, and
	// set 0's next flip threw NotFoundError from insertBefore.
	const { component, diagnostics } = compile(
		tsrx(
			'<div class="frame">@if (a.get()) { <p class="one">A</p> }@if (b.get()) { <p class="two">B</p> }</div>',
			{
				setup:
					'const a = createCell(true)\n\t\tconst b = createCell(false)\n\t\texpose({ a, b })',
			},
		),
	)
	if (!component) throw new Error(JSON.stringify(diagnostics))
	// Not 'c-el.client.ts': the boundary describe above already imported a
	// module of that name, and the process module cache would serve ITS
	// client for this realm's markup.
	const clientPath = generated.emit(
		'c-el-adjacent.client.ts',
		component.clientCode,
	)
	const markup = await render(component.serverCode, 'C', {})
	const realm = createSimulationRealm()
	afterAll(() => realm.dispose())
	await realm.load(() => import(pathToFileURL(clientPath).href))
	const settle = async () => {
		for (let i = 0; i < 20; i++) await Promise.resolve()
	}
	const frame = () => realm.document.querySelector('c-el .frame') as HTMLElement
	const host = () =>
		realm.document.querySelector('c-el') as HTMLElement & {
			a: boolean
			b: boolean
		}

	test('connect leaves both sets and all templates in place', async () => {
		expect(diagnostics.filter(d => d.severity === 'error')).toEqual([])
		const { html } = await realm.render({ markup, component: 'c-el' })
		expect(html).toBe(markup)
		expect(frame().querySelectorAll('template').length).toBe(2)
	})

	test('both sets keep flipping independently afterwards', async () => {
		host().b = true
		await settle()
		expect(frame().querySelector('p.two')).not.toBeNull()
		expect(frame().querySelectorAll('template').length).toBe(2)

		host().a = false
		await settle()
		expect(frame().querySelector('p.one')).toBeNull()

		host().a = true
		await settle()
		// The flip that threw NotFoundError before the fix: set 0's arm must
		// come back, with its template intact.
		expect(frame().querySelector('p.one')).not.toBeNull()
		expect(frame().querySelectorAll('template').length).toBe(2)

		host().b = false
		await settle()
		expect(frame().querySelector('p.two')).toBeNull()
		expect(frame().querySelector('p.one')).not.toBeNull()
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

/* === Mode classification follows scope (LT-387) === */

/** A one-file component around `body`, `.tsx` spelling. */
const tsx = (
	body: string,
	{ params = '{}: {}', setup = '' }: { params?: string; setup?: string } = {},
): string => `import { createCell } from '@zeix/le-truc'

export function C(${params}) {
	${setup}
	return (
			<c-el>${body}
				<style>{'c-el { color: red }'}</style>
			</c-el>
	)
}
`

describe('condition classification follows scope (LT-387)', () => {
	const setup = 'const open = createCell(false)\n\t\texpose({ open: open.get })'
	const listParams = '{ items }: { items: boolean[] }'
	const errorsOn = (surface: 'tsrx' | 'tsx', source: string) =>
		(surface === 'tsrx'
			? compileComponent(source, 'c.tsrx', new Set())
			: compileComponentTsx(source, 'c.tsx', new Set())
		).diagnostics.filter(d => d.severity === 'error')

	test.each(['tsrx', 'tsx'] as const)(
		'a live setup alias of a signal is refused (LTC005) on .%s',
		surface => {
			const at = (alias: string, cond: string) =>
				surface === 'tsrx'
					? tsrx(`<div>@if (${cond}) { <b>x</b> }</div>`, {
							setup: `${setup}\n\t\t${alias}`,
						})
					: tsx(`{${cond} ? <b>x</b> : null}`, {
							setup: `${setup}\n\t\t${alias}`,
						})
			// A function whose body reads the signal, a bare signal alias and
			// a method reference without the call are all LIVE reads: under a
			// `server` classification the condition would never update.
			for (const [alias, cond] of [
				['const isOpen = () => open.get()', 'isOpen()'],
				['const o = open', 'o.get()'],
				['const a = open.get', 'a'],
			] as Array<[string, string]>) {
				expect(errorsOn(surface, at(alias, cond)).map(d => d.code)).toEqual([
					'LTC005',
				])
			}
		},
	)

	test.each(['tsrx', 'tsx'] as const)(
		'an eager snapshot const of a signal stays server on .%s',
		surface => {
			const at = (snapshotSetup: string, cond: string) =>
				surface === 'tsrx'
					? tsrx(`<div>@if (${cond}) { <b>x</b> }</div>`, {
							setup: snapshotSetup,
						})
					: tsx(`{${cond} ? <b>x</b> : null}`, {
							setup: snapshotSetup,
						})
			// The dereference runs once in setup — one server value, not a
			// live read. Direct, and through a further bare alias.
			expect(
				errorsOn(
					surface,
					at(`${setup}\n\t\tconst snapshot = open.get()`, 'snapshot'),
				),
			).toEqual([])
			expect(
				errorsOn(
					surface,
					at(`${setup}\n\t\tconst s = open.get()\n\t\tconst t = s`, 't'),
				),
			).toEqual([])
		},
	)

	test.each(['tsrx', 'tsx'] as const)(
		'a loop binding shadowing a signal name compiles on .%s',
		surface => {
			const source =
				surface === 'tsrx'
					? tsrx(
							'<ul>@for (const open of items) { <li>@if (open) { <b>x</b> }</li> }</ul>',
							{ params: listParams, setup },
						)
					: tsx('<ul>{items.map(open => <li>{open && <b>x</b>}</li>)}</ul>', {
							params: listParams,
							setup,
						})
			// The binding shadows the same-named signal inside the body, so
			// the condition is the per-item server value, not a signal read.
			expect(errorsOn(surface, source)).toEqual([])
		},
	)

	test.each(['tsrx', 'tsx'] as const)(
		'a hoisted const shadowing a signal name compiles on .%s',
		surface => {
			const itemParams = '{ items }: { items: { open: boolean }[] }'
			const source =
				surface === 'tsrx'
					? tsrx(
							'<ul>@for (const item of items) { const open = item.open; <li>@if (open) { <b>x</b> }</li> }</ul>',
							{ params: itemParams, setup },
						)
					: tsx(
							'<ul>{items.map(item => { const open = item.open; return <li>{open && <b>x</b>}</li> })}</ul>',
							{ params: itemParams, setup },
						)
			// The hoisted per-item const shadows the same-named signal too.
			expect(errorsOn(surface, source)).toEqual([])
		},
	)
})
