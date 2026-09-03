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
}

export type ComponentRegistry = Record<string, RegistryEntry>

/* === Exported Functions === */

export const registryJson = (entries: RegistryEntry[]): string =>
	`${JSON.stringify(Object.fromEntries(entries.map(e => [e.tag, e])), null, '\t')}\n`
