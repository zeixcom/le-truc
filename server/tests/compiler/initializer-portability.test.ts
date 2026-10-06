/**
 * A signal rendered only through a thunk no site can splice into (a
 * style-map, a computed thunk) seeds the client by reusing its initializer
 * verbatim (LT-036). LT-093 widens which initializers are reusable: a plain
 * setup const or an authored import is bound in the client module — the
 * signal's declaration is a client-emitted position, so the placement
 * fixpoint emits what it reads — and no longer routes the component
 * Simulated on LTC004. An initializer the client still cannot reuse names
 * its free names in the routing reason, instead of claiming no site exists.
 */
import { describe, expect, test } from 'bun:test'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'

const compile = (source: string) =>
	compileComponent(source, 'c.tsrx', new Set())

const styled = (setup: string, imports = '') => `export function C({}: {})
@{
${setup}
	expose({})
		<c-el>
			<p style={() => ({ color: color.get() })}>hi</p>
			<style>:host {
	  display: block;
	}</style>
		</c-el>
}
import { createState } from '@zeix/le-truc'
${imports}`

describe('initializer free names place client-side (LT-093)', () => {
	test('a plain setup const in the initializer folds', () => {
		const { component, diagnostics } = compile(
			styled("\tconst DEFAULT = 'red'\n\tconst color = createState(DEFAULT)"),
		)
		expect(diagnostics).toEqual([])
		expect(component?.entry.routingSignals).toEqual([])
		expect(component?.entry.tier).toBe('folded')
		expect(component?.clientCode).toContain("const DEFAULT = 'red'")
		expect(component?.clientCode).toContain('createState(DEFAULT)')
	})

	test('a const chain folds, transitively', () => {
		const { component } = compile(
			styled(
				"\tconst BASE = 'red'\n\tconst DEFAULT = BASE.toUpperCase()\n\tconst color = createState(DEFAULT)",
			),
		)
		expect(component?.entry.tier).toBe('folded')
		expect(component?.clientCode).toContain("const BASE = 'red'")
	})

	test('an authored import in the initializer folds and is placed client-side', () => {
		const { component, diagnostics } = compile(
			styled(
				'\tconst color = createState(DEFAULT_COLOR)',
				"import { DEFAULT_COLOR } from './colors'",
			),
		)
		expect(diagnostics).toEqual([])
		expect(component?.entry.tier).toBe('folded')
		expect(component?.clientCode).toMatch(/import \{ DEFAULT_COLOR \} from/)
	})

	test('the harvested declaration keeps the authored type arguments', () => {
		const { component } = compile(
			styled(
				"\tconst DEFAULT = 'red'\n\tconst color = createState<string>(DEFAULT)",
			),
		)
		expect(component?.clientCode).toContain('createState<string>(DEFAULT)')
	})

	test('the .tsx surface folds the same const', () => {
		const { component } = compileComponentTsx(
			`export function C({}: {}) {
	const DEFAULT = 'red'
	const color = createState(DEFAULT)
	expose({})
	return (
		<c-el>
			<p style={() => ({ color: color.get() })}>hi</p>
			<style></style>
		</c-el>
	)
}
import { createState } from '@zeix/le-truc'`,
			'c.tsx',
			new Set(),
		)
		expect(component?.entry.routingSignals).toEqual([])
		expect(component?.entry.tier).toBe('folded')
	})
})

describe('a reactive thunk may read an authored import (LT-091 plainLocalNames)', () => {
	test('no LTC005, and the client imports the name', () => {
		const { component, diagnostics } = compile(`export function C({}: {})
@{
	const color = createState('red')
	expose({})
		<c-el>
			<p>{color}</p>
			<span class={() => shade(color.get())}>hi</span>
			<style>:host {
	  display: block;
	}</style>
		</c-el>
}
import { createState } from '@zeix/le-truc'
import { shade } from './colors'`)
		expect(diagnostics).toEqual([])
		expect(component?.clientCode).toMatch(/import \{ shade \} from/)
		expect(component?.clientCode).toContain('shade(color.get())')
	})
})

describe('the LTC004 routing reason names an unportable initializer (LT-093 step 1)', () => {
	test('a rendered signal over a factory member names the member', () => {
		const { component } = compile(`export function C({}: {})
@{
	const count = createState(all('li').get().length)
	expose({})
		<c-el>
			<ul><li>a</li></ul>
			<p class={() => String(count.get() + 1)}>n</p>
			<style>:host {
	  display: block;
	}</style>
		</c-el>
}
import { createState } from '@zeix/le-truc'`)
		const details = component?.entry.routingSignals
			.filter(s => s.origin === 'LTC004')
			.map(s => s.detail)
		expect(details).toEqual([
			'signal `count` is rendered, but its initializer reads `all`, so the client cannot reuse it to seed the signal',
		])
	})

	test('a signal nothing renders keeps the no-site reason', () => {
		const { component } = compile(
			`export function C({}: {})
@{
	const color = createState('red')
	expose({})
		<c-el>
			<p>hi</p>
			<style>:host {
	  display: block;
	}</style>
		</c-el>
}
import { createState } from '@zeix/le-truc'`,
		)
		expect(component?.entry.routingSignals.map(s => s.detail)).toEqual([
			'signal `color` has no harvestable initial-DOM site',
		])
	})
})
