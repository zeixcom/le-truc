/**
 * Component registry (ADR 0023 milestone 1).
 *
 * One entry per compiled component: where its artifacts live and which
 * types it exports. Two consumers:
 * - the client analyzer — registry-aware attribute dispatch (a reactive
 *   attribute on a registry tag lowers to `pass()`, any other dashed tag
 *   to `bindProperty()`; AGENTS.md's own rule, encoded — the compiler has
 *   registry knowledge hand-written code lacks);
 * - the future docs/examples migration, which resolves tags to render
 *   functions and stylesheets through this file.
 */

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
}

export type ComponentRegistry = Record<string, RegistryEntry>

/* === Exported Functions === */

export const registryJson = (entries: RegistryEntry[]): string =>
	`${JSON.stringify(Object.fromEntries(entries.map(e => [e.tag, e])), null, '\t')}\n`
