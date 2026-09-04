/**
 * Component registry (ADR 0023 milestone 1).
 *
 * One entry per compiled component: where its artifacts live and which
 * types it exports. Three consumers:
 * - the client analyzer — registry-aware attribute dispatch (a reactive
 *   attribute on a registry tag lowers to `pass()`, any other dashed tag
 *   to `bindProperty()`; AGENTS.md's own rule, encoded — the compiler has
 *   registry knowledge hand-written code lacks);
 * - `pass={{ }}` legality (LT-158) — a binding's target is decided against
 *   the TARGET component's own `expose()`, recorded here as `exposedProps`;
 * - the future docs/examples migration, which resolves tags to render
 *   functions and stylesheets through this file.
 */

import type { ExposeKind } from './ir'
import type { EvaluationTier, RoutingSignal } from './tier'

/* === Types === */

export type RegistryEntry = {
	/** Custom element tag (`basic-counter`). */
	tag: string
	/** Component function name (`BasicCounter`). */
	name: string
	/** Path of the .tsrx source, relative to the repo root. */
	source: string
	/** Generated artifacts, relative to the registry file. */
	serverModule: string
	clientModule: string
	css: string
	/** Exported `<Name>Props` type, when authored. */
	propsType: string | null
	/**
	 * Every `expose()` key, mapped to how its initializer lands on the host
	 * (LT-158, [ADR 0028](../../adr/0028-tiered-error-surfacing.md)
	 * sub-design 6).
	 *
	 * `propsType` records only the exported type's NAME, which says nothing
	 * about writability — and writability is the whole question a
	 * `pass={{ }}` has to answer, because `pass()` swaps the target's
	 * backing SIGNAL and only a Slot-backed prop has one
	 * ([ADR 0004](../../adr/0004-slot-based-signal-swapping-for-inter-component-binding.md)).
	 * TypeScript accepts a read-only prop structurally, so without this the
	 * only channel left was the runtime throw — which since LT-155 is
	 * contained, and would have left the author with a console line instead
	 * of a build failure.
	 *
	 * A third consumer of the registry, alongside the two above: the client
	 * analyzer reads the TARGET component's entry when it lowers a
	 * `pass={{ }}` on that component's tag.
	 */
	exposedProps: Record<string, ExposeKind>
	/**
	 * Tags of every DIRECTLY composed (PascalCase) child, deduplicated.
	 * Corpus-wide (composeRegistry-resolved) so it is empty during the
	 * registry-discovery pass, same tolerance as `pass()` dispatch.
	 *
	 * The server-simulation driver (ADR 0027, LT-154) needs this to replay
	 * `customElements.define()` calls children-first: a composed child that
	 * a component's own client module never imports (pure server-splice
	 * composition, no `pass()`/`first()` binding) still needs its tag
	 * defined before its composing ancestor's for jsdom upgrade order —
	 * and nothing in an import graph encodes that relationship, so the
	 * compiler has to hand it down explicitly.
	 */
	composesTags: string[]
	/**
	 * Which server-evaluation mechanism renders this component's initial
	 * HTML (ADR 0029, LT-165), and why it was routed there.
	 *
	 * Recorded here rather than kept inside the compiler because the tier is
	 * product surface, not an implementation detail: it decides build cost,
	 * it feeds the build report's tier census, and a component drifting from
	 * the Folded tier to the Simulated tier is a cost regression worth
	 * seeing. `emit-server.ts` also reads it — a Simulated-tier or
	 * Static-tier module does not re-declare `@{ }` setup verbatim.
	 *
	 * The value written by the FIRST pass is pre-contamination. The
	 * registry-aware second pass applies ADR 0029 sub-design 3's compose-read
	 * fixpoint, which can only move a component downward, towards the
	 * Simulated tier.
	 */
	tier: EvaluationTier
	/** Why this component is not Folded-tier; empty for the Folded tier. */
	routingSignals: RoutingSignal[]
	/**
	 * Composed children this component READS — the contamination edges of
	 * ADR 0029 sub-design 3, and a strict subset of `composesTags`.
	 * Containment alone does not contaminate; only a `first()` on the
	 * compose site or a `truc:pass={{ }}` into it does.
	 */
	composeReadTags: string[]
}

export type ComponentRegistry = Record<string, RegistryEntry>

/* === Exported Functions === */

export const registryJson = (entries: RegistryEntry[]): string =>
	`${JSON.stringify(Object.fromEntries(entries.map(e => [e.tag, e])), null, '\t')}\n`
