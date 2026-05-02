/**
 * Unit tests for makeWatch in src/effects.ts
 *
 * Tests that SingleMatchHandlers branches (ok, nil, stale) are correctly forwarded
 * to match(). Uses createTask with a seeded value to trigger the stale path: on the
 * first effect run the task has a retained value but is still computing, so match()
 * routes to stale instead of ok.
 *
 * No DOM required — host is a plain stub; Task signals are passed directly.
 */

import { describe, expect, test } from 'bun:test'
import { createScope, createState, createTask } from '@zeix/cause-effect'
import { makeWatch } from '../helpers/reactive'
import type { ComponentProps } from '../types'

/* === Helpers === */

// makeWatch only uses host for string-keyed sources, which these tests don't exercise.
const stubHost = () => ({}) as unknown as HTMLElement

/* === Tests === */

describe('makeWatch — SingleMatchHandlers', () => {
	test('stale handler fires when task has seeded value and is computing', async () => {
		const calls: string[] = []
		const deferred = { resolve: () => {} }

		// Seeded value: task.get() returns 'seeded' on first call while computing.
		// The task won't resolve until deferred.resolve() is called.
		const task = createTask(
			async () => {
				await new Promise<void>(r => {
					deferred.resolve = r
				})
				return 'resolved'
			},
			{ value: 'seeded' },
		)

		const watch = makeWatch(
			stubHost() as unknown as HTMLElement & ComponentProps,
		)

		const cleanup = createScope(() => {
			watch(task, {
				ok: v => {
					calls.push(`ok:${v}`)
				},
				stale: () => {
					calls.push('stale')
				},
			})()
		})

		// First run: task has 'seeded' value but is computing → stale
		expect(calls).toEqual(['stale'])

		// Resolve the task → effect re-runs → ok
		deferred.resolve()
		await new Promise<void>(r => setTimeout(r, 0))
		expect(calls).toEqual(['stale', 'ok:resolved'])

		cleanup?.()
	})

	test('stale handler is not called for a State signal', () => {
		const calls: string[] = []
		const state = createState('hello')

		const watch = makeWatch(
			stubHost() as unknown as HTMLElement & ComponentProps,
		)

		const cleanup = createScope(() => {
			watch(state, {
				ok: (v: string) => {
					calls.push(`ok:${v}`)
				},
				stale: () => {
					calls.push('stale')
				},
			})()
		})

		expect(calls).toEqual(['ok:hello'])

		state.set('world')
		expect(calls).toEqual(['ok:hello', 'ok:world'])
		expect(calls).not.toContain('stale')

		cleanup?.()
	})
})
