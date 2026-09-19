/**
 * The substrate resolver (ADR 0035 sub-design 4, LT-263).
 *
 * Activation is INSTALLATION: the driver is present or it is not, with no
 * configuration flag and no dynamic degradation path threaded through the
 * compiler. This module is the one place that knows how to reach it.
 *
 * ## Why the specifier is a variable
 *
 * `await import(SIMULATION_DRIVER)` with a variable specifier is opaque to
 * the typechecker, and that is the point rather than an accident: a literal
 * would make `tsc` follow the edge into `sim/realm.ts` and from there into
 * `jsdom`, so an opted-out consumer's `tsc --noEmit` would fail on a
 * dependency they deliberately did not install (ADR 0034 sub-design 5). The
 * contract (`./contract.ts`) carries the types instead; the import carries
 * only the values, cast once, here.
 *
 * ## Today's specifier and tomorrow's
 *
 * ADR 0035 sub-design 4 keeps the driver inside the compiler for 3.0, so
 * the specifier is a relative path. When `@zeix/le-truc-simulation` is
 * split out in a later 3.x, this constant becomes the package name and
 * nothing else in the compiler changes — which is the whole return on
 * shaping the seam as a package boundary before it is a package.
 *
 * ## Absence is not an error here
 *
 * {@link resolveSimulationProvider} answers `null` when the driver or its
 * substrate is not installed. Turning that into a routing outcome with an
 * `unavailable substrate` census reason is LT-256's work; this module only
 * makes the condition observable without a crash.
 */

import { SIMULATION_SEAM_VERSION, type SimulationProvider } from './contract.ts'

/**
 * Where the driver lives. A relative path for 3.0; `'@zeix/le-truc-simulation'`
 * after the split (ADR 0035 sub-design 4). Held in a variable so the
 * typechecker does not follow it — see the module header.
 */
const SIMULATION_DRIVER = '../sim/index.ts'

/** Cached across calls: one resolution per process, driver or not. */
let resolved: SimulationProvider | null | undefined

/**
 * Raised when a driver IS installed but speaks a seam revision this
 * compiler does not. Distinct from absence on purpose: absence is a
 * supported configuration, a version mismatch is a broken install.
 */
export class SimulationSeamVersionError extends Error {
	constructor(found: number) {
		super(
			`The installed simulation driver speaks seam version ${found}, but ` +
				`this compiler speaks ${SIMULATION_SEAM_VERSION}. Install a driver ` +
				'matching the compiler, or uninstall it to build without the ' +
				'Simulated tier.',
		)
		this.name = 'SimulationSeamVersionError'
	}
}

/**
 * Resolve the installed simulation driver, or `null` when there is none.
 *
 * Throws only on a version mismatch — a driver that is present but wrong is
 * a broken install, not an opt-out.
 */
export const resolveSimulationProvider =
	async (): Promise<SimulationProvider | null> => {
		if (resolved !== undefined) return resolved
		let provider: SimulationProvider | null = null
		try {
			const loaded = (await import(SIMULATION_DRIVER)) as {
				simulationProvider?: SimulationProvider
			}
			provider = loaded.simulationProvider ?? null
		} catch {
			// No driver, or no substrate under it. Either way the build has no
			// Simulated tier available; the caller decides what that means.
			provider = null
		}
		if (provider !== null && provider.seamVersion !== SIMULATION_SEAM_VERSION)
			throw new SimulationSeamVersionError(provider.seamVersion)
		resolved = provider
		return provider
	}

/** Drop the cached resolution. Tests only. */
export const resetSimulationProvider = (): void => {
	resolved = undefined
}
