/**
 * The compiler's designated public API (LT-265, ADR 0032 amended
 * 2026-09-19; the IR left it at LT-370, ADR 0034 s8, D-25).
 *
 * A consumer hands an authored source to a bundled front end and gets back
 * a `CompileFileResult`: the three artifacts, the registry entry, the span
 * tables, and the diagnostics. This module names the symbols of that
 * exchange; the narrative contract document lives with the compiler docs
 * (LE_TRUC_COMPILER.md § 2).
 *
 * The IR is NOT here. It is the lowering — internal, and it may change in
 * any release (ADR 0034 s8). So is `compileFromIR`, the shared pipeline
 * entry both in-repo front ends call: it is the anti-drift seam of ADR 0032
 * sub-design 6, not an extension point. The external extension point is
 * source-to-source — an adapter that translates another component format
 * into host-profile `.tsx` (ADR 0032 s6, LT-376).
 *
 * The re-exports below are EXACTLY the set published as
 * `@zeix/le-truc-compiler` — the `exports` map entry and the version stamp
 * ride LT-254 and are mechanical once this set is named. Which entry points
 * and result types belong here is the D-32 design session's call.
 * `contract.test.ts` pins the set: widening it is a public-API decision and
 * shrinking it is a breaking one, and both belong in review, not in a
 * drive-by re-export.
 *
 * ## Stability policy
 *
 * From the first publish, semantic versioning applies to this set and to
 * nothing else — everything else under `server/compiler/` is internal and
 * may change in any release, including a patch release.
 *
 * - `CompileFileResult`/`CompiledComponent`/`RegistryEntry` and the refusal
 *   vocabularies: new `DiagnosticCode` members and new `RoutingSignalOrigin`
 *   members are additive (minor); renames, removals, and tightened required
 *   shapes are major.
 * - Emitted artifact BYTES are not part of the contract. The
 *   `*.server.ts`/`*.client.ts`/`*.css` bytes are pinned by in-repo goldens
 *   only; stability covers the typed contract and behavior, never byte
 *   identity.
 * - Diagnostic codes are public API at first publish: a number is never
 *   reused; the spent-number ledger is `VOCABULARY_LEDGER.md` (ADR 0028
 *   sub-design 1, as amended — the `LTC###` default, the six `TSRX###`
 *   `.tsrx`-grammar exceptions).
 * - `compileComponentTsx` is the bundled `.tsx` front end — the only front
 *   end published at 3.0 (ADR 0034 s2). The `.tsrx` shell's
 *   `compileComponent` is deliberately absent: it stays repo-internal until
 *   `@tsrx/core` reaches 1.0.
 *
 * Component-model connectors (React, Vue, Solid) are THIRD-PARTY by name
 * (ADR 0032, 2026-09-19): the engineering risk of tracking a target
 * framework's minor versions transfers with ownership, the reputational
 * risk does not. This contract is documentation and naming, not a plugin
 * API — no registry, no lifecycle hooks, no discovery mechanism. The
 * refusal vocabularies are closed in the same spirit (owner ruling,
 * 2026-09-21): `DiagnosticCode` and `RoutingSignalOrigin` are the
 * compiler's.
 */

/* === The refusal channels — how a compile fails honestly === */

export type { CompileDiagnostic, DiagnosticCode } from './diagnostics'
export type {
	EvaluationTier,
	Resolution,
	RoutingSignal,
	RoutingSignalOrigin,
	UnresolvableLimb,
} from './tier'

/* === The compile result and its three artifacts === */

/** The registry entry's per-prop kind vocabulary (`entry.exposedProps`). */
export type { ExposeKind } from './ir'
export type { CompiledComponent, CompileFileResult } from './pipeline'
export type { RegistryEntry } from './registry'
export type { SourceSpan } from './spans'

/* === The emit-path facts a consumer threads through === */

export type { EmitPaths } from './emit-paths'
export { DEFAULT_EMIT_PATHS } from './emit-paths'

/* === The bundled front end === */

export { compileComponentTsx } from './frontend/tsx/index'
