/**
 * Server Simulation driver surface (ADR 0027, LT-151; report channel LT-163).
 *
 * `patch-table.ts` holds the per-runtime data, `realm.ts` applies it,
 * `boundary.ts` enforces the hermetic-quiescence serialization boundary, and
 * `report.ts` turns the realm's diagnostics into the build report — the
 * channel that replaced compile-time refusals (LT-153 decision 1). The
 * patch DATA is substrate-swappable (LT-152), but the realm's public type
 * is not: `SimulationRealm` exposes jsdom's own `window`/`Document` types,
 * so a substrate change is an API change to this surface, not a swap
 * confined to `realm.ts`.
 */

export {
	assertSynchronousWindow,
	drainToQuiescence,
	type QuiescenceResult,
	SimulationBoundaryError,
} from './boundary.ts'
export {
	detectRuntime,
	NETWORK_GLOBALS,
	patchesFor,
	REALM_GLOBALS,
	type SimPatch,
	type SimRuntime,
	STUB_GLOBALS,
} from './patch-table.ts'
export {
	childrenFirstOrder,
	createSimulationRealm,
	type RecordedDefinition,
	type SimDiagnostic,
	type SimulationRealm,
} from './realm.ts'
export {
	type Census,
	type CensusEntry,
	type CensusKind,
	CLASSIFIED_DIAGNOSTICS,
	type ClassifiedDiagnostic,
	classificationFor,
	classifyDiagnostic,
	formatCensus,
	formatSimDiagnostic,
	formatSimReport,
	reportDiagnostics,
	type SimReport,
	type TierCensusSubject,
	type TranslationGap,
	tierCensus,
	translationCensus,
} from './report.ts'
