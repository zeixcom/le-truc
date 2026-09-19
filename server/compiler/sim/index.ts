/**
 * The jsdom simulation driver, as the seam sees it (ADR 0027, LT-151;
 * report channel LT-163; seam LT-263).
 *
 * This module is the driver's whole published surface. `patch-table.ts`
 * holds the per-runtime applier data, `realm.ts` applies it, `boundary.ts`
 * enforces the hermetic-quiescence serialization boundary, and
 * `classifications.ts` names the standing notices this substrate emits.
 *
 * {@link simulationProvider} is what `../simulation/resolve.ts` reaches for
 * — the only entry point the compiler uses. Everything else exported here
 * is for the driver's own tests and the cross-runtime portability probe,
 * which legitimately know jsdom.
 *
 * ADR 0035 sub-design 4 keeps this inside `@zeix/le-truc-compiler` for 3.0
 * and designs the boundary so the later `@zeix/le-truc-simulation` split is
 * a resolver-specifier change, not a breaking one. The realm's PUBLIC type
 * is now `SimulationRealm` from the contract and names no jsdom type; the
 * wider `JsdomSimulationRealm` stays behind the seam, where the substrate
 * is known.
 */

import {
	SIMULATION_SEAM_VERSION,
	type SimulationProvider,
} from '../simulation/contract.ts'
import { CLASSIFIED_DIAGNOSTICS } from './classifications.ts'
import { createSimulationRealm } from './realm.ts'

/** The seam handshake, and the only thing the compiler imports from here. */
export const simulationProvider: SimulationProvider = {
	seamVersion: SIMULATION_SEAM_VERSION,
	substrate: 'jsdom',
	classifications: CLASSIFIED_DIAGNOSTICS,
	createSimulationRealm,
}

export {
	assertSynchronousWindow,
	drainToQuiescence,
	type QuiescenceResult,
	SimulationBoundaryError,
} from './boundary.ts'
export { CLASSIFIED_DIAGNOSTICS } from './classifications.ts'
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
	type JsdomSimulationRealm,
	type RecordedDefinition,
} from './realm.ts'
