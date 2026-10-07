/**
 * A compiler-inferred `number` harvest reads through `asNumber`, not
 * `asInteger` (LT-440). The server renders a number with `String(n)`, the
 * shortest round-tripping form, so `parseFloat` recovers it exactly; the old
 * `asInteger` mapping truncated `2.5` to `2` at connect — a silent
 * miscompile of the DOM-is-truth seed (ADR 0003).
 *
 * Each fixture connects in the simulation realm on both surfaces: connect is
 * a fixed point, so a harvest that recovered `2.5` re-renders `2.5`, and a
 * truncating one re-renders `2`.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { pathToFileURL } from 'node:url'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { createSimulationRealm } from '../../compiler/sim/realm'
import { createGeneratedDir } from '../helpers/generated-corpus'

const NAMES = "import { createState } from '@zeix/le-truc'"
const PARAMS = '{ count = 0 }: { count?: number }'
const SETUP = 'const n = createState(count)\n\t\texpose({})'
const BUTTON =
	'<button type="button" onClick={() => n.set(n.get() + 1)}>+</button>'

const tsrxSource = (tag: string, body: string) => `${NAMES}
export function C(${PARAMS})
	@{
		${SETUP}
			<${tag}>${body}
				<style>@scope {
	:scope {
		  color: red;
		}
}</style>
			</${tag}>
	}`

const tsxSource = (tag: string, body: string) => `${NAMES}
import { css } from '@zeix/le-truc-compiler/macros'
export function C(${PARAMS}) {
	${SETUP}
	return (
			<${tag}>${body}
				<style>{css\`@scope {
	:scope {
		  color: red;
		}
}\`}</style>
			</${tag}>
	)
}`

const fixtures: Array<{
	name: string
	tag: string
	body: string
	harvest: string
	inner: string
}> = [
	{
		name: 'a text site',
		tag: 'c-num-text',
		body: `<span>{() => n.get()}</span>${BUTTON}`,
		harvest: 'createState(asNumber()(span.textContent))',
		inner: '<span>2.5</span><button type="button">+</button>',
	},
	{
		name: 'an attribute site',
		tag: 'c-num-attr',
		body: `<span data-n={() => n.get()}></span>${BUTTON}`,
		harvest: "createState(asNumber()(span.getAttribute('data-n')))",
		inner: '<span data-n="2.5"></span><button type="button">+</button>',
	},
]

const surfaces = [
	{ surface: 'tsrx', suffix: '', compile: compileComponent, file: 'c.tsrx' },
	{
		surface: 'tsx',
		suffix: '-x',
		compile: compileComponentTsx,
		file: 'c.tsx',
	},
] as const

const generated = createGeneratedDir('number-harvest')
afterAll(() => generated.cleanup())

describe('an inferred number harvest keeps decimals (LT-440)', async () => {
	const realm = createSimulationRealm()
	afterAll(() => realm.dispose())
	const clients: Record<string, string> = {}
	for (const { tag: base, body } of fixtures) {
		for (const { suffix, compile, file } of surfaces) {
			const tag = `${base}${suffix}`
			const source =
				file === 'c.tsrx' ? tsrxSource(tag, body) : tsxSource(tag, body)
			const { component, diagnostics } = compile(source, file, new Set())
			if (!component)
				throw new Error(diagnostics.map(d => d.message).join('; '))
			clients[tag] = component.clientCode
			const path = generated.emit(`${tag}.client.ts`, component.clientCode)
			await realm.load(() => import(pathToFileURL(path).href))
		}
	}

	for (const { name, tag: base, harvest, inner } of fixtures) {
		for (const { surface, suffix } of surfaces) {
			const tag = `${base}${suffix}`
			test(`${name} (${surface}): harvests through asNumber`, () => {
				expect(clients[tag]).toContain(harvest)
				expect(clients[tag]).not.toContain('asInteger')
			})
			test(`${name} (${surface}): a 2.5 seed connects at 2.5`, async () => {
				const markup = `<${tag}>${inner}</${tag}>`
				const { html } = await realm.render({ markup, component: tag })
				expect(html).toContain(inner)
			})
		}
	}
})
