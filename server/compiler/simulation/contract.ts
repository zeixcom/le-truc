/**
 * The simulation seam (ADR 0035 sub-designs 3 and 4, LT-263).
 *
 * This module is the whole of what the compiler knows about simulation. It
 * names the interface a substrate driver must satisfy and nothing else: no
 * `window`, no `Document`, no jsdom type, no import of `../sim/`. Markup and
 * a component tag go in; HTML and diagnostics come out.
 *
 * ## Why the seam is shaped as a package boundary
 *
 * ADR 0034 sub-design 5 makes jsdom an optional peer dependency and
 * absence a routing outcome rather than a build failure. That policy is
 * only implementable if the compiler can classify, report and TYPECHECK
 * with no substrate present — so the contract has to be a standalone
 * module the driver depends on, never the other way round. The driver is
 * reached through {@link ../simulation/resolve.ts}'s resolver, whose
 * specifier is opaque to the typechecker, so an opted-out consumer's
 * `tsc --noEmit` never follows the edge into jsdom.
 *
 * ADR 0035 sub-design 4 keeps the driver inside `@zeix/le-truc-compiler`
 * for 3.0 and defers the `@zeix/le-truc-simulation` split to a later 3.x.
 * The split is then a resolver-specifier change and a `package.json` entry —
 * not a breaking change to this interface, which is the entire reason the
 * seam is versioned now rather than retrofitted later.
 *
 * ## Versioning
 *
 * {@link SIMULATION_SEAM_VERSION} is the compiler's half of the handshake.
 * A driver publishes its own `seamVersion`; the resolver refuses a
 * mismatch rather than calling into an interface it cannot vouch for.
 * Bump it when a member is removed or its meaning changes — additive
 * optional members do not need a bump.
 */

/* === Version === */

/**
 * The seam revision this compiler speaks. Bumped on a breaking change to
 * anything in this file; see the module header for what counts.
 */
export const SIMULATION_SEAM_VERSION = 1

/* === Diagnostics === */

/**
 * The five conditions a driver reports, plus the drain overrun. None is
 * statically decidable — that is why they are build-report entries rather
 * than compile diagnostics (ADR 0028 tier 2, `../build-report.ts`).
 */
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

/**
 * A standing diagnostic the build has classified as unable to affect the
 * serialized markup — recorded, not silenced: every occurrence stays listed
 * with its `reason` in the report.
 *
 * The TYPE crosses the seam; the REGISTRY of entries does not. Which
 * notices a substrate emits is a fact about that substrate (jsdom's
 * unimplemented canvas is not linkedom's), so the entries ship with the
 * driver and reach the report channel through
 * {@link SimulationProvider.classifications}.
 */
export type ClassifiedDiagnostic = {
	kind: SimDiagnosticKind
	/** Restrict the classification to one component; undefined matches any. */
	component?: string
	/**
	 * The message must match this pattern. The specificity is the point: a
	 * classification admits exactly the diagnostic it was written for, so a
	 * message change re-opens the question instead of slipping through.
	 */
	message: RegExp
	/** Why this diagnostic cannot affect the serialized markup. */
	reason: string
}

/* === Suppression === */

/**
 * The {@link SuppressedSite} selector that addresses the component's own
 * root element — the ambient `host`, the same sentinel the effect plans use
 * for root-exempt constructs (`query: 'host'`). The driver resolves it
 * against the rendered root, not against the document at large.
 */
export const SUPPRESSED_HOST_SELECTOR = 'host'

/**
 * One unresolvable expression's target site, recorded at compile time for
 * the simulation driver (ADR 0029 sub-design 1's implementation constraint,
 * LT-165 step 7).
 *
 * The generated client module is the shipped artifact and the driver replays
 * it, so the driver cannot decline to install a binding whose thunk reads the
 * wall clock or the RNG — its connect-time write would bake the build
 * machine's reading into the serialized HTML permanently. Instead the driver
 * snapshots each recorded site's server-rendered state before the upgrade
 * and restores that state after the connect window stabilizes, so the site
 * ships in the omitted (skeleton) form sub-design 1 mandates and the client
 * answers at connect.
 *
 * Only limb (b) sites (`not-a-server-fact`) are recorded. Limb (a)
 * (stubbed-API) sites keep ADR 0027 sub-design 6's unamended remainder —
 * the driver's stub answer (silent zero, never-matching media list), which
 * the client corrects at connect — and that answer is deterministic inside
 * the realm, so the fixed-point gate is not threatened by it.
 *
 * Lives here rather than in `../tier.ts` because it crosses the seam: the
 * compiler writes these records and the driver reads them, which is exactly
 * the set of types a package boundary has to own.
 */
export type SuppressedSite =
	| {
			kind: 'attr'
			/** CSS selector for the element, or {@link SUPPRESSED_HOST_SELECTOR}. */
			selector: string
			/** The content attribute the binding writes. */
			attr: string
			/**
			 * The IDL property the binding writes instead of the attribute
			 * (dirty-flag dispatch, LT-116). The revert must restore the
			 * property too: once the control is dirty, the stale reading
			 * survives `removeAttribute`.
			 */
			prop?: string
	  }
	| {
			kind: 'text'
			/** CSS selector for the element, or {@link SUPPRESSED_HOST_SELECTOR}. */
			selector: string
	  }

/* === The realm interface === */

/** The server runtimes a driver must run under. */
export type SimRuntime = 'bun' | 'node' | 'deno' | 'unknown'

/** One render: strings in, strings out. */
export type SimRenderRequest = {
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
	/** Bound on the quiescence drain; a driver default applies when omitted. */
	maxTurns?: number
}

/**
 * What one render answers. `diagnostics` is this render's own window —
 * the cumulative list stays on {@link SimulationRealm.diagnostics}, because
 * the process-level channels report late (an `unhandledRejection` fires in
 * a macrotask after `render()` has returned) and the build gate reads the
 * whole build, not one call.
 */
export type SimRenderResult = {
	html: string
	diagnostics: readonly SimDiagnostic[]
}

export type SimulationRealmOptions = {
	/** The shell document as markup; a driver default applies when omitted. */
	html?: string
	/**
	 * Direct composed-child tags for a defined tag, from the compiler's
	 * compose graph (`RegistryEntry.composesTags`). Defaults to "no known
	 * children".
	 */
	composesTags?: (tag: string) => readonly string[]
	/**
	 * Suppression records per component tag (ADR 0029 sub-design 1,
	 * LT-165 step 7), from the same registry entry the compile wrote.
	 * Defaults to "no records". Consulted once per render, for the
	 * rendered tag.
	 */
	suppressedSites?: (tag: string) => readonly SuppressedSite[]
}

/**
 * The DOM-free realm handle (ADR 0035 sub-design 3, limb 3).
 *
 * Every member here is a string, a string union or a plain record. A driver
 * may return a WIDER handle for its own tests and probes — the jsdom driver
 * does, exposing `window`/`document` — but nothing on the compiler side may
 * read past this interface, or the seam is not a seam.
 */
export type SimulationRealm = {
	readonly runtime: SimRuntime
	/** Every diagnostic recorded since the realm opened. */
	readonly diagnostics: readonly SimDiagnostic[]
	/** Tags whose client module has been loaded, in load order. */
	readonly loadedTags: readonly string[]
	/**
	 * Resolution phase: import client modules, recording their definitions.
	 * Throws if the import records no NEW definitions (ADR 0027 sub-design
	 * 10's load-once assertion).
	 */
	load(importer: () => Promise<unknown>): Promise<void>
	/**
	 * Parse, upgrade, drain to quiescence, serialize. The parse+upgrade step
	 * is asserted synchronous; the quiescence drain after it is not, so this
	 * is async end to end.
	 */
	render(request: SimRenderRequest): Promise<SimRenderResult>
	/**
	 * End-of-process, never between renders (ADR 0027 sub-design 2, LT-154):
	 * a disposed realm's deleted globals turn a contained component's
	 * lingering dependency-wait into a process-aborting flood.
	 */
	dispose(): void
}

/**
 * What a substrate package exports. The resolver checks `seamVersion`
 * before handing this to the build.
 */
export type SimulationProvider = {
	/** The driver's half of the {@link SIMULATION_SEAM_VERSION} handshake. */
	readonly seamVersion: number
	/** Human name for the substrate, for the build log and census reasons. */
	readonly substrate: string
	/** The standing diagnostics this substrate is known to emit. */
	readonly classifications: readonly ClassifiedDiagnostic[]
	createSimulationRealm(options?: SimulationRealmOptions): SimulationRealm
}
