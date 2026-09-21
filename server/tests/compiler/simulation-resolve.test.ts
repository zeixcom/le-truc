/**
 * The substrate resolver's absence discrimination (LT-256, ADR 0034 s5).
 *
 * `resolveSimulationProvider` used to swallow EVERY error from the driver
 * import, which made a driver that is installed but broken indistinguishable
 * from one that was never installed — tolerable while that still failed the
 * build, silently dangerous once absence became a routing outcome. The
 * narrowed catch admits only genuine resolution failures for the driver or
 * its substrate. These tests pin both gates of {@link isSubstrateAbsence}:
 * the error SHAPE (a module-resolution failure vs anything else) and the
 * failing SPECIFIER (driver/substrate vs a transitive dependency). The
 * shapes are as Bun and Node actually throw them: Bun's `ResolveMessage`
 * carries `.specifier`; Node's `ERR_MODULE_NOT_FOUND` names the module in
 * the message only.
 */

import { describe, expect, test } from 'bun:test'
import {
	isSubstrateAbsence,
	resetSimulationProvider,
	resolveSimulationProvider,
} from '../../compiler/simulation/resolve'

/* === Fixtures === */

/** Bun's shape: ResolveMessage with the failing specifier as a field. */
const bunResolveError = (specifier: string) =>
	Object.assign(
		new Error(
			`Cannot find package '${specifier}' imported from '/repo/server/compiler/sim/index.ts'`,
		),
		{ name: 'ResolveMessage', code: 'ERR_MODULE_NOT_FOUND', specifier },
	)

/** Node's shape: code only; the failing specifier is in the message. */
const nodeResolveError = (specifier: string) =>
	Object.assign(
		new Error(
			`Cannot find module '${specifier}' imported from /repo/server/effects/simulate.ts`,
		),
		{ name: 'Error', code: 'ERR_MODULE_NOT_FOUND' },
	)

/* === Tests === */

describe('isSubstrateAbsence admits only genuine substrate absence', () => {
	test('a resolution failure naming the substrate is absence (Bun shape)', () => {
		// In a build with no jsdom installed, the import that fails is the
		// substrate load inside the otherwise-present driver.
		expect(isSubstrateAbsence(bunResolveError('jsdom'))).toBe(true)
	})

	test('a resolution failure naming the driver file is absence (both shapes)', () => {
		expect(
			isSubstrateAbsence(bunResolveError('/repo/server/compiler/sim/index.ts')),
		).toBe(true)
		expect(isSubstrateAbsence(nodeResolveError('../sim/index.ts'))).toBe(true)
	})

	test('a resolution failure naming a transitive dependency is a broken install', () => {
		// jsdom present but a dependency of it missing: this is the
		// silent-degradation case the narrowing exists to prevent.
		expect(isSubstrateAbsence(bunResolveError('whatwg-url'))).toBe(false)
		expect(isSubstrateAbsence(nodeResolveError('whatwg-mimetype'))).toBe(false)
	})

	test('a driver that throws at import is a broken install, not absence', () => {
		const initThrow = new Error('boom during module init')
		expect(isSubstrateAbsence(initThrow)).toBe(false)
		expect(isSubstrateAbsence({ code: 'ERR_GENERIC' })).toBe(false)
	})

	test('an error of unrecorded shape surfaces, never masquerades as absence', () => {
		expect(isSubstrateAbsence('a string')).toBe(false)
		expect(isSubstrateAbsence(null)).toBe(false)
	})
})

describe('the real resolver against the installed substrate', () => {
	test('with jsdom installed the provider resolves', async () => {
		resetSimulationProvider()
		const provider = await resolveSimulationProvider()
		expect(provider).not.toBeNull()
		expect(provider?.substrate).toBe('jsdom')
	})

	test('the resolution is cached across calls', async () => {
		resetSimulationProvider()
		const first = await resolveSimulationProvider()
		const second = await resolveSimulationProvider()
		expect(second).toBe(first)
	})
})
