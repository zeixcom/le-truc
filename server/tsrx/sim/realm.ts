/**
 * The simulation realm (ADR 0027 sub-design 2, LT-151; amended by LT-154,
 * 2026-09-03 — see `boundary.ts`'s header for why).
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
 * Sub-design 9 requires the instantiate→parse step to be synchronous, so the
 * two are split:
 *
 * 1. `load()` — the resolution phase. Imports run with a RECORDING
 *    `customElements` in place, which captures `define()` calls instead of
 *    performing them. Awaiting here is legitimate (sub-design 9, "two phases,
 *    and only the second is synchronous"). One module cache per process means
 *    a component's client module registers its element exactly once — `load()`
 *    THROWS when an import records no new definitions, because a fresh realm
 *    re-importing an already-loaded bundle silently degrades to un-upgraded
 *    SSR markup (sub-design 10) rather than erroring. **Load each component
 *    once; render it many times.**
 * 2. `render()` — parses the SSR'd markup into the document while the
 *    elements are still undefined (the pre-parsed upgrade path sub-design 2
 *    depends on), replays the recorded definitions onto the real registry
 *    CHILDREN-FIRST (`childrenFirstOrder`, keyed off the compiler's compose
 *    graph — `define()` call order decides upgrade order, not import order
 *    or recording order) so the upgrade runs, then drains the realm's
 *    microtask queue to quiescence (`drainToQuiescence`) and serializes.
 *    Async, because draining is: the parse+upgrade step itself is still
 *    asserted synchronous (`assertSynchronousWindow`), only the quiescence
 *    wait after it is not.
 *
 * ## Disposal
 *
 * End-of-process, not per-realm (LT-152 review, LT-154). A disposed realm's
 * deleted globals turn a contained component's lingering dependency-wait
 * into a synchronous `customElements is not defined` flood that aborts the
 * process — so `dispose()` must be called at most once, after every render
 * the realm will ever do, never between them. One realm per build.
 *
 * ## Diagnostics
 *
 * jsdom's `virtualConsole` is the diagnostic channel (ADR 0027 Consequences).
 * `jsdomError`s, realm console errors/warnings, attempted network calls,
 * contained per-component throws and non-quiescent drains all land in
 * `diagnostics`; `report.ts` turns them into the build report (LT-163) —
 * per-kind copy, the classification registry for standing entries, and the
 * zero-unclassified baseline.
 *
 * ## Attribution
 *
 * A diagnostic is attributed to `currentComponent` — the component whose
 * synchronous window most recently opened. The marker is set when a render
 * opens its window and is overwritten by the NEXT render; it is deliberately
 * never reset in between, because the process-level channels report late:
 * under Bun (and Node), an `unhandledRejection` fires in a macrotask AFTER
 * `render()` has returned, and post-drain the realm's queue is quiescent —
 * so a late rejection traces to the most recent connect, and clearing the
 * marker would strip the warning of the component it belongs to. `load()`
 * performs no connect, so an error during module evaluation attributes to
 * whatever component rendered last.
 *
 * Note the scope of the rejection handler: registering `process.on(
 * 'unhandledRejection')` suppresses the runtime's default crash-on-unhandled-
 * rejection for the WHOLE process, for the realm's lifetime — not just
 * rejections from inside the realm. That is the containment trade (tier 2):
 * an unhandled rejection during a build becomes a diagnostic here instead of
 * a dead build, and the build report is the only place it surfaces.
 *
 * ## Render memoization (LT-166)
 *
 * `render()` memoizes on `(component, locale, markup)` — the driver-side
 * surrogate
 * for the build's `(component, serialized args)` key: identical args render
 * to identical markup through the pure server render functions, and the
 * markup is what the simulation actually consumes. The page locale joins the
 * key because it is seeded onto `<html lang>` and so is an input to the
 * render, not a property of the markup (LT-172). A hit returns the first
 * pass's bytes without reopening a connect window, so a repeated occurrence
 * reports only the FIRST occurrence's diagnostics, and a time-dependent
 * render (sub-design 6 lets `Date.now()` through) stabilizes on the first
 * observed value — which is what a deterministic build wants. Only a
 * completed connect memoizes: a degraded (contained throw) or non-quiescent
 * render re-runs every time, so its diagnostic keeps firing per occurrence.
 * The map dies with the realm and is bounded by unique
 * `(component, locale, markup)` triples — 216 signatures across the built
 * docs' 3,330
 * occurrences, per LT-152's measurement.
 */

import { JSDOM, VirtualConsole } from 'jsdom'
import { assertSynchronousWindow, drainToQuiescence } from './boundary.ts'
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
	| 'non-quiescent'

/** One build warning from a simulated run, attributed where possible. */
export type SimDiagnostic = {
	kind: SimDiagnosticKind
	/** Custom element name, when the driver knows which component caused it. */
	component?: string
	/**
	 * For `console`: which channel logged. The level is part of the condition
	 * (`console.error` and `console.warn` mean different things), so it is
	 * data, not message text.
	 */
	level?: 'error' | 'warn'
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
	/**
	 * BCP 47 tag for the page this occurrence is being built into (LT-172,
	 * ADR 0030 sub-design 7). Seeds the simulated document's `<html lang>` so
	 * `getLocale()`'s `closest('[lang]')` walk resolves the page's locale
	 * instead of the `'en'` fallback. Omitted means "no page locale known",
	 * which clears the attribute — a previous render's locale never leaks
	 * into the next one.
	 */
	locale?: string
	/** Bound passed through to `drainToQuiescence`; defaults to 10 turns. */
	maxTurns?: number
}

export type SimulationRealm = {
	readonly runtime: SimRuntime
	readonly window: JSDOM['window']
	readonly document: Document
	readonly diagnostics: readonly SimDiagnostic[]
	readonly definitions: readonly RecordedDefinition[]
	/**
	 * Resolution phase: import client modules, recording their definitions.
	 * Throws if the import records no NEW definitions (sub-design 10's
	 * load-once assertion) — see module header.
	 */
	load(importer: () => Promise<unknown>): Promise<void>
	/**
	 * Parse, upgrade, drain to quiescence, serialize. The parse+upgrade step
	 * is asserted synchronous; the quiescence drain after it is not, so this
	 * is async end to end.
	 */
	render(options: RenderOptions): Promise<string>
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

/**
 * Order `definitions` so every entry's composed children (per
 * `composesTags`) come before it — a DFS post-order topological sort,
 * stable on the input order for unrelated entries.
 *
 * `define()` call order decides jsdom upgrade order (LT-154's correction to
 * sub-design 2's "native bottom-up" claim): a composed child that its
 * parent's client module never imports (pure server-splice composition, no
 * `pass()`/`first()` binding) has no import-graph relationship to its
 * parent, so nothing about import/recording order guarantees it is defined
 * first. The compose graph is the only source of truth for that
 * relationship, hence `composesTags` is threaded in rather than inferred.
 */
export function childrenFirstOrder(
	definitions: readonly RecordedDefinition[],
	composesTags: (tag: string) => readonly string[],
): RecordedDefinition[] {
	const byName = new Map(definitions.map(entry => [entry.name, entry]))
	const visited = new Set<string>()
	const ordered: RecordedDefinition[] = []
	const visit = (name: string): void => {
		if (visited.has(name)) return
		visited.add(name)
		for (const child of composesTags(name)) visit(child)
		const entry = byName.get(name)
		if (entry) ordered.push(entry)
	}
	for (const entry of definitions) visit(entry.name)
	return ordered
}

/* === Exported Functions === */

/**
 * Build a simulation realm with the patch table applied to `globalThis`.
 *
 * The patches are process-global for the realm's lifetime, so a realm owns the
 * process while it lives — `dispose()` restores every touched global to the
 * descriptor it found. One realm per build (ADR 0027 sub-design 2), disposed
 * only at end-of-process (LT-154; see module header).
 *
 * @param options.html - the shell document; defaults to an empty body
 * @param options.composesTags - direct composed-child tags for a defined
 *   tag, from the compiler's compose graph (`RegistryEntry.composesTags`).
 *   Defaults to "no known children" — correct for the driver's own inline
 *   test fixtures, which have no composition.
 * @returns the realm handle
 */
export function createSimulationRealm(
	options: {
		html?: string
		composesTags?: (tag: string) => readonly string[]
	} = {},
): SimulationRealm {
	const composesTags = options.composesTags ?? (() => [])
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
			report({ kind: 'console', level, message: args.map(String).join(' ') })
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
			`network access from a simulated connect (\`${patch.name}()\`) — the ` +
			'build realm is closed (ADR 0027 sub-design 2d). Declare build-time ' +
			'data as a resolution-phase dependency instead.'
		// Never settles (amended sub-design 2d, LT-154): a rejection would route
		// every fetching component to `@catch` under the quiescence drain, but
		// the build cannot know the request failed — it never ran. A promise
		// that never settles keeps the component's task at `nil`, which SSG
		// requires (CHECKLIST §8/§9) and `match()` renders as `@pending`.
		// Reported at CALL time, so "fails loudly" is unaffected either way.
		const deny = () => {
			report({ kind: 'network', message })
			return new Promise<never>(() => {})
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

	// Render memoization (LT-166): see the module header's section. Keyed on
	// (component, locale, markup); only quiescent, non-degraded connects are
	// stored.
	const renderCache = new Map<string, string>()

	const load = async (importer: () => Promise<unknown>) => {
		const before = definitions.length
		force('customElements', recordingRegistry)
		try {
			await importer()
		} finally {
			force('customElements', realRegistry)
		}
		// Load-once is a driver assertion, not a convention (LT-152 review,
		// LT-154): one module cache per process means a bundle imported by an
		// EARLIER realm/load re-evaluates nothing here, and rendering would
		// then silently degrade to un-upgraded SSR markup — invisible in the
		// output, because it looks like ordinary un-upgraded markup.
		if (definitions.length === before)
			throw new Error(
				'load() recorded no element definitions — the imported module was ' +
					'served from the process module cache (one cache per process, ' +
					'ADR 0027 sub-design 10). Load each component exactly once and ' +
					'render it many times.',
			)
	}

	const render = async ({
		markup,
		component,
		locale,
		maxTurns,
	}: RenderOptions): Promise<string> => {
		// The locale is part of the render signature, not incidental to it: the
		// same markup on a `de` page and an `en` page are different renders
		// once a component reads `getLocale(host)` (LT-172).
		const cacheKey = `${component}\u0000${locale ?? ''}\u0000${markup}`
		const cached = renderCache.get(cacheKey)
		if (cached !== undefined) return cached
		let degraded = false
		const parsed = assertSynchronousWindow(() => {
			currentComponent = component
			try {
				// Seed the page locale onto `<html>` BEFORE the markup parses, so
				// a component reading `getLocale(host)` at connect sees the page's
				// answer rather than the `'en'` fallback (ADR 0030 sub-design 7).
				// This only narrows the gap — the realm parses one component's
				// markup, so an ancestor `[lang]` BELOW `<html>` stays invisible;
				// the reserved `i18n` parameter is the canonical route.
				if (locale === undefined)
					document.documentElement.removeAttribute('lang')
				else document.documentElement.setAttribute('lang', locale)
				// Parsed while still undefined: the pre-parsed upgrade path, which
				// is what gives `connectedCallback` its child-before-parent order.
				document.body.innerHTML = markup
				// Children-first (LT-154): define() call order decides jsdom
				// upgrade order, and the compose graph — not recording order —
				// is the only source of truth for which tags contain which.
				for (const entry of childrenFirstOrder(definitions, composesTags)) {
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
				degraded = true
				return markup
			}
			const rendered = document.querySelector(component)
			return rendered?.outerHTML ?? document.body.innerHTML
		}, component)

		// Hermetic quiescence (sub-design 9, amended): drain the microtask
		// queue — never a timer — until the component's own markup stops
		// changing, or the bound expires. Skipped when the parse step already
		// degraded to plain SSR output (nothing upgraded, nothing to settle).
		if (degraded) return parsed
		const { value, quiescent, turns } = await drainToQuiescence(
			() => document.querySelector(component)?.outerHTML ?? parsed,
			maxTurns,
		)
		// Only a completed connect memoizes — a non-quiescent one re-runs per
		// occurrence so its diagnostic keeps firing (LT-166).
		if (quiescent) renderCache.set(cacheKey, value)
		if (!quiescent)
			report({
				kind: 'non-quiescent',
				component,
				message:
					`did not settle within ${turns} microtask turns — a reactive ` +
					'effect is re-triggering itself at connect (ADR 0027 sub-design ' +
					'9). The build shipped the last observed state rather than hang. ' +
					'Find the self-triggering effect before relying on this markup.',
			})
		return value
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
		dispose,
	}
}
