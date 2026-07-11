/**
 * Unit tests for context helpers in src/helpers/context.ts
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createEffect, createScope } from '@zeix/cause-effect'
import {
	CONTEXT_REQUEST,
	ContextRequestEvent,
	createContext,
	makeProvideContexts,
	makeRequestContext,
} from '../helpers/context'
import type { ComponentProps } from '../types'
// `mock.module` mutates the live module namespace in place, so a captured
// `import * as ns` reference reflects whatever the mock last set — it is NOT
// a stable snapshot. Spread it into a plain object at file-load time, before
// any `mock.module('../util', …)` call below, and restore from that snapshot.
import * as realUtilNamespace from '../util'

const realUtil = { ...realUtilNamespace }

/* === Test Types === */

interface TestProps extends ComponentProps {
	theme: string
	count: number
	enabled: boolean
}

type TestHost = HTMLElement & TestProps

/* === Helpers === */

const createTestHost = (props: Partial<TestProps> = {}): TestHost => {
	const host = {
		theme: 'light',
		count: 0,
		enabled: true,
		...props,
		addEventListener: (_: string, __: any) => {},
		removeEventListener: (_: string, __: any) => {},
		dispatchEvent: (_: Event) => true,
	} as unknown as TestHost
	return host
}

const createEventListenerMap = () => {
	const listeners = new Map<string, Array<(e: Event) => void>>()
	const addEventListener = (type: string, listener: (e: Event) => void) => {
		if (!listeners.has(type)) listeners.set(type, [])
		listeners.get(type)!.push(listener)
	}
	const removeEventListener = (type: string, listener: (e: Event) => void) => {
		const ls = listeners.get(type)
		if (ls) {
			const idx = ls.indexOf(listener)
			if (idx >= 0) ls.splice(idx, 1)
		}
	}
	const dispatchEvent = (event: Event) => {
		const ls = listeners.get(event.type)
		if (ls) {
			for (const listener of [...ls]) listener(event)
		}
		return true
	}
	return { listeners, addEventListener, removeEventListener, dispatchEvent }
}

/* === ContextRequestEvent Tests === */

describe('ContextRequestEvent', () => {
	test('creates event with correct type', () => {
		const context = createContext<() => string>('theme')
		const event = new ContextRequestEvent(context, (getter: () => string) => {})
		expect(event.type).toBe(CONTEXT_REQUEST)
	})

	test('creates event with bubbles and composed flags', () => {
		const context = createContext<() => string>('theme')
		const event = new ContextRequestEvent(
			context,
			(_getter: () => string) => {},
		)
		expect(event.bubbles).toBe(true)
		expect(event.composed).toBe(true)
	})

	test('stores context key', () => {
		const contextKey = createContext<() => string>('theme')
		const event = new ContextRequestEvent(
			contextKey,
			(_getter: () => string) => {},
		)
		expect(event.context).toBe(contextKey)
	})

	test('stores callback function', () => {
		const context = createContext<() => string>('theme')
		const callback = (getter: () => string) => {}
		const event = new ContextRequestEvent(context, callback)
		expect(event.callback).toBe(callback)
	})

	test('defaults subscribe to false', () => {
		const context = createContext<() => string>('theme')
		const event = new ContextRequestEvent(
			context,
			(_getter: () => string) => {},
		)
		expect(event.subscribe).toBe(false)
	})

	test('accepts subscribe flag', () => {
		const context = createContext<() => string>('theme')
		const event = new ContextRequestEvent(
			context,
			(_getter: () => string) => {},
			true,
		)
		expect(event.subscribe).toBe(true)
	})
})

/* === makeProvideContexts Tests === */

describe('makeProvideContexts', () => {
	let host: TestHost
	let eventMap: ReturnType<typeof createEventListenerMap>

	beforeEach(() => {
		eventMap = createEventListenerMap()
		host = {
			...createTestHost(),
			addEventListener: eventMap.addEventListener,
			removeEventListener: eventMap.removeEventListener,
		} as unknown as TestHost
	})

	afterEach(() => {
		// Clean up any remaining listeners
		for (const [, ls] of eventMap.listeners) ls.length = 0
	})

	test('returns a function that accepts contexts array', () => {
		const provideContexts = makeProvideContexts(host)
		const descriptor = provideContexts(['theme', 'count'])
		expect(typeof descriptor).toBe('function')
	})

	test('attaches context-request listener to host when descriptor is called', () => {
		const provideContexts = makeProvideContexts(host)
		const cleanup = provideContexts(['theme'])()

		expect(eventMap.listeners.has(CONTEXT_REQUEST)).toBe(true)

		cleanup?.()
	})

	test('provides matching context value via callback', () => {
		const provideContexts = makeProvideContexts(host)
		const cleanup = provideContexts(['theme'])()

		let receivedGetter: (() => string) | null = null
		const context = createContext<() => string>('theme')
		const event = new ContextRequestEvent(context, (getter: () => string) => {
			receivedGetter = getter
		})

		eventMap.dispatchEvent(event)

		expect(receivedGetter).not.toBeNull()
		expect(receivedGetter!()).toBe('light')

		cleanup?.()
	})

	test('does not provide non-matching context', () => {
		const provideContexts = makeProvideContexts(host)
		const cleanup = provideContexts(['theme'])()

		let callbackCalled = false
		const context = createContext<() => number>('count')
		const event = new ContextRequestEvent(context, (getter: () => number) => {
			callbackCalled = true
		})

		eventMap.dispatchEvent(event)

		expect(callbackCalled).toBe(false)

		cleanup?.()
	})

	test('stops immediate propagation when context matches', () => {
		const provideContexts = makeProvideContexts(host)
		const cleanup = provideContexts(['theme'])()

		let propagationStopped = false
		const context = createContext<() => string>('theme')
		const event = new ContextRequestEvent(context, (getter: () => string) => {})
		// Override stopImmediatePropagation to track calls
		event.stopImmediatePropagation = () => {
			propagationStopped = true
		}

		eventMap.dispatchEvent(event)

		expect(propagationStopped).toBe(true)

		cleanup?.()
	})

	test('provides multiple contexts', () => {
		const provideContexts = makeProvideContexts(host)
		const cleanup = provideContexts(['theme', 'count', 'enabled'])()

		const received: string[] = []

		const themeContext = createContext<() => string>('theme')
		const themeEvent = new ContextRequestEvent(
			themeContext,
			(getter: () => string) => {
				received.push(getter())
			},
		)

		const countContext = createContext<() => number>('count')
		const countEvent = new ContextRequestEvent(
			countContext,
			(getter: () => number) => {
				received.push(String(getter()))
			},
		)

		const enabledContext = createContext<() => boolean>('enabled')
		const enabledEvent = new ContextRequestEvent(
			enabledContext,
			(getter: () => boolean) => {
				received.push(String(getter()))
			},
		)

		eventMap.dispatchEvent(themeEvent)
		eventMap.dispatchEvent(countEvent)
		eventMap.dispatchEvent(enabledEvent)

		expect(received).toEqual(['light', '0', 'true'])

		cleanup?.()
	})

	test('removes listener on cleanup', () => {
		const provideContexts = makeProvideContexts(host)
		const cleanup = provideContexts(['theme'])()

		const initialListenerCount =
			eventMap.listeners.get(CONTEXT_REQUEST)?.length ?? 0
		expect(initialListenerCount).toBeGreaterThan(0)

		cleanup?.()

		const afterCleanupCount =
			eventMap.listeners.get(CONTEXT_REQUEST)?.length ?? 0
		expect(afterCleanupCount).toBe(0)
	})

	test('does not call callback when callback is not a function', () => {
		const provideContexts = makeProvideContexts(host)
		const cleanup = provideContexts(['theme'])()

		const context = createContext<() => string>('theme')
		// Intentionally passing non-function callback - using any to bypass type check
		const event = new ContextRequestEvent(context, 'not a function' as any)

		// Should not throw
		eventMap.dispatchEvent(event)

		cleanup?.()
	})

	test('getter swallows a throwing property access and returns undefined', () => {
		const throwingHost = {
			...createTestHost(),
			addEventListener: eventMap.addEventListener,
			removeEventListener: eventMap.removeEventListener,
		} as unknown as TestHost
		Object.defineProperty(throwingHost, 'theme', {
			get() {
				throw new Error('boom')
			},
		})

		const provideContexts = makeProvideContexts(throwingHost)
		const cleanup = provideContexts(['theme'])()

		let receivedGetter: (() => string) | null = null
		const context = createContext<() => string>('theme')
		const event = new ContextRequestEvent(context, (getter: () => string) => {
			receivedGetter = getter
		})

		eventMap.dispatchEvent(event)

		expect(receivedGetter).not.toBeNull()
		expect(() => receivedGetter!()).not.toThrow()
		expect(receivedGetter!()).toBeUndefined()

		cleanup?.()
	})

	test('logs a DEV_MODE warning naming the host when the getter throws', () => {
		// DEV_MODE is a module-level const captured at import time from
		// `../util`, so flipping `process.env.DEV_MODE` here has no effect on
		// the already-loaded binding. `mock.module` patches the live binding
		// in place (including in already-imported consumers like context.ts),
		// so it's the only way to exercise this branch from a unit test.
		// Deliberately synchronous (no `await`) — bun:test can interleave other
		// files' tests across an `await` point, which would leak this mock into
		// unrelated tests for the window before it's restored. The restore
		// itself uses the `realUtil` snapshot above, not a live import — see
		// that declaration for why a live reference can't be used to restore.
		const originalWarn = console.warn
		const warnings: unknown[][] = []
		console.warn = (...args: unknown[]) => warnings.push(args)

		try {
			mock.module('../util', () => ({ ...realUtil, DEV_MODE: true }))

			const throwingHost = {
				...createTestHost(),
				addEventListener: eventMap.addEventListener,
				removeEventListener: eventMap.removeEventListener,
			} as unknown as TestHost
			Object.defineProperty(throwingHost, 'theme', {
				get() {
					throw new Error('boom')
				},
			})

			const provideContexts = makeProvideContexts(throwingHost)
			const cleanup = provideContexts(['theme'])()

			let receivedGetter: (() => string) | null = null
			const context = createContext<() => string>('theme')
			const event = new ContextRequestEvent(context, (getter: () => string) => {
				receivedGetter = getter
			})
			eventMap.dispatchEvent(event)
			receivedGetter!()

			cleanup?.()
		} finally {
			mock.module('../util', () => realUtil)
			console.warn = originalWarn
		}

		expect(warnings).toHaveLength(1)
		expect(warnings[0]).toContain('provideContexts: getter threw')
	})

	test('only matches string context keys', () => {
		const provideContexts = makeProvideContexts(host)
		const cleanup = provideContexts(['theme'])()

		let callbackCalled = false
		// Symbol context - should not match - need to cast since createContext expects string
		const symbolContext = createContext<() => string>(
			Symbol('theme') as unknown as string,
		)
		const event = new ContextRequestEvent(symbolContext, () => {
			callbackCalled = true
		})

		eventMap.dispatchEvent(event)

		expect(callbackCalled).toBe(false)

		cleanup?.()
	})
})

/* === makeRequestContext Tests === */

describe('makeRequestContext', () => {
	let host: TestHost
	let eventMap: ReturnType<typeof createEventListenerMap>
	let dispatchedEvents: Event[]

	beforeEach(() => {
		eventMap = createEventListenerMap()
		dispatchedEvents = []
		host = {
			...createTestHost(),
			addEventListener: eventMap.addEventListener,
			removeEventListener: eventMap.removeEventListener,
			dispatchEvent: (event: Event) => {
				dispatchedEvents.push(event)
				return eventMap.dispatchEvent(event)
			},
		} as unknown as TestHost
	})

	afterEach(() => {
		for (const [, ls] of eventMap.listeners) ls.length = 0
		dispatchedEvents.length = 0
	})

	test('returns a function that accepts context and fallback', () => {
		const requestContext = makeRequestContext(host)
		const context = createContext<() => string>('theme')
		const memo = requestContext(context, 'dark')
		expect(memo).toHaveProperty('get')
	})

	test('dispatches context-request event', () => {
		const requestContext = makeRequestContext(host)
		const context = createContext<() => string>('theme')
		requestContext(context, 'dark')

		expect(dispatchedEvents.length).toBe(1)
		expect(dispatchedEvents[0]!.type).toBe(CONTEXT_REQUEST)
	})

	test('returns memo with fallback when no provider responds', () => {
		const requestContext = makeRequestContext(host)
		const context = createContext<() => string>('nonexistent')
		const memo = requestContext(context, 'fallback-value')

		expect(memo.get()).toBe('fallback-value')
	})

	test('returns memo with provider value when provider responds', () => {
		// Set up a provider first
		const provideContexts = makeProvideContexts(host)
		const provideCleanup = provideContexts(['theme'])()

		const requestContext = makeRequestContext(host)
		const context = createContext<() => string>('theme')
		const memo = requestContext(context, 'fallback-value')

		// The event was dispatched during requestContext call
		// The provider should have responded
		expect(memo.get()).toBe('light')

		provideCleanup?.()
	})

	test('memo returns getter that reads current host value', () => {
		const provideContexts = makeProvideContexts(host)
		const provideCleanup = provideContexts(['count'])()

		const requestContext = makeRequestContext(host)
		const context = createContext<() => number>('count')
		const memo = requestContext(context, 999)

		// The memo.get() returns the value from the getter at the time of the request
		// The getter is () => host.count, so it reads the current value
		expect(memo.get()).toBe(0)

		provideCleanup?.()
	})

	test('works with object fallback', () => {
		const requestContext = makeRequestContext(host)
		const context = createContext<() => { value: string }>('nonexistent')
		const fallback = { value: 'test' }
		const memo = requestContext(context, fallback)

		expect(memo.get()).toBe(fallback)
	})
})

/* === makeRequestContext Late-Provider Tests === */

describe('makeRequestContext late-provider resolution', () => {
	let host: TestHost
	let eventMap: ReturnType<typeof createEventListenerMap>
	let dispatchedEvents: Event[]

	beforeEach(() => {
		eventMap = createEventListenerMap()
		dispatchedEvents = []
		// isConnected: true so the microtask/timeout retries are not skipped;
		// tests that exercise the disconnect guard override it to false.
		host = {
			...createTestHost(),
			isConnected: true,
			addEventListener: eventMap.addEventListener,
			removeEventListener: eventMap.removeEventListener,
			dispatchEvent: (event: Event) => {
				dispatchedEvents.push(event)
				return eventMap.dispatchEvent(event)
			},
		} as unknown as TestHost
	})

	afterEach(() => {
		for (const [, ls] of eventMap.listeners) ls.length = 0
		dispatchedEvents.length = 0
	})

	test('recovers when a provider answers on the microtask retry', async () => {
		// No provider listener at first dispatch → memo serves fallback.
		// Then a provider attaches (simulating a late customElements.define)
		// before the microtask retry drains, and the consumer recovers.
		const requestContext = makeRequestContext(host)
		const context = createContext<() => string>('theme')
		const memo = requestContext(context, 'fallback-value')

		// Before the provider appears: fallback.
		expect(memo.get()).toBe('fallback-value')

		// The provider upgrades now, attaching its listener.
		const provideContexts = makeProvideContexts(host)
		const cleanup = provideContexts(['theme'])()

		// Flush the microtask retry.
		await Promise.resolve()
		await Promise.resolve()

		expect(memo.get()).toBe('light')

		cleanup?.()
	})

	test('memo reactively re-runs an effect on late-provider answer', async () => {
		const requestContext = makeRequestContext(host)
		const context = createContext<() => string>('theme')
		const memo = requestContext(context, 'fallback-value')

		const values: string[] = []
		const cleanupEffect = createScope(() =>
			createEffect(() => {
				values.push(memo.get())
			}),
		)

		// First run captured the fallback.
		expect(values).toEqual(['fallback-value'])

		// Provider appears after the synchronous dispatch but before the retry.
		const provideContexts = makeProvideContexts(host)
		const cleanup = provideContexts(['theme'])()

		await Promise.resolve()
		await Promise.resolve()

		// The effect re-ran with the provider's value.
		expect(values).toEqual(['fallback-value', 'light'])

		cleanup?.()
		cleanupEffect()
	})

	test('recovers when a provider answers after the timeout retry', async () => {
		// Provider attaches only after the microtask retry has already fired
		// (missed it), but before the ~210 ms timeout retry.
		const requestContext = makeRequestContext(host)
		const context = createContext<() => string>('theme')
		const memo = requestContext(context, 'fallback-value')

		// Drain past the microtask retry without a provider attached.
		await Promise.resolve()
		await Promise.resolve()
		expect(memo.get()).toBe('fallback-value')

		// Now the provider upgrades — after the microtask, before the timeout.
		const provideContexts = makeProvideContexts(host)
		const cleanup = provideContexts(['theme'])()

		// Wait past the CONTEXT_RETRY_DELAY (210 ms).
		await new Promise(r => setTimeout(r, 260))

		expect(memo.get()).toBe('light')

		cleanup?.()
	})

	test('stays on fallback when no provider ever answers (DEV_MODE warning)', async () => {
		const originalWarn = console.warn
		const warnings: unknown[][] = []
		console.warn = (...args: unknown[]) => warnings.push(args)

		try {
			mock.module('../util', () => ({ ...realUtil, DEV_MODE: true }))

			const requestContext = makeRequestContext(host)
			const context = createContext<() => string>('theme')
			const memo = requestContext(context, 'fallback-value')

			await new Promise(r => setTimeout(r, 260))

			expect(memo.get()).toBe('fallback-value')
			expect(warnings).toHaveLength(1)
			expect(String(warnings[0])).toContain('requestContext')
			expect(String(warnings[0])).toContain('theme')
		} finally {
			mock.module('../util', () => realUtil)
			console.warn = originalWarn
		}
	})

	test('does not emit a DEV_MODE warning when DEV_MODE is off', async () => {
		const originalWarn = console.warn
		const warnings: unknown[][] = []
		console.warn = (...args: unknown[]) => warnings.push(args)

		try {
			mock.module('../util', () => ({ ...realUtil, DEV_MODE: false }))

			const requestContext = makeRequestContext(host)
			const context = createContext<() => string>('theme')
			const memo = requestContext(context, 'fallback-value')

			await new Promise(r => setTimeout(r, 260))

			expect(memo.get()).toBe('fallback-value')
			expect(warnings).toHaveLength(0)
		} finally {
			mock.module('../util', () => realUtil)
			console.warn = originalWarn
		}
	})

	test('dispatches exactly once when a provider answers immediately', async () => {
		// Provider present at the synchronous dispatch #1 → the microtask and
		// timeout retries must be skipped (no gratuitous event traffic).
		const provideContexts = makeProvideContexts(host)
		const cleanup = provideContexts(['theme'])()

		const requestContext = makeRequestContext(host)
		const context = createContext<() => string>('theme')
		requestContext(context, 'fallback-value')

		// Drain both retry windows.
		await Promise.resolve()
		await Promise.resolve()
		await new Promise(r => setTimeout(r, 260))

		expect(dispatchedEvents.length).toBe(1)

		cleanup?.()
	})

	test('does not re-dispatch from a disconnected host', async () => {
		const requestContext = makeRequestContext(host)
		const context = createContext<() => string>('theme')
		requestContext(context, 'fallback-value')

		// Synchronous dispatch already happened (count 1).
		expect(dispatchedEvents.length).toBe(1)

		// Disconnect before the microtask retry fires.
		;(host as unknown as { isConnected: boolean }).isConnected = false

		await Promise.resolve()
		await Promise.resolve()
		await new Promise(r => setTimeout(r, 260))

		// No retries dispatched.
		expect(dispatchedEvents.length).toBe(1)
	})
})

/* === Integration Tests === */

describe('Context integration', () => {
	test('provider and requester work together', () => {
		const eventMap = createEventListenerMap()
		const host: TestHost = {
			...createTestHost({ theme: 'dark' }),
			addEventListener: eventMap.addEventListener,
			removeEventListener: eventMap.removeEventListener,
			dispatchEvent: eventMap.dispatchEvent,
		} as unknown as TestHost

		const provideContexts = makeProvideContexts(host)
		const requestContext = makeRequestContext(host)

		const provideCleanup = provideContexts(['theme'])()
		const context = createContext<() => string>('theme')
		const memo = requestContext(context, 'light')

		expect(memo.get()).toBe('dark')

		provideCleanup?.()
	})

	test('provider responds to context requests', () => {
		const eventMap = createEventListenerMap()
		const host: TestHost = {
			...createTestHost({ theme: 'light' }),
			addEventListener: eventMap.addEventListener,
			removeEventListener: eventMap.removeEventListener,
			dispatchEvent: eventMap.dispatchEvent,
		} as unknown as TestHost

		// Host provides 'theme' context
		const provideContexts = makeProvideContexts(host)
		const cleanup = provideContexts(['theme'])()

		// Request from same host
		const requestContext = makeRequestContext(host)
		const context = createContext<() => string>('theme')
		const memo = requestContext(context, 'fallback')

		expect(memo.get()).toBe('light')

		cleanup?.()
	})
})

/* === CONTEXT_REQUEST constant === */

describe('CONTEXT_REQUEST', () => {
	test('is the string "context-request"', () => {
		expect(CONTEXT_REQUEST).toBe('context-request')
	})
})
