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
 * substrate is not installed; the simulation pass turns that into a routing
 * outcome with an `unavailable substrate` census reason (LT-256, ADR 0034
 * sub-design 5). Absence is narrowly construed: only a resolution failure
 * for the driver or its substrate ({@link isSubstrateAbsence}) counts. A
 * driver that IS installed but broken — an init throw, a missing transitive
 * dependency — surfaces, the same distinction
 * {@link SimulationSeamVersionError} draws for a version mismatch.
 */

import { SIMULATION_SEAM_VERSION, type SimulationProvider } from './contract.ts'

/**
 * Where the driver lives. A relative path for 3.0; `'@zeix/le-truc-simulation'`
 * after the split (ADR 0035 sub-design 4). Held in a variable so the
 * typechecker does not follow it — see the module header.
 */
const SIMULATION_DRIVER = '../sim/index.ts'

/** The substrate package the driver itself loads (`sim/realm.ts`'s import). */
const SUBSTRATE_PACKAGE = 'jsdom'

/** What the driver specifier resolves to, as it appears in a resolve error. */
const DRIVER_SPECIFIER_TAIL = 'sim/index.ts'

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
 * Whether `error` is a genuine resolution failure for the driver or its
 * substrate — the one shape of absence (ADR 0035 sub-design 4). Exported
 * for the discrimination tests; the resolver is the only caller.
 *
 * Both gates are load-bearing. The error must BE a module-resolution
 * failure — `ERR_MODULE_NOT_FOUND` (Node's code; Bun's `ResolveMessage`
 * carries the same code and this name) — because anything else is a driver
 * that is present but broken, which must surface rather than masquerade as
 * an opt-out. And the failing specifier must be the driver itself or its
 * substrate package: in a build with no jsdom installed, the import that
 * fails is the substrate load INSIDE the otherwise-present driver, while a
 * missing transitive dependency names some third specifier — a broken
 * install, which surfaces the same way. An error of unrecorded shape
 * surfaces too: ambiguity resolves to "broken", never to "absent".
 */
export const isSubstrateAbsence = (error: unknown): boolean => {
	if (typeof error !== 'object' || error === null) return false
	const { code, name, specifier } = error as {
		code?: string
		name?: string
		specifier?: string
	}
	if (code !== 'ERR_MODULE_NOT_FOUND' && name !== 'ResolveMessage') return false
	// Bun carries the failing specifier as a field; under Node it appears
	// only in the message ("Cannot find package 'x' imported from …").
	const failed =
		specifier ??
		/^(?:Cannot find (?:module|package)) ['"]([^'"]+)['"]/.exec(
			error instanceof Error ? error.message : '',
		)?.[1]
	if (failed === undefined) return false
	return failed === SUBSTRATE_PACKAGE || failed.endsWith(DRIVER_SPECIFIER_TAIL)
}

/**
 * Resolve the installed simulation driver, or `null` when there is none.
 *
 * Throws on a version mismatch — a driver that is present but wrong is a
 * broken install, not an opt-out — and on any error from loading the
 * driver that is not a resolution failure for the driver or its substrate
 * (LT-256): a driver that is present but broken surfaces with its real
 * cause instead of degrading the Simulated tier silently.
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
		} catch (error) {
			if (!isSubstrateAbsence(error)) throw error
			// The driver or its substrate is genuinely not installed. The build
			// has no Simulated tier available; the caller decides what that
			// means (LT-256: it routes Static and records a census reason).
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
