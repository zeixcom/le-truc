/**
 * Unit tests for makeWatch in src/helpers/reactive.ts
 *
 * Tests that SingleMatchHandlers branches (ok, nil, stale) are correctly forwarded
 * to match(), and that the array-source form passes a MatchHandlers object through
 * to match()'s multi-signal overload (nil on any unset source, collected errors,
 * stale on a seeded re-computing Task) with a per-position-inferred value tuple.
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
import { InvalidPassPropertyError } from '../errors'
import type { PassedProps } from '../helpers/reactive'
import {
	activateDescriptors,
	each,
	makePass,
	makeWatch,
} from '../helpers/reactive'
import {
	getSignals,
	installActiveCollector,
	restoreActiveCollector,
	withCollector,
} from '../internal'
import type { ComponentProps, EffectDescriptor } from '../types'
import { activate } from './activate'

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
		withCollector(collector, () => {
			watch(createState('x'), () => {})
		})
		expect(collector).toHaveLength(1)
		expect(typeof collector[0]).toBe('function')
	})

	test('pass() pushes its descriptor into the active collector', () => {
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const pass = makePass(host)
		const target = { localName: 'my-el' } as unknown as HTMLElement &
			ComponentProps
		const collector: EffectDescriptor[] = []
		withCollector(collector, () => {
			pass(target, {})
		})
		expect(collector).toHaveLength(1)
		expect(typeof collector[0]).toBe('function')
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
})

describe('makeWatch — basic function signature', () => {
	test('returns a watch helper function', () => {
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const watch = makeWatch(host)
		expect(typeof watch).toBe('function')
	})

	test('registers via the collector when called with signal and handler', () => {
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const watch = makeWatch(host)
		const signal = createState('test')
		const collector: EffectDescriptor[] = []
		withCollector(collector, () => watch(signal, () => {}))
		expect(collector).toHaveLength(1)
		expect(typeof collector[0]).toBe('function')
	})

	test('registers via the collector when called with property name and handler', () => {
		const host = { testProp: 'value' } as unknown as HTMLElement &
			ComponentProps
		const watch = makeWatch(host)
		const collector: EffectDescriptor[] = []
		withCollector(collector, () => watch('testProp', () => {}))
		expect(collector).toHaveLength(1)
		expect(typeof collector[0]).toBe('function')
	})

	test('registers via the collector when called with thunk and handler', () => {
		const host = stubHost() as unknown as HTMLElement & ComponentProps
		const watch = makeWatch(host)
		const collector: EffectDescriptor[] = []
		withCollector(collector, () =>
			watch(
				() => 'test',
				() => {},
			),
		)
		expect(collector).toHaveLength(1)
		expect(typeof collector[0]).toBe('function')
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

		const cleanup = activate(() => {
			watch(task, {
				ok: v => {
					calls.push(`ok:${v}`)
				},
				stale: () => {
					calls.push('stale')
				},
			})
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

		const cleanup = activate(() => {
			watch(state, {
				ok: (v: string) => {
					calls.push(`ok:${v}`)
				},
				stale: () => {
					calls.push('stale')
				},
			})
		})

		expect(calls).toEqual(['ok:hello'])

		state.set('world')
		expect(calls).toEqual(['ok:hello', 'ok:world'])
		expect(calls).not.toContain('stale')

		cleanup?.()
	})
})

describe('makeWatch — array source', () => {
	test('delivers the resolved tuple to the plain handler', () => {
		const calls: unknown[][] = []
		const watch = makeWatch(
			stubHost() as unknown as HTMLElement & ComponentProps,
		)
		const num = createState(1)
		const str = createState('a')
		const cleanup = activate(() => {
			watch([num, str], values => {
				calls.push([...values])
			})
		})

		expect(calls).toEqual([[1, 'a']])

		num.set(2)
		expect(calls).toEqual([
			[1, 'a'],
			[2, 'a'],
		])

		cleanup?.()
	})

	test('infers the value tuple per position (mixed source forms)', () => {
		const calls: unknown[][] = []
		const host = { testProp: 'value' } as unknown as HTMLElement & {
			testProp: string
		}
		const watch = makeWatch(host)
		const num = createState(1)
		const cleanup = activate(() => {
			watch([num, 'testProp', () => 2], values => {
				// Compile-time pin: Signal → V, prop key → P[K], thunk →
				// awaited non-null return. Load-bearing both ways — if the
				// array form still carried `any[]`, the negative pin below
				// would stop erroring and `tsc` would flag it as unused.
				const typed: [number, string, number] = values
				// @ts-expect-error — positions resolve per source form, not all-any
				const wrong: [string, string, string] = values
				void wrong
				calls.push([...typed])
			})
		})

		expect(calls).toEqual([[1, 'value', 2]])

		cleanup?.()
	})

	test('nil fires while any source is unset, then ok once it resolves', async () => {
		const calls: string[] = []
		const deferred = { resolve: () => {} }
		const pending = createTask(async () => {
			await new Promise<void>(r => {
				deferred.resolve = r
			})
			return 'ready'
		})
		const set = createState('x')
		const watch = makeWatch(
			stubHost() as unknown as HTMLElement & ComponentProps,
		)
		const cleanup = activate(() => {
			watch([set, pending], {
				ok: values => {
					calls.push(`ok:${values[1]}`)
				},
				nil: () => {
					calls.push('nil')
				},
			})
		})

		// Unseeded task source → UnsetSignalValueError → nil for the whole
		// tuple, even though the State source has a value.
		expect(calls).toEqual(['nil'])

		deferred.resolve()
		await new Promise<void>(r => setTimeout(r, 0))
		expect(calls).toEqual(['nil', 'ok:ready'])

		cleanup?.()
	})

	test('err collects a source error once the rejected task settles', async () => {
		const calls: string[] = []
		const failing = createTask(async () => {
			throw new Error('boom')
		})
		const set = createState('x')
		const watch = makeWatch(
			stubHost() as unknown as HTMLElement & ComponentProps,
		)
		const cleanup = activate(() => {
			watch([set, failing], {
				ok: () => {
					calls.push('ok')
				},
				nil: () => {
					calls.push('nil')
				},
				err: errors => {
					calls.push(`err:${errors.map(e => e.message).join(',')}`)
				},
			})
		})

		expect(calls).toEqual(['nil'])

		await new Promise<void>(r => setTimeout(r, 0))
		// The rejection settles the task signal, which re-runs the effect;
		// match() collects the source errors into one readonly array.
		expect(calls).toEqual(['nil', 'err:boom'])

		cleanup?.()
	})

	test('stale fires when a seeded task source re-computes', async () => {
		const calls: string[] = []
		const deferred = { resolve: () => {} }
		const task = createTask(
			async () => {
				await new Promise<void>(r => {
					deferred.resolve = r
				})
				return 'resolved'
			},
			{ value: 'seeded' },
		)
		const set = createState('x')
		const watch = makeWatch(
			stubHost() as unknown as HTMLElement & ComponentProps,
		)
		const cleanup = activate(() => {
			watch([set, task], {
				ok: values => {
					calls.push(`ok:${values[1]}`)
				},
				stale: () => {
					calls.push('stale')
				},
			})
		})

		// Retained 'seeded' value while computing → stale, not ok.
		expect(calls).toEqual(['stale'])

		deferred.resolve()
		await new Promise<void>(r => setTimeout(r, 0))
		expect(calls).toEqual(['stale', 'ok:resolved'])

		cleanup?.()
	})
})

/* === activateDescriptors === */

describe('activateDescriptors', () => {
	test('activates empty array without error', () => {
		expect(() => activateDescriptors([])).not.toThrow()
	})

	test('activates single effect descriptor', () => {
		let called = false
		const descriptor = () => {
			called = true
		}
		activateDescriptors([descriptor])
		expect(called).toBe(true)
	})

	test('activates multiple effect descriptors in registration order', () => {
		const calls: number[] = []
		const descriptor1 = () => {
			calls.push(1)
		}
		const descriptor2 = () => {
			calls.push(2)
		}
		activateDescriptors([descriptor1, descriptor2])
		expect(calls).toEqual([1, 2])
	})
})

/* === each === */

describe('each', () => {
	test('registers its descriptor via the collector', () => {
		const memo = createMemo(() => [] as Element[])
		const collector: EffectDescriptor[] = []
		withCollector(collector, () => each(memo, () => {}))
		expect(collector).toHaveLength(1)
		expect(typeof collector[0]).toBe('function')
	})

	test('calls callback for each element in memo', () => {
		const elements = [{}, {}, {}] as Element[]
		const memo = createMemo(() => elements)
		const callbacks: Element[] = []
		activate(() => {
			each(memo, (el: Element) => {
				callbacks.push(el)
			})
		})
		expect(callbacks).toHaveLength(3)
	})

	test('registers the callback\u2019s returned cleanup on the per-element scope', () => {
		const elements = [{} as Element]
		const memo = createMemo(() => elements)
		const log: string[] = []
		const dispose = activate(() => {
			each(memo, () => () => log.push('leave'))
		})
		// The cleanup runs only when the per-element scope is disposed
		expect(log).toEqual([])
		dispose?.()
		expect(log).toEqual(['leave'])
	})
})

// each()'s 2nd callback parameter is a scoped `first`, pre-bound to the
// current element instead of the host — see ADR 0021.
describe('each — scoped first (ADR 0021)', () => {
	test('scoped first resolves against the element, not the host', () => {
		const child = { localName: 'span' } as unknown as Element
		const el = {
			querySelector: (selector: string) => (selector === 'span' ? child : null),
		} as unknown as Element
		const memo = createMemo(() => [el])

		const found: unknown[] = []
		activate(() => {
			each(memo, (_el, first) => {
				found.push(first('span'))
			})
		})

		expect(found).toEqual([child])
	})

	test('scoped first returns undefined when optional and missing', () => {
		const el = { querySelector: () => null } as unknown as Element
		const memo = createMemo(() => [el])

		const found: unknown[] = []
		activate(() => {
			each(memo, (_el, first) => {
				found.push(first('.missing'))
			})
		})

		expect(found).toEqual([undefined])
	})

	test('scoped first throws MissingElementError with "in item" wording when required and missing', () => {
		const el = { querySelector: () => null } as unknown as Element
		const memo = createMemo(() => [el])

		expect(() =>
			activate(() => {
				each(memo, (_el, first) => {
					first('.missing', 'needed for X')
				})
			}),
		).toThrow(/in item /)
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
		activate(() => {
			each(memo, () => {
				// Bare call, no return — must still register and run.
				watch(state, value => {
					seen.push(value)
				})
			})
		})
		expect(seen).toEqual(['a'])
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
		activate(() => {
			each(rowMemo, () => {
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
		})
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

	test('registers via the collector when called with target and props', () => {
		const host = {} as unknown as HTMLElement & ComponentProps
		const pass = makePass(host)
		const target = {} as unknown as HTMLElement & ComponentProps
		const collector: EffectDescriptor[] = []
		withCollector(collector, () => pass(target, {}))
		expect(collector).toHaveLength(1)
		expect(typeof collector[0]).toBe('function')
	})

	test('registers via the collector when called with memo target and props', () => {
		const host = {} as unknown as HTMLElement & ComponentProps
		const pass = makePass(host)
		const memo = createMemo(() => [] as (HTMLElement & ComponentProps)[])
		const collector: EffectDescriptor[] = []
		withCollector(collector, () => pass(memo, {}))
		expect(collector).toHaveLength(1)
		expect(typeof collector[0]).toBe('function')
	})
})

describe('makePass — real slot swap and restore', () => {
	test('swaps a Slot-backed property to a mediated descriptor of the host signal, and restores the original on cleanup', () => {
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
		const cleanup = activate(() =>
			pass(target, {
				greeting: { get: hostState.get, set: hostState.set },
			}),
		)
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

		// No Slot was registered for 'greeting' — e.g. a non-Le-Truc custom element,
		// or a read-only/computed Le Truc prop (see ADR 0011).
		expect(() =>
			activate(() =>
				pass(target, {
					greeting: { get: hostState.get, set: hostState.set },
				}),
			),
		).toThrow(/'greeting'/)
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

		expect(() =>
			activate(() =>
				pass(target, {
					greeting: { get: hostState.get, set: hostState.set },
				}),
			),
		).toThrow(/'greeting'/)
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
		let error: unknown
		try {
			activate(() =>
				pass(target, {
					greeting: { get: hostState.get, set: hostState.set },
					farewell: { get: hostState.get, set: hostState.set },
				}),
			)
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

		expect(() =>
			activate(() =>
				pass(target, {
					greeting: { get: hostGreeting.get, set: hostGreeting.set },
					farewell: { get: hostFarewell.get, set: hostFarewell.set },
				}),
			),
		).toThrow(/'farewell'/)
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
		expect(() =>
			activate(() =>
				pass(target, {
					greeting: { get: hostState.get, set: hostState.set },
				}),
			),
		).toThrow()
	})
})

describe('makePass — retired short forms fail validation (ADR-0012 removal)', () => {
	// A Le-Truc-style target with one Slot-backed prop, so the entry would be
	// bindable if the retired form still resolved — the failure is the FORM,
	// not the target.
	const makeTarget = (prop: string) => {
		const originalState = createState('original')
		const slot = createSlot(originalState)
		const target = { localName: 'my-target' } as unknown as HTMLElement &
			ComponentProps
		getSignals(target)[prop] = slot
		Object.defineProperty(target, prop, slot)
		return { target, slot, originalState }
	}

	// A retired form can no longer be written as a type-checked `pass()` call,
	// so the props object is built untyped on purpose — the shape an untyped
	// JS consumer (or a not-yet-migrated 2.x call) produces at runtime.
	const retiredProps = (props: Record<string, unknown>) =>
		props as unknown as PassedProps<HTMLElement & ComponentProps>

	test('rejects a bare State passed directly, swapping nothing', () => {
		const hostState = createState('host')
		const host = {} as unknown as HTMLElement & ComponentProps
		const { target, slot, originalState } = makeTarget('value')

		let error: unknown
		try {
			activate(() => makePass(host)(target, retiredProps({ value: hostState })))
		} catch (e) {
			error = e
		}
		expect(error).toBeInstanceOf(InvalidPassPropertyError)
		expect((error as Error).message).toContain("'value'")
		// Pin the resolution wording, not the reason string's punctuation —
		// that copy is the Tech Writer's (LT-178 copy rider, may land in
		// either spelling).
		expect((error as Error).message).toContain(
			'could not be resolved to a signal',
		)
		// The slot still holds the original signal — nothing was swapped.
		expect(slot.current()).toBe(originalState)
		expect((target as any).value).toBe('original')
	})

	test('rejects the property-key form (a string resolving to the parent signal)', () => {
		const hostState = createState('host')
		const host = { value: hostState } as unknown as HTMLElement & ComponentProps
		// Register the host signal like a real Le Truc component — the retired
		// property-key form resolved through it; today nothing may resolve.
		getSignals(host)['value'] = hostState
		const { target, slot, originalState } = makeTarget('value')

		expect(() =>
			activate(() => makePass(host)(target, retiredProps({ value: 'value' }))),
		).toThrow(InvalidPassPropertyError)
		expect(slot.current()).toBe(originalState)
	})

	test('rejects a bare read-only signal too — no silent continuation', () => {
		const memo = createMemo(() => 'derived')
		const host = {} as unknown as HTMLElement & ComponentProps
		const { target, slot, originalState } = makeTarget('value')

		expect(() =>
			activate(() => makePass(host)(target, retiredProps({ value: memo }))),
		).toThrow(InvalidPassPropertyError)
		expect(slot.current()).toBe(originalState)
	})

	test('the accepted thunk form still swaps (control)', () => {
		const hostState = createState('host')
		const host = { value: hostState } as unknown as HTMLElement & ComponentProps
		const { target } = makeTarget('value')

		activate(() => makePass(host)(target, { value: () => hostState.get() }))

		expect((target as any).value).toBe('host')
	})
})

describe('each — element leave/enter disposal', () => {
	// The callback runs at mount; its returned cleanup registers on the
	// per-element scope — the same contract as `reconcile()`'s `bindItem`.
	const track = (log: string[], id: string) => {
		log.push(`enter:${id}`)
		return () => log.push(`leave:${id}`)
	}

	test('disposes the per-element scope when an element leaves, before creating scopes for the new set', () => {
		const elA = { id: 'a' } as unknown as Element
		const elB = { id: 'b' } as unknown as Element
		const source = createState<Element[]>([elA])
		const memo = createMemo(() => source.get())

		const log: string[] = []
		const cleanup = activate(() =>
			each(memo, (el: Element) => track(log, (el as any).id)),
		)
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
		const cleanup = activate(() =>
			each(memo, (el: Element) => track(log, (el as any).id)),
		)
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
		const cleanup = activate(() =>
			pass(memo, { greeting: () => hostState.get() }),
		)
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
