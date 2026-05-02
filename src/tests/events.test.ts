/**
 * Unit tests for src/helpers/events.ts
 *
 * requestAnimationFrame is mocked so timing is deterministic.
 * The element is a plain object stub — no real DOM required.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { makeOn } from '../helpers/events'

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

/* === makeOn — async handler === */

describe('makeOn async handlers', () => {
	type HostProps = { count: number }

	const makeStubs = () => {
		// Minimal host stub with one tracked property
		const host = { count: 0, shadowRoot: null } as unknown as HTMLElement &
			HostProps

		// Target element stub with addEventListener
		const listeners = new Map<string, EventListener>()
		const target = {
			addEventListener: (type: string, listener: EventListener) =>
				listeners.set(type, listener),
			removeEventListener: (type: string) => listeners.delete(type),
		} as unknown as Element

		const dispatch = (type: string) => {
			listeners.get(type)?.(new Event(type))
		}

		return { host, target, dispatch }
	}

	test('async handler: Promise return value is ignored — host is not updated', async () => {
		const { host, target, dispatch } = makeStubs()
		const on = makeOn(host)

		// @ts-expect-error async handler should not return a value
		const descriptor = on(target, 'click', async () => ({ count: 42 }))
		descriptor()

		dispatch('click')
		await Promise.resolve()
		// Promise resolved, but on() never awaits it — host must remain unchanged
		expect(host.count).toBe(0)
	})
})
