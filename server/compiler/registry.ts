/**
 * Component registry (ADR 0024 milestone 1).
 *
 * One entry per compiled component: where its artifacts live and which types
 * it exports. Written as `registry.json` into the configured output root, and
 * scoped to ONE PROJECT'S corpus — every component the configured source
 * globs select, wherever that project keeps them (LT-255,
 * `corpus-config.ts`). The tag is the key, which is why two sources anywhere
 * in a project declaring the same tag fail the compile naming both (LTC048)
 * rather than letting compile order decide — a folder-local variant set
 * (ADR 0039) excepted: its members compile, and only the selected surface's
 * entry, naming that member's source, reaches this registry.
 *
 * Three consumers:
 * - the client analyzer — registry-aware attribute dispatch (a reactive
 *   attribute on a registry tag lowers to `pass()`, any other dashed tag
 *   to `bindProperty()`; AGENTS.md's own rule, encoded — the compiler has
 *   registry knowledge hand-written code lacks);
 * - `pass={{ }}` legality (LT-158) — a binding's target is decided against
 *   the TARGET component's own `expose()`, recorded here as `exposedProps`;
 * - the future docs/examples migration, which resolves tags to render
 *   functions and stylesheets through this file.
 */

import type { ChildrenRegion } from './children-region'
import type { ExposeKind, RenderedShape } from './ir'
import type { SuppressedSite } from './simulation/contract.ts'
import type { EvaluationTier, RoutingSignal } from './tier'

/* === Types === */

export type RegistryEntry = {
	/** Custom element tag (`basic-counter`). */
	tag: string
	/** Component function name (`BasicCounter`). */
	name: string
	/** Path of the authored source, relative to the PROJECT root. */
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
	 * Every element this component's template can render (LT-096), for the
	 * PARENT's selector engine: a composing parent's synthesized `first()`
	 * query runs over the whole subtree, the child's markup included, so a
	 * candidate that one of these shapes could match is not unique. Composed
	 * grandchildren appear as `compose` shapes and are resolved through the
	 * registry, so the list is complete from the discovery pass on. Optional
	 * for hand-built entries; an entry without it constrains nothing.
	 */
	renderedShapes?: RenderedShape[]
	/**
	 * What this component renders inside its Children Region besides the
	 * content a composing parent passes (ADR 0048 s1). Present exactly when
	 * the template inserts `{children}`: a parent's compose site then passes
	 * its own tag as the region owner, and the parent's selector engine
	 * proves a reference into its content against these shapes.
	 */
	childrenRegion?: ChildrenRegion
	/**
	 * Whether the component's own template renders interactive content (ADR
	 * 0048 s4, LT-477): an `a[href]`, `button`, `input` (except
	 * `type="hidden"`), `select`, `textarea`, `label`, `details`, `iframe`,
	 * any `[tabindex]`, or `audio`/`video` with `controls` — transitively
	 * through its own composed children, which the registry-aware pass
	 * closes over the entries' `renderedShapes` the way
	 * `composedShapesFor` does. Direction matters (ADR 0048 s1): markup the
	 * component passes at its own compose sites is its own markup and
	 * counts toward the flag; content a parent passes TO it is the parent's,
	 * never part of its template, and never counts. The consumer of the
	 * flag is a composing parent: a compose site of a child that declares
	 * `'non-interactive'` refuses literal interactive content and a
	 * composed child this flag is set through (LTC085,
	 * `analysis/content-model.ts`). The discovery pass knows no composed
	 * child, so its entries carry the direct half only; the entry that
	 * reaches `registry.json` is the registry-aware one.
	 */
	interactive: boolean
	/**
	 * The declared content model of the `children` arg's `Children<Roles,
	 * Model>` annotation (ADR 0048 s4, LT-477): `'any'` when the second
	 * type argument is absent (the default), `'non-interactive'` when
	 * declared, `null` when a model argument is present that the compiler
	 * cannot read (tsc owns it — the union constraint rejects anything
	 * else at authored typecheck). Present exactly when the annotation
	 * exists. A composing parent reads it at the compose site: `'non-interactive'`
	 * turns LTC085 on there.
	 */
	childrenModel?: 'any' | 'non-interactive' | null
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
	 * Reactive sites whose expression no server phase can answer (ADR 0029
	 * sub-design 1 limb b, LT-165 step 7), so the simulation driver can
	 * revert each one to its server-rendered skeleton state after the
	 * connect window stabilizes. Recorded per EXPRESSION, not per tier —
	 * unresolvability is a property of an expression — and keyed here
	 * because the driver already reads this registry for `composesTags`; it
	 * must not re-derive the list by re-analyzing source. Inert for Folded-
	 * and Static-tier components, for which no realm ever opens.
	 */
	suppressedSites: SuppressedSite[]
	/**
	 * Composed children this component READS — the contamination edges of
	 * ADR 0029 sub-design 3, and a strict subset of `composesTags`.
	 * Containment alone does not contaminate; only a `first()` on the
	 * compose site or a `truc:pass={{ }}` into it does.
	 */
	composeReadTags: string[]
	/**
	 * Whether the component declares the reserved `i18n` parameter (ADR
	 * 0030 sub-design 2, LT-173). A parent's generated server module reads
	 * this off the child's entry at a compose site to supply the record the
	 * child never receives from its caller — and to know that a caller
	 * cannot have authored it either.
	 */
	declaresI18n: boolean
	/**
	 * The component's authored `lang` default (`lang = 'en'`), or null —
	 * ADR 0030 sub-design 3's precedence: a compose site builds the child's
	 * record with the site's `lang` arg when authored, else this default,
	 * else the build's page locale.
	 */
	langArgDefault: string | null
	/**
	 * The component's inline message catalog (ADR 0030 sub-design 4): key →
	 * source-locale string, from `export const i18n`. Null when the
	 * component declares none. The corpus effect folds every entry's
	 * catalog into the generated `i18n` module the render boundaries use.
	 */
	i18nMessages: Record<string, string> | null
	/**
	 * The message keys the component reads in client positions (ADR 0030
	 * s9, LT-218), sorted — the keys the server renders into the root
	 * `i18n` attribute. The translation census checks their translations
	 * against the narrowed client evaluator (LT-219).
	 */
	clientMessageKeys: string[]
	/**
	 * Where each handler arg lands (LT-461), by arg name: every element the
	 * component places the arg on as an event attribute, or the composed
	 * child it forwards the arg to. A composing parent reads this at its
	 * compose site to bind its handler with `on()` against each placement,
	 * through the site's selector joined with the placement's — the child's
	 * signature is the contract, so the parent never reaches in on its own.
	 * Optional: absent on entries that declare no handler arg.
	 */
	handlerArgs?: Record<string, HandlerPlacement[]>
}

/**
 * One placement of a handler arg (LT-461), relative to the component's host
 * element. `optional` marks a placement in a server-rendered branch, which
 * the render may leave out: the parent's query for it must not throw.
 *
 * - An element placement: the event (`click` for `onClick`) and the
 *   selector proving the element unique under the host — a `:scope >`
 *   child path when the component composes children whose markup is
 *   unknown at discovery time.
 * - A forwarding placement (`<Inner onClick={onClick} />`): the composed
 *   child's source, the compose site's discriminator clause (`''` when the
 *   component composes that child once) and the child's own arg name. The
 *   parent resolves it through the child's entry, recursively.
 */
export type HandlerPlacement =
	| { event: string; selector: string; optional: boolean }
	| { via: string; clause: string; arg: string; optional: boolean }

export type ComponentRegistry = Record<string, RegistryEntry>

/* === Exported Functions === */

export const registryJson = (entries: RegistryEntry[]): string =>
	`${JSON.stringify(Object.fromEntries(entries.map(e => [e.tag, e])), null, '\t')}\n`
