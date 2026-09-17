/**
 * TSX spike parity harness (LT-183, TSX_SPIKE.md §4.3).
 *
 * For each of the four ported components, compile the `.tsrx` original
 * (`server/tsrx`) and the `.tsx` port (`server/tsrx-tsx`) with identical
 * registries, compose registries, and args, then compare:
 *
 * - server renders through the VALUE HARNESS byte-for-byte (the bar: ADR
 *   0029's markup-identical-across-tiers invariant extends across surfaces
 *   for identically-authored components);
 * - CSS artifacts byte-for-byte;
 * - Simulated-tier components (the combobox+listbox pair — the corpus's only
 *   two) render through the UNMODIFIED `sim/` realm byte-for-byte;
 * - client modules structurally (snapshot review, not bytes — naming and
 *   import placement may differ);
 * - the §4.4 synthetic fixtures compile through the unmodified analysis and
 *   render (async boundary: pending arm; control-flow shapes: taken arms).
 *
 * The comparison runs BOTH-SIDES LIVE (the .tsrx originals compile in the
 * same process) rather than against copied golden strings — the repo's
 * golden tests already pin those bytes; live comparison additionally proves
 * the two front ends agree under the same registry state.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { compileComponent } from '../../tsrx'
import { compileComponentTsx } from '../../tsrx-tsx'
import type { RegistryEntry } from '../../tsrx/registry'
import { createSimulationRealm } from '../../tsrx/sim/realm'
import { createGeneratedDir } from '../helpers/generated-tsrx'
import { CORPUS_ARGS, PLURALIZE_I18N } from '../tsrx/corpus-args'

const ROOT = path.resolve(import.meta.dir, '../../..')
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8')

type Fixture = {
	tag: string
	name: string
	tsrx: string
	tsxx: string
	args: Record<string, unknown>
}

const FIXTURES: Fixture[] = [
	{
		tag: 'basic-counter',
		name: 'BasicCounter',
		tsrx: 'examples/basic/counter/basic-counter.tsrx',
		tsxx: 'spike/tsx/basic/counter/basic-counter.tsx',
		args: { start: 42 },
	},
	{
		tag: 'basic-pluralize',
		name: 'BasicPluralize',
		tsrx: 'examples/basic/pluralize/basic-pluralize.tsrx',
		tsxx: 'spike/tsx/basic/pluralize/basic-pluralize.tsx',
		args: { count: 1, i18n: PLURALIZE_I18N },
	},
	{
		tag: 'form-listbox',
		name: 'FormListbox',
		tsrx: 'examples/form/listbox/form-listbox.tsrx',
		tsxx: 'spike/tsx/form/listbox/form-listbox.tsx',
		args: CORPUS_ARGS['form-listbox'] as Record<string, unknown>,
	},
	{
		tag: 'form-combobox',
		name: 'FormCombobox',
		tsrx: 'examples/form/combobox/form-combobox.tsrx',
		tsxx: 'spike/tsx/form/combobox/form-combobox.tsx',
		args: CORPUS_ARGS['form-combobox'] as Record<string, unknown>,
	},
]

const registry = new Set<string>([
	'basic-counter',
	'basic-pluralize',
	'form-listbox',
	'form-combobox',
])

/** Both front ends get the same compose graph: combobox composes listbox. */
const compilePair = (fx: Fixture, listboxEntries: RegistryEntry[]) => {
	const composeRegistry = new Map<string, RegistryEntry>(
		listboxEntries.map(e => [e.source, e]),
	)
	const tsrx = compileComponent(
		read(fx.tsrx),
		fx.tsrx,
		new Set([...registry]),
		undefined,
		composeRegistry.size > 0 ? composeRegistry : undefined,
	)
	const tsxx = compileComponentTsx(
		read(fx.tsxx),
		fx.tsxx,
		new Set([...registry]),
		undefined,
		composeRegistry.size > 0 ? composeRegistry : undefined,
	)
	return { tsrx, tsxx }
}

const generated = createGeneratedDir('tsx-parity')
afterAll(() => generated.cleanup())

const renderOf =
	(tag: string, name: string) =>
	async (code: string, args: unknown): Promise<string> => {
		generated.emit(`${tag}.server.ts`, code)
		const mod = (await generated.importModule(`${tag}.server.ts`)) as Record<
			string,
			unknown
		>
		const fn = mod[`render${name}`] as (args: unknown) => string
		if (typeof fn !== 'function')
			throw new Error(`render${name} missing for ${tag}`)
		return fn(args)
	}

describe('TSX spike — front-end parity (§4.3)', () => {
	// Pass 1: listbox alone (feeds the compose registry), then the rest with it.
	const listboxPair = compilePair(FIXTURES[2] as Fixture, [])
	for (const compiled of [listboxPair.tsrx, listboxPair.tsxx]) {
		if (!compiled.component)
			throw new Error(
				`form-listbox must compile on both surfaces: ${JSON.stringify(compiled.diagnostics)}`,
			)
	}
	const listboxEntries = [
		(listboxPair.tsrx.component as { entry: RegistryEntry }).entry,
		(listboxPair.tsxx.component as { entry: RegistryEntry }).entry,
	]

	for (const fx of FIXTURES) {
		describe(fx.tag, () => {
			const { tsrx, tsxx } = compilePair(fx, listboxEntries)

			test('compiles clean on the .tsx front end (no errors/warnings)', () => {
				expect(tsxx.diagnostics).toEqual([])
				expect(tsxx.component).not.toBeNull()
			})

			test('lands in the same tier', () => {
				expect(tsxx.component?.entry.tier).toBe(tsrx.component?.entry.tier)
			})

			test('server render byte-identical to the .tsrx original (value harness)', async () => {
				if (!tsrx.component || !tsxx.component) throw new Error('compile failed')
				const render = renderOf(fx.tag, fx.name)
				const a = await render(tsrx.component.serverCode, fx.args)
				const b = await render(tsxx.component.serverCode, fx.args)
				expect(b).toBe(a)
				// The render must also be non-trivial markup for its own tag.
				expect(a).toContain(`<${fx.tag}`)
			})

			test('CSS byte-identical', () => {
				expect(tsxx.component?.css).toBe(tsrx.component?.css)
			})

			test('client module snapshot (structural review, not bytes)', () => {
				expect(tsxx.component?.clientCode).toMatchSnapshot()
			})

			if (fx.tag === 'form-combobox' || fx.tag === 'form-listbox') {
				test(
					'server render byte-identical through the UNMODIFIED sim realm (Simulated tier)',
					async () => {
						if (!tsrx.component || !tsxx.component) throw new Error('compile failed')
						const realm = createSimulationRealm({
							composesTags: tag =>
								tag === 'form-combobox' ? ['form-listbox'] : [],
						})
						try {
							generated.emit(`${fx.tag}.client.ts`, tsrx.component.clientCode)
							await realm.load(() =>
								generated
									.importModule(`${fx.tag}.client.ts`)
									.then(() => undefined),
							)
							const render = renderOf(fx.tag, fx.name)
							const phase1A = await render(tsrx.component.serverCode, fx.args)
							const phase1B = await render(tsxx.component.serverCode, fx.args)
							const phase2A = await realm.render({
								markup: phase1A,
								component: fx.tag,
							})
							const phase2B = await realm.render({
								markup: phase1B,
								component: fx.tag,
							})
							expect(phase2B).toBe(phase2A)
						} finally {
							realm.dispose()
						}
					},
				)
			}
		})
	}
})

describe('TSX spike — §4.4 synthetic shapes through the unmodified analysis', () => {
	test('async boundary (boundary({ ok, pending, err })) renders the pending arm', async () => {
		const source = read('spike/tsx/async/async-el.tsx')
		const { component, diagnostics } = compileComponentTsx(
			source,
			'spike/tsx/async/async-el.tsx',
			new Set(['async-el']),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('async fixture must compile')
		const render = renderOf('async-el', 'AsyncEl')
		const html = await render(component.serverCode, {})
		expect(html).toContain('<p class="loading">Loading</p>')
		expect(html).toContain('hidden class="content"')
		expect(html).toContain('hidden class="error"')
		// One watch() toggles all three roots — the client shape the .tsrx
		// fixture pinned (features.test.ts).
		expect(component.clientCode).toContain('watch(')
		expect(component.clientCode).not.toContain('document.createElement')
	})

	test('switch IIFE / try-catch IIFE / indexed map / && and ternary arms', async () => {
		const source = read('spike/tsx/sync/sync-el.tsx')
		const { component, diagnostics } = compileComponentTsx(
			source,
			'spike/tsx/sync/sync-el.tsx',
			new Set(['sync-el']),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('sync fixture must compile')
		const render = renderOf('sync-el', 'SyncEl')
		const args = {
			mode: 'list',
			items: [
				{ id: 'a', label: 'Alpha' },
				{ id: 'b', label: 'Beta' },
			],
		}
		const html = await render(component.serverCode, args)
		expect(html).toContain('<ul data-container>')
		expect(html).toContain('<li data-value="a">0: ALPHA</li>')
		expect(html).toContain('<li data-value="b">1: BETA</li>')
		expect(html).toContain('<p class="first">Alpha</p>')
		expect(html).toContain('<span class="badge">listing</span>')
		expect(html).toContain('<span class="count">2</span>')
		// The not-taken arms stay absent (server renders the taken branch).
		expect(html).not.toContain('class="empty"')
		expect(html).not.toContain('class="none"')
		expect(html).not.toContain('class="zero"')
		// ...and the opposite state flips them (server-known conditions).
		const flipped = await render(component.serverCode, { mode: 'x', items: [] })
		expect(flipped).toContain('class="empty"')
		expect(flipped).toContain('class="none"')
		expect(flipped).toContain('class="zero"')
	})

	test('reactive createList .map lowers to the reconcile plan (unmodified analysis)', () => {
		const source = `import { createList } from '@zeix/le-truc'
export function Seeded({ initial }: { initial?: string[] })
{
	const items = createList<string>(initial, { keyConfig: 'item' })
	expose({})

	return (
		<>
			<c-el2>
				<ul data-container>
					{items.map(item => (
						<li><span>{item}</span></li>
					))}
				</ul>
			</c-el2>
			<style>c-el2 { color: red }</style>
		</>
	)
}`
		const { component, diagnostics } = compileComponentTsx(
			source,
			'seeded.tsx',
			new Set(['c-el2']),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('seeded fixture must compile')
		// The reconcile path: an extracted <template> and a reconcile() call,
		// keyed by the list's own keyConfig (no authored key clause needed).
		expect(component.serverCode).toContain("<template>")
		expect(component.clientCode).toContain('reconcile(')
	})

	test('statement-context arms are diagnosed — bare client-stmt inside a branch is not expressible', () => {
		// A `&&` arm must be JSX: an IIFE returning null (the .tsrx client-stmt
		// shape — a bare side effect beside conditional markup) has no JSX
		// spelling and is REJECTED, retiring the construct with the grammar
		// (ADR 0024 s11 already restricted it to @if roots).
		const source = `export function NoStmt({ flag }: { flag: boolean })
{
	expose({})
	return (
		<c-el3>
			{flag && (() => { internals?.states.add('x'); return null })()}
		</c-el3>
	)
}`
		const { component, diagnostics } = compileComponentTsx(source, 'no-stmt.tsx', new Set(['c-el3']))
		expect(component).toBeNull()
		expect(diagnostics.some(d => d.message.includes('if arms must be JSX elements'))).toBe(true)
	})
})
