/**
 * Unit Tests for effects/build-effect.ts — Shared Build Effect Wrapper
 *
 * Exercises the resolve/reject/firstRun semantics every effect in
 * server/effects/ relies on: a failure on the first run must reject `ready`
 * (a one-shot build has to fail loudly), while a failure on a later,
 * file-watch-triggered run must be logged and swallowed (a live dev server
 * shouldn't crash on a typo).
 */

import { describe, expect, test } from 'bun:test'
import { createState } from '@zeix/cause-effect'
import { createBuildEffect, runCommand } from '../../effects/build-effect'
import { settle } from '../helpers/test-utils'

const tick = () => Bun.sleep(10)

describe('createBuildEffect', () => {
	test('resolves ready after a successful first run', async () => {
		const source = createState({ n: 0 })
		const { cleanup, ready } = createBuildEffect('Test', [source], () => {})

		expect(await ready).toBeUndefined()
		cleanup()
	})

	test('does not call onRebuild for the first run', async () => {
		const source = createState({ n: 0 })
		let rebuilds = 0
		const { cleanup, ready } = createBuildEffect(
			'Test',
			[source],
			() => {},
			() => {
				rebuilds++
			},
		)

		await ready
		expect(rebuilds).toBe(0)
		cleanup()
	})

	test('calls onRebuild after a successful later run', async () => {
		const source = createState({ n: 0 })
		let rebuilds = 0
		const { cleanup, ready } = createBuildEffect(
			'Test',
			[source],
			() => {},
			() => {
				rebuilds++
			},
		)

		await ready
		source.set({ n: 1 })
		await tick()

		expect(rebuilds).toBe(1)
		cleanup()
	})

	test('rejects ready when the first run throws', async () => {
		const source = createState({ n: 0 })
		const { cleanup, ready } = createBuildEffect('Test', [source], () => {
			throw new Error('boom')
		})

		// Via settle() — bun-types types every matcher as void, so the
		// awaited `expect(...).rejects` form draws TS 80007 (see test-utils).
		const settled = await settle(ready)
		if (settled.status !== 'rejected')
			throw new Error('the first run should have failed')
		expect(String(settled.reason)).toContain('boom')
		cleanup()
	})

	test('a later-run failure does not reject the already-settled ready promise', async () => {
		const source = createState({ n: 0 })
		let rebuilds = 0
		const { cleanup, ready } = createBuildEffect(
			'Test',
			[source],
			values => {
				if (values[0].n === 1) throw new Error('transient failure')
			},
			() => {
				rebuilds++
			},
		)

		expect(await ready).toBeUndefined()

		// A failing rebuild must not crash the effect or reject `ready` again —
		// it's already settled — and must not trigger onRebuild.
		source.set({ n: 1 })
		await tick()
		expect(rebuilds).toBe(0)

		// The effect must still be alive and recover on the next successful run.
		source.set({ n: 2 })
		await tick()
		expect(rebuilds).toBe(1)

		cleanup()
	})

	test('run receives the unwrapped signal values', async () => {
		const a = createState({ value: 'x' })
		const b = createState({ value: 'y' })
		let seen: [string, string] | undefined
		const { cleanup, ready } = createBuildEffect('Test', [a, b], values => {
			seen = [values[0].value, values[1].value]
		})

		await ready
		expect(seen).toEqual(['x', 'y'])
		cleanup()
	})
})

describe('runCommand', () => {
	test('resolves when the command exits 0', async () => {
		expect(await runCommand(['true'])).toBeUndefined()
	})

	test('throws when the command exits non-zero', async () => {
		const settled = await settle(runCommand(['false']))
		if (settled.status !== 'rejected')
			throw new Error('the command should have failed')
		expect(String(settled.reason)).toContain('exited with code')
	})

	test('runs in the given cwd', async () => {
		expect(
			await runCommand(['test', '-f', 'package.json'], {
				cwd: process.cwd(),
			}),
		).toBeUndefined()
	})
})
