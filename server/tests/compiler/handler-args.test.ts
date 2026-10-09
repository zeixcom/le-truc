/**
 * Handler args (LT-461): an `on`-prefixed function arg the child places on
 * an owned element lowers to a parent-side `on()`.
 *
 * - the child emits nothing for the arg, on either half, and publishes the
 *   placement on its registry entry (`handlerArgs`);
 * - the event comes from the placement, not the arg name;
 * - the parent's compose site binds the handler with `on()` against the
 *   site's selector joined with the placement's, in the site's Mount Scope:
 *   the host, an arm (root or descendant), a reactive-list item;
 * - a forwarded arg resolves through the registry, the selector descending
 *   through both boundaries;
 * - the handler's `{ prop: value }` return updates the PARENT's host: it is
 *   the parent factory's own `on`;
 * - the parent's server render never forwards the arg.
 *
 * LTC081's cases are pinned on both surfaces in `tsx/diagnostic-parity`.
 */
import { describe, expect, test } from 'bun:test'
import ts from 'typescript'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import type { InternalRegistryEntry } from '../../compiler/registry'

const CHILD_TSX = `export function BasicChild(
	{ label, onPress }: { label: string; onPress?: (e: MouseEvent) => void },
) {
	return (
		<basic-child>
			<button type="button" onClick={onPress}>{label}</button>
			<style>{\`@scope {
	:scope { display: block; }
}\`}</style>
		</basic-child>
	)
}`

const CHILD_TSRX = `export function BasicChild({ label, onPress }: { label: string; onPress?: (e: MouseEvent) => void })
	@{
		<basic-child>
			<button type="button" onClick={onPress}>{label}</button>
			<style>@scope {
	:scope { display: block; }
}</style>
		</basic-child>
	}`

const CHILD_PATH = 'examples/child/basic-child.tsx'

const entryOf = (
	source: string,
	path: string,
	tsx = true,
): InternalRegistryEntry => {
	const { component, diagnostics } = tsx
		? compileComponentTsx(source, path, new Set())
		: compileComponent(source, path, new Set())
	if (!component)
		throw new Error(`must compile: ${JSON.stringify(diagnostics)}`)
	return component.entry
}

const registryOf = (...entries: InternalRegistryEntry[]) =>
	new Map(entries.map(e => [e.source, e]))

const parentTsx = (body: string, setup = '', pre = '', ctx = '') => `${pre}
import { BasicChild } from '../child/basic-child.tsx'
export function BasicParent({}: {}${ctx}) {
	${setup}
	return (
		<basic-parent>
			${body}
			<style>{\`@scope {
	:scope { display: block; }
}\`}</style>
		</basic-parent>
	)
}`

const compileParent = (
	source: string,
	registry: Map<string, InternalRegistryEntry>,
) => {
	const result = compileComponentTsx(
		source,
		'examples/parent/basic-parent.tsx',
		new Set(),
		undefined,
		registry,
	)
	if (!result.component)
		throw new Error(
			`parent must compile: ${JSON.stringify(result.diagnostics)}`,
		)
	return result.component
}

describe('the child half: no emission, one published placement', () => {
	for (const [surface, source, path] of [
		['.tsx', CHILD_TSX, CHILD_PATH],
		['.tsrx', CHILD_TSRX, 'examples/child/basic-child.tsrx'],
	] as const) {
		test(`${surface}: neither half emits the arg; the event comes from the placement`, () => {
			const { component, diagnostics } =
				surface === '.tsx'
					? compileComponentTsx(source, path, new Set())
					: compileComponent(source, path, new Set())
			expect(diagnostics).toEqual([])
			expect(component?.serverCode).toContain(
				'__html.push("<button type=\\"button\\">")',
			)
			expect(component?.serverCode).not.toContain('onPress)')
			expect(component?.clientCode).not.toContain('on(')
			expect(component?.entry.handlerArgs).toEqual({
				onPress: [{ event: 'click', selector: 'button', optional: false }],
			})
		})
	}

	test('a placement in a server-rendered branch is optional', () => {
		const entry = entryOf(
			`export function BasicChild(
	{ open, onPress }: { open: boolean; onPress?: () => void },
) {
	return (
		<basic-child>
			{open ? <button type="button" onClick={onPress}>x</button> : null}
			<style>{\`@scope {
	:scope { display: block; }
}\`}</style>
		</basic-child>
	)
}`,
			CHILD_PATH,
		)
		expect(entry.handlerArgs).toEqual({
			onPress: [{ event: 'click', selector: 'button', optional: true }],
		})
	})

	test('two placements of one arg publish one placement each', () => {
		const entry = entryOf(
			`export function BasicChild({ onPress }: { onPress?: () => void }) {
	return (
		<basic-child>
			<button type="button" class="a" onClick={onPress}>a</button>
			<input class="b" onKeyup={onPress} />
			<style>{\`@scope {
	:scope { display: block; }
}\`}</style>
		</basic-child>
	)
}`,
			CHILD_PATH,
		)
		expect(
			entry.handlerArgs?.onPress?.map(p => 'event' in p && p.event),
		).toEqual(['click', 'keyup'])
	})
})

describe('the parent half: one on() per placement, in the site’s scope', () => {
	const registry = registryOf(entryOf(CHILD_TSX, CHILD_PATH))

	test('two sites of one child bind through their discriminators', () => {
		const parent = compileParent(
			parentTsx(
				'<BasicChild class="a" label="a" onPress={() => console.log(1)} /><BasicChild class="b" label="b" onPress={() => console.log(2)} />',
			),
			registry,
		)
		expect(parent.clientCode).toContain("first('basic-child.a button'")
		expect(parent.clientCode).toContain("first('basic-child.b button'")
	})

	test('sites sharing one `truc:pass` still need a discriminator for a handler', () => {
		const sharing = `{ value: () => 'x' }`
		const { diagnostics } = compileComponentTsx(
			parentTsx(
				`<BasicChild class="row" label="a" truc:pass={${sharing}} onPress={() => console.log(1)} /><BasicChild class="row" label="b" truc:pass={${sharing}} onPress={() => console.log(2)} />`,
			),
			'examples/parent/basic-parent.tsx',
			new Set(),
			undefined,
			registryOf(
				entryOf(
					CHILD_TSX.replace('return (', "expose({ value: '' })\n\treturn ("),
					CHILD_PATH,
				),
			),
		)
		expect(diagnostics.map(d => d.code)).toEqual(['LTC007', 'LTC007'])
		expect(diagnostics[0]?.message).toContain(
			'a handler arg needs a unique target',
		)
	})

	test('a host-level site binds through a factory query; the server render drops the arg', () => {
		const parent = compileParent(
			parentTsx(
				'<BasicChild class="top" label="a" onPress={e => console.log(e.button)} />',
			),
			registry,
		)
		expect(parent.clientCode).toContain(
			"const button = first('basic-child button', 'basic-parent: basic-child button missing')",
		)
		expect(parent.clientCode).toContain(
			"on(button, 'click', e => console.log(e.button))",
		)
		expect(parent.serverCode).toContain('renderBasicChild({ "label": "a" })')
	})

	test("the handler's return value batches into the parent's host", () => {
		const parent = compileParent(
			parentTsx(
				'<BasicChild label="a" onPress={() => ({ open: true })} />',
				'',
				'',
				', { on }: FactoryContext<{ open: boolean }>',
			),
			registry,
		)
		// The parent factory's own `on`, destructured from its context.
		expect(parent.clientCode).toMatch(/\(\{ first, on \}\) => \{/)
		expect(parent.clientCode).toContain(
			"on(button, 'click', () => ({ open: true }))",
		)
	})

	test('a setup const only a handler arg reads reaches the client (LT-490)', () => {
		const parent = compileParent(
			parentTsx(
				'<BasicChild label="a" onPress={() => console.log(ALPHA[0])} />',
				"const ALPHA = 'ABC'",
			),
			registry,
		)
		expect(parent.clientCode).toContain("const ALPHA = 'ABC'")
		// The generated module declares every name it reads: no TS2304. Its
		// imports stay unresolved here, which is TS2307, not TS2304.
		const file = 'basic-parent.ts'
		const host = ts.createCompilerHost({ noEmit: true })
		const getSourceFile = host.getSourceFile
		host.getSourceFile = (name, version) =>
			name === file
				? ts.createSourceFile(name, parent.clientCode, version)
				: getSourceFile(name, version)
		const program = ts.createProgram(
			[file],
			{
				noEmit: true,
				noResolve: true,
				lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
			},
			host,
		)
		const undeclared = program
			.getSemanticDiagnostics(program.getSourceFile(file))
			.filter(d => d.code === 2304)
			.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
		expect(undeclared).toEqual([])
	})

	test('a site in a server-rendered branch queries without throwing', () => {
		const parent = compileParent(
			`import { BasicChild } from '../child/basic-child.tsx'
export function BasicParent({ open }: { open: boolean }) {
	return (
		<basic-parent>
			{open ? <BasicChild label="a" onPress={() => console.log('a')} /> : null}
			<style>{\`@scope {
	:scope { display: block; }
}\`}</style>
		</basic-parent>
	)
}`,
			registry,
		)
		expect(parent.clientCode).toContain(
			"const button = first('basic-child button')",
		)
	})

	test('a reactive-list item binds in its mount, reading the key (no LTC075)', () => {
		const result = compileComponentTsx(
			parentTsx(
				'<ul>{items.map((item, k) => <li><BasicChild label="x" onPress={() => items.remove(k)} /></li>)}</ul>',
				'const items = createList<string>([], { keyConfig: item => item })',
				"import { createList } from '@zeix/le-truc'",
			),
			'examples/parent/basic-parent.tsx',
			new Set(),
			undefined,
			registry,
		)
		expect(result.diagnostics).toEqual([])
		const code = result.component?.clientCode ?? ''
		expect(code).toContain('(_element, item, k, first) => {')
		expect(code).toContain(
			"const button = first('basic-child button', 'basic-parent: basic-child button missing')",
		)
		expect(code).toContain("on(button, 'click', () => items.remove(k))")
		expect(result.component?.serverCode).not.toContain('items.remove')
	})

	test('an arm root and an arm descendant bind in the arm’s mount', () => {
		const parent = compileParent(
			parentTsx(
				`{host.open ? <BasicChild label="a" onPress={() => ({ open: false })} /> : <section><BasicChild label="b" onPress={() => ({ open: true })} /></section>}`,
				'',
				'',
				', { host }: FactoryContext<{ open: boolean }>',
			),
			registry,
		)
		expect(parent.clientCode).toContain(
			"if (armKey === 'then') {\n\t\t\t\tconst button = first('button', 'basic-parent: button missing')\n\t\t\t\ton(button, 'click', () => ({ open: false }))",
		)
		expect(parent.clientCode).toContain(
			"const button2 = first('basic-child button', 'basic-parent: basic-child button missing')\n\t\t\t\ton(button2, 'click', () => ({ open: true }))",
		)
	})

	test('a forwarded arg resolves through the registry, descending both boundaries', () => {
		const child = entryOf(CHILD_TSX, CHILD_PATH)
		const middle = entryOf(
			`import { BasicChild } from '../child/basic-child.tsx'
export function BasicMiddle({ onClick }: { onClick?: (e: MouseEvent) => void }) {
	return (
		<basic-middle>
			<div><BasicChild label="m" onPress={onClick} /></div>
			<style>{\`@scope {
	:scope { display: block; }
}\`}</style>
		</basic-middle>
	)
}`,
			'examples/middle/basic-middle.tsx',
		)
		expect(middle.handlerArgs).toEqual({
			onClick: [
				{ via: CHILD_PATH, clause: '', arg: 'onPress', optional: false },
			],
		})
		const result = compileComponentTsx(
			`import { BasicMiddle } from '../middle/basic-middle.tsx'
export function BasicParent({}: {}) {
	return (
		<basic-parent>
			<BasicMiddle onClick={() => console.log('m')} />
			<style>{\`@scope {
	:scope { display: block; }
}\`}</style>
		</basic-parent>
	)
}`,
			'examples/parent/basic-parent.tsx',
			new Set(),
			undefined,
			registryOf(child, middle),
		)
		expect(result.diagnostics).toEqual([])
		expect(result.component?.clientCode).toContain(
			"first('basic-middle basic-child button'",
		)
		expect(result.component?.clientCode).toContain(
			"on(button, 'click', () => console.log('m'))",
		)
	})

	test('a forwarding site emits nothing in the forwarding component', () => {
		const result = compileComponentTsx(
			`import { BasicChild } from '../child/basic-child.tsx'
export function BasicMiddle({ onClick }: { onClick?: () => void }) {
	return (
		<basic-middle>
			<BasicChild label="m" onPress={onClick} />
			<style>{\`@scope {
	:scope { display: block; }
}\`}</style>
		</basic-middle>
	)
}`,
			'examples/middle/basic-middle.tsx',
			new Set(),
			undefined,
			registry,
		)
		expect(result.diagnostics).toEqual([])
		expect(result.component?.clientCode).not.toContain('on(')
		expect(result.component?.serverCode).toContain(
			'renderBasicChild({ "label": "m" })',
		)
	})

	test('a forward inside a reactive-list item is LTC081', () => {
		const { diagnostics } = compileComponentTsx(
			`import { createList } from '@zeix/le-truc'
import { BasicChild } from '../child/basic-child.tsx'
export function BasicMiddle({ onClick }: { onClick?: () => void }) {
	const items = createList<string>([], { keyConfig: item => item })
	return (
		<basic-middle>
			<ul>{items.map(item => <li><BasicChild label="m" onPress={onClick} /></li>)}</ul>
			<style>{\`@scope {
	:scope { display: block; }
}\`}</style>
		</basic-middle>
	)
}`,
			'examples/middle/basic-middle.tsx',
			new Set(),
			undefined,
			registry,
		)
		expect(diagnostics.map(d => d.code)).toEqual(['LTC081'])
		expect(diagnostics[0]?.message).toContain(
			"recreates the item's elements on every reconcile",
		)
	})

	test('a site in a server-data loop body is refused, not dropped', () => {
		const { diagnostics } = compileComponentTsx(
			`import { BasicChild } from '../child/basic-child.tsx'
export function BasicParent({ rows }: { rows: string[] }) {
	return (
		<basic-parent>
			<ul>{rows.map(row => <li><BasicChild label={row} onPress={() => console.log(1)} /></li>)}</ul>
			<style>{\`@scope {
	:scope { display: block; }
}\`}</style>
		</basic-parent>
	)
}`,
			'examples/parent/basic-parent.tsx',
			new Set(),
			undefined,
			registry,
		)
		expect(diagnostics.map(d => d.code)).toEqual(['LTC005'])
		expect(diagnostics[0]?.message).toContain(
			'A handler arg on <BasicChild> in a server-data',
		)
	})

	test('a handler-arg placement in composed content is LTC011', () => {
		const { diagnostics } = compileComponentTsx(
			`import { BasicChild } from '../child/basic-child.tsx'
export function BasicMiddle({ onClick }: { onClick?: () => void }) {
	return (
		<basic-middle>
			<BasicChild label="m"><button type="button" onClick={onClick}>x</button></BasicChild>
			<style>{\`@scope {
	:scope { display: block; }
}\`}</style>
		</basic-middle>
	)
}`,
			'examples/middle/basic-middle.tsx',
			new Set(),
			undefined,
			registry,
		)
		expect(diagnostics.map(d => d.code)).toEqual(['LTC011'])
		expect(diagnostics[0]?.message).toContain('The handler arg `onClick`')
	})

	test('the .tsrx surface lowers a compose-site handler identically', () => {
		const tsrxParent = compileComponent(
			`import { BasicChild } from '../child/basic-child.tsx'
export function BasicParent({}: {})
	@{
		<basic-parent>
			<BasicChild class="top" label="a" onPress={e => console.log(e.button)} />
			<style>@scope {
	:scope { display: block; }
}</style>
		</basic-parent>
	}`,
			'examples/parent/basic-parent.tsrx',
			new Set(),
			undefined,
			registry,
		)
		expect(tsrxParent.diagnostics).toEqual([])
		expect(tsrxParent.component?.clientCode).toContain(
			"on(button, 'click', e => console.log(e.button))",
		)
		expect(tsrxParent.component?.clientCode).toContain(
			"first('basic-child button'",
		)
	})
})

describe('a raw element of the child tag counts against every compose-site query (LT-498)', () => {
	const registry = registryOf(entryOf(CHILD_TSX, CHILD_PATH))
	const RAW = '<basic-child class="raw"></basic-child>'

	test('host: the site takes its class', () => {
		const parent = compileParent(
			parentTsx(
				`${RAW}<BasicChild class="site" label="a" onPress={() => console.log(1)} />`,
			),
			registry,
		)
		expect(parent.clientCode).toContain("first('basic-child.site button'")
		expect(parent.clientCode).not.toContain("first('basic-child button'")
	})

	test('host: a site with no class is refused (LTC007)', () => {
		const { component, diagnostics } = compileComponentTsx(
			parentTsx(
				`${RAW}<BasicChild label="a" onPress={() => console.log(1)} />`,
			),
			'examples/parent/basic-parent.tsx',
			new Set(),
			undefined,
			registry,
		)
		expect(component).toBeNull()
		expect(diagnostics.map(d => d.code)).toEqual(['LTC007'])
		expect(diagnostics[0]?.message).toContain(
			'Give the site a class no other <basic-child> carries.',
		)
	})

	test('arm: the site below the arm root takes its class', () => {
		const parent = compileParent(
			parentTsx(
				`{host.open ? <section>${RAW}<BasicChild class="site" label="b" onPress={() => ({ open: false })} /></section> : <p>closed</p>}`,
				'',
				'',
				', { host }: FactoryContext<{ open: boolean }>',
			),
			registry,
		)
		expect(parent.clientCode).toContain("first('basic-child.site button'")
		expect(parent.clientCode).not.toContain("first('basic-child button'")
	})

	test('arm: a site with no class is refused (LTC007)', () => {
		const { diagnostics } = compileComponentTsx(
			parentTsx(
				`{host.open ? <section>${RAW}<BasicChild label="b" onPress={() => ({ open: false })} /></section> : <p>closed</p>}`,
				'',
				'',
				', { host }: FactoryContext<{ open: boolean }>',
			),
			'examples/parent/basic-parent.tsx',
			new Set(),
			undefined,
			registry,
		)
		expect(diagnostics.map(d => d.code)).toEqual(['LTC007'])
		expect(diagnostics[0]?.message).toContain('in this arm also render')
	})

	test('item: the site takes its class', () => {
		const result = compileComponentTsx(
			parentTsx(
				`<ul>{items.map((item, k) => <li>${RAW}<BasicChild class="site" label="x" onPress={() => items.remove(k)} /></li>)}</ul>`,
				'const items = createList<string>([], { keyConfig: item => item })',
				"import { createList } from '@zeix/le-truc'",
			),
			'examples/parent/basic-parent.tsx',
			new Set(),
			undefined,
			registry,
		)
		expect(result.diagnostics).toEqual([])
		const code = result.component?.clientCode ?? ''
		expect(code).toContain("first('basic-child.site button'")
		expect(code).not.toContain("first('basic-child button'")
	})

	test('item: a site with no class is refused (LTC007)', () => {
		const { diagnostics } = compileComponentTsx(
			parentTsx(
				`<ul>{items.map((item, k) => <li>${RAW}<BasicChild label="x" onPress={() => items.remove(k)} /></li>)}</ul>`,
				'const items = createList<string>([], { keyConfig: item => item })',
				"import { createList } from '@zeix/le-truc'",
			),
			'examples/parent/basic-parent.tsx',
			new Set(),
			undefined,
			registry,
		)
		expect(diagnostics.map(d => d.code)).toEqual(['LTC007'])
		expect(diagnostics[0]?.message).toContain(
			'Give the site a class no other <basic-child> carries.',
		)
	})

	const middle = (
		body: string,
	) => `import { BasicChild } from '../child/basic-child.tsx'
export function BasicMiddle({ onClick }: { onClick?: (e: MouseEvent) => void }) {
	return (
		<basic-middle>
			${body}
			<style>{\`@scope { :where(:scope) { display: block; } }\`}</style>
		</basic-middle>
	)
}`

	test('forward: the recorded clause skips past the raw element', () => {
		// Recorded without a registry, as the discovery pass records it.
		const entry = entryOf(
			middle(`${RAW}<BasicChild class="site" label="m" onPress={onClick} />`),
			'examples/middle/basic-middle.tsx',
		)
		expect(entry.handlerArgs).toEqual({
			onClick: [
				{ via: CHILD_PATH, clause: '.site', arg: 'onPress', optional: false },
			],
		})
	})

	test('forward: with the tag unknown, any raw custom element refuses a lone site with no class (LTC007)', () => {
		const { component, diagnostics } = compileComponentTsx(
			middle('<other-el></other-el><BasicChild label="m" onPress={onClick} />'),
			'examples/middle/basic-middle.tsx',
			new Set(),
		)
		expect(component).toBeNull()
		expect(diagnostics.map(d => d.code)).toEqual(['LTC007'])
		expect(diagnostics[0]?.message).toContain(
			'Give the site a class no raw custom element here carries.',
		)
	})

	test('forward: once the tag is known, a composed child rendering it refuses the site (LTC007)', () => {
		const card = entryOf(
			`export function BasicCard({}: {}) {
	return (
		<basic-card>
			<basic-child>c</basic-child>
			<style>{\`@scope { :where(:scope) { display: block; } }\`}</style>
		</basic-card>
	)
}`,
			'examples/card/basic-card.tsx',
		)
		const source = middle(
			'<BasicCard /><BasicChild label="m" onPress={onClick} />',
		).replace(
			'import { BasicChild }',
			"import { BasicCard } from '../card/basic-card.tsx'\nimport { BasicChild }",
		)
		// The discovery pass records the bare tag: it cannot see the card.
		expect(
			entryOf(source, 'examples/middle/basic-middle.tsx').handlerArgs,
		).toEqual({
			onClick: [
				{ via: CHILD_PATH, clause: '', arg: 'onPress', optional: false },
			],
		})
		const { component, diagnostics } = compileComponentTsx(
			source,
			'examples/middle/basic-middle.tsx',
			new Set(),
			undefined,
			registryOf(entryOf(CHILD_TSX, CHILD_PATH), card),
		)
		expect(component).toBeNull()
		expect(diagnostics.map(d => d.code)).toEqual(['LTC007'])
		expect(diagnostics[0]?.message).toContain(
			'the handler arg it forwards needs a unique target',
		)
	})
})
