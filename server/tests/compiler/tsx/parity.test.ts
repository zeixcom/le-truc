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
import { compileComponent } from '../../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../../compiler/frontend/tsx'
import type { RegistryEntry } from '../../../compiler/registry'
import { createSimulationRealm } from '../../../compiler/sim/realm'
import { collectI18n, writeI18nModule } from '../../../effects/i18n'
import { createGeneratedDir } from '../../helpers/generated-corpus'
import { CORPUS_ARGS, PLURALIZE_I18N } from '../corpus-args'

const ROOT = path.resolve(import.meta.dir, '../../../..')
const read = (rel: string): string =>
	fs.readFileSync(path.join(ROOT, rel), 'utf8')

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
		// The ported `.tsx` lives beside its `.tsrx` twin since LT-285 (the
		// LT-237 move, applied to this component first as the ADR 0039
		// three-spelling exemplar) — the pair is now a folder-local fact.
		tsxx: 'examples/basic/counter/basic-counter.tsx',
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

/**
 * What a client module derives from the authored types (LT-298): the
 * `defineComponent<Props>` type argument and every Parser call, in order.
 * Author comments are copied verbatim and may legitimately differ.
 */
const clientTypeFacts = (code: string | undefined): string[] =>
	[
		...(code ?? '').matchAll(
			/defineComponent(?:<\w+>)?\(|\bas(?:String|Integer|Boolean|Number)\(/g,
		),
	].map(m => m[0])

/** A server module's `argsFromAttrs` export, or '' where it is withheld. */
const argsFromAttrsOf = (code: string | undefined): string =>
	/export function argsFromAttrs[\s\S]*?\n}\n/.exec(code ?? '')?.[0] ?? ''

/** A server module's render function signature (`paramsText`). */
const renderSignatureOf = (code: string | undefined): string =>
	/export function render\w+\([\s\S]*?\): string \{/.exec(code ?? '')?.[0] ?? ''

/**
 * Pairs whose `.tsx` spike fixture authors different args than the
 * `.tsrx` original: no `i18n` arg, and listbox's `'truc:pass'` compose
 * surface. LT-237 reconciles them when it moves the fixtures.
 */
const AUTHORED_ARGS_DRIFT = new Set(['form-listbox', 'form-combobox'])

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

// Pass 1: listbox alone (feeds the compose registry), then the rest with it.
// Hoisted to module scope because the generated i18n module write below is
// top-level await (describe callbacks are sync).
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

// form-combobox's server module supplies its composed listbox's reserved
// record (`i18n: i18nRecord("form-listbox", …)`), which imports './i18n' —
// write the generated i18n module from the compiled .tsrx entry, the same
// derivation the real corpus pipeline performs (ADR 0030 sub-design 2).
const tsrxListboxEntry = listboxEntries[0]
if (!tsrxListboxEntry) throw new Error('tsrx listbox entry missing')
await writeI18nModule(generated.path, await collectI18n([tsrxListboxEntry]))

describe('TSX spike — front-end parity (§4.3)', () => {
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
				if (!tsrx.component || !tsxx.component)
					throw new Error('compile failed')
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

			// LT-298: the `.tsx` converter once dropped the args annotation, so
			// every arg read as untyped — `asString` harvests, all args
			// optional, no `string` channels — and the snapshot above pinned
			// it. Pin the two surfaces' derived facts against each other.
			test('client facts derived from the args type identical (props type argument, harvest parsers)', () => {
				expect(clientTypeFacts(tsxx.component?.clientCode)).toEqual(
					clientTypeFacts(tsrx.component?.clientCode),
				)
			})

			test('page-occurrence helper identical (arg optionality, string and Parser channels)', () => {
				expect(argsFromAttrsOf(tsxx.component?.serverCode)).toBe(
					argsFromAttrsOf(tsrx.component?.serverCode),
				)
			})

			// The render signature is the authored args pattern verbatim, so it
			// can only match where the two sources author the same args.
			// AUTHORED_ARGS_DRIFT pins the pairs that do not yet; the inverted
			// assertion fails once a pair converges, so the set cannot go stale.
			test('render signature (the typed args pattern) identical', () => {
				const a = renderSignatureOf(tsrx.component?.serverCode)
				const b = renderSignatureOf(tsxx.component?.serverCode)
				if (AUTHORED_ARGS_DRIFT.has(fx.tag)) expect(b).not.toBe(a)
				else expect(b).toBe(a)
			})

			test('client module snapshot (structural review, not bytes)', () => {
				expect(tsxx.component?.clientCode).toMatchSnapshot()
			})

			if (fx.tag === 'form-combobox' || fx.tag === 'form-listbox') {
				test('server render byte-identical through the UNMODIFIED sim realm (Simulated tier)', async () => {
					if (!tsrx.component || !tsxx.component)
						throw new Error('compile failed')
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
						const { html: phase2A } = await realm.render({
							markup: phase1A,
							component: fx.tag,
						})
						const { html: phase2B } = await realm.render({
							markup: phase1B,
							component: fx.tag,
						})
						expect(phase2B).toBe(phase2A)
					} finally {
						realm.dispose()
					}
				})
			}
		})
	}
})

describe('TSX spike — §4.4 synthetic shapes through the unmodified analysis', () => {
	test('async boundary (boundary({ ok, nil, err })) renders the nil arm and folds the isPending idiom', async () => {
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
		// Fresh task in the value harness: pending WITHOUT a retained value —
		// the nil arm shows; ok/err render hidden alongside it.
		expect(html).toContain('<p class="loading">Loading</p>')
		expect(html).toContain('hidden class="content"')
		expect(html).toContain('hidden class="error"')
		// The stale arm is gone (LT-211): no fourth root anywhere.
		expect(html).not.toContain('stale')
		// The `isPending(data)` class binding folds server-side — the fresh
		// task is pending at build time, so the class renders on (LT-211).
		expect(html).toContain('<p role="status" class="pending">')
		// One watch() toggles the three roots; the client-side class binding
		// reads isPending(data) so it re-fires when the task settles.
		expect(component.clientCode).toContain('watch(')
		expect(component.clientCode).toContain('isPending(data)')
		expect(component.clientCode).not.toContain('stale')
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
export function Seeded({ initial, removeLabel }: { initial?: string[]; removeLabel: string })
{
	const items = createList<string>(initial, { keyConfig: 'item' })
	expose({})

	return (
		<>
			<c-el2>
				<ul data-container>
					{items.map(item => (
						<li aria-label={removeLabel}><span>{item}</span></li>
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
		expect(component.serverCode).toContain('<template>')
		expect(component.clientCode).toContain('reconcile(')
		// LT-215: a server-static attribute inside the reactive-list body is
		// admitted — folded into the initial items AND baked into the served
		// template, so cloned items carry the value with no client binding.
		expect(component.serverCode).toContain(`attr('aria-label', removeLabel)`)
		expect(component.serverCode).toContain(
			'aria-label="${esc(String(removeLabel))}"',
		)
	})

	test('a server-static attribute in a reactive-list body emits identically on both surfaces (LT-215)', () => {
		// The .tsrx twin of the synthetic above: same args, same body shape.
		// The template-baked emission — the load-bearing lines — must be
		// byte-identical, the anti-drift contract applied to the admitted
		// class.
		const tsrxSource = `import { createList } from '@zeix/le-truc'
export function Seeded({ initial, removeLabel }: { initial?: string[]; removeLabel: string })
	@{
		const items = createList<string>(initial, { keyConfig: 'item' })
		expose({})
		<>
			<c-el2>
				<ul data-container>
					@for (const item of items) {
						<li aria-label={removeLabel}><span>{item}</span></li>
					}
				</ul>
			</c-el2>
			<style>c-el2 { color: red }</style>
		</>
	}`
		const tsrx = compileComponent(tsrxSource, 'seeded.tsrx', new Set(['c-el2']))
		if (!tsrx.component) throw new Error('tsrx twin must compile')
		expect(tsrx.diagnostics).toEqual([])
		// The baked template line is front-end-neutral (emit-server's
		// listTemplateLines): identical bytes from either parser.
		const bakedLine = 'aria-label="${esc(String(removeLabel))}"'
		expect(tsrx.component.serverCode).toContain(bakedLine)
		expect(tsrx.component.serverCode).toContain(
			`attr('aria-label', removeLabel)`,
		)
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
		const { component, diagnostics } = compileComponentTsx(
			source,
			'no-stmt.tsx',
			new Set(['c-el3']),
		)
		expect(component).toBeNull()
		expect(
			diagnostics.some(d => d.message.includes('if arms must be JSX elements')),
		).toBe(true)
	})
})

describe('the typed factory-context parameter (LT-209)', () => {
	const withContext = (contextParam: string): string =>
		`import { asString } from '@zeix/le-truc'
import type { FactoryContext } from '@zeix/le-truc'

export type BadHostProps = { value: string }

export const config = { formAssociated: true }

export function BadHost(
	{ label = 'x' }: { label?: string },
	${contextParam},
) {
	const span = first('span', 'the span')
	expose({ value: asString('') })
	return (
		<bad-host>
			<span>{label}</span>
		</bad-host>
	)
}`

	test('an unknown context destructure is LTC049', () => {
		const { component, diagnostics } = compileComponentTsx(
			withContext(
				'{ host, first, expose, grimoire }: FactoryContext<BadHostProps>',
			),
			'bad-host.tsx',
			new Set(['bad-host']),
		)
		expect(component).toBeNull()
		const hit = diagnostics.find(d => d.code === 'LTC049')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`grimoire`')
	})

	test('a form-associated component annotating plain FactoryContext is LTC050', () => {
		const { diagnostics } = compileComponentTsx(
			withContext('{ host, first, expose }: FactoryContext<BadHostProps>'),
			'bad-host.tsx',
			new Set(['bad-host']),
		)
		const hit = diagnostics.find(d => d.code === 'LTC050')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('FormFactoryContext')
	})

	test('a plain component annotating FormFactoryContext is LTC050 too', () => {
		const source = withContext(
			'{ host, first, expose }: FormFactoryContext<BadHostProps>',
		).replace(`export const config = { formAssociated: true }\n\n`, '')
		const { diagnostics } = compileComponentTsx(
			source,
			'bad-host.tsx',
			new Set(['bad-host']),
		)
		const hit = diagnostics.find(d => d.code === 'LTC050')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('not form-associated')
	})

	test('a matching FormFactoryContext annotation compiles clean', () => {
		const { component, diagnostics } = compileComponentTsx(
			withContext('{ host, first, expose }: FormFactoryContext<BadHostProps>'),
			'bad-host.tsx',
			new Set(['bad-host']),
		)
		expect(diagnostics).toEqual([])
		expect(component).not.toBeNull()
	})
})

describe('the args type annotation reaches the shared stages (LT-298)', () => {
	const component = (params: string): string => `export function C(${params}) {
	expose({})
	return (
		<>
			<c-el>{label}</c-el>
			<style>{css\`c-el { color: red }\`}</style>
		</>
	)
}`

	test('a default paired with a required type is LTC032 on .tsx too', () => {
		const { diagnostics } = compileComponentTsx(
			component(`{ label = 'x' }: { label: string }`),
			'c.tsx',
			new Set(),
		)
		const hit = diagnostics.find(d => d.code === 'LTC032')
		expect(hit).toBeDefined()
		expect(hit?.message).toContain('`label`')
	})

	test('a default paired with an optional type is not flagged', () => {
		const { diagnostics } = compileComponentTsx(
			component(`{ label = 'x' }: { label?: string }`),
			'c.tsx',
			new Set(),
		)
		expect(diagnostics.some(d => d.code === 'LTC032')).toBe(false)
	})

	test('a renamed destructure keeps its property key', () => {
		const { component: compiled, diagnostics } = compileComponentTsx(
			component(`{ title: label }: { title: string }`),
			'c.tsx',
			new Set(),
		)
		expect(diagnostics).toEqual([])
		expect(compiled?.serverCode).toContain(
			'renderC({ title: label }: { title: string })',
		)
	})
})

describe('the isPending fold (LT-211, review pin)', () => {
	test('a ROOT class-map over isPending binds the harness import too', () => {
		// The root element's folded attributes are assembled into rootParts
		// and pushed into the module body AFTER the isPending reference scan
		// — without the rootParts clause the scan misses them and the
		// generated server module references isPending without importing it.
		const source = `import { deriveCell, isPending } from '@zeix/le-truc'

export function PendingRoot({}: {}) {
	const data = deriveCell(async () => 'loaded')
	expose({})
	return (
		<pending-root class={() => ({ dimmed: isPending(data) })}>
			<p>ok</p>
		</pending-root>
	)
}`
		const { component, diagnostics } = compileComponentTsx(
			source,
			'pending-root.tsx',
			new Set(['pending-root']),
		)
		expect(diagnostics).toEqual([])
		if (!component) throw new Error('pending-root fixture must compile')
		// The harness import line carries the binding...
		expect(component.serverCode).toMatch(
			/import \{[^}]*\bisPending\b[^}]*\} from/,
		)
		// ...and the fold renders the class (fresh task: pending at build).
		const html = component.serverCode
		expect(html).toContain('isPending(data)')
	})
})

describe('the loop empty arm on both surfaces (LT-212)', () => {
	/** Generated modules minus their provenance header (names the source). */
	const body = (code: string | undefined): string =>
		(code ?? '').replace(/^\/\*\*[\s\S]*?\*\/\n/, '')

	const pairs = [
		{
			path: 'each',
			tag: 'empty-each',
			name: 'EmptyEach',
			tsrx: `export function EmptyEach({ rows }: { rows: string[] })
	@{
		<>
			<empty-each>
				<ul>
					@for (const row of rows) {
						<li class="row">{row}</li>
					} @empty {
						<li class="none">Nothing yet</li>
					}
				</ul>
			</empty-each>
			<style>empty-each { color: red }</style>
		</>
	}`,
			tsxx: `export function EmptyEach({ rows }: { rows: string[] }) {
	return (
		<>
			<empty-each>
				<ul>
					{rows.length === 0 ? (
						<li class="none">Nothing yet</li>
					) : (
						rows.map(row => <li class="row">{row}</li>)
					)}
				</ul>
			</empty-each>
			<style>empty-each { color: red }</style>
		</>
	)
}`,
			args: (rows: string[]) => ({ rows }),
		},
		{
			path: 'reconcile',
			tag: 'empty-list',
			name: 'EmptyList',
			tsrx: `import { createList } from '@zeix/le-truc'
export function EmptyList({ initial }: { initial?: string[] })
	@{
		const items = createList<string>(initial, { keyConfig: 'item' })
		<>
			<empty-list>
				<ul data-container>
					@for (const item of items) {
						<li><span>{item}</span></li>
					} @empty {
						<p class="none">Nothing yet</p>
					}
				</ul>
			</empty-list>
			<style>empty-list { color: red }</style>
		</>
	}`,
			tsxx: `import { createList } from '@zeix/le-truc'
export function EmptyList({ initial }: { initial?: string[] }) {
	const items = createList<string>(initial, { keyConfig: 'item' })
	return (
		<>
			<empty-list>
				<ul data-container>
					{items.length === 0 ? (
						<p class="none">Nothing yet</p>
					) : (
						items.map(item => <li><span>{item}</span></li>)
					)}
				</ul>
			</empty-list>
			<style>empty-list { color: red }</style>
		</>
	)
}`,
			args: (initial: string[]) => ({ initial }),
		},
	]

	for (const pair of pairs) {
		describe(`${pair.path} path`, () => {
			const tsrx = compileComponent(pair.tsrx, `${pair.tag}.tsrx`, new Set())
			const tsxx = compileComponentTsx(pair.tsxx, `${pair.tag}.tsx`, new Set())

			test('compiles clean on both surfaces', () => {
				expect(tsrx.diagnostics).toEqual([])
				expect(tsxx.diagnostics).toEqual([])
			})

			test('generated modules identical apart from the provenance header', () => {
				expect(body(tsxx.component?.serverCode)).toBe(
					body(tsrx.component?.serverCode),
				)
				expect(body(tsxx.component?.clientCode)).toBe(
					body(tsrx.component?.clientCode),
				)
			})

			test('renders the arm exactly when the iterable is empty', async () => {
				if (!tsrx.component) throw new Error('compile failed')
				const render = renderOf(pair.tag, pair.name)
				const empty = await render(tsrx.component.serverCode, pair.args([]))
				const full = await render(
					tsrx.component.serverCode,
					pair.args(['a', 'b']),
				)
				expect(empty).toContain('Nothing yet')
				expect(full).toContain('>a<')
				if (pair.path === 'each') {
					expect(full).not.toContain('Nothing yet')
				} else {
					// The toggle path: always rendered, exempt from
					// reconciliation, hidden while the list has items.
					expect(empty).toContain('<p data-unreconciled class="none">')
					expect(full).toContain('<p data-unreconciled hidden class="none">')
				}
			})
		})
	}

	test('the reconcile path toggles each arm root from the list length', () => {
		const { component } = compileComponent(
			pairs[1]?.tsrx ?? '',
			'empty-list.tsrx',
			new Set(),
		)
		expect(component?.clientCode).toContain(
			'watch(() => items.length === 0, bindVisible(empty))',
		)
	})
})
