/**
 * The front-end contract — the compiler's designated public API (LT-265,
 * ADR 0032 amended 2026-09-19).
 *
 * A front end turns an authored source into
 * `{ component, diagnostics, routingSignals }` and hands it to
 * `compileFromIR`; the shared pipeline does everything after that (compose
 * validation, client analysis, tier classification, both emitters, the
 * registry entry). `frontend/tsx/index.ts` and `frontend/tsrx/index.ts` are
 * the same shell over this seam — the anti-drift contract of ADR 0032
 * sub-design 6 — which is the evidence that this is the seam any third front
 * end would use. This module names that seam's symbols; the narrative
 * contract document lives with the compiler docs (LE_TRUC_COMPILER.md).
 *
 * The re-exports below are EXACTLY the set published as
 * `@zeix/le-truc-compiler` — the `exports` map entry and the version stamp
 * ride LT-254 behind the P6 gate and are mechanical once this set is named.
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
 * - `compileFromIR` and the IR types: the front-end contract. New OPTIONAL
 *   IR fields, new `DiagnosticCode` members, and new `RoutingSignalOrigin`
 *   members are additive (minor); renames, removals, and tightened required
 *   shapes are major.
 * - `CompileFileResult`/`CompiledComponent`/`RegistryEntry`: the consumer
 *   half of the contract — same rule.
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
 * API — no registry, no lifecycle hooks, no discovery mechanism.
 */

/* === The IR — what a front end produces === */

/** The machinery's own AST node vocabulary the IR carries. */
export type { AstNode } from './ast-node'
export type {
	AttributeIR,
	ComponentIR,
	ComponentParam,
	ComposeAttrIR,
	ConfigIR,
	ExposeKind,
	ForIR,
	PassEntryIR,
	SetupStmt,
	SignalConstructor,
	SignalIR,
	SourceRange,
	TemplateNode,
} from './ir'

/* === The refusal channels — how a front end fails honestly === */

export type { CompileDiagnostic, DiagnosticCode } from './diagnostics'
export type {
	EvaluationTier,
	Resolution,
	RoutingSignal,
	RoutingSignalOrigin,
	UnresolvableLimb,
} from './tier'

/* === The pipeline entry and its three artifacts === */

export type { CompiledComponent, CompileFileResult } from './pipeline'
export { compileFromIR } from './pipeline'
export type { RegistryEntry } from './registry'
export type { SourceSpan } from './spans'

/* === The emit-path facts a front end threads through === */

export type { EmitPaths } from './emit-paths'
export { DEFAULT_EMIT_PATHS } from './emit-paths'

/* === The bundled front ends === */

export { compileComponentTsx } from './frontend/tsx/index'
