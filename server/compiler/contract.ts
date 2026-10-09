/**
 * The compiler's designated public API (LT-265, ADR 0032 amended
 * 2026-09-19; reshaped to the D-32 ruling at LT-480, owner 2026-10-06).
 *
 * A consumer configures a corpus — a `CorpusConfig` hand-built, or their
 * `le-truc.config.json` resolved by the package's loader
 * (`corpus-scan.ts`'s `loadCorpusConfig`, internal until LT-254 decides
 * the exports map) — and hands it to `compileCorpus`: the one entry
 * point, which scans the sources, compiles the corpus, writes the
 * artifacts to the configured `outDir`, and returns the diagnostics and a
 * summary. The artifacts are files, not return values: the generated
 * `*.server.ts`/`*.client.ts`/`*.css` per component, `registry.json` (the
 * public projection of `RegistryEntry` — that projection IS the file's
 * schema), the `i18n` module, and `tsrx-imports.d.ts` where the corpus
 * carries `.tsrx` sources. This module names the symbols of that exchange;
 * the narrative contract document lives with the compiler docs
 * (LE_TRUC_COMPILER.md § 2).
 *
 * The per-file front end is NOT here. `compileComponentTsx` stays internal
 * — exported from `frontend/tsx/index.ts` for the corpus pass and the
 * tests — because a component's artifacts depend on other components:
 * compose legality, tier contamination over the compose graph, variant
 * sets. A per-file entry point would hand every consumer that orchestration
 * to rebuild, and one that skips the contamination fixpoint ships wrong
 * tiers without an error (D-32). The IR is not here either — it is the
 * lowering, internal, and it may change in any release (ADR 0034 s8). The
 * external extension point is source-to-source: an adapter translates
 * another component format into host-profile `.tsx` (ADR 0032 s6); that
 * seam is not built yet (LT-376).
 *
 * The re-exports below are EXACTLY the set published as
 * `@zeix/le-truc-compiler` — the `exports` map entry and the version stamp
 * ride LT-254 and are mechanical once this set is named.
 * `contract.test.ts` pins the set: widening it is a public-API decision and
 * shrinking it is a breaking one, and both belong in review, not in a
 * drive-by re-export.
 *
 * ## Stability policy
 *
 * From the first publish, semantic versioning applies to this set and to
 * the generated-module API.
 *
 * - Every member of the set: new `DiagnosticCode` members are additive
 *   (minor); renames, removals, and tightened required shapes are major.
 * - The generated-module API, by name and signature, never by bytes:
 *   - `render<Name>` in each `*.server.ts` — including its optional second
 *     parameter, the content owner's tag (LT-472);
 *   - the client module's default export;
 *   - the `i18n` module's shape (`I18n<T>`, `i18nRecord`, the locale
 *     constants);
 *   - the `registry.json` schema — the public projection of `RegistryEntry`.
 *
 *   A rename, a removal or a tightened signature among these is a major.
 *   `argsFromAttrs` is internal: only the compiler's own composition and
 *   audit code calls it; making it public later is a minor.
 * - Emitted artifact BYTES are not part of the contract. The
 *   `*.server.ts`/`*.client.ts`/`*.css` bytes are pinned by in-repo goldens
 *   only; stability covers the typed contract and behavior, never byte
 *   identity.
 * - Diagnostic codes are public API at first publish: a number is never
 *   reused; the spent-number ledger is `VOCABULARY_LEDGER.md` (ADR 0028
 *   sub-design 1, as amended — the `LTC###` default, the six `TSRX###`
 *   `.tsrx`-grammar exceptions).
 * - Everything else under `server/compiler/` is internal and may change in
 *   any release, including a patch release — the IR and `compileFromIR`
 *   included, and `compileComponentTsx` with them.
 *
 * Component-model connectors (React, Vue, Solid) are THIRD-PARTY by name
 * (ADR 0032, 2026-09-19): the engineering risk of tracking a target
 * framework's minor versions transfers with ownership, the reputational
 * risk does not. This contract is documentation and naming, not a plugin
 * API — no registry, no lifecycle hooks, no discovery mechanism. The
 * refusal vocabulary is closed in the same spirit (owner ruling,
 * 2026-09-21): `DiagnosticCode` is the compiler's.
 */

/* === The corpus entry point and its exchange types === */

export type { CorpusResult, CorpusSummary } from './corpus'
export { compileCorpus } from './corpus'
export type {
	CorpusConfig,
	CorpusConfigInput,
} from './corpus-config'

/* === The registry the run wrote === */

/** The registry entry's per-prop kind vocabulary (`entry.exposedProps`). */
export type { ExposeKind } from './ir'
export type { RegistryEntry } from './registry'

/* === The refusal channel — how a compile fails honestly === */

// The record's location, fix and edit shapes are named because
// `CompileDiagnostic` names them (ADR 0044 s1).
export type {
	CompileDiagnostic,
	DiagnosticCode,
	DiagnosticEdit,
	DiagnosticFix,
	DiagnosticLocation,
} from './diagnostics'
export type { EvaluationTier } from './tier'
