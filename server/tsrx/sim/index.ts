/**
 * Server Simulation driver surface (ADR 0027, LT-151).
 *
 * `patch-table.ts` holds the per-runtime data, `realm.ts` applies it, and
 * `boundary.ts` enforces the synchronous instantiate→serialize window. Swapping
 * the substrate (LT-152) is confined to `realm.ts` plus the table.
 */

export { runSynchronously, SimulationBoundaryError } from './boundary.ts'
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
	createSimulationRealm,
	type RecordedDefinition,
	type SimDiagnostic,
	type SimulationRealm,
} from './realm.ts'
