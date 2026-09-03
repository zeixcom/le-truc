/**
 * Substrate evaluation: jsdom vs. happy-dom (ADR 0027, LT-152).
 *
 * Runs the ADR 0027 spike checklist on BOTH substrates, verifies DOMPurify on
 * both, renders the `form-colorgraph` stress case through both and diffs the
 * serialized HTML, and measures the render cost at real docs-build scale —
 * the full-build number the ADR needs before acceptance, not an adjective.
 *
 *   bun run scripts/substrate-evaluation.ts [--skip-perf] [--skip-build] [--json <path>]
 *
 * The substrate-parameterized driver half lives in
 * `scripts/lib/substrate-probe.ts`; the production realm
 * (`server/tsrx/sim/realm.ts`) stays jsdom-only on purpose. The LT-152 claim
 * under test — a substrate swap is confined to the applier plus table
 * entries — is exercised by that module reusing the production patch table.
 *
 * Sections:
 * 1. Checklist  — pre-parsed upgrade, upgrade order, `whenDefined`, reflection,
 *    attribute reads, connect-time writes, custom-property survival, internals
 *    surface, silent defaults (recorded on a BARE window: substrate truth).
 * 2. DOMPurify  — `createDOMPurify(window)` on both substrates, verified
 *    against a hostile payload (LT-152's fourth criterion).
 * 3. Colorgraph — real corpus component, full driver posture (patch table,
 *    two-phase load/render, synchronous boundary), byte-diffed.
 * 4. Perf       — every site component rendered once per occurrence of its
 *    tag in the built docs (the real occurrence distribution), against the
 *    string-push baseline and the timed full docs build; memoization
 *    measured, not assumed (repeat identity, two-order identity, hit rate).
 */

import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import type { WindowLike } from 'dompurify'
import createDOMPurify from 'dompurify'
import { detectRuntime } from '../server/tsrx/sim/patch-table.ts'
import {
	applyPatches,
	buildClientBundle,
	createWindow,
	drainToQuiescence,
	importBundle,
	ProbeRealm,
	releaseBundleDir,
	type SubstrateName,
	type SubstrateWindow,
	substrateAvailable,
} from './lib/substrate-probe.ts'

/* === Constants === */

const ROOT = resolve(import.meta.dir, '..')
const GENERATED = join(ROOT, 'server', 'generated', 'tsrx')
const DOCS = join(ROOT, 'docs')

/** hostile payload for the DOMPurify verification */
const PURIFY_PAYLOAD =
	'<a href="javascript:alert(1)">link</a>' +
	'<img src="x" onerror="alert(2)">' +
	'<script>bad()</script>' +
	'<b>ok</b><ul><li>kept</li></ul>'

const COLORGRAPH = {
	component: 'form-colorgraph',
	client: 'form-colorgraph.client.ts',
	server: 'form-colorgraph.server.ts',
	render: 'renderFormColorgraph',
	args: { name: 'color', value: 'oklch(0.7 0.1 200)' },
	probes: [
		{ label: 'knob-style', selector: '.knob', attribute: 'style' },
		{ label: 'thumb-style', selector: '.thumb', attribute: 'style' },
		{
			label: 'slider-valuenow',
			selector: '.slider',
			attribute: 'aria-valuenow',
		},
		{
			label: 'canvas-width',
			selector: 'canvas.graph-canvas',
			attribute: 'width',
		},
	],
}

/**
 * Args for corpus components whose contract has genuinely required fields —
 * the same fixtures `server/tests/tsrx/server-render-smoke.test.ts` uses.
 * Everything absent renders from `{}`.
 */
const ARGS: Record<string, Record<string, unknown>> = {
	'form-spinbutton': { name: 'quantity' },
	'form-checkbox': { name: 'agree', label: 'I agree' },
	'form-radiogroup': {
		name: 'choice',
		label: 'Pick one',
		options: [
			{ value: 'a', label: 'A' },
			{ value: 'b', label: 'B' },
		],
	},
	'form-textbox': { name: 'title', label: 'Title' },
	'form-combobox': {
		name: 'fruit',
		label: 'Fruit',
		options: [
			{ value: 'a', label: 'Apple' },
			{ value: 'b', label: 'Banana' },
		],
	},
	'form-tokenbox': { name: 'tags', label: 'Tags' },
	'form-listbox': {
		name: 'fruit',
		options: [
			{ value: 'a', label: 'Apple' },
			{ value: 'b', label: 'Banana' },
		],
	},
	'module-tabgroup': {
		tabs: [
			{ id: 'one', label: 'One', content: 'First' },
			{ id: 'two', label: 'Two', content: 'Second' },
		],
	},
	'card-blogpost': { title: 'Title', href: '#' },
	'card-callout': { title: 'Heads up' },
	'card-collapsible': { title: 'Details' },
	'basic-button': { label: 'Add' },
}

/* === Types === */

type CheckResult = { pass: boolean; evidence: string }

type PerfRow = {
	tag: string
	count: number
	ms: number
	bytes?: number
	errors?: number
}

type ColorgraphReport = {
	preDrainLength: number
	shippedLength: number
	turns: number
	quiescent: boolean
	probes: Record<string, string | null>
}

type MemoizationReport = {
	repeatIdentical: boolean
	twoOrderIdentical: boolean
	uniqueSignatures: number
	totalOccurrences: number
}

/** The `--json <path>` artifact, accumulated section by section. */
type Report = {
	substrates: { ran: SubstrateName[]; skipped: SubstrateName[] }
	checklist: Partial<Record<SubstrateName, string[]>>
	dompurify: Partial<Record<SubstrateName, ReturnType<typeof runPurify>>>
	colorgraph: Partial<Record<SubstrateName, ColorgraphReport>> & {
		preDrainIdentical?: boolean
		shippedIdentical?: boolean
	}
	perf: {
		occurrences: number
		corpusOccurrences: number
		tags: number
		buildBaselineMs?: number[]
		stringPushMs?: number
		memoization?: MemoizationReport
	} & Partial<Record<SubstrateName, number>>
}

/* === Section 1: checklist === */

type Handle = SubstrateWindow

/** Bare window (no patches): the checklist records substrate truth. */
const bareWindow = (substrate: SubstrateName): Handle =>
	createWindow(substrate, '<!DOCTYPE html><html><body></body></html>')

const realmBase = (handle: Handle): typeof HTMLElement =>
	handle.window.HTMLElement as unknown as typeof HTMLElement

const registryOf = (handle: Handle): CustomElementRegistry =>
	handle.window.customElements as unknown as CustomElementRegistry

const checklistItems: Array<{
	name: string
	run: (handle: Handle) => Promise<CheckResult> | CheckResult
}> = [
	{
		name: 'pre-parsed upgrade fires connectedCallback',
		run: handle => {
			class PreEl extends realmBase(handle) {
				connectedCallback() {
					this.setAttribute('upgraded', 'yes')
				}
			}
			handle.document.body.innerHTML = '<pre-el></pre-el>'
			const el = handle.document.querySelector('pre-el')
			registryOf(handle).define('pre-el', PreEl)
			return {
				pass: el?.getAttribute('upgraded') === 'yes',
				evidence: `upgraded attr = ${JSON.stringify(el?.getAttribute('upgraded'))}`,
			}
		},
	},
	{
		name: 'upgrade order follows define order (child first)',
		run: handle => {
			const order: string[] = []
			const make = (tag: string) =>
				class extends realmBase(handle) {
					connectedCallback() {
						order.push(tag)
					}
				}
			handle.document.body.innerHTML =
				'<ord-parent><ord-child></ord-child></ord-parent>'
			registryOf(handle).define('ord-child', make('child'))
			registryOf(handle).define('ord-parent', make('parent'))
			return {
				pass: order.join(',') === 'child,parent',
				evidence: `connect order = [${order.join(', ')}]`,
			}
		},
	},
	{
		name: 'whenDefined resolves (pending + already-defined)',
		run: async handle => {
			const registry = registryOf(handle)
			const pending = registry.whenDefined('wd-el')
			class WdEl extends realmBase(handle) {}
			registry.define('wd-el', WdEl)
			await pending // resolution is asynchronous on both substrates
			const immediate = registry.whenDefined('wd-el')
			await immediate
			return {
				pass: true,
				evidence:
					'pending promise resolved on define; already-defined promise resolved',
			}
		},
	},
	{
		name: 'IDL reflection (lang) both directions',
		run: handle => {
			handle.document.body.innerHTML = '<ref-el lang="de"></ref-el>'
			const el = handle.document.querySelector(
				'ref-el',
			) as unknown as HTMLElement & { lang: string }
			const fromAttr = el.lang
			el.lang = 'fr'
			const toAttr = el.getAttribute('lang')
			return {
				pass: fromAttr === 'de' && toAttr === 'fr',
				evidence: `attr→prop = ${JSON.stringify(fromAttr)}, prop→attr = ${JSON.stringify(toAttr)}`,
			}
		},
	},
	{
		name: 'connect-time attribute reads see parsed markup',
		run: handle => {
			let seen = ''
			class ReadEl extends realmBase(handle) {
				connectedCallback() {
					seen = `${this.hasAttribute('ordinal')}:${this.getAttribute('ordinal')}`
				}
			}
			handle.document.body.innerHTML = '<read-el ordinal="7"></read-el>'
			registryOf(handle).define('read-el', ReadEl)
			return {
				pass: seen === 'true:7',
				evidence: `hasAttribute:getAttribute = ${seen}`,
			}
		},
	},
	{
		name: 'connect-time writes land in outerHTML',
		run: handle => {
			class WriteEl extends realmBase(handle) {
				connectedCallback() {
					this.setAttribute('aria-valuenow', '42')
					this.textContent = 'computed'
				}
			}
			handle.document.body.innerHTML = '<write-el></write-el>'
			registryOf(handle).define('write-el', WriteEl)
			const html = handle.document.body.innerHTML
			return {
				pass:
					html.includes('aria-valuenow="42"') && html.includes('>computed<'),
				evidence: html.slice(0, 80),
			}
		},
	},
	{
		name: 'custom properties survive serialization',
		run: handle => {
			class PropEl extends realmBase(handle) {
				connectedCallback() {
					this.style.setProperty('--knob-x', '12px')
				}
			}
			handle.document.body.innerHTML = '<prop-el></prop-el>'
			registryOf(handle).define('prop-el', PropEl)
			const html = handle.document.body.innerHTML
			return {
				pass: html.includes('--knob-x'),
				evidence: html.match(/style="[^"]*"/)?.[0] ?? '(no style attr)',
			}
		},
	},
	{
		name: 'internals surface (raw substrate truth)',
		run: handle => {
			const proto = handle.window.HTMLElement as unknown as {
				prototype: Record<string, unknown>
			}
			const kind = typeof proto.prototype.attachInternals
			if (kind !== 'function')
				return {
					pass: false,
					evidence: `attachInternals: ${kind} — the library's try/catch degrades to null internals`,
				}
			class IntEl extends realmBase(handle) {}
			handle.document.body.innerHTML = '<int-el></int-el>'
			registryOf(handle).define('int-el', IntEl)
			const el = handle.document.querySelector('int-el') as unknown as {
				attachInternals: () => Record<string, unknown>
			}
			const internals = el.attachInternals()
			return {
				pass: true,
				evidence: `returns object: ${String(internals !== undefined)}; states: ${typeof internals.states}; validationMessage: ${JSON.stringify(internals.validationMessage)}`,
			}
		},
	},
	{
		name: 'silent defaults (getBoundingClientRect, matchMedia)',
		run: handle => {
			const rect = (
				handle.document.createElement('div') as unknown as {
					getBoundingClientRect: () => Record<string, number>
				}
			).getBoundingClientRect()
			const zero = Object.values(rect).every(value => value === 0)
			const media = typeof handle.window.matchMedia
			const matches =
				media === 'function'
					? String(
							(handle.window.matchMedia as (q: string) => { matches: boolean })(
								'(min-width: 100px)',
							).matches,
						)
					: 'n/a'
			return {
				pass: zero,
				evidence: `rect all-zero = ${zero}; matchMedia = ${media} (matches ${matches})`,
			}
		},
	},
	{
		name: 'instanceof clean after realm forcing',
		run: handle => {
			const restore = applyPatches(handle, () => {})
			const el = handle.document.createElement('div')
			const HTMLElementGlobal = globalThis.HTMLElement
			restore() // the checklist window is bare — do not leak its classes
			return {
				pass: el instanceof HTMLElementGlobal,
				evidence: `el instanceof forced HTMLElement = ${String(el instanceof HTMLElementGlobal)}`,
			}
		},
	},
]

const runChecklist = (substrate: SubstrateName): Promise<string[]> =>
	Promise.all(
		checklistItems.map(async item => {
			const handle = bareWindow(substrate)
			let result: CheckResult
			try {
				result = await item.run(handle)
			} catch (error) {
				result = {
					pass: false,
					evidence: `threw: ${String((error as Error).message)}`,
				}
			}
			handle.dispose()
			return `  ${result.pass ? '✓' : '✗'} ${item.name}\n      ${result.evidence}`
		}),
	)

/* === Section 2: DOMPurify === */

const runPurify = (
	substrate: SubstrateName,
): { supported: boolean; out: string; verdict: boolean; stripped: boolean } => {
	const handle = bareWindow(substrate)
	try {
		const purify = createDOMPurify(handle.window as unknown as WindowLike)
		const supported = purify.isSupported
		const out = String(purify.sanitize(PURIFY_PAYLOAD))
		const stripped =
			!out.includes('<script') &&
			!out.includes('onerror') &&
			!out.includes('javascript:') &&
			out.includes('<b>ok</b>') &&
			out.includes('<li>kept</li>')
		return { supported, out, verdict: supported && stripped, stripped }
	} finally {
		handle.dispose()
	}
}

/* === Section 3: colorgraph === */

const runColorgraph = async (
	substrate: SubstrateName,
): Promise<{
	sync: string
	shipped: string
	turns: number
	quiescent: boolean
	probes: Record<string, string | null>
	diagnostics: string[]
}> => {
	const serverModule = (await import(
		join(GENERATED, COLORGRAPH.server)
	)) as Record<string, (args: Record<string, unknown>) => string>
	const render = serverModule[COLORGRAPH.render]
	if (!render)
		throw new Error(`${COLORGRAPH.server} exports no ${COLORGRAPH.render}`)
	const markup = render(COLORGRAPH.args)
	// Fresh bundle per realm: one module cache per process means a second
	// realm importing the same path records nothing and silently renders
	// un-upgraded SSR markup (ADR 0027 sub-design 10).
	const bundle = await buildClientBundle(
		join(GENERATED, COLORGRAPH.client),
		`colorgraph-${substrate}`,
	)
	const realm = new ProbeRealm(substrate)
	try {
		await realm.load(() => importBundle(bundle))
		// LT-151's strict boundary is superseded (amended sub-design 9): the
		// shipped HTML is the QUIESCENT output. The pre-drain snapshot is
		// kept only to show what a synchronous window would have dropped.
		const sync = realm.renderSync(markup, COLORGRAPH.component)
		const {
			html: shipped,
			turns,
			quiescent,
		} = await drainToQuiescence(realm, COLORGRAPH.component)
		const probes: Record<string, string | null> = {}
		for (const probe of COLORGRAPH.probes) {
			const el = realm.document.querySelector(probe.selector)
			probes[probe.label] = el
				? probe.attribute
					? el.getAttribute(probe.attribute)
					: el.textContent
				: null
		}
		return {
			sync,
			shipped,
			turns,
			quiescent,
			probes,
			diagnostics: [...realm.diagnostics],
		}
	} finally {
		realm.dispose()
	}
}

/* === Section 4: perf === */

/** `form-spinbutton` → `renderFormSpinbutton`. */
const renderName = (tag: string): string =>
	`render${tag
		.split('-')
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join('')}`

type SiteTag = {
	tag: string
	/** corpus (compiled .tsrx) or hand-written example */
	kind: 'corpus' | 'handwritten'
	/** client module path, relative to ROOT */
	client: string
	/** markup for one occurrence */
	markup: string
	/** occurrences in the built docs (docs/, excluding docs/test/) */
	count: number
}

const walkDocsHtml = (dir: string, out: string[] = []): string[] => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name)
		if (entry.isDirectory()) {
			if (full === join(DOCS, 'test')) continue
			walkDocsHtml(full, out)
		} else if (entry.name.endsWith('.html')) out.push(full)
	}
	return out
}

const buildInventory = async (): Promise<SiteTag[]> => {
	// Tag occurrences in the built docs — the real distribution.
	const files = walkDocsHtml(DOCS)
	const counts = new Map<string, number>()
	for (const file of files) {
		const html = readFileSync(file, 'utf8')
		for (const match of html.matchAll(
			/<((?:basic|card|form|module|section)-[a-z-]+)(?=[\s/>])/g,
		)) {
			const tag = match[1]
			if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1)
		}
	}

	// Site components: compiled corpus + hand-written clients from main.ts.
	const inventory: SiteTag[] = []
	const mainTs = readFileSync(join(ROOT, 'examples', 'main.ts'), 'utf8')
	const imports = [...mainTs.matchAll(/^import '(.+)'/gm)].flatMap(match =>
		match[1] ? [match[1]] : [],
	)
	for (const specifier of imports) {
		const client = relative(ROOT, resolve(ROOT, 'examples', specifier))
		const tag = basename(client).replace(/\.client\.ts$|\.ts$/, '')
		const count = counts.get(tag) ?? 0
		if (count === 0) continue
		const kind = client.startsWith(join('server', 'generated'))
			? 'corpus'
			: 'handwritten'
		let markup: string
		if (kind === 'corpus') {
			const mod = (await import(join(GENERATED, `${tag}.server.ts`))) as Record<
				string,
				(args: Record<string, unknown>) => string
			>
			const render = mod[renderName(tag)]
			if (!render)
				throw new Error(`${tag}.server.ts exports no ${renderName(tag)}`)
			markup = render(ARGS[tag] ?? {})
		} else {
			markup = readFileSync(
				join(ROOT, client.replace(/\.ts$/, '.html')),
				'utf8',
			).trim()
		}
		inventory.push({ tag, kind, client, markup, count })
	}
	return inventory.sort((a, b) => b.count - a.count)
}

const timeSubstrate = async (
	substrate: SubstrateName,
	inventory: SiteTag[],
): Promise<{ totalMs: number; rows: PerfRow[] }> => {
	const bundles: string[] = []
	for (const entry of inventory)
		bundles.push(
			await buildClientBundle(
				join(ROOT, entry.client),
				`site-${substrate}-${entry.tag}`,
			),
		)
	const realm = new ProbeRealm(substrate)
	const rows: PerfRow[] = []
	try {
		// Resolution phase: load every client once, render many times (LT-151).
		for (const bundle of bundles) await realm.load(() => importBundle(bundle))
		// Warmup: the first render per tag pays the define/upgrade registration.
		for (const entry of inventory) realm.render(entry.markup, entry.tag)
		// Drain deferred activations between tags, while the realm is alive:
		// each sync render queues a deferred effect (resolveDependencies'
		// microtask), and LT-154's per-render hermetic quiescence will drain
		// it the same way. Letting the flood run after dispose() tears the
		// patch-table globals out from under it (and crashed Bun once).
		const drain = async () => {
			for (let turn = 0; turn < 3; turn++) await Promise.resolve()
		}
		for (const entry of inventory) {
			await drain()
			const start = performance.now()
			let last = ''
			for (let i = 0; i < entry.count; i++)
				last = realm.render(entry.markup, entry.tag)
			rows.push({
				tag: entry.tag,
				count: entry.count,
				ms: performance.now() - start,
				bytes: last.length,
				errors: realm.diagnostics.filter(line =>
					line.startsWith(`[${entry.tag}]`),
				).length,
			})
		}
		await drain()
	} finally {
		realm.dispose()
	}
	Bun.gc(true)
	return { totalMs: rows.reduce((sum, row) => sum + row.ms, 0), rows }
}

const timeStringPush = async (
	inventory: SiteTag[],
): Promise<{ totalMs: number; rows: PerfRow[] }> => {
	const rows: PerfRow[] = []
	const renders = new Map<string, (args: Record<string, unknown>) => string>()
	for (const entry of inventory.filter(entry => entry.kind === 'corpus'))
		renders.set(
			entry.tag,
			(
				(await import(join(GENERATED, `${entry.tag}.server.ts`))) as Record<
					string,
					unknown
				>
			)[renderName(entry.tag)] as (args: Record<string, unknown>) => string,
		)
	for (const entry of inventory) {
		const render = renders.get(entry.tag)
		if (!render) continue // hand-written markup is authored; no render function exists today
		const start = performance.now()
		let last = ''
		for (let i = 0; i < entry.count; i++) last = render(ARGS[entry.tag] ?? {})
		rows.push({
			tag: entry.tag,
			count: entry.count,
			ms: performance.now() - start,
			bytes: last.length,
		})
	}
	return { totalMs: rows.reduce((sum, row) => sum + row.ms, 0), rows }
}

/**
 * Memoization measurements: repeat identity, two-order identity, and the
 * hit rate a `(component, args)` cache would see on the built docs.
 *
 * Each pass is a fresh realm with freshly bundled modules (one module cache
 * per process, sub-design 10) rendering the corpus in its given order, with
 * every render drained to quiescence — the output the amended contract
 * ships. Realms are NOT disposed between passes: a disposed realm's deleted
 * globals turn a contained component's lingering dependency-wait into a
 * synchronous ReferenceError flood, and the bench child hard-exits anyway.
 */
const measureMemoization = async (
	inventory: SiteTag[],
	substrate: SubstrateName,
): Promise<{
	repeatIdentical: boolean
	twoOrderIdentical: boolean
	uniqueSignatures: number
	totalOccurrences: number
}> => {
	let pass = 0
	const renderPass = async (order: number[]): Promise<string[]> => {
		const realm = new ProbeRealm(substrate)
		for (const entry of inventory) {
			const bundle = await buildClientBundle(
				join(ROOT, entry.client),
				`memo-${substrate}-${pass}-${entry.tag}`,
			)
			await realm.load(() => importBundle(bundle))
		}
		const outputs = new Array<string>(inventory.length)
		for (const index of order) {
			const entry = inventory[index]!
			realm.render(entry.markup, entry.tag)
			const { html, quiescent } = await drainToQuiescence(realm, entry.tag)
			if (!quiescent)
				throw new Error(`${entry.tag} did not quiesce in memo pass ${pass}`)
			outputs[index] = html
		}
		pass++
		return outputs
	}
	const forward = await renderPass(inventory.map((_, index) => index))
	const repeated = await renderPass(inventory.map((_, index) => index))
	const backward = await renderPass([...inventory.keys()].reverse())
	const repeatIdentical = forward.every(
		(html, index) => html === repeated[index],
	)
	const twoOrderIdentical = forward.every(
		(html, index) => html === backward[index],
	)

	// Hit rate: unique attribute signatures per tag in the built docs.
	const signatures = new Map<string, Set<string>>()
	let total = 0
	for (const file of walkDocsHtml(DOCS)) {
		const html = readFileSync(file, 'utf8')
		for (const entry of inventory) {
			for (const match of html.matchAll(
				new RegExp(`<${entry.tag}([^>]*)>`, 'g'),
			)) {
				const attrs =
					match[1]
						?.match(/[a-zA-Z-]+(?:="[^"]*")?/g)
						?.sort()
						.join(' ') ?? ''
				const set = signatures.get(entry.tag) ?? new Set<string>()
				set.add(attrs)
				signatures.set(entry.tag, set)
				total++
			}
		}
	}
	const unique = [...signatures.values()].reduce(
		(sum, set) => sum + set.size,
		0,
	)
	return {
		repeatIdentical,
		twoOrderIdentical,
		uniqueSignatures: unique,
		totalOccurrences: total,
	}
}

const timeDocsBuild = (): number[] => {
	const runs: number[] = []
	for (let i = 0; i < 3; i++) {
		const start = performance.now()
		const proc = Bun.spawnSync(['bun', 'run', 'build:docs'], {
			cwd: ROOT,
			stdout: 'pipe',
			stderr: 'pipe',
		})
		if (proc.exitCode !== 0)
			throw new Error(
				`build:docs failed:\n${proc.stderr.toString().slice(-800)}`,
			)
		runs.push(performance.now() - start)
	}
	return runs
}

/* === Report helpers === */

const ms = (value: number): string => `${value.toFixed(1).padStart(9)} ms`

const printRows = (title: string, rows: PerfRow[], totalMs: number) => {
	console.log(`\n${title}`)
	console.log(
		`  ${'tag'.padEnd(24)} ${'count'.padStart(6)} ${'time'.padStart(12)}${'bytes'.padStart(9)}${'err'.padStart(5)}`,
	)
	const sorted = [...rows].sort((a, b) => b.ms - a.ms)
	for (const row of sorted.slice(0, 14))
		console.log(
			`  ${row.tag.padEnd(24)} ${String(row.count).padStart(6)} ${ms(row.ms)}${String(row.bytes ?? '').padStart(9)}${String(row.errors ?? '').padStart(5)}`,
		)
	const rest = sorted.slice(14)
	if (rest.length)
		console.log(
			`  … ${rest.length} more tags`.padEnd(44) +
				ms(rest.reduce((sum, row) => sum + row.ms, 0)),
		)
	console.log(
		`  ${'TOTAL'.padEnd(24)} ${String(rows.reduce((sum, row) => sum + row.count, 0)).padStart(6)} ${ms(totalMs)}`,
	)
}

/* === Main === */

/**
 * Bench phases run in SUBPROCESSES (`--bench <name>`), one per substrate:
 * the jsdom render loop holds thousands of DOM trees and a crash or leak in
 * one substrate must not take the measurement of the other down (it did,
 * before this was a subprocess — a Bun hard-crash after the jsdom pass).
 * The child prints its result as a single JSON object on stdout.
 */
const runBenchPhase = async (name: string): Promise<unknown> => {
	const inventory = await buildInventory()
	if (name.startsWith('perf-')) {
		const substrate = name.slice('perf-'.length) as SubstrateName
		const result = await timeSubstrate(substrate, inventory)
		// Hard exit, no realm.dispose(): a component whose connect was
		// contained (module-lazyload's missing-element fixture) keeps a
		// dependency-wait alive, and after dispose() deletes the realm
		// globals every retry throws `customElements is not defined` — a
		// synchronous flood that aborts Bun. The production driver disposes
		// once, at process end; the child does the same, just sooner.
		console.log(
			JSON.stringify({
				inventory: inventory.map(({ tag, kind, count }) => ({
					tag,
					kind,
					count,
				})),
				...result,
			}),
		)
		process.exit(0)
	}
	if (name.startsWith('memo-')) {
		const substrate = name.slice('memo-'.length) as SubstrateName
		const result = await measureMemoization(inventory, substrate)
		console.log(JSON.stringify(result))
		process.exit(0)
	}
	throw new Error(`unknown bench phase: ${name}`)
}

const runPhaseInSubprocess = async (name: string): Promise<unknown> => {
	const script = join(import.meta.dir, 'substrate-evaluation.ts')
	const proc = Bun.spawnSync(['bun', script, '--bench', name], {
		cwd: ROOT,
		stdout: 'pipe',
		stderr: 'inherit',
	})
	if (proc.exitCode !== 0)
		throw new Error(`bench phase ${name} failed (exit ${proc.exitCode})`)
	const out = proc.stdout.toString()
	const start = out.indexOf('{')
	if (start < 0)
		throw new Error(`bench phase ${name} printed no JSON:\n${out.slice(-400)}`)
	return JSON.parse(out.slice(start)) as unknown
}

const main = async (): Promise<void> => {
	const argv = process.argv.slice(2)
	if (argv.includes('--bench')) {
		const result = await runBenchPhase(argv[argv.indexOf('--bench') + 1] ?? '')
		console.log(JSON.stringify(result))
		return
	}
	const skipPerf = argv.includes('--skip-perf')
	const skipBuild = argv.includes('--skip-build')
	const jsonPath = argv.includes('--json')
		? argv[argv.indexOf('--json') + 1]
		: undefined

	const report = {} as Report
	// happy-dom was disqualified by this harness and dropped from
	// devDependencies (ADR 0027). Absent, every section runs its jsdom half and
	// the comparison columns say why they are missing — the `check:sim` posture
	// for an absent runtime: degrade to a narrower check, never to a false pass.
	const ALL_SUBSTRATES: readonly SubstrateName[] = ['jsdom', 'happy-dom']
	const SUBSTRATES = ALL_SUBSTRATES.filter(substrateAvailable)
	const skipped = ALL_SUBSTRATES.filter(name => !substrateAvailable(name))

	console.log(
		`Substrate evaluation (LT-152) — ${SUBSTRATES.join(' vs ')}, runtime: ${detectRuntime()} ${Bun.version}`,
	)
	if (skipped.length) {
		console.log(
			`  not installed: ${skipped.join(', ')} — comparison sections run one-sided.`,
		)
		console.log(
			'  `bun add -d happy-dom` restores the full LT-152 comparison; it was',
		)
		console.log(
			'  removed because the evaluation disqualified it (DOMPurify fails open).',
		)
	}
	report.substrates = { ran: SUBSTRATES, skipped }

	// --- 1. Checklist ---
	console.log('\n=== 1. Fidelity checklist (bare window: substrate truth) ===')
	report.checklist = {}
	for (const substrate of SUBSTRATES) {
		console.log(`\n[${substrate}]`)
		const rows = await runChecklist(substrate)
		for (const row of rows) console.log(row)
		report.checklist[substrate] = rows
	}

	// --- 2. DOMPurify ---
	console.log('\n=== 2. DOMPurify (LT-152 fourth criterion) ===')
	report.dompurify = {}
	for (const substrate of SUBSTRATES) {
		let result: ReturnType<typeof runPurify>
		try {
			result = runPurify(substrate)
		} catch (error) {
			result = {
				supported: false,
				out: `threw: ${String((error as Error).message)}`,
				verdict: false,
				stripped: false,
			}
		}
		console.log(
			`  [${substrate}] isSupported = ${result.supported}; hostile payload stripped = ${result.stripped}\n    out: ${result.out.slice(0, 160)}`,
		)
		report.dompurify[substrate] = result
	}

	// --- 3. Colorgraph ---
	console.log('\n=== 3. form-colorgraph through the full driver posture ===')
	report.colorgraph = {}
	const colorgraphRuns = new Map<
		SubstrateName,
		Awaited<ReturnType<typeof runColorgraph>>
	>()
	for (const substrate of SUBSTRATES) {
		const result = await runColorgraph(substrate)
		colorgraphRuns.set(substrate, result)
		console.log(
			`  [${substrate}] ${result.sync.length} chars pre-drain → ${result.shipped.length} chars quiescent (${result.turns} turns${result.quiescent ? '' : ', NON-QUIESCENT'}); settled probes: ${JSON.stringify(result.probes)}`,
		)
		if (result.diagnostics.length)
			console.log(
				`    diagnostics: ${result.diagnostics.map(line => line.slice(0, 140)).join(' | ')}`,
			)
		report.colorgraph[substrate] = {
			preDrainLength: result.sync.length,
			shippedLength: result.shipped.length,
			turns: result.turns,
			quiescent: result.quiescent,
			probes: result.probes,
		}
	}
	{
		const jsdomRun = colorgraphRuns.get('jsdom')
		const happyRun = colorgraphRuns.get('happy-dom')
		if (jsdomRun && happyRun) {
			for (const [label, left, right] of [
				[
					'pre-drain snapshot (what a strict sync window would ship)',
					jsdomRun.sync,
					happyRun.sync,
				],
				[
					'quiescent (the shipped HTML, amended sub-design 9)',
					jsdomRun.shipped,
					happyRun.shipped,
				],
			] as Array<[string, string, string]>) {
				const identical = left === right
				console.log(
					`  ${identical ? '✓' : '✗'} ${label}: ${identical ? 'byte-identical' : `differs (${left.length} vs ${right.length} chars)`}`,
				)
				if (!identical) {
					let diff = 0
					while (
						diff < Math.min(left.length, right.length) &&
						left[diff] === right[diff]
					)
						diff++
					console.log(
						`    jsdom     …${left.slice(Math.max(0, diff - 40), diff + 80)}…\n    happy-dom …${right.slice(Math.max(0, diff - 40), diff + 80)}…`,
					)
				}
			}
			report.colorgraph.preDrainIdentical = jsdomRun.sync === happyRun.sync
			report.colorgraph.shippedIdentical = jsdomRun.shipped === happyRun.shipped
		}
	}

	// --- 4. Perf ---
	if (!skipPerf) {
		console.log('\n=== 4. Perf at docs-build scale ===')
		const inventory = await buildInventory()
		const corpus = inventory.filter(entry => entry.kind === 'corpus')
		const occurrences = inventory.reduce((sum, entry) => sum + entry.count, 0)
		const corpusOccurrences = corpus.reduce(
			(sum, entry) => sum + entry.count,
			0,
		)
		console.log(
			`  site tags with docs occurrences: ${inventory.length} (${corpus.length} corpus) — ${occurrences} occurrences total, ${corpusOccurrences} on corpus tags`,
		)
		report.perf = { occurrences, corpusOccurrences, tags: inventory.length }

		if (!skipBuild) {
			const builds = timeDocsBuild()
			console.log(
				`  full docs build (string pipeline, today): ${builds.map(value => `${(value / 1000).toFixed(2)}s`).join(', ')} wall`,
			)
			report.perf.buildBaselineMs = builds
		}

		console.log(`  inventory: ${bundlesSummary(inventory)}`)

		const stringResult = await timeStringPush(inventory)
		printRows(
			'  [string-push baseline — generated render*() only]',
			stringResult.rows,
			stringResult.totalMs,
		)
		report.perf.stringPushMs = stringResult.totalMs

		// Each substrate's render loop runs in its own process (see
		// runBenchPhase): thousands of DOM trees per substrate do not share
		// one heap, and one substrate crashing cannot end the measurement.
		const perfJson: Record<string, { totalMs: number; rows: PerfRow[] }> = {}
		for (const substrate of SUBSTRATES) {
			process.stdout.write(`  benchmarking ${substrate}…\n`)
			perfJson[substrate] = (await runPhaseInSubprocess(
				`perf-${substrate}`,
			)) as { totalMs: number; rows: PerfRow[] }
			printRows(
				`  [${substrate} — simulate + connect every occurrence]`,
				perfJson[substrate].rows,
				perfJson[substrate].totalMs,
			)
			console.log(
				`  ${substrate}: ${(perfJson[substrate].totalMs / 1000).toFixed(2)}s total, ${Math.round((perfJson[substrate].totalMs / occurrences) * 1000)} µs/render mean`,
			)
			report.perf[substrate] = perfJson[substrate].totalMs
		}

		console.log('\n  Memoization (measured, not assumed):')
		const memo = (await runPhaseInSubprocess('memo-jsdom')) as MemoizationReport
		console.log(
			`    repeat render (same realm, same order) identical: ${memo.repeatIdentical}`,
		)
		console.log(
			`    two-order render (fresh realm, reversed order) identical: ${memo.twoOrderIdentical}`,
		)
		console.log(
			`    (component, args) cache on built docs: ${memo.uniqueSignatures} unique signatures / ${memo.totalOccurrences} occurrences → ${((1 - memo.uniqueSignatures / memo.totalOccurrences) * 100).toFixed(1)}% hit rate`,
		)
		report.perf.memoization = memo
	}

	if (jsonPath) {
		await Bun.write(jsonPath, JSON.stringify(report, null, 2))
		console.log(`\nJSON report written to ${jsonPath}`)
	}
}

const bundlesSummary = (inventory: SiteTag[]): string =>
	`${inventory.length} client modules (${inventory.filter(entry => entry.kind === 'corpus').length} corpus, ${inventory.filter(entry => entry.kind === 'handwritten').length} hand-written)`

main()
	.then(() => releaseBundleDir())
	.catch(error => {
		releaseBundleDir()
		console.error(error)
		process.exitCode = 1
	})
