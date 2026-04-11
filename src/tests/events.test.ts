/**
 * Unit tests for src/events.ts
 *
 * requestAnimationFrame is mocked so timing is deterministic.
 * The element is a plain object stub — no real DOM required.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createEffect } from '@zeix/cause-effect'
import { createEventsSensor } from '../events'

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
	flushRAF()
})

const flushRAF = () => {
	const cbs = rafCallbacks.splice(0)
	for (const cb of cbs) cb(0)
}

/* === createEventsSensor === */

describe('createEventsSensor', () => {
	const makeEl = () => {
		const listeners = new Map<string, EventListener>()
		const el = {
			addEventListener: (type: string, listener: EventListener) =>
				listeners.set(type, listener),
			removeEventListener: (type: string) => listeners.delete(type),
			contains: () => true,
		} as unknown as Element
		const dispatch = (type: string) => {
			const e = {
				target: el,
				stopImmediatePropagation: () => {},
			} as unknown as Event
			listeners.get(type)?.(e)
		}
		return { el, dispatch }
	}

	test('two passive event types both run once per frame', () => {
		const { el, dispatch } = makeEl()
		const scrollCalls: number[] = []
		const wheelCalls: number[] = []

		const sensor = createEventsSensor(el, 0, {
			scroll: ({ prev }) => {
				scrollCalls.push(prev + 1)
				return prev + 1
			},
			wheel: ({ prev }) => {
				wheelCalls.push(prev + 10)
				return prev + 10
			},
		})

		// Sensors are lazy — activate by reading inside an effect
		createEffect(() => void sensor.get())

		dispatch('scroll')
		dispatch('wheel')

		// Neither handler should have run yet
		expect(scrollCalls).toHaveLength(0)
		expect(wheelCalls).toHaveLength(0)

		flushRAF()

		// Both handlers run exactly once per frame — the previous schedule-slot
		// bug would have dropped whichever fired first
		expect(scrollCalls).toHaveLength(1)
		expect(wheelCalls).toHaveLength(1)
	})
})
