/**
 * The simulation realm (ADR 0027 sub-design 2, LT-151).
 *
 * Applies `patch-table.ts` to `globalThis` for the duration of a simulated
 * connect, so a generated client module — which reads `HTMLElement`,
 * `customElements` and `document` as free globals — resolves them to the jsdom
 * realm on Bun, Node and Deno alike. Everything runtime-specific lives in the
 * table; this module is the uniform applier.
 *
 * ## The two phases
 *
 * A generated client module registers its element as an import side effect
 * (`defineComponent()` at module top level), and importing is asynchronous.
 * Sub-design 9 requires the instantiate→serialize window to be synchronous, so
 * the two are split:
 *
 * 1. `load()` — the resolution phase. Imports run with a RECORDING
 *    `customElements` in place, which captures `define()` calls instead of
 *    performing them. Awaiting here is legitimate (sub-design 9, "two phases,
 *    and only the second is synchronous").
 * 2. `render()` — the synchronous window. Parses the SSR'd markup into the
 *    document while the elements are still undefined (the pre-parsed upgrade
 *    path sub-design 2 depends on), replays the recorded definitions onto the
 *    real registry so the upgrade runs, and serializes — all under
 *    `runSynchronously()`, which fails the build if anything awaited.
 *
 * ## Diagnostics
 *
 * jsdom's `virtualConsole` is the diagnostic channel (ADR 0027 Consequences).
 * `jsdomError`s, realm console errors/warnings, attempted network calls and
 * contained per-component throws all land in `diagnostics` as build warnings
 * attributed to a component where one is known.
 */

import { JSDOM, VirtualConsole } from 'jsdom'
import { runSynchronously } from './boundary.ts'
import {
	detectRuntime,
	NETWORK_GLOBALS,
	type NetworkGlobalPatch,
	PROTOTYPE_PATCHES,
	patchesFor,
	REALM_GLOBALS,
	type SimRuntime,
	STUB_GLOBALS,
	type StubShape,
} from './patch-table.ts'

/* === Types === */

export type SimDiagnosticKind =
	| 'jsdom-error'
	| 'console'
	| 'network'
	| 'unhandled-rejection'
	| 'component-throw'
	| 'deferred-activation'

/** One build warning from a simulated run, attributed where possible. */
export type SimDiagnostic = {
	kind: SimDiagnosticKind
	/** Custom element name, when the driver knows which component caused it. */
	component?: string
	message: string
	stack?: string
}

/** A `customElements.define()` call captured during the resolution phase. */
export type RecordedDefinition = {
	name: string
	elementConstructor: CustomElementConstructor
	options?: ElementDefinitionOptions
}

export type RenderOptions = {
	/** The SSR'd markup for one component, as `emit-server` produced it. */
	markup: string
	/** Custom element name, used to attribute diagnostics and pick the root. */
	component: string
}

export type SimulationRealm = {
	readonly runtime: SimRuntime
	readonly window: JSDOM['window']
	readonly document: Document
	readonly diagnostics: readonly SimDiagnostic[]
	readonly definitions: readonly RecordedDefinition[]
	/** Resolution phase: import client modules, recording their definitions. */
	load(importer: () => Promise<unknown>): Promise<void>
	/** Synchronous window: parse, upgrade, serialize. */
	render(options: RenderOptions): string
	/**
	 * Diagnostic-only: yield one turn and report whether the serialized HTML
	 * would have changed. Never affects the shipped HTML.
	 */
	checkDeferredActivation(component: string, rendered: string): Promise<void>
	dispose(): void
}

/* === Internal Functions === */

const asRecord = (value: object) => value as unknown as Record<string, unknown>

/** Resolve a possibly dotted patch name to its owner object and leaf key. */
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

const stubFor = (shape: StubShape): unknown => {
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
			// Returns a handle but never calls back: anything it would have
			// scheduled lands after the serialization boundary anyway.
			return () => 0
		case 'cancel':
		case 'noop':
			return () => {}
	}
}

/* === Exported Functions === */

/**
 * Build a simulation realm with the patch table applied to `globalThis`.
 *
 * The patches are process-global for the realm's lifetime, so a realm owns the
 * process while it lives — `dispose()` restores every touched global to the
 * descriptor it found. One realm per build (ADR 0027 sub-design 2), or one per
 * render where isolation matters more than cost (sub-design 10).
 *
 * @param options.html - the shell document; defaults to an empty body
 * @returns the realm handle
 */
export function createSimulationRealm(
	options: { html?: string } = {},
): SimulationRealm {
	const runtime = detectRuntime()
	const diagnostics: SimDiagnostic[] = []
	const definitions: RecordedDefinition[] = []
	/**
	 * The component whose synchronous window is open, so realm-level channels
	 * (jsdom errors, console, network) are attributed rather than anonymous.
	 */
	let currentComponent: string | undefined
	const report = (diagnostic: SimDiagnostic) => {
		diagnostics.push(
			diagnostic.component === undefined && currentComponent !== undefined
				? { ...diagnostic, component: currentComponent }
				: diagnostic,
		)
	}

	const virtualConsole = new VirtualConsole()
	virtualConsole.on('jsdomError', (error: Error) => {
		const cause = (error.cause as Error | undefined) ?? error
		report({
			kind: 'jsdom-error',
			message: String(cause?.message ?? cause),
			...(cause?.stack === undefined ? {} : { stack: cause.stack }),
		})
	})
	for (const level of ['error', 'warn'] as const)
		virtualConsole.on(level, (...args: unknown[]) => {
			report({ kind: 'console', message: args.map(String).join(' ') })
		})

	const dom = new JSDOM(
		options.html ?? '<!DOCTYPE html><html><body></body></html>',
		{ virtualConsole, pretendToBeVisual: false },
	)
	const { window } = dom
	const document = window.document as unknown as Document
	const realRegistry = window.customElements as unknown as CustomElementRegistry

	// --- Apply the patch table -------------------------------------------

	const root = globalThis as unknown as Record<string, unknown>
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
			// Deno marks a few globals non-configurable; skip rather than abort,
			// and let the probe's cross-runtime diff surface any consequence.
			report({
				kind: 'console',
				message: `Could not patch global '${name}' under ${runtime}`,
			})
			return
		}
		restores.push(() => {
			if (previous) Object.defineProperty(owner, key, previous)
			else delete owner[key]
		})
	}

	const windowRecord = asRecord(window as unknown as object)
	for (const patch of patchesFor(REALM_GLOBALS, runtime)) {
		const value = windowRecord[patch.from ?? patch.name]
		if (value === undefined) continue
		// Constructors go across verbatim — a bound copy breaks both `instanceof`
		// and `class X extends HTMLElement`. Free functions (`getComputedStyle`)
		// need their receiver.
		const isConstructor =
			typeof value === 'function' && /^[A-Z]/.test(patch.name)
		force(
			patch.name,
			typeof value === 'function' && !isConstructor
				? value.bind(window)
				: value,
		)
	}

	for (const patch of patchesFor(STUB_GLOBALS, runtime)) {
		const present =
			windowRecord[patch.name] !== undefined || root[patch.name] !== undefined
		if (present && !patch.force) continue
		force(patch.name, stubFor(patch.shape))
	}

	const denyNetwork = (patch: NetworkGlobalPatch) => {
		const message =
			`Network access from a simulated connect: ${patch.name}() — the ` +
			'build realm is closed (ADR 0027 sub-design 2d). Declare build-time ' +
			'data as a resolution-phase dependency instead.'
		const deny = () => {
			report({ kind: 'network', message })
			const rejection = Promise.reject(new Error(message))
			// Reported at CALL time above, so silence the runtime's own
			// unhandled-rejection channel: the caller still sees the rejection,
			// but a component that ignores its own promise must not abort a build
			// that has already recorded the violation.
			rejection.catch(() => {})
			return rejection
		}
		return patch.form === 'function'
			? deny
			: class {
					constructor() {
						report({ kind: 'network', message })
						throw new Error(message)
					}
				}
	}
	for (const patch of patchesFor(NETWORK_GLOBALS, runtime)) {
		force(patch.name, denyNetwork(patch))
		const inRealm = resolveTarget(windowRecord, patch.name)
		if (inRealm && inRealm.key in inRealm.owner) {
			const previous = Object.getOwnPropertyDescriptor(
				inRealm.owner,
				inRealm.key,
			)
			try {
				Object.defineProperty(inRealm.owner, inRealm.key, {
					value: denyNetwork(patch),
					writable: true,
					configurable: true,
				})
				restores.push(() => {
					if (previous)
						Object.defineProperty(inRealm.owner, inRealm.key, previous)
				})
			} catch {
				/* realm-side copy is best effort; the global is the load-bearing one */
			}
		}
	}

	for (const patch of PROTOTYPE_PATCHES) {
		const owner = windowRecord[patch.owner] as
			| { prototype: Record<string, unknown> }
			| undefined
		if (!owner?.prototype) continue
		const previous = Object.getOwnPropertyDescriptor(
			owner.prototype,
			patch.method,
		)
		Object.defineProperty(owner.prototype, patch.method, {
			value: function patched() {
				throw new Error(patch.message)
			},
			writable: true,
			configurable: true,
		})
		restores.push(() => {
			if (previous)
				Object.defineProperty(owner.prototype, patch.method, previous)
			else delete owner.prototype[patch.method]
		})
	}

	const onRejection = (reason: unknown) => {
		report({
			kind: 'unhandled-rejection',
			message: String((reason as { message?: string })?.message ?? reason),
		})
	}
	type ProcessLike = {
		on?: (event: string, handler: (reason: unknown) => void) => void
		off?: (event: string, handler: (reason: unknown) => void) => void
	}
	const processLike = root.process as ProcessLike | undefined
	processLike?.on?.('unhandledRejection', onRejection)

	// --- Phases -----------------------------------------------------------

	const recordingRegistry = {
		define(
			name: string,
			elementConstructor: CustomElementConstructor,
			elementOptions?: ElementDefinitionOptions,
		) {
			definitions.push({
				name,
				elementConstructor,
				...(elementOptions === undefined ? {} : { options: elementOptions }),
			})
		},
		get(name: string) {
			return (
				realRegistry.get(name) ??
				definitions.find(entry => entry.name === name)?.elementConstructor
			)
		},
		getName(elementConstructor: CustomElementConstructor) {
			return (
				definitions.find(
					entry => entry.elementConstructor === elementConstructor,
				)?.name ?? null
			)
		},
		whenDefined: (name: string) => realRegistry.whenDefined(name),
		upgrade: (node: Node) => realRegistry.upgrade(node),
	}

	const load = async (importer: () => Promise<unknown>) => {
		force('customElements', recordingRegistry)
		try {
			await importer()
		} finally {
			force('customElements', realRegistry)
		}
	}

	const render = ({ markup, component }: RenderOptions): string =>
		runSynchronously(() => {
			currentComponent = component
			try {
				// Parsed while still undefined: the pre-parsed upgrade path, which
				// is what gives `connectedCallback` its child-before-parent order.
				document.body.innerHTML = markup
				for (const entry of definitions) {
					if (realRegistry.get(entry.name)) continue
					realRegistry.define(
						entry.name,
						entry.elementConstructor,
						entry.options as ElementDefinitionOptions,
					)
				}
			} catch (error) {
				// Sub-design 2c: a throwing component degrades to plain SSR output
				// and never blocks the build.
				report({
					kind: 'component-throw',
					component,
					message: String((error as Error)?.message ?? error),
					...((error as Error)?.stack === undefined
						? {}
						: { stack: (error as Error).stack as string }),
				})
				return markup
			}
			const rendered = document.querySelector(component)
			return rendered?.outerHTML ?? document.body.innerHTML
		}, component)

	const checkDeferredActivation = async (
		component: string,
		rendered: string,
	) => {
		await Promise.resolve()
		const settled = document.querySelector(component)?.outerHTML
		if (settled !== undefined && settled !== rendered)
			report({
				kind: 'deferred-activation',
				component,
				message:
					`${component} kept mutating after the serialization boundary: ` +
					`${rendered.length} chars serialized, ${settled.length} after one ` +
					'turn. The library defers effect activation by a microtask whenever ' +
					'a component queries a custom child (`resolveDependencies`, ' +
					'`src/helpers/dom.ts`), and those writes cannot reach the served ' +
					'HTML under sub-design 9.',
			})
	}

	const dispose = () => {
		processLike?.off?.('unhandledRejection', onRejection)
		for (const restore of restores.reverse()) restore()
		window.close()
	}

	return {
		runtime,
		window,
		document,
		diagnostics,
		definitions,
		load,
		render,
		checkDeferredActivation,
		dispose,
	}
}
