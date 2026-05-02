/**
 * Unit tests for makeWatch in src/helpers/reactive.ts
 *
 * Tests that SingleMatchHandlers branches (ok, nil, stale) are correctly forwarded
 * to match(). Uses createTask with a seeded value to trigger the stale path: on the
 * first effect run the task has a retained value but is still computing, so match()
 * routes to stale instead of ok.
 *
 * No DOM required — host is a plain stub; Task signals are passed directly.
 */

import { describe, expect, test } from 'bun:test'
import {
	createMemo,
	createScope,
	createState,
	createTask,
} from '@zeix/cause-effect'
import { activateResult, each, makePass, makeWatch } from '../helpers/reactive'
import type { ComponentProps } from '../types'

/* === Helpers === */

// makeWatch only uses host for string-keyed sources, which these tests don't exercise.
const stubHost = () => ({}) as unknown as HTMLElement

/* === Tests === */

describe('makeWatch — basic function signature', () => {
	test('returns a watch helper function', () => {
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const watch = makeWatch(host)
		expect(typeof watch).toBe('function')
	})

	test('returns effect descriptor when called with signal and handler', () => {
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const watch = makeWatch(host)
		const signal = createState('test')
		const descriptor = watch(signal, () => {})
		expect(typeof descriptor).toBe('function')
	})

	test('returns effect descriptor when called with property name and handler', () => {
		const host = { testProp: 'value' } as unknown as HTMLElement &
			ComponentProps
		const watch = makeWatch(host)
		const descriptor = watch('testProp', () => {})
		expect(typeof descriptor).toBe('function')
	})

	test('returns effect descriptor when called with thunk and handler', () => {
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const watch = makeWatch(host)
		const descriptor = watch(
			() => 'test',
			() => {},
		)
		expect(typeof descriptor).toBe('function')
	})
})

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

/* === activateResult === */

describe('activateResult', () => {
	test('activates empty array without error', () => {
		expect(() => activateResult([])).not.toThrow()
	})

	test('activates single effect descriptor', () => {
		let called = false
		const descriptor = () => {
			called = true
		}
		activateResult([descriptor])
		expect(called).toBe(true)
	})

	test('activates multiple effect descriptors', () => {
		const calls: number[] = []
		const descriptor1 = () => {
			calls.push(1)
		}
		const descriptor2 = () => {
			calls.push(2)
		}
		activateResult([descriptor1, descriptor2])
		expect(calls).toEqual([1, 2])
	})

	test('flattens nested arrays', () => {
		const calls: number[] = []
		const descriptor1 = () => {
			calls.push(1)
		}
		const descriptor2 = () => {
			calls.push(2)
		}
		const descriptor3 = () => {
			calls.push(3)
		}
		activateResult([[descriptor1, descriptor2], descriptor3])
		expect(calls).toEqual([1, 2, 3])
	})

	test('skips falsy values', () => {
		let called = false
		const descriptor = () => {
			called = true
		}
		activateResult([null, undefined, false, 0, '', descriptor])
		expect(called).toBe(true)
	})

	test('handles deeply nested arrays', () => {
		const calls: number[] = []
		const descriptor1 = () => {
			calls.push(1)
		}
		const descriptor2 = () => {
			calls.push(2)
		}
		const descriptor3 = () => {
			calls.push(3)
		}
		activateResult([[[descriptor1], [descriptor2]], descriptor3])
		expect(calls).toEqual([1, 2, 3])
	})
})

/* === each === */

describe('each', () => {
	test('returns an effect descriptor', () => {
		const memo = createMemo(() => [] as Element[])
		const descriptor = each(memo, () => {})
		expect(typeof descriptor).toBe('function')
	})

	test('calls callback for each element in memo', () => {
		const elements = [{}, {}, {}] as Element[]
		const memo = createMemo(() => elements)
		const callbacks: Element[] = []
		const descriptor = each(memo, (el: Element) => {
			callbacks.push(el)
			return []
		})
		// Need to run the descriptor in a scope
		createScope(() => descriptor())
		expect(callbacks).toHaveLength(3)
	})

	test('activates FactoryResult from callback', () => {
		const elements = [{} as Element]
		const memo = createMemo(() => elements)
		let called = false
		const descriptor = each(memo, () => {
			// Return a descriptor that sets called to true
			return [
				() => {
					called = true
				},
			]
		})
		createScope(() => descriptor())
		// The callback should have been called and the descriptor activated
		expect(called).toBe(true)
	})
})

/* === makePass === */

describe('makePass', () => {
	test('returns a pass helper function', () => {
		const host = {} as unknown as HTMLElement & ComponentProps
		const pass = makePass(host)
		expect(typeof pass).toBe('function')
	})

	test('returns effect descriptor when called with target and props', () => {
		const host = {} as unknown as HTMLElement & ComponentProps
		const pass = makePass(host)
		const target = {} as unknown as HTMLElement & ComponentProps
		const descriptor = pass(target, {})
		expect(typeof descriptor).toBe('function')
	})

	test('returns effect descriptor when called with memo target and props', () => {
		const host = {} as unknown as HTMLElement & ComponentProps
		const pass = makePass(host)
		const memo = createMemo(() => [] as (HTMLElement & ComponentProps)[])
		const descriptor = pass(memo, {})
		expect(typeof descriptor).toBe('function')
	})
})
