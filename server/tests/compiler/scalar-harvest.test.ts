/**
 * The scalar `harvest(seed, parser)` marker and the LTC077 refusal (ADR
 * 0046 s7, LT-443), on both surfaces:
 *
 * - a signal whose seed type the compiler cannot read (an alias, a union —
 *   anything but the bare `string`/`number`/`boolean` keyword) is refused
 *   LTC077 at the seed when its render site would harvest it, on every
 *   route the parser applies to (a direct text or attribute site, an arg's
 *   substituted DOM read, a membership value read);
 * - `harvest(price, asNumber())` declares the parser: spliced into the
 *   client as authored around the harvest read, the server reading the
 *   seed through — an aliased `number` connects as a number, a `Date`
 *   round-trips through an authored parser;
 * - a signal that never harvests is never refused (no raw render site, a
 *   Parser-exposed prop), and a marker whose parser would never run (a
 *   literal seed the client re-evaluates) is refused rather than silently
 *   ignored;
 * - the marker is recognized only in a scalar constructor's seed, matched
 *   against its form (`createList` takes the map), and its parser's free
 *   names must resolve on the client.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { createSimulationRealm } from '../../compiler/sim/realm'
import { createGeneratedDir } from '../helpers/generated-corpus'

const FILE = 'server/tests/compiler/fixtures/c-scalar'

const generated = createGeneratedDir('scalar-harvest')
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
	/** Server attributes on the root element. */
	rootAttrs?: string
	/** The markup inside the root, minus the `<style>` block. */
	body: string
	/** The `.tsx` markup, when the reactive loop spellings diverge. */
	bodyTsx?: string
}

const sourceOf = (surface: Surface, tag: string, parts: Parts): string => {
	const { pre, params, props, setup, rootAttrs = '', body } = parts
	const markup = surface === 'tsrx' ? body : (parts.bodyTsx ?? body)
	if (surface === 'tsrx')
		return `${pre}
export function C(${params})
	@{
		${setup}
		<${tag}${rootAttrs}>
			${markup}
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
	${setup}
	return (
		<${tag}${rootAttrs}>
			${markup}
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

const codesOf = (result: ReturnType<typeof compile>) =>
	result.diagnostics.map(d => d.code)

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

/* === LTC077: an unreadable seed type on a harvest site is refused === */

const ALIASED: Parts = {
	pre: `import { createState } from '@zeix/le-truc'
type Price = number`,
	params: '{ price }: { price: Price }',
	props: '{ value: number }',
	setup: `const p = createState(price)
		expose({ value: () => p.get() })`,
	body: '<p class="amount">{p}</p>',
}

describe('LTC077 refuses an unreadable seed type on a harvest site (LT-443)', () => {
	for (const surface of SURFACES) {
		test(`${surface}: a lazy text site, located at the seed`, () => {
			const result = compile(surface, `c-scalar-refused-${surface}`, ALIASED)
			const ltc077 = result.diagnostics.find(d => d.code === 'LTC077')
			expect(ltc077).toBeDefined()
			expect(ltc077?.severity).toBe('error')
			expect(ltc077?.message).toContain('`Price` the compiler cannot read')
			expect(ltc077?.message).toContain('`createState(harvest(price, …))`')
			expect(
				sourceOf(surface, `c-scalar-refused-${surface}`, ALIASED).slice(
					ltc077!.location.start,
					ltc077!.location.end,
				),
			).toBe('price')
		})

		test(`${surface}: a reactive attribute site`, () => {
			const result = compile(surface, `c-scalar-attr-${surface}`, {
				...ALIASED,
				body: '<data class="amount" value={() => p.get()}></data>',
			})
			expect(codesOf(result)).toContain('LTC077')
		})

		test(`${surface}: a number | null union`, () => {
			const result = compile(surface, `c-scalar-union-${surface}`, {
				...ALIASED,
				pre: `import { createState } from '@zeix/le-truc'`,
				params: '{ price }: { price: number | null }',
			})
			const ltc077 = result.diagnostics.find(d => d.code === 'LTC077')
			expect(ltc077?.message).toContain(
				'`number | null` the compiler cannot read',
			)
		})

		test(`${surface}: the bare "number" keyword is not refused (LT-440's mapping)`, () => {
			const result = compile(surface, `c-scalar-keyword-${surface}`, {
				...ALIASED,
				pre: `import { createState } from '@zeix/le-truc'`,
				params: '{ price }: { price: number }',
			})
			expect(codesOf(result)).not.toContain('LTC077')
		})

		test(`${surface}: a substituted arg read (no direct site)`, () => {
			const result = compile(surface, `c-scalar-subst-${surface}`, {
				...ALIASED,
				// The arg renders on the root; the signal itself renders only
				// through a computed thunk, so the harvest substitutes the arg's
				// DOM site — which the parser selection covers too.
				rootAttrs: ' price={price}',
				body: '<p class="label">{() => `\\u00a7${p.get()}`}</p>',
			})
			const ltc077 = result.diagnostics.find(d => d.code === 'LTC077')
			expect(ltc077).toBeDefined()
		})
	}
})

/* === The marker declares the parser; the value round-trips === */

const WRAPPED: Parts = {
	pre: `import { asNumber, createState } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'
type Price = number`,
	params: '{ price }: { price: Price }',
	props: '{ value: number }',
	setup: `const p = createState(harvest(price, asNumber()))
		expose({ value: () => p.get() })`,
	body: '<p class="amount">{p}</p>',
}

describe('harvest(price, asNumber()) declares the scalar parser (LT-443)', () => {
	for (const surface of SURFACES) {
		describe(surface, async () => {
			const tag = `c-scalar-ok-${surface}`
			const result = compile(surface, tag, WRAPPED)
			const component = result.component
			if (!component) throw new Error(JSON.stringify(result.diagnostics))
			const markup = await render(component.serverCode, { price: 2.5 })
			const { realm, html, diagnostics } = await mount(
				`scalar-ok-${surface}`,
				tag,
				component.clientCode,
				markup,
			)
			afterAll(() => realm.dispose())
			const host = () =>
				realm.document.querySelector(tag) as HTMLElement & { value: number }

			test('compiles clean', () => {
				expect(result.diagnostics).toEqual([])
			})

			test('the client splices the authored parser around the site read', () => {
				expect(component.clientCode).toMatch(
					/createState\(asNumber\(\)\(\w+\.textContent\)\)/,
				)
				// The server reads the seed through, and neither module imports
				// the marker.
				expect(component.serverCode).toContain('createState(price)')
				expect(component.serverCode).not.toContain('harvest(')
				expect(component.clientCode).not.toContain('harvest(')
				expect(component.serverCode).not.toContain('/macros')
				expect(component.clientCode).not.toContain('/macros')
			})

			test('connects as a number — decimals survive', () => {
				expect(diagnostics).toEqual([])
				expect(html).toBe(serialized(markup))
				expect(host().value).toBe(2.5)
			})
		})
	}
})

/* === A Date seed round-trips through an authored parser (substitute route) === */

const DUE: Parts = {
	pre: `import { asParser, createState } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'
type Due = Date`,
	params: '{ due }: { due: Due }',
	props: '{ year: number }',
	setup: `const d = createState(harvest(due, asParser(v => new Date(v ?? ''))))
		expose({ year: () => d.get().getUTCFullYear() })`,
	// The arg renders on the root; the signal itself never renders raw (a
	// `Date` cannot pass a typed sink), so the harvest reads the arg's
	// substituted DOM site.
	rootAttrs: ' due={due}',
	body: '<p class="label">{() => String(d.get())}</p>',
}

describe('a Date seed round-trips through its authored parser (LT-443)', () => {
	for (const surface of SURFACES) {
		describe(surface, async () => {
			const tag = `c-scalar-date-${surface}`
			const result = compile(surface, tag, DUE)
			const component = result.component
			if (!component) throw new Error(JSON.stringify(result.diagnostics))
			const markup = await render(component.serverCode, {
				due: new Date(Date.UTC(2026, 3, 30, 12)),
			})
			const { realm, html, diagnostics } = await mount(
				`scalar-date-${surface}`,
				tag,
				component.clientCode,
				markup,
			)
			afterAll(() => realm.dispose())
			const host = () =>
				realm.document.querySelector(tag) as HTMLElement & { year: number }

			test('compiles clean', () => {
				expect(result.diagnostics).toEqual([])
			})

			test('the parser wraps the substituted arg read', () => {
				expect(component.clientCode).toContain(
					"asParser(v => new Date(v ?? ''))((host.getAttribute('due') ?? ''))",
				)
				expect(component.serverCode).toContain('createState(due)')
			})

			test('connects as a Date — the year survives', () => {
				expect(diagnostics).toEqual([])
				expect(html).toBe(serialized(markup))
				expect(host().year).toBe(2026)
			})
		})
	}
})

/* === Non-harvested signals are never refused === */

describe('a non-harvested signal is never LTC077 (LT-443)', () => {
	for (const surface of SURFACES) {
		test(`${surface}: no raw render site — the seeding refusals are today's, not LTC077`, () => {
			const result = compile(surface, `c-scalar-nosite-${surface}`, {
				...ALIASED,
				// The signal renders only through a computed thunk, and the arg
				// renders nowhere — the arg has no DOM site to substitute, so
				// the seed routes off the fold instead of harvesting.
				body: '<p class="label">{() => `\\u00a7${p.get()}`}</p>',
			})
			expect(codesOf(result)).not.toContain('LTC077')
		})

		test(`${surface}: a Parser-exposed prop has no scalar seed to refuse`, () => {
			const result = compile(surface, `c-scalar-parserprop-${surface}`, {
				pre: `import { asNumber } from '@zeix/le-truc'
type Price = number`,
				params: '{ price = 0 }: { price?: Price }',
				props: '{ price: number }',
				setup: `expose({ price: asNumber(0) })`,
				body: '<p class="amount">{host.price}</p>',
			})
			expect(codesOf(result)).not.toContain('LTC077')
		})

		test(`${surface}: a seed that derives from the arg keeps its bare substitution`, () => {
			// form-textbox's shape: `createCell(value.length)` — the substituted
			// read reproduces the derivation on both sides, so its value is
			// never a bare site string, and no parser applies.
			const result = compile(surface, `c-scalar-derive-${surface}`, {
				...ALIASED,
				setup: `const p = createState(price.length)
					expose({ value: () => p.get() })`,
				body: '<p class="label">{() => `\\u00a7${p.get()}`}</p>',
			})
			expect(codesOf(result)).not.toContain('LTC077')
		})

		test(`${surface}: a marker on a deriving seed is dead — no read takes a parser`, () => {
			const result = compile(surface, `c-scalar-derivedead-${surface}`, {
				pre: `import { asNumber, createState } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'`,
				params: '{ price }: { price: string }',
				props: '{ value: number }',
				setup: `const p = createState(harvest(price.length, asNumber()))
					expose({ value: () => p.get() })`,
				body: '<p class="label">{() => `\\u00a7${p.get()}`}</p>',
			})
			const dead = result.diagnostics.find(
				d =>
					d.severity === 'error' &&
					d.message.includes('reads no server-rendered value'),
			)
			expect(dead).toBeDefined()
		})
	}
})

/* === A marker whose parser never runs is refused === */

describe('a dead scalar marker is refused (LT-443)', () => {
	for (const surface of SURFACES) {
		test(`${surface}: a literal seed the client re-evaluates`, () => {
			const result = compile(surface, `c-scalar-dead-${surface}`, {
				pre: `import { asNumber, createState } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'`,
				params: '{}',
				props: '{ value: number }',
				setup: `const p = createState(harvest(5, asNumber()))
					expose({ value: () => p.get() })`,
				// No direct site: the client reuses the literal seed as written,
				// so the declared parser never runs.
				body: '<p class="amount">{() => `\\u00a7${p.get()}`}</p>',
			})
			const dead = result.diagnostics.find(
				d =>
					d.severity === 'error' &&
					d.message.includes('reads no server-rendered value'),
			)
			expect(dead).toBeDefined()
			expect(codesOf(result)).not.toContain('LTC077')
		})
	}
})

/* === The marker is recognized only where a scalar seed is spelled === */

describe('marker form and position (LT-443)', () => {
	for (const surface of SURFACES) {
		test(`${surface}: the scalar form on a createList seed is refused`, () => {
			const result = compile(surface, `c-scalar-list-${surface}`, {
				pre: `import { asNumber, createList } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'`,
				params: '{ rows = [] }: { rows?: string[] }',
				props: '{ count: number }',
				setup: `const items = createList(harvest(rows, asNumber()), { keyConfig: r => r })
					expose({ count: () => items.get().length })`,
				body: '<ul data-container></ul>',
			})
			const mismatch = result.diagnostics.find(
				d =>
					d.severity === 'error' &&
					d.message.includes(
						'scalar `harvest(seed, parser)` on a `createList` seed',
					),
			)
			expect(mismatch).toBeDefined()
		})

		test(`${surface}: the map form on a createState seed is refused`, () => {
			const result = compile(surface, `c-scalar-map-${surface}`, {
				pre: `import { asString, createState } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'`,
				params: '{ price = 0 }: { price?: number }',
				props: '{ value: number }',
				setup: `const p = createState(harvest(price, { price: asString() }))
					expose({ value: () => p.get() })`,
				body: '<p class="amount">{p}</p>',
			})
			const mismatch = result.diagnostics.find(
				d =>
					d.severity === 'error' &&
					d.message.includes('map on a `createState` seed'),
			)
			expect(mismatch).toBeDefined()
		})

		test(`${surface}: one-argument harvest() is malformed`, () => {
			const result = compile(surface, `c-scalar-malformed-${surface}`, {
				pre: `import { createState } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'`,
				params: '{ price = 0 }: { price?: number }',
				props: '{ value: number }',
				setup: `const p = createState(harvest(price))
					expose({ value: () => p.get() })`,
				body: '<p class="amount">{p}</p>',
			})
			const malformed = result.diagnostics.find(
				d =>
					d.severity === 'error' &&
					d.message.includes(
						'other than `harvest(seed, { field: parser, … })` or `harvest(seed, parser)`',
					),
			)
			expect(malformed).toBeDefined()
		})

		test(`${surface}: a server-only parser name is the client-position LTC005`, () => {
			const result = compile(surface, `c-scalar-serverparser-${surface}`, {
				pre: `import { createState } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'
// A module-level helper is a server-only name (a .tsx component function
// scan refuses a module-level function declaration, so the arrow form).
const parsePrice = (v: string): number => Number(v)
type Price = number`,
				params: '{ price }: { price: Price }',
				props: '{ value: number }',
				setup: `const p = createState(harvest(price, parsePrice))
					expose({ value: () => p.get() })`,
				body: '<p class="amount">{p}</p>',
			})
			const serverOnly = result.diagnostics.find(
				d =>
					d.severity === 'error' &&
					d.message.includes('`harvest()` parser of signal `p`') &&
					d.message.includes('server-only'),
			)
			expect(serverOnly).toBeDefined()
		})
	}
})

/* === Membership: the marker parses the value read === */

const MEMBER: Parts = {
	pre: `import { asNumber, createState } from '@zeix/le-truc'
import { harvest } from '@zeix/le-truc-compiler/macros'
type Amount = number`,
	params: '{ rows = [], initial }: { rows?: string[], initial: Amount }',
	props: '{ picked: number }',
	setup: `const picked = createState(harvest(initial, asNumber()))
		expose({ picked })`,
	body: `<ul data-container>
			@for (const row of rows; index i) {
				const rid = i
				<li aria-selected={() => String(picked.get() === rid)} data-row={rid}>{row}</li>
			}
		</ul>`,
	bodyTsx: `<ul data-container>
			{rows.map((row, i) => {
				const rid = i
				return (
					<li aria-selected={() => String(picked.get() === rid)} data-row={rid}>
						{row}
					</li>
				)
			})}
		</ul>`,
}

const MEMBER_UNMARKED: Parts = {
	...MEMBER,
	pre: `import { createState } from '@zeix/le-truc'
type Amount = number`,
	setup: `const picked = createState(initial)
		expose({ picked })`,
}

describe('a membership seed reads through its marker parser (LT-443)', () => {
	for (const surface of SURFACES) {
		test(`${surface}: the parser wraps the value read, owning the miss`, () => {
			const tag = `c-scalar-member-${surface}`
			const result = compile(surface, tag, MEMBER)
			const component = result.component
			if (!component) throw new Error(JSON.stringify(result.diagnostics))
			expect(result.diagnostics).toEqual([])
			expect(component.clientCode).toMatch(
				/asNumber\(\)\(\w+\.get\(\)\.find\(el => el\.ariaSelected === 'true'\)\?\.getAttribute\('data-row'\)\)/,
			)
		})

		test(`${surface}: an unreadable membership seed without a marker is LTC077`, () => {
			const tag = `c-scalar-member0-${surface}`
			const result = compile(surface, tag, MEMBER_UNMARKED)
			expect(codesOf(result)).toContain('LTC077')
		})
	}
})

/* === The membership plan connects in the realm === */
// (Pinned at the generated-module level: the simulation realm's elements do
// not implement the ARIA reflection the membership predicate reads —
// `el.ariaSelected` — so a realm round-trip would exercise the realm, not
// the plan.)

describe('a marked membership seed declares its parser (LT-443)', () => {
	for (const surface of SURFACES) {
		test(`${surface}: compiles clean, reads through the authored parser`, () => {
			const tag = `c-scalar-memberok-${surface}`
			const result = compile(surface, tag, MEMBER)
			const component = result.component
			if (!component) throw new Error(JSON.stringify(result.diagnostics))
			expect(result.diagnostics).toEqual([])
			expect(component.clientCode).toContain(
				"asNumber()(rows.get().find(el => el.ariaSelected === 'true')?.getAttribute('data-row'))",
			)
			// The parser owns the miss: no typed default follows the read.
			expect(component.clientCode).not.toMatch(
				/getAttribute\('data-row'\)\s*\?\?/,
			)
			expect(component.serverCode).toContain('createState(initial)')
		})
	}
})
