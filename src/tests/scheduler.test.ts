/**
 * Unit tests for src/scheduler.ts
 *
 * requestAnimationFrame is mocked so timing is fully deterministic.
 * afterEach drains any pending callbacks to reset module-level state between tests.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { schedule, throttle } from '../scheduler'

/* === RAF Mock === */

type RafCb = (timestamp: number) => void

let rafCallbacks: RafCb[] = []

beforeEach(() => {
	rafCallbacks = []
	;(globalThis as any).requestAnimationFrame = (cb: RafCb) => {
		rafCallbacks.push(cb)
		return rafCallbacks.length
	}
})

afterEach(() => {
	flushRAF() // drain pending callbacks so module-level requestId resets to undefined
})

const flushRAF = () => {
	const cbs = rafCallbacks.splice(0)
	for (const cb of cbs) cb(0)
}

/* === throttle === */

describe('throttle', () => {
	test('does not call fn before RAF fires', () => {
		const calls: number[] = []
		const fn = throttle((n: number) => calls.push(n))
		fn(1)
		expect(calls).toHaveLength(0)
	})

	test('calls fn on next RAF with provided args', () => {
		const calls: number[] = []
		const fn = throttle((n: number) => calls.push(n))
		fn(42)
		flushRAF()
		expect(calls).toEqual([42])
	})

	test('coalesces rapid calls — only latest args reach fn', () => {
		const calls: number[] = []
		const fn = throttle((n: number) => calls.push(n))
		fn(1)
		fn(2)
		fn(3)
		flushRAF()
		expect(calls).toEqual([3])
	})

	test('multiple rapid calls request only one RAF', () => {
		const fn = throttle((_n: number) => {})
		fn(1)
		fn(2)
		fn(3)
		expect(rafCallbacks).toHaveLength(1)
	})

	test('can be called again after RAF flushes', () => {
		const calls: number[] = []
		const fn = throttle((n: number) => calls.push(n))
		fn(1)
		flushRAF()
		fn(2)
		flushRAF()
		expect(calls).toEqual([1, 2])
	})

	test('.cancel() before RAF drops the pending call', () => {
		const calls: number[] = []
		const fn = throttle((n: number) => calls.push(n))
		fn(42)
		fn.cancel()
		flushRAF()
		expect(calls).toHaveLength(0)
	})

	test('.cancel() is a no-op when nothing is pending', () => {
		const fn = throttle((_n: number) => {})
		expect(() => fn.cancel()).not.toThrow()
	})

	test('can be called again after .cancel()', () => {
		const calls: number[] = []
		const fn = throttle((n: number) => calls.push(n))
		fn(1)
		fn.cancel()
		fn(2)
		flushRAF()
		expect(calls).toEqual([2])
	})

	test('AbortSignal abort cancels a pending call', () => {
		const calls: number[] = []
		const controller = new AbortController()
		const fn = throttle((n: number) => calls.push(n), controller.signal)
		fn(42)
		controller.abort()
		flushRAF()
		expect(calls).toHaveLength(0)
	})

	test('AbortSignal abort after RAF flush has no effect', () => {
		const calls: number[] = []
		const controller = new AbortController()
		const fn = throttle((n: number) => calls.push(n), controller.signal)
		fn(42)
		flushRAF()
		controller.abort()
		expect(calls).toEqual([42])
	})
})

/* === schedule === */

describe('schedule', () => {
	test('does not run task before RAF fires', () => {
		const el = {} as Element
		const calls: string[] = []
		schedule(el, () => calls.push('ran'))
		expect(calls).toHaveLength(0)
	})

	test('runs task on next RAF', () => {
		const el = {} as Element
		const calls: string[] = []
		schedule(el, () => calls.push('ran'))
		flushRAF()
		expect(calls).toEqual(['ran'])
	})

	test('multiple calls for the same element — only latest task runs', () => {
		const el = {} as Element
		const calls: string[] = []
		schedule(el, () => calls.push('first'))
		schedule(el, () => calls.push('second'))
		schedule(el, () => calls.push('third'))
		flushRAF()
		expect(calls).toEqual(['third'])
	})

	test('multiple calls for the same element request only one RAF', () => {
		const el = {} as Element
		schedule(el, () => {})
		schedule(el, () => {})
		schedule(el, () => {})
		expect(rafCallbacks).toHaveLength(1)
	})

	test('tasks for different elements all run', () => {
		const el1 = {} as Element
		const el2 = {} as Element
		const calls: string[] = []
		schedule(el1, () => calls.push('el1'))
		schedule(el2, () => calls.push('el2'))
		flushRAF()
		expect(calls).toHaveLength(2)
		expect(calls).toContain('el1')
		expect(calls).toContain('el2')
	})
})

/* === shared RAF tick === */

describe('shared RAF tick', () => {
	test('throttle and schedule together request only one RAF', () => {
		const el = {} as Element
		const fn = throttle((_n: number) => {})
		fn(1)
		schedule(el, () => {})
		expect(rafCallbacks).toHaveLength(1)
	})

	test('both execute within the same RAF callback', () => {
		const el = {} as Element
		const calls: string[] = []
		const fn = throttle((_n: number) => calls.push('throttled'))
		fn(1)
		schedule(el, () => calls.push('scheduled'))
		flushRAF()
		expect(calls).toContain('throttled')
		expect(calls).toContain('scheduled')
		expect(rafCallbacks).toHaveLength(0) // no new RAF was requested
	})
})
