/**
 * The facts the emitters need from the corpus configuration (LT-255; the
 * CSS target joined as the third fact in LT-304).
 *
 * A leaf on purpose: the emitters (`imports.ts`, `pipeline.ts`) need only
 * these defaults, not config resolution. RESOLUTION — which needs real
 * path math and value validation — lives in `corpus-config.ts`.
 */

/* === Constants === */

/** Output root, relative to the project root. */
export const DEFAULT_OUT_DIR = 'server/generated/components'

/**
 * Specifier the generated SERVER modules (and the generated `i18n` module)
 * import the render harness from.
 *
 * The default is the published package's own `./runtime` subpath (LT-254,
 * ADR 0034 s1): a consumer never sets `runtimeImport`. This repo is the one
 * consumer that must — its harness is the in-tree `server/compiler/runtime`
 * source, not an installed package — so its `le-truc.config.json` pins the
 * repo-relative specifier the generated modules used before publication
 * (ADR 0036 s2's exception, made deliberate by the same task).
 */
export const DEFAULT_RUNTIME_IMPORT = '@zeix/le-truc-compiler/runtime'

/* === The CSS target (ADR 0033 s5, LT-304) === */

/**
 * The browsers a `cssTargets` entry names. The four engines the runtime
 * baseline (REQUIREMENTS § Browser support, Baseline 2023) is stated over;
 * Blink derivatives (Opera, Samsung Internet) ride `chrome`.
 */
export type CssBrowser = 'chrome' | 'edge' | 'firefox' | 'safari'

export const CSS_BROWSERS: readonly CssBrowser[] = [
	'chrome',
	'edge',
	'firefox',
	'safari',
]

/**
 * A browser version in lightningcss's packed encoding —
 * `major << 16 | minor << 8 | patch` — the shape `transform({ targets })`
 * consumes, so the resolved config can be handed to lightningcss as-is.
 */
export const encodeCssVersion = (major: number, minor = 0, patch = 0): number =>
	(major << 16) | (minor << 8) | patch

/**
 * Minimum browser versions, keyed by `CssBrowser` and packed per
 * `encodeCssVersion`. A browser left out imposes no constraint — the
 * project has declared it does not matter (browserslist semantics).
 */
export type CssTargets = Partial<Record<CssBrowser, number>>

/**
 * The default CSS target: **Baseline widely available**, pinned to the
 * browser set that had every Baseline-2023-and-older feature in wide
 * availability when 3.0 pinned it (April 2024 releases — chrome/edge 124,
 * firefox 125, safari 17.4), per the runtime's baseline policy (owner,
 * 2026-09-24: a pin moves only with a major).
 *
 * `@scope` is NOT widely available at this pin (Firefox crossed 128 only in
 * July 2024), so the default compiles the **lowered** emission — ADR 0033
 * s5's "with the default, `@scope` lowers until widely available". The pin
 * moves only with a compiler/runtime major, never silently.
 */
export const DEFAULT_CSS_TARGETS: CssTargets = {
	chrome: encodeCssVersion(124),
	edge: encodeCssVersion(124),
	firefox: encodeCssVersion(125),
	safari: encodeCssVersion(17, 4),
}

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
	/**
	 * The resolved CSS target (ADR 0033 s5, LT-304): decides native `@scope`
	 * vs the flat-selector lowering, and feeds lightningcss's own lowering.
	 */
	cssTargets: CssTargets
}

/**
 * What the emitters assume when no configuration is threaded through — this
 * repo's layout, so every call site that has not been handed a config keeps
 * emitting exactly what it emitted before LT-255.
 */
export const DEFAULT_EMIT_PATHS: EmitPaths = {
	outDirPrefix: '../'.repeat(DEFAULT_OUT_DIR.split('/').length),
	runtimeImport: DEFAULT_RUNTIME_IMPORT,
	cssTargets: DEFAULT_CSS_TARGETS,
}
