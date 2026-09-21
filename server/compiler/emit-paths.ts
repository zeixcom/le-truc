/**
 * The two path facts the emitters need from the corpus configuration
 * (LT-255).
 *
 * A leaf on purpose: `imports.ts` and `pipeline.ts` are in the browser bundle
 * (`build:tsrx:browser`, whose purity is CI-pinned), so what they import must
 * carry no `node:` specifier. Config RESOLUTION — which needs real path math
 * — lives in `corpus-config.ts`, which the browser graph never reaches.
 */

/* === Constants === */

/** Output root, relative to the project root. */
export const DEFAULT_OUT_DIR = 'server/generated/components'

/**
 * Specifier the generated SERVER modules import the render harness from.
 *
 * The repo default is the relative path from the default output root back to
 * `server/compiler/runtime.ts`. An installing project has no such path and
 * must set `runtimeImport` to wherever the harness is importable from in its
 * own tree. It becomes a package specifier once LT-254 publishes the
 * compiler, at which point this default flips and consumers stop setting it.
 */
export const DEFAULT_RUNTIME_IMPORT = '../../compiler/runtime'

/* === Types === */

/**
 * Every generated module lands FLAT in the output root regardless of how the
 * authored source was nested, so a relative specifier the author wrote
 * (resolved to a root-relative path) needs a fixed prefix back to the project
 * root — and that prefix is a function of how deep the configured output root
 * sits. Both facts were hard-coded for this repo's layout before LT-255,
 * which is what made the output root un-configurable in practice.
 */
export type EmitPaths = {
	/** `../` once per path segment from the output root back to the root. */
	outDirPrefix: string
	/** See `DEFAULT_RUNTIME_IMPORT`. */
	runtimeImport: string
}

/**
 * What the emitters assume when no configuration is threaded through — this
 * repo's layout, so every call site that has not been handed a config keeps
 * emitting exactly what it emitted before LT-255.
 */
export const DEFAULT_EMIT_PATHS: EmitPaths = {
	outDirPrefix: '../'.repeat(DEFAULT_OUT_DIR.split('/').length),
	runtimeImport: DEFAULT_RUNTIME_IMPORT,
}
