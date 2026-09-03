/**
 * Substrate-probe harness for the LT-152 substrate evaluation
 * (scripts/substrate-evaluation.ts) — jsdom vs. happy-dom.
 *
 * Carries the substrate-parameterized half of the simulation driver: window
 * creation for both substrates, a patch-table applier that reuses the
 * PRODUCTION table (`server/tsrx/sim/patch-table.ts`) verbatim plus
 * substrate extras, and the two-phase ProbeRealm (recording-registry load,
 * synchronous parse→replay→serialize render) mirroring
 * `server/tsrx/sim/realm.ts`. The production realm stays jsdom-only; any
 * table entry this harness needs for a second substrate is an evaluation
 * finding, recorded in ADR 0027.
 *
 * Client-module loading goes through `importBundle`, which only ever loads a
 * bundle this harness itself wrote into its own tmp directory (validated
 * before the dynamic import), so the executed code is pinned to
 * locally-bundled generated/hand-written clients.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { JSDOM, VirtualConsole } from 'jsdom'
import { assertSynchronousWindow } from '../../server/tsrx/sim/boundary.ts'
import {
	detectRuntime,
	NETWORK_GLOBALS,
	PROTOTYPE_PATCHES,
	patchesFor,
	REALM_GLOBALS,
	type RealmGlobalPatch,
	STUB_GLOBALS,
} from '../../server/tsrx/sim/patch-table.ts'
import type { RecordedDefinition } from '../../server/tsrx/sim/realm.ts'

/* === Types === */

export type SubstrateName = 'jsdom' | 'happy-dom'

/**
 * happy-dom is NOT a dependency. It was disqualified as the substrate by this
 * very harness (ADR 0027 Alternatives: DOMPurify fails open on it) and removed
 * from `devDependencies` on 2026-09-03, so the comparison it exists to make is
 * settled. The import stays optional rather than deleted because the ADR names
 * two conditions under which the rejection is revisited, and re-running the
 * comparison should cost `bun add -d happy-dom` and nothing else.
 *
 * Absent, the harness reports the substrate as unavailable and runs its jsdom
 * half — the `check:sim` posture for a runtime that is not on PATH: degrade to
 * a narrower check that says so, never to a false pass.
 */
let HappyWindow: (new () => unknown) | undefined
// Widened to `string` deliberately: a literal specifier makes TypeScript
// resolve the module statically, which is an error once the package is gone
// and would come back the moment someone reinstalls it. This types the same
// either way.
const HAPPY_DOM_SPECIFIER: string = 'happy-dom'
try {
	;({ Window: HappyWindow } = (await import(HAPPY_DOM_SPECIFIER)) as {
		Window: new () => unknown
	})
} catch {
	HappyWindow = undefined
}

/** False when the substrate's package is not installed (happy-dom only). */
export const substrateAvailable = (substrate: SubstrateName): boolean =>
	substrate === 'jsdom' || HappyWindow !== undefined

export type SubstrateWindow = {
	readonly substrate: SubstrateName
	readonly window: Record<string, unknown>
	readonly document: Document
	/** Console/error entries the substrate collected so far (draining). */
	diagnostics(): string[]
	dispose(): void
}

/* === Substrate windows === */

/**
 * happy-dom's natively implemented observers/media APIs, forced from its
 * window so the REAL implementation reaches `globalThis`. For jsdom these
 * resolve `undefined` and are skipped, so the stub column fills instead —
 * one unified table, two correct outcomes. `requestAnimationFrame` is NOT
 * here: its forced stub stays on every substrate (same-branch parity —
 * a real rAF fires after serialization and could hold the process open).
 */
const REALM_EXTRAS: readonly RealmGlobalPatch[] = [
	{
		kind: 'realm',
		name: 'ResizeObserver',
		note: 'happy-dom implements it; jsdom resolves undefined and the stub fills',
	},
	{ kind: 'realm', name: 'IntersectionObserver', note: 'same' },
	{
		kind: 'realm',
		name: 'matchMedia',
		note: 'happy-dom implements it; jsdom resolves undefined and the stub fills',
	},
]

export const createWindow = (
	substrate: SubstrateName,
	html: string,
): SubstrateWindow => {
	if (substrate === 'jsdom') {
		const entries: string[] = []
		const virtualConsole = new VirtualConsole()
		virtualConsole.on('jsdomError', (error: Error) =>
			entries.push(
				`jsdomError: ${String(
					(error.cause as Error | undefined)?.message ?? error.message,
				)}`,
			),
		)
		for (const level of ['error', 'warn'] as const)
			virtualConsole.on(level, (...args: unknown[]) =>
				entries.push(`${level}: ${args.map(String).join(' ')}`),
			)
		const dom = new JSDOM(html, { virtualConsole, pretendToBeVisual: false })
		return {
			substrate,
			window: dom.window as unknown as Record<string, unknown>,
			document: dom.window.document as unknown as Document,
			diagnostics: () => entries.splice(0),
			dispose: () => dom.window.close(),
		}
	}
	if (!HappyWindow)
		throw new Error(
			'happy-dom is not installed — it was disqualified as the substrate ' +
				'and dropped from devDependencies (ADR 0027). Run `bun add -d ' +
				'happy-dom` to re-run the comparison.',
		)
	const win = new HappyWindow() as {
		document: Document & { body: { innerHTML: string } }
		happyDOM?: {
			virtualConsolePrinter?: {
				read(): Array<{ level: unknown; values: unknown[] }>
			}
			abort?(): Promise<void> | undefined
		}
	}
	win.document.body.innerHTML = html
	const happy = win.happyDOM
	return {
		substrate,
		window: win as unknown as Record<string, unknown>,
		document: win.document as unknown as Document,
		diagnostics: () =>
			(happy?.virtualConsolePrinter?.read() ?? []).map(
				entry =>
					`${String(entry.level)}: ${entry.values.map(String).join(' ')}`,
			),
		dispose: () => {
			happy?.abort?.()?.catch?.(() => {})
		},
	}
}

/* === Patch-table application === */

const resolveTarget = (
	root: Record<string, unknown>,
	name: string,
): { owner: Record<string, unknown>; key: string } | null => {
	const parts = name.split('.')
	let owner: Record<string, unknown> = root
	for (const part of parts.slice(0, -1)) {
		const next = owner[part]
		if (typeof next !== 'object' || next === null) return null
		owner = next as Record<string, unknown>
	}
	const key = parts.at(-1)
	return key === undefined ? null : { owner, key }
}

const stubFor = (shape: string): unknown => {
	switch (shape) {
		case 'observer':
			return class {
				observe() {}
				unobserve() {}
				disconnect() {}
				takeRecords() {
					return []
				}
			}
		case 'match-media':
			return (query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener() {},
				removeListener() {},
				addEventListener() {},
				removeEventListener() {},
				dispatchEvent: () => false,
			})
		case 'animation-frame':
			return () => 0
		default:
			return () => {}
	}
}

/**
 * Apply the production patch table plus the substrate extras; the return
 * value restores every touched `globalThis` descriptor. Callers MUST call
 * the restore before the window is disposed — a skipped restore leaks the
 * window's classes onto `globalThis` (the sim-realm tests' `withRealm()`
 * discipline).
 */
export const applyPatches = (
	handle: SubstrateWindow,
	onReport: (message: string) => void,
): (() => void) => {
	const runtime = detectRuntime()
	const root = globalThis as unknown as Record<string, unknown>
	const winRecord = handle.window
	const restores: Array<() => void> = []

	const force = (name: string, value: unknown) => {
		const target = resolveTarget(root, name)
		if (!target) return
		const { owner, key } = target
		const previous = Object.getOwnPropertyDescriptor(owner, key)
		try {
			Object.defineProperty(owner, key, {
				value,
				writable: true,
				configurable: true,
				enumerable: previous?.enumerable ?? false,
			})
		} catch {
			onReport(`could not patch global '${name}' under ${runtime}`)
			return
		}
		restores.push(() => {
			if (previous) Object.defineProperty(owner, key, previous)
			else delete owner[key]
		})
	}

	const realmPatches: readonly RealmGlobalPatch[] = [
		...REALM_EXTRAS,
		...REALM_GLOBALS,
	]
	for (const patch of patchesFor(realmPatches, runtime)) {
		const value = winRecord[patch.from ?? patch.name]
		if (value === undefined) continue
		const isConstructor =
			typeof value === 'function' && /^[A-Z]/.test(patch.name)
		force(
			patch.name,
			typeof value === 'function' && !isConstructor
				? (value as (...args: unknown[]) => unknown).bind(handle.window)
				: value,
		)
	}

	for (const patch of patchesFor(STUB_GLOBALS, runtime)) {
		const present =
			winRecord[patch.name] !== undefined || root[patch.name] !== undefined
		if (present && !patch.force) continue
		force(patch.name, stubFor(patch.shape))
	}

	const deny = (name: string) => {
		const message = `Network access from a simulated connect: ${name}() (ADR 0027 sub-design 2d)`
		return () => {
			onReport(message)
			// Never settles (amended sub-design 2d): a rejection asserts the
			// request failed, which the build cannot know, and under a drain it
			// would route every fetching component to `@catch`; pending is the
			// honest state and routes `match()` to `@pending`. Reported at
			// CALL time, so the violation is loud regardless.
			return new Promise<never>(() => {})
		}
	}
	for (const patch of patchesFor(NETWORK_GLOBALS, runtime)) {
		if (patch.name === 'navigator.sendBeacon') continue
		force(patch.name, deny(patch.name))
	}

	for (const patch of PROTOTYPE_PATCHES) {
		const owner = winRecord[patch.owner] as
			| { prototype: Record<string, unknown> }
			| undefined
		if (!owner?.prototype) continue
		Object.defineProperty(owner.prototype, patch.method, {
			value: function patched() {
				throw new Error(patch.message)
			},
			writable: true,
			configurable: true,
		})
	}
	// The prototype patch replaces rather than restores; the window is
	// disposed right after, so no restore entry is kept for it.

	return () => {
		for (const restore of restores.reverse()) restore()
	}
}

/* === Bundled-module import chokepoint === */

/**
 * Bundles this harness itself wrote, in its own tmp directory — the only
 * things `importBundle` will ever load. Validated before the dynamic import
 * so a confused path cannot widen into arbitrary module execution.
 */
let bundleRoot: string | undefined

export const claimBundleDir = (): string => {
	if (!bundleRoot)
		bundleRoot = mkdtempSync(join(tmpdir(), 'le-truc-substrate-'))
	return bundleRoot
}

export const releaseBundleDir = (): void => {
	if (bundleRoot) rmSync(bundleRoot, { recursive: true, force: true })
	bundleRoot = undefined
}

export const importBundle = async (path: string): Promise<unknown> => {
	const resolved = resolve(path)
	if (
		!bundleRoot ||
		!resolved.startsWith(bundleRoot) ||
		!/\.(mjs|js)$/.test(resolved)
	)
		throw new Error(`refusing to import non-bundle path: ${resolved}`)
	return import(resolved)
}

/** Bundle one client entry (generated or hand-written) for substrate use. */
export const buildClientBundle = async (
	entrypoint: string,
	outdirName: string,
	define: Record<string, string> = { 'process.env.DEV_MODE': '"false"' },
): Promise<string> => {
	const built = await Bun.build({
		entrypoints: [entrypoint],
		outdir: join(claimBundleDir(), outdirName),
		target: 'node',
		format: 'esm',
		define,
	})
	if (!built.success)
		throw new Error(
			`bundling ${entrypoint} failed:\n${built.logs.map(String).join('\n')}`,
		)
	return built.outputs[0]!.path
}

/* === Probe realm (two-phase driver, mirrors realm.ts) === */

export class ProbeRealm {
	readonly substrate: SubstrateName
	readonly handle: SubstrateWindow
	readonly document: Document
	readonly diagnostics: string[] = []
	readonly definitions: RecordedDefinition[] = []
	#restore: () => void
	#currentComponent: string | undefined

	constructor(
		substrate: SubstrateName,
		html = '<!DOCTYPE html><html><body></body></html>',
	) {
		this.substrate = substrate
		this.handle = createWindow(substrate, html)
		this.document = this.handle.document
		this.#restore = applyPatches(this.handle, message => this.#report(message))
	}

	#report(message: string) {
		this.diagnostics.push(
			this.#currentComponent
				? `[${this.#currentComponent}] ${message}`
				: message,
		)
	}

	#drainSubstrateConsole() {
		for (const entry of this.handle.diagnostics()) this.diagnostics.push(entry)
	}

	/**
	 * Resolution phase: import client modules behind a recording registry.
	 *
	 * Throws when the import recorded no new definitions: one module cache
	 * per process means a bundle imported by an EARLIER realm re-evaluates
	 * nothing in a later one, and the render would then silently degrade to
	 * un-upgraded SSR markup (ADR 0027 sub-design 10's documented failure —
	 * it bit this very harness before the check existed).
	 */
	async load(importer: () => Promise<unknown>): Promise<void> {
		const before = this.definitions.length
		const realRegistry = this.handle.window
			.customElements as unknown as CustomElementRegistry
		const recording = {
			define: (
				name: string,
				elementConstructor: CustomElementConstructor,
				options?: ElementDefinitionOptions,
			) => {
				this.definitions.push({
					name,
					elementConstructor,
					...(options ? { options } : {}),
				})
			},
			get: (name: string) =>
				realRegistry.get(name) ??
				this.definitions.find(entry => entry.name === name)?.elementConstructor,
			getName: (elementConstructor: CustomElementConstructor) =>
				this.definitions.find(
					entry => entry.elementConstructor === elementConstructor,
				)?.name ?? null,
			whenDefined: (name: string) => realRegistry.whenDefined(name),
			upgrade: (node: Node) => realRegistry.upgrade(node),
		}
		const previous = Object.getOwnPropertyDescriptor(
			globalThis,
			'customElements',
		)
		Object.defineProperty(globalThis, 'customElements', {
			value: recording,
			writable: true,
			configurable: true,
		})
		try {
			await importer()
		} finally {
			if (previous)
				Object.defineProperty(globalThis, 'customElements', previous)
			else delete (globalThis as Record<string, unknown>).customElements
		}
		if (this.definitions.length === before)
			throw new Error(
				'load() recorded no element definitions — the imported module was ' +
					'served from the process module cache (one cache per process, ' +
					'ADR 0027 sub-design 10). Build a fresh bundle for each realm.',
			)
		this.#drainSubstrateConsole()
	}

	/** Synchronous window: parse, replay definitions, serialize. */
	render(markup: string, component: string): string {
		const realRegistry = this.handle.window
			.customElements as unknown as CustomElementRegistry
		this.#currentComponent = component
		try {
			this.document.body.innerHTML = markup
			for (const entry of this.definitions) {
				if (realRegistry.get(entry.name)) continue
				realRegistry.define(
					entry.name,
					entry.elementConstructor,
					entry.options as ElementDefinitionOptions,
				)
			}
			this.#drainSubstrateConsole()
			const rendered = this.document.querySelector(component)
			return rendered?.outerHTML ?? this.document.body.innerHTML
		} catch (error) {
			this.diagnostics.push(
				`[${component}] component-throw: ${String((error as Error)?.message ?? error)}`,
			)
			return markup
		} finally {
			this.#currentComponent = undefined
		}
	}

	/** Like `render`, but under the production boundary assertion. */
	renderSync(markup: string, component: string): string {
		return assertSynchronousWindow(
			() => this.render(markup, component),
			component,
		)
	}

	dispose(): void {
		this.#restore()
		this.handle.dispose()
	}
}

/* === Hermetic quiescence (amended sub-design 9) === */

export type QuiescenceResult = {
	/** The serialized HTML once the output stopped changing. */
	html: string
	/** Microtask turns elapsed until stability (≥ 1). */
	turns: number
	/** False when `maxTurns` expired with the output still changing. */
	quiescent: boolean
}

/**
 * Drain the realm's microtask queue to quiescence and read the settled
 * `outerHTML` — the harness counterpart of the boundary LT-154 will build:
 * microtask-only (jsdom timers never fire), bounded (a reactive loop
 * surfaces as a `non-quiescent` verdict, not a hang), and the settled
 * output is what the amended contract ships. The realm must stay alive
 * until this resolves — draining after `dispose()` tears the patch-table
 * globals out from under deferred effects.
 */
export const drainToQuiescence = async (
	realm: ProbeRealm,
	component: string,
	maxTurns = 10,
): Promise<QuiescenceResult> => {
	let previous = realm.document.querySelector(component)?.outerHTML ?? ''
	for (let turns = 1; turns <= maxTurns; turns++) {
		await Promise.resolve()
		const next = realm.document.querySelector(component)?.outerHTML ?? ''
		if (next === previous) return { html: next, turns, quiescent: true }
		previous = next
	}
	return { html: previous, turns: maxTurns, quiescent: false }
}
