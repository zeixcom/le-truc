/**
 * Unit tests for src/helpers/events.ts
 *
 * requestAnimationFrame is mocked so timing is deterministic.
 * The element is a plain object stub — no real DOM required.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createMemo, createState, type Memo } from '@zeix/cause-effect'
import { makeOn } from '../helpers/events'
// `mock.module` mutates the live module namespace in place, so a captured
// `import * as ns` reference reflects whatever the mock last set — it is NOT
// a stable snapshot. Spread it into a plain object at file-load time, before
// any `mock.module('../util', …)` call below, and restore from that snapshot.
import * as realUtilNamespace from '../util'

const realUtil = { ...realUtilNamespace }

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

/* === makeOn — passive/throttle === */

describe('makeOn passive scheduling', () => {
	type HostProps = { count: number }

	const makeStubs = () => {
		const host = { count: 0, shadowRoot: null } as unknown as HTMLElement &
			HostProps
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

	test('passive events (e.g. scroll) are throttled to one call per animation frame', () => {
		const { host, target, dispatch } = makeStubs()
		const on = makeOn(host)
		const descriptor = on(target, 'scroll', () => ({ count: 1 }))
		descriptor()

		dispatch('scroll')
		// Throttled via requestAnimationFrame — not applied until the frame flushes
		expect(host.count).toBe(0)
		flushRAF()
		expect(host.count).toBe(1)
	})

	test('non-passive events (e.g. click) apply synchronously, without RAF', () => {
		const { host, target, dispatch } = makeStubs()
		const on = makeOn(host)
		const descriptor = on(target, 'click', () => ({ count: 1 }))
		descriptor()

		dispatch('click')
		expect(host.count).toBe(1)
	})

	test('explicit passive:false on a default-passive event type disables throttling', () => {
		const { host, target, dispatch } = makeStubs()
		const on = makeOn(host)
		const descriptor = on(target, 'scroll', () => ({ count: 1 }), {
			passive: false,
		})
		descriptor()

		dispatch('scroll')
		expect(host.count).toBe(1)
	})
})

/* === makeOn — Memo target: delegation vs per-element fallback === */

describe('makeOn Memo target dispatch', () => {
	const makeFakeElement = () => {
		const listeners = new Map<string, EventListener>()
		const el = {
			addEventListener: (type: string, listener: EventListener) =>
				listeners.set(type, listener),
			removeEventListener: (type: string) => listeners.delete(type),
		}
		return Object.assign(el, {
			_listeners: listeners,
		}) as unknown as Element & {
			_listeners: Map<string, EventListener>
		}
	}

	const makeHost = () => {
		const listeners = new Map<string, EventListener>()
		const host = {
			shadowRoot: null,
			addEventListener: (type: string, listener: EventListener) =>
				listeners.set(type, listener),
			removeEventListener: (type: string) => listeners.delete(type),
		}
		return Object.assign(host, {
			_listeners: listeners,
		}) as unknown as HTMLElement & {
			_listeners: Map<string, EventListener>
		}
	}

	test('bubbling event type delegates: one listener on the root, dispatched via composedPath', () => {
		const el1 = makeFakeElement()
		const el2 = makeFakeElement()
		const host = makeHost()
		const memo = createMemo(() => [el1, el2]) as unknown as Memo<Element[]>

		const calls: Element[] = []
		const on = makeOn(host)
		const descriptor = on(memo, 'click', (_e, el) => {
			calls.push(el)
		})
		descriptor()

		// Delegation — no listener attached to the individual elements
		expect(el1._listeners.size).toBe(0)
		expect(el2._listeners.size).toBe(0)
		expect(host._listeners.has('click')).toBe(true)

		const event = { composedPath: () => [el1] } as unknown as Event
		host._listeners.get('click')!(event)
		expect(calls).toEqual([el1])
	})

	test('event whose path matches no Memo element is ignored', () => {
		const el1 = makeFakeElement()
		const host = makeHost()
		const memo = createMemo(() => [el1]) as unknown as Memo<Element[]>

		let called = false
		const on = makeOn(host)
		const descriptor = on(memo, 'click', () => {
			called = true
		})
		descriptor()

		const event = { composedPath: () => [] } as unknown as Event
		host._listeners.get('click')!(event)
		expect(called).toBe(false)
	})

	test('non-bubbling event type falls back to per-element listeners instead of delegation', () => {
		const el1 = makeFakeElement()
		const el2 = makeFakeElement()
		const host = makeHost()
		const memo = createMemo(() => [el1, el2]) as unknown as Memo<Element[]>

		const on = makeOn(host)
		const descriptor = on(memo, 'focus', () => {})
		descriptor()

		expect(el1._listeners.has('focus')).toBe(true)
		expect(el2._listeners.has('focus')).toBe(true)
		// No delegated listener on the root for a non-bubbling type
		expect(host._listeners.has('focus')).toBe(false)
	})

	test('per-element fallback keeps surviving elements’ listeners when the collection changes', () => {
		const makeSpiedElement = () => {
			const el = makeFakeElement()
			const counts = { added: 0, removed: 0 }
			const originalAdd = el.addEventListener.bind(el)
			const originalRemove = el.removeEventListener.bind(el)
			el.addEventListener = (type: string, listener: EventListener) => {
				counts.added++
				originalAdd(type, listener)
			}
			el.removeEventListener = (type: string, listener: EventListener) => {
				counts.removed++
				originalRemove(type, listener)
			}
			return Object.assign(el, { _counts: counts })
		}

		const el1 = makeSpiedElement()
		const el2 = makeSpiedElement()
		const el3 = makeSpiedElement()
		const host = makeHost()
		const source = createState<Element[]>([el1, el2])
		const memo = createMemo(() => source.get())

		const on = makeOn(host)
		on(memo, 'focus', () => {})()

		expect(el1._counts).toEqual({ added: 1, removed: 0 })
		expect(el2._counts).toEqual({ added: 1, removed: 0 })

		// el3 enters — the surviving el1/el2 listeners are not detached or
		// re-attached; only el3 gets exactly one new listener.
		source.set([el1, el2, el3])
		expect(el1._counts).toEqual({ added: 1, removed: 0 })
		expect(el2._counts).toEqual({ added: 1, removed: 0 })
		expect(el3._counts).toEqual({ added: 1, removed: 0 })

		// el2 leaves — only its listener is removed.
		source.set([el1, el3])
		expect(el1._counts).toEqual({ added: 1, removed: 0 })
		expect(el2._counts).toEqual({ added: 1, removed: 1 })
		expect(el3._counts).toEqual({ added: 1, removed: 0 })
	})

	test('per-element fallback logs a DEV_MODE warning pointing at each() + on()', () => {
		// Deliberately synchronous (no `await`) — see context.test.ts's
		// DEV_MODE test for why an `await` here would risk leaking the mock
		// into other files' tests via bun:test interleaving.
		const originalWarn = console.warn
		const warnings: unknown[][] = []
		console.warn = (...args: unknown[]) => warnings.push(args)

		try {
			mock.module('../util', () => ({ ...realUtil, DEV_MODE: true }))
			const el1 = makeFakeElement()
			const host = makeHost()
			const memo = createMemo(() => [el1]) as unknown as Memo<Element[]>
			const on = makeOn(host)
			on(memo, 'focus', () => {})()
		} finally {
			mock.module('../util', () => realUtil)
			console.warn = originalWarn
		}

		expect(warnings).toHaveLength(1)
		expect(warnings[0]?.[0]).toContain("'focus' does not bubble")
	})
})
