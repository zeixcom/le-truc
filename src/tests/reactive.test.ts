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

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
	createEffect,
	createMemo,
	createScope,
	createSlot,
	createState,
	createTask,
} from '@zeix/cause-effect'
import {
	activateResult,
	each,
	makePass,
	makeRun,
	makeWatch,
} from '../helpers/reactive'
import {
	getSignals,
	installActiveCollector,
	restoreActiveCollector,
	withCollector,
} from '../internal'
import type { ComponentProps, EffectDescriptor } from '../types'

/* === Helpers === */

// makeWatch only uses host for string-keyed sources, which these tests don't exercise.
const stubHost = () => ({}) as unknown as HTMLElement

/* === Tests === */

// watch()/pass()/each() push into the currently active effect-descriptor
// collector (ADR 0018) and throw NoActiveCollectorError if none is active.
// These tests call the helpers directly, outside `defineComponent`'s factory
// execution, so install a throwaway collector for the duration of the file.
let previousCollector: EffectDescriptor[] | undefined
beforeEach(() => {
	previousCollector = installActiveCollector([])
})
afterEach(() => {
	restoreActiveCollector(previousCollector)
})

describe('implicit effect collection (ADR 0018)', () => {
	test('watch() pushes its descriptor into the active collector', () => {
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const watch = makeWatch(host)
		const collector: EffectDescriptor[] = []
		let descriptor: EffectDescriptor
		withCollector(collector, () => {
			descriptor = watch(createState('x'), () => {})
		})
		expect(collector).toEqual([descriptor!])
	})

	test('pass() pushes its descriptor into the active collector', () => {
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const pass = makePass(host)
		const target = { localName: 'my-el' } as unknown as HTMLElement &
			ComponentProps
		const collector: EffectDescriptor[] = []
		let descriptor: EffectDescriptor
		withCollector(collector, () => {
			descriptor = pass(target, {})
		})
		expect(collector).toEqual([descriptor!])
	})

	test('throws NoActiveCollectorError when called with no active collector', () => {
		// Deactivate the file-level throwaway collector installed by the outer
		// beforeEach — the outer afterEach restores from `previousCollector`
		// (captured before this test ran), so no manual cleanup is needed here.
		restoreActiveCollector(undefined)
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const watch = makeWatch(host)
		expect(() => watch(createState('x'), () => {})).toThrow(
			'watch() called outside synchronous factory, each() callback, or reconcile() bindItem execution',
		)
	})

	test('run() pushes a wrapped descriptor into the active collector', () => {
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const run = makeRun(host)
		const rawDescriptor: EffectDescriptor = () => () => {}
		const collector: EffectDescriptor[] = []
		withCollector(collector, () => {
			run(rawDescriptor)
		})
		// The pushed descriptor is a createScope() wrapper around rawDescriptor
		// (see makeRun), not rawDescriptor itself — the wrapping is what makes
		// rawDescriptor's returned cleanup actually register for disposal.
		expect(collector).toHaveLength(1)
		expect(collector[0]).not.toBe(rawDescriptor)
	})

	test('run() returns void, unlike watch()/on()/pass()/provideContexts()', () => {
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const run = makeRun(host)
		const collector: EffectDescriptor[] = []
		const result = withCollector(collector, () => run(() => {}))
		expect(result).toBeUndefined()
	})

	test('run() throws NoActiveCollectorError when called with no active collector', () => {
		restoreActiveCollector(undefined)
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const run = makeRun(host)
		expect(() => run(() => {})).toThrow(
			'run() called outside synchronous factory, each() callback, or reconcile() bindItem execution',
		)
	})
})

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

describe('each — implicit collection (ADR 0018)', () => {
	test('activates a bare (non-returned) watch() call made inside the callback', () => {
		const el = {} as Element
		const memo = createMemo(() => [el])
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const state = createState('a')
		const seen: string[] = []
		const watch = makeWatch(host)
		const descriptor = each(memo, () => {
			// Bare call, no return — must still register and run.
			watch(state, value => {
				seen.push(value)
			})
		})
		createScope(() => descriptor())
		expect(seen).toEqual(['a'])
	})

	test('does not double-activate a descriptor that is both collected and returned', () => {
		const el = {} as Element
		const memo = createMemo(() => [el])
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const state = createState('a')
		const runs: string[] = []
		const watch = makeWatch(host)
		const descriptor = each(memo, () =>
			// Old explicit-return style: watch() both pushes into the active
			// collector AND is returned — must run exactly once, not twice.
			watch(state, value => {
				runs.push(value)
			}),
		)
		createScope(() => descriptor())
		expect(runs).toEqual(['a'])
	})

	test('supports each() nested 3+ levels deep with implicit collection', () => {
		// A grid: rows containing columns containing cells, each level
		// registering its own bare watch() call.
		const seen: string[] = []
		const cellMemo = createMemo(() => [{} as Element])
		const colMemo = createMemo(() => [{} as Element])
		const rowMemo = createMemo(() => [{} as Element])
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const watch = makeWatch(host)
		const state = createState('grid')

		// Plain inline block-body arrows — no named handlers, no explicit each<Element>
		// type args needed. See LT-009: the earlier workaround (named handlers with
		// explicit `: void` return types) wasn't fixing a nesting-depth inference
		// limitation — it was incidentally avoiding a real type error unrelated to
		// nesting (an expression-bodied arrow returning a non-void value). Any
		// void-returning handler compiles fine at any depth; see LT-009's TODO.md
		// entry for the full root-cause writeup.
		const descriptor = each(rowMemo, () => {
			watch(state, v => {
				seen.push(`row:${v}`)
			})
			each(colMemo, () => {
				watch(state, v => {
					seen.push(`col:${v}`)
				})
				each(cellMemo, () => {
					watch(state, v => {
						seen.push(`cell:${v}`)
					})
				})
			})
		})
		createScope(() => descriptor())
		expect(seen).toEqual(['row:grid', 'col:grid', 'cell:grid'])
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

describe('makePass — real slot swap and restore', () => {
	test('swaps a Slot-backed property to the host signal, and restores the original on cleanup', () => {
		const hostState = createState('host-value')
		const targetState = createState('original-value')
		const host = { greeting: hostState } as unknown as HTMLElement &
			ComponentProps
		// `localName` needs a hyphen — `swapSlots` rejects non-custom-elements.
		const target = { localName: 'my-target' } as unknown as HTMLElement &
			ComponentProps
		const slot = createSlot(targetState)
		getSignals(target)['greeting'] = slot
		Object.defineProperty(target, 'greeting', slot)

		const pass = makePass(host)
		const descriptor = pass(target, { greeting: hostState })

		const cleanup = createScope(() => descriptor())
		expect((target as any).greeting).toBe('host-value')

		cleanup?.()
		expect((target as any).greeting).toBe('original-value')
	})

	test('throws InvalidPassPropertyError when the target prop is not Slot-backed', () => {
		const hostState = createState('host-value')
		const host = { greeting: hostState } as unknown as HTMLElement &
			ComponentProps
		const target = {
			localName: 'my-target',
			greeting: 'plain-value',
		} as unknown as HTMLElement & ComponentProps

		const pass = makePass(host)
		const descriptor = pass(target, { greeting: hostState })

		// No Slot was registered for 'greeting' — e.g. a non-Le-Truc custom element,
		// or a read-only/computed Le Truc prop (see ADR 0011).
		expect(() => createScope(() => descriptor())).toThrow(/'greeting'/)
		// The plain own value is untouched — no partial swap on failure.
		expect(target.greeting).toBe('plain-value')
	})

	test('throws InvalidPassPropertyError when the prop does not exist on target', () => {
		const hostState = createState('host-value')
		const host = { greeting: hostState } as unknown as HTMLElement &
			ComponentProps
		const target = { localName: 'my-target' } as unknown as HTMLElement &
			ComponentProps

		const pass = makePass(host)
		const descriptor = pass(target, { greeting: hostState })

		expect(() => createScope(() => descriptor())).toThrow(/'greeting'/)
	})

	test('aggregates multiple failing props into a single InvalidPassPropertyError', () => {
		const hostState = createState('host-value')
		const host = {
			greeting: hostState,
			farewell: hostState,
		} as unknown as HTMLElement & ComponentProps
		const target = {
			localName: 'my-target',
			greeting: 'plain-value',
		} as unknown as HTMLElement & ComponentProps

		const pass = makePass(host)
		// 'greeting' is not Slot-backed; 'farewell' does not exist on target at all.
		const descriptor = pass(target, {
			greeting: hostState,
			farewell: hostState,
		})

		let error: unknown
		try {
			createScope(() => descriptor())
		} catch (e) {
			error = e
		}
		expect(error).toBeInstanceOf(Error)
		const message = (error as Error).message
		expect(message).toContain('greeting')
		expect(message).toContain('farewell')
	})

	test('does not leave a partial swap when one of several props fails', () => {
		const hostGreeting = createState('host-greeting')
		const hostFarewell = createState('host-farewell')
		const targetGreetingState = createState('original-greeting')
		const host = {
			greeting: hostGreeting,
			farewell: hostFarewell,
		} as unknown as HTMLElement & ComponentProps
		const target = {
			localName: 'my-target',
		} as unknown as HTMLElement & ComponentProps
		const slot = createSlot(targetGreetingState)
		getSignals(target)['greeting'] = slot
		Object.defineProperty(target, 'greeting', slot)
		// 'farewell' does not exist on target — this entry fails validation.

		const pass = makePass(host)
		const descriptor = pass(target, {
			greeting: hostGreeting,
			farewell: hostFarewell,
		})

		expect(() => createScope(() => descriptor())).toThrow(/'farewell'/)
		// 'greeting' would have succeeded in isolation, but the whole call is
		// atomic — its slot must still hold the original signal, unswapped.
		expect(slot.current()).toBe(targetGreetingState)
	})

	test('throws InvalidCustomElementError when the target is not a custom element', () => {
		const hostState = createState('host-value')
		const host = {} as unknown as HTMLElement & ComponentProps
		const target = { localName: 'div' } as unknown as HTMLElement &
			ComponentProps

		const pass = makePass(host)
		const descriptor = pass(target, { greeting: hostState })
		expect(() => createScope(() => descriptor())).toThrow()
	})
})

describe('makePass — ADR-0012 DEV_MODE warning for writable short forms', () => {
	// Shared helper: a Le-Truc-style target with one Slot-backed prop, so the
	// warning fires before the eager slot validation rejects the binding.
	const makeTarget = (prop: string) => {
		const targetState = createState('original')
		const slot = createSlot(targetState)
		const target = { localName: 'my-target' } as unknown as HTMLElement &
			ComponentProps
		getSignals(target)[prop] = slot
		Object.defineProperty(target, prop, slot)
		return target
	}

	// DEV guards read `process.env.DEV_MODE` at call time, so flipping the
	// env var around the call is enough — no module mocking required.
	const captureWarnings = () => {
		const warnings: unknown[][] = []
		const originalWarn = console.warn
		const prevDevMode = process.env.DEV_MODE
		console.warn = (...args: unknown[]) => warnings.push(args)
		process.env.DEV_MODE = 'true'
		return {
			warnings,
			restore: () => {
				if (prevDevMode === undefined) delete process.env.DEV_MODE
				else process.env.DEV_MODE = prevDevMode
				console.warn = originalWarn
			},
		}
	}

	const EXPECTED = (prop: string) =>
		`pass() received a writable signal for '${prop}'. Use () => host.${prop} for read-only access, or { get, set } to mediate writes.`

	// Detection is reversed (ADR-0012): allow only what is provably read-only.

	test('warns for a property key resolving to a writable host State', () => {
		const hostState = createState('host')
		const host = { value: hostState } as unknown as HTMLElement & ComponentProps
		// Register the host signal like a real Le Truc component, so the
		// property-key form resolves to the writable State (not a createMemo
		// fallback, which is read-only and would not warn).
		getSignals(host)['value'] = hostState
		const target = makeTarget('value')
		const { warnings, restore } = captureWarnings()
		try {
			createScope(() => makePass(host)(target, { value: 'value' })())
		} finally {
			restore()
		}
		expect(warnings).toHaveLength(1)
		expect(warnings[0]?.[0]).toBe(EXPECTED('value'))
	})

	test('warns for a bare State passed directly', () => {
		const hostState = createState('host')
		const host = {} as unknown as HTMLElement & ComponentProps
		const target = makeTarget('value')
		const { warnings, restore } = captureWarnings()
		try {
			createScope(() => makePass(host)(target, { value: hostState })())
		} finally {
			restore()
		}
		expect(warnings).toHaveLength(1)
		expect(warnings[0]?.[0]).toBe(EXPECTED('value'))
	})

	test('warns for a bare Slot passed directly (backing may swap to mutable at runtime)', () => {
		const backingState = createState('host')
		const slot = createSlot(backingState)
		const host = {} as unknown as HTMLElement & ComponentProps
		const target = makeTarget('value')
		const { warnings, restore } = captureWarnings()
		try {
			createScope(() => makePass(host)(target, { value: slot })())
		} finally {
			restore()
		}
		expect(warnings).toHaveLength(1)
		expect(warnings[0]?.[0]).toBe(EXPECTED('value'))
	})

	test('does NOT warn for a { get, set } descriptor (explicit mediated form)', () => {
		const hostState = createState('host')
		const host = {} as unknown as HTMLElement & ComponentProps
		const target = makeTarget('value')
		const { warnings, restore } = captureWarnings()
		try {
			createScope(() =>
				makePass(host)(target, {
					value: { get: hostState.get, set: hostState.set },
				})(),
			)
		} finally {
			restore()
		}
		expect(warnings).toHaveLength(0)
	})

	test('does NOT warn for a thunk () => ... (toSignal wraps it as a Memo)', () => {
		const hostState = createState('host')
		const host = { value: hostState } as unknown as HTMLElement & ComponentProps
		const target = makeTarget('value')
		const { warnings, restore } = captureWarnings()
		try {
			createScope(() =>
				makePass(host)(target, { value: () => hostState.get() })(),
			)
		} finally {
			restore()
		}
		expect(warnings).toHaveLength(0)
	})

	test('does NOT warn for a bare Memo passed directly (read-only derived)', () => {
		const memo = createMemo(() => 'derived')
		const host = {} as unknown as HTMLElement & ComponentProps
		const target = makeTarget('value')
		const { warnings, restore } = captureWarnings()
		try {
			createScope(() => makePass(host)(target, { value: memo })())
		} finally {
			restore()
		}
		expect(warnings).toHaveLength(0)
	})

	test('does NOT warn for a bare Task passed directly (read-only derived)', () => {
		const task = createTask(async () => 'resolved', { value: 'seeded' })
		const host = {} as unknown as HTMLElement & ComponentProps
		const target = makeTarget('value')
		const { warnings, restore } = captureWarnings()
		try {
			createScope(() => makePass(host)(target, { value: task })())
		} finally {
			restore()
		}
		expect(warnings).toHaveLength(0)
	})

	test('warns once per writable prop and aggregates across multiple props', () => {
		const hostState = createState('host')
		const host = { a: hostState, b: hostState } as unknown as HTMLElement &
			ComponentProps
		// Register the 'a' host signal so the property-key form resolves to
		// the writable State (the 'b' entry passes the State directly).
		getSignals(host)['a'] = hostState
		const target = makeTarget('a')
		// second Slot-backed prop
		const slotB = createSlot(createState('orig-b'))
		getSignals(target)['b'] = slotB
		Object.defineProperty(target, 'b', slotB)

		const { warnings, restore } = captureWarnings()
		try {
			createScope(() =>
				makePass(host)(target, {
					a: 'a',
					b: hostState,
				})(),
			)
		} finally {
			restore()
		}
		expect(warnings).toHaveLength(2)
		const messages = warnings.map(w => w[0])
		expect(messages).toContain(EXPECTED('a'))
		expect(messages).toContain(EXPECTED('b'))
	})
})

describe('each — element leave/enter disposal', () => {
	// The callback's returned descriptor is invoked and its return value
	// discarded (see `activateResult`) — a bare `() => cleanupFn` registers
	// nothing. Cleanup must come from a primitive that self-registers with
	// the active owner, e.g. `createEffect`, which is what `watch()` uses
	// internally. That's why the descriptor here wraps `createEffect`.
	const trackedDescriptor = (log: string[], id: string) => () =>
		createEffect(() => {
			log.push(`enter:${id}`)
			return () => log.push(`leave:${id}`)
		})

	test('disposes the per-element scope when an element leaves, before creating scopes for the new set', () => {
		const elA = { id: 'a' } as unknown as Element
		const elB = { id: 'b' } as unknown as Element
		const source = createState<Element[]>([elA])
		const memo = createMemo(() => source.get())

		const log: string[] = []
		const descriptor = each(memo, (el: Element) =>
			trackedDescriptor(log, (el as any).id),
		)

		const cleanup = createScope(() => descriptor())
		expect(log).toEqual(['enter:a'])

		source.set([elB])
		expect(log).toEqual(['enter:a', 'leave:a', 'enter:b'])

		cleanup?.()
		expect(log).toEqual(['enter:a', 'leave:a', 'enter:b', 'leave:b'])
	})

	test("keeps a surviving element's scope alive when another element enters", () => {
		const elA = { id: 'a' } as unknown as Element
		const elB = { id: 'b' } as unknown as Element
		const source = createState<Element[]>([elA])
		const memo = createMemo(() => source.get())

		const log: string[] = []
		const descriptor = each(memo, (el: Element) =>
			trackedDescriptor(log, (el as any).id),
		)

		const cleanup = createScope(() => descriptor())
		expect(log).toEqual(['enter:a'])

		// elA stays, elB is added — scopes are keyed by element identity, so
		// only the entering elB gets a new scope; elA's scope (and everything
		// registered on it) survives untouched.
		source.set([elA, elB])
		expect(log).toEqual(['enter:a', 'enter:b'])

		// Disposing the component scope still tears down every live
		// per-element scope, including the root-scoped surviving ones.
		cleanup?.()
		expect(log).toEqual(['enter:a', 'enter:b', 'leave:a', 'leave:b'])
	})
})

describe('makePass — keyed per-element lifecycle for Memo targets', () => {
	const makeTarget = (name: string) => {
		const originalState = createState(`original-${name}`)
		const slot = createSlot(originalState)
		const target = { localName: 'my-target' } as unknown as HTMLElement &
			ComponentProps
		getSignals(target)['greeting'] = slot
		Object.defineProperty(target, 'greeting', slot)
		return { target, slot, originalState }
	}

	test("keeps a surviving target's injected slot signal identity-stable when another target enters", () => {
		const hostState = createState('host-value')
		const host = { greeting: hostState } as unknown as HTMLElement &
			ComponentProps
		const a = makeTarget('a')
		const b = makeTarget('b')

		const source = createState<(HTMLElement & ComponentProps)[]>([a.target])
		const memo = createMemo(() => source.get())

		const pass = makePass(host)
		const descriptor = pass(memo, { greeting: () => hostState.get() })

		const cleanup = createScope(() => descriptor())
		expect((a.target as any).greeting).toBe('host-value')
		const injectedIntoA = a.slot.current()

		// b enters — a's scope must survive: its slot still holds the very
		// same injected signal instance, not a freshly created computed.
		source.set([a.target, b.target])
		expect(a.slot.current()).toBe(injectedIntoA)
		expect((b.target as any).greeting).toBe('host-value')

		// b leaves — only b's slot is restored; a is still untouched.
		source.set([a.target])
		expect(a.slot.current()).toBe(injectedIntoA)
		expect(b.slot.current()).toBe(b.originalState)
		expect((b.target as any).greeting).toBe('original-b')

		// Component disconnect restores the surviving target's original signal.
		cleanup?.()
		expect(a.slot.current()).toBe(a.originalState)
		expect((a.target as any).greeting).toBe('original-a')
	})
})
