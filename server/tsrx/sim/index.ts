/**
 * Server Simulation driver surface (ADR 0027, LT-151; report channel LT-163).
 *
 * `patch-table.ts` holds the per-runtime data, `realm.ts` applies it,
 * `boundary.ts` enforces the hermetic-quiescence serialization boundary, and
 * `report.ts` turns the realm's diagnostics into the build report — the
 * channel that replaced compile-time refusals (LT-153 decision 1). Swapping
 * the substrate (LT-152) is confined to `realm.ts` plus the table.
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
	PROTOTYPE_PATCHES,
	patchesFor,
	REALM_GLOBALS,
	SIM_PATCH_TABLE,
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
	CLASSIFIED_DIAGNOSTICS,
	type ClassifiedDiagnostic,
	classificationFor,
	classifyDiagnostic,
	formatSimDiagnostic,
	formatSimReport,
	reportDiagnostics,
	type SimReport,
} from './report.ts'
