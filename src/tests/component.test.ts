/**
 * Unit tests for src/component.ts
 *
 * No real DOM in bun:test, and `class Truc extends HTMLElement` /
 * `customElements.define/get` need those globals to exist at all. Both are
 * minimal stand-ins installed in beforeEach, scoped to this file (no other
 * file references `HTMLElement`/`customElements` as runtime values).
 *
 * `connectedCallback`/`disconnectedCallback` are invoked directly on the
 * instance rather than via real DOM insertion — they're ordinary prototype
 * methods, not browser magic, so this is a legitimate way to drive the
 * lifecycle without a document.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createEffect, createState, createTask } from '@zeix/cause-effect'
import { defineComponent } from '../component'
import {
	InvalidComponentNameError,
	InvalidPassPropertyError,
	InvalidPropertyNameError,
	NoActiveCollectorError,
} from '../errors'
import { internalsHosts } from '../internal'
import { asParser, defineMethod } from '../types'

/* === Fake customElements registry + HTMLElement base === */

class FakeHTMLElement {
	#attrs = new Map<string, string>()
	localName = 'fake-element'
	shadowRoot: null = null
	formAssociated = false
	#internals: FakeElementInternals | null = null

	getAttribute(name: string): string | null {
		return this.#attrs.has(name) ? this.#attrs.get(name)! : null
	}
	setAttribute(name: string, value: string) {
		this.#attrs.set(name, value)
	}
	hasAttribute(name: string) {
		return this.#attrs.has(name)
	}
	removeAttribute(name: string) {
		this.#attrs.delete(name)
	}
	addEventListener() {}
	removeEventListener() {}
	dispatchEvent() {
		return true
	}
	attachInternals() {
		if (!this.#internals) this.#internals = new FakeElementInternals()
		return this.#internals
	}
}

/** Mutable ValidityState — the real DOM type has readonly fields. */
type MutableValidityState = {
	-readonly [K in keyof ValidityState]: boolean
}

/**
 * Minimal ElementInternals stub for unit tests.
 * Stores form value, validity, and states for assertion.
 */
class FakeElementInternals {
	formValue: string | File | FormData | null = null
	validity: MutableValidityState = {
		valueMissing: false,
		typeMismatch: false,
		patternMismatch: false,
		tooLong: false,
		tooShort: false,
		rangeUnderflow: false,
		rangeOverflow: false,
		stepMismatch: false,
		badInput: false,
		customError: false,
		valid: true,
	}
	validationMessage = ''
	states = new Set<string>()
	willValidate = true

	setFormValue(value: string | File | FormData | null) {
		this.formValue = value
	}
	setValidity(
		flags: ValidityStateFlags,
		message?: string,
		anchor?: HTMLElement,
	) {
		Object.assign(this.validity, flags)
		// Recompute valid: true only if no error flag is set
		this.validity.valid =
			!this.validity.valueMissing &&
			!this.validity.typeMismatch &&
			!this.validity.patternMismatch &&
			!this.validity.tooLong &&
			!this.validity.tooShort &&
			!this.validity.rangeUnderflow &&
			!this.validity.rangeOverflow &&
			!this.validity.stepMismatch &&
			!this.validity.badInput &&
			!this.validity.customError
		this.validationMessage = message ?? ''
	}
	checkValidity() {
		return this.validity.valid
	}
	reportValidity() {
		return this.validity.valid
	}
}

const registry = new Map<string, CustomElementConstructor>()

const installFakeCustomElements = () => {
	;(globalThis as any).HTMLElement = FakeHTMLElement
	;(globalThis as any).customElements = {
		define: (name: string, ctor: CustomElementConstructor) => {
			if (registry.has(name)) throw new Error(`already defined: <${name}>`)
			registry.set(name, ctor)
		},
		get: (name: string) => registry.get(name),
		whenDefined: (name: string) =>
			registry.has(name) ? Promise.resolve() : new Promise(() => {}),
	}
}

let nameCounter = 0
const uniqueName = () => `test-component-${nameCounter++}`

beforeEach(() => {
	installFakeCustomElements()
})

afterEach(() => {
	registry.clear()
})

/* === defineComponent name validation === */

describe('defineComponent name validation', () => {
	test('throws InvalidComponentNameError when the name has no hyphen', () => {
		expect(() => defineComponent('foo', () => [])).toThrow(
			InvalidComponentNameError,
		)
	})

	test('throws when the name starts with an uppercase letter', () => {
		expect(() => defineComponent('Foo-bar', () => [])).toThrow(
			InvalidComponentNameError,
		)
	})

	test('throws when the name starts with a digit', () => {
		expect(() => defineComponent('1foo-bar', () => [])).toThrow(
			InvalidComponentNameError,
		)
	})

	test('throws when the name contains disallowed characters', () => {
		expect(() => defineComponent('foo_bar-baz', () => [])).toThrow(
			InvalidComponentNameError,
		)
	})

	test('accepts a valid name and registers a constructor', () => {
		const name = uniqueName()
		const ctor = defineComponent(name, () => [])
		expect(ctor).toBeDefined()
		expect((globalThis as any).customElements.get(name)).toBe(ctor)
	})
})

/* === connectedCallback / disconnectedCallback === */

describe('connectedCallback / disconnectedCallback', () => {
	test('activates factory effect descriptors on connect', () => {
		let ran = false
		const Ctor = defineComponent(uniqueName(), () => [
			() => {
				ran = true
			},
		])!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(ran).toBe(true)
	})

	test('a factory returning no descriptors does not throw on connect or disconnect', () => {
		const Ctor = defineComponent(uniqueName(), () => [])!
		const instance = new Ctor() as any
		expect(() => instance.connectedCallback()).not.toThrow()
		expect(() => instance.disconnectedCallback()).not.toThrow()
	})

	test('disconnectedCallback disposes effects created during connect', () => {
		let cleaned = false
		const Ctor = defineComponent(uniqueName(), () => [
			() =>
				createEffect(() => {
					return () => {
						cleaned = true
					}
				}),
		])!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(cleaned).toBe(false)
		instance.disconnectedCallback()
		expect(cleaned).toBe(true)
	})

	test('disconnectedCallback before any connect does not throw', () => {
		const Ctor = defineComponent(uniqueName(), () => [() => {}])!
		const instance = new Ctor() as any
		expect(() => instance.disconnectedCallback()).not.toThrow()
	})
})

/* === reconnect === */

describe('reconnect', () => {
	test('disposes the previous scope before re-activating, instead of leaking it', () => {
		let runCount = 0
		let cleanupCount = 0
		const Ctor = defineComponent(uniqueName(), () => [
			() =>
				createEffect(() => {
					runCount++
					return () => {
						cleanupCount++
					}
				}),
		])!
		const instance = new Ctor() as any

		instance.connectedCallback()
		expect(runCount).toBe(1)
		expect(cleanupCount).toBe(0)

		// Reparent/reslot: connectedCallback fires again while #initialized is
		// already true. The regression overwrote #cleanup without
		// calling it first, leaking the previous effect on every reconnect.
		instance.connectedCallback()
		expect(cleanupCount).toBe(1)
		expect(runCount).toBe(2)

		instance.connectedCallback()
		expect(cleanupCount).toBe(2)
		expect(runCount).toBe(3)
	})
})

/* === #initSignals dispatch order: Parser → MethodProducer → static/Signal === */

describe('#initSignals dispatch order', () => {
	test('Parser initializer is called with the attribute value at connect time', () => {
		const upper = asParser((value: string | null | undefined) =>
			(value ?? '').toUpperCase(),
		)
		const Ctor = defineComponent<{ label: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ label: upper })
			},
		)!
		const instance = new Ctor() as any
		instance.setAttribute('label', 'hello')
		instance.connectedCallback()
		expect(instance.label).toBe('HELLO')
	})

	test('MethodProducer initializer is installed directly as the method', () => {
		const greet = defineMethod(function (this: any, name: string) {
			return `hi ${name}`
		})
		const Ctor = defineComponent<{ greet: (name: string) => string }>(
			uniqueName(),
			({ expose }) => {
				expose({ greet })
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(typeof instance.greet).toBe('function')
		expect(instance.greet('world')).toBe('hi world')
	})

	test('static value initializer becomes a readable signal-backed property', () => {
		const Ctor = defineComponent<{ count: number }>(
			uniqueName(),
			({ expose }) => {
				expose({ count: 5 })
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(instance.count).toBe(5)
	})

	test('SlotDescriptor ({ get, set }) initializer delegates reads/writes to a backing signal', () => {
		const tokens = createState('a,b')
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({
					value: {
						get: () => tokens.get(),
						set: (v: string) => tokens.set(v.toUpperCase()),
					},
				})
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(instance.value).toBe('a,b')
		instance.value = 'c,d'
		expect(tokens.get()).toBe('C,D')
		expect(instance.value).toBe('C,D')
	})

	test('SlotDescriptor without set throws on write, like a read-only signal', () => {
		const Ctor = defineComponent<{ value: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ value: { get: () => 'fixed' } })
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(instance.value).toBe('fixed')
		expect(() => {
			instance.value = 'other'
		}).toThrow()
	})

	test('all three initializer kinds resolve correctly in a single expose() call', () => {
		const upper = asParser((value: string | null | undefined) =>
			(value ?? '').toUpperCase(),
		)
		const greet = defineMethod(function (this: any) {
			return 'hi'
		})
		const Ctor = defineComponent<{
			label: string
			greet: () => string
			count: number
		}>(uniqueName(), ({ expose }) => {
			expose({ label: upper, greet, count: 5 })
		})!
		const instance = new Ctor() as any
		instance.setAttribute('label', 'world')
		instance.connectedCallback()
		expect(instance.label).toBe('WORLD')
		expect(instance.greet()).toBe('hi')
		expect(instance.count).toBe(5)
	})
})

/* === prop in this guard === */

describe('prop in this guard', () => {
	test('skips an initializer when the property already exists on the host', () => {
		const Ctor = defineComponent<{ localName: string }>(
			uniqueName(),
			({ expose }) => {
				// `localName` already exists on the HTMLElement instance — the
				// guard must skip it rather than overwrite it with a signal.
				expose({ localName: 'should-be-ignored' })
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(instance.localName).toBe('fake-element')
	})

	test('does not skip a genuinely new property name', () => {
		const Ctor = defineComponent<{ totallyNewProp: number }>(
			uniqueName(),
			({ expose }) => {
				expose({ totallyNewProp: 42 })
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(instance.totallyNewProp).toBe(42)
	})
})

/** Swallows console.error for the duration of `fn` and returns what it saw. */
const captureErrors = <T>(fn: () => T): { calls: unknown[][]; result: T } => {
	const originalError = console.error
	const calls: unknown[][] = []
	console.error = (...args: unknown[]) => calls.push(args)
	try {
		return { calls, result: fn() }
	} finally {
		console.error = originalError
	}
}

/* === InvalidPropertyNameError (reserved words regression) === */

describe('reserved word guard', () => {
	test('reports InvalidPropertyNameError for a reserved word prop name, contained (ADR 0028)', () => {
		const Ctor = defineComponent<Record<string, NonNullable<unknown>>>(
			uniqueName(),
			({ expose }) => {
				expose({ constructor: 'evil' } as any)
			},
		)!
		const instance = new Ctor() as any
		const { calls } = captureErrors(() => {
			expect(() => instance.connectedCallback()).not.toThrow()
		})
		expect(calls).toHaveLength(1)
		expect(calls[0]?.[1]).toBeInstanceOf(InvalidPropertyNameError)
	})

	test('the reserved property is still not installed — the guard is the ordering, not the throw', () => {
		// The prototype chain is protected because #initSignals throws BEFORE
		// Object.defineProperty runs, not because the throw escapes. Containing
		// it therefore costs nothing (ADR 0028 inventory).
		const Ctor = defineComponent<Record<string, NonNullable<unknown>>>(
			uniqueName(),
			({ expose }) => {
				expose({ constructor: 'evil' } as any)
			},
		)!
		const instance = new Ctor() as any
		captureErrors(() => instance.connectedCallback())
		expect(Object.hasOwn(instance, 'constructor')).toBe(false)
	})
})

/* === ADR 0028: connect-time error containment === */

describe('connect-time error containment (ADR 0028)', () => {
	test('a factory that throws does not escape connectedCallback', () => {
		const Ctor = defineComponent(uniqueName(), () => {
			throw new Error('factory boom')
		})!
		const instance = new Ctor() as any
		const { calls } = captureErrors(() => {
			expect(() => instance.connectedCallback()).not.toThrow()
		})
		expect(calls).toHaveLength(1)
		// Production-branch wording: degraded, not broken (ADR 0028 sub-design 4).
		expect(String(calls[0]?.[0])).toContain('did not enhance')
	})

	test('a broken component does not take other components down', () => {
		const BrokenCtor = defineComponent(uniqueName(), () => {
			throw new Error('factory boom')
		})!
		const WorkingCtor = defineComponent<{ greeting: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ greeting: 'Hello' })
			},
		)!
		const broken = new BrokenCtor() as any
		const working = new WorkingCtor() as any
		captureErrors(() => {
			broken.connectedCallback()
			working.connectedCallback()
		})
		expect(working.greeting).toBe('Hello')
	})

	test('props exposed before the throw stay installed — the element is inert, not reverted', () => {
		const Ctor = defineComponent<{ greeting: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ greeting: 'Hello' })
				throw new Error('factory boom')
			},
		)!
		const instance = new Ctor() as any
		captureErrors(() => instance.connectedCallback())
		expect(instance.greeting).toBe('Hello')
	})

	test('a throwing descriptor costs only itself — its siblings still activate', () => {
		// The substantive change from whole-component containment (ADR 0028
		// sub-design 3): descriptors are independent thunks, so one failing
		// binding must not cost the component its working effects.
		const ran: string[] = []
		const Ctor = defineComponent<{ count: number }>(
			uniqueName(),
			({ expose, watch }) => {
				expose({ count: 0 })
				watch(
					() => true,
					() => {
						ran.push('before')
					},
				)
				// Hand-authored descriptors: activateResult calls them
				// directly, so a throw is not routed through match()'s err
				// handler the way a watch() handler's would be.
				return [
					() => {
						throw new Error('activation boom')
					},
					() => {
						ran.push('after')
					},
				]
			},
		)!
		const instance = new Ctor() as any
		const { calls } = captureErrors(() => {
			expect(() => instance.connectedCallback()).not.toThrow()
		})
		expect(calls).toHaveLength(1)
		expect(ran).toEqual(['before', 'after'])
	})

	test('the surviving effects stay live and are disposed on disconnect', () => {
		const cleaned: string[] = []
		const Ctor = defineComponent<{ count: number }>(
			uniqueName(),
			({ expose, watch }) => {
				expose({ count: 0 })
				watch(
					() => true,
					() => () => cleaned.push('survivor'),
				)
				return [
					() => {
						throw new Error('activation boom')
					},
				]
			},
		)!
		const instance = new Ctor() as any
		captureErrors(() => instance.connectedCallback())
		// Not torn down at connect: the component is partially enhanced, not
		// failed.
		expect(cleaned).toEqual([])
		instance.disconnectedCallback()
		expect(cleaned).toEqual(['survivor'])
	})

	test('a failing descriptor is reported once, not once per reconnect', () => {
		const Ctor = defineComponent(uniqueName(), () => [
			() => {
				throw new Error('activation boom')
			},
		])!
		const instance = new Ctor() as any
		const { calls } = captureErrors(() => {
			instance.connectedCallback()
			instance.disconnectedCallback()
			instance.connectedCallback()
			instance.disconnectedCallback()
			instance.connectedCallback()
		})
		expect(calls).toHaveLength(1)
	})

	test('a failed factory does not re-report on reconnect', () => {
		const Ctor = defineComponent(uniqueName(), () => {
			throw new Error('factory boom')
		})!
		const instance = new Ctor() as any
		const { calls } = captureErrors(() => {
			instance.connectedCallback()
			instance.disconnectedCallback()
			instance.connectedCallback()
		})
		expect(calls).toHaveLength(1)
	})

	test('the DEV_MODE diagnostic names the component and its degradation', () => {
		const prevDevMode = process.env.DEV_MODE
		const Ctor = defineComponent(uniqueName(), () => {
			throw new Error('factory boom')
		})!
		const instance = new Ctor() as any
		instance.localName = 'test-broken-factory'
		let calls: unknown[][] = []
		try {
			process.env.DEV_MODE = 'true'
			calls = captureErrors(() => instance.connectedCallback()).calls
		} finally {
			if (prevDevMode === undefined) delete process.env.DEV_MODE
			else process.env.DEV_MODE = prevDevMode
		}
		expect(String(calls[0]?.[0])).toContain('<test-broken-factory>')
		expect(String(calls[0]?.[0])).toContain('the component factory')
		// Tier 2 wording: degraded, not broken (ADR 0028 sub-design 4).
		expect(String(calls[0]?.[0])).toContain('server-rendered markup')
		expect(calls[0]?.[1]).toBeInstanceOf(Error)
	})

	test('the effect diagnostic names the helper, and a failed pass() costs only that binding', () => {
		// ADR 0028's headline case, and ADR 0011's own motivating example: a
		// target whose prop exists but is not Slot-backed. A partially
		// enhanced component is only debuggable if the report says which
		// effect did not activate.
		const prevDevMode = process.env.DEV_MODE
		const ran: string[] = []
		// Typed as a component with the prop — TypeScript covers the
		// prop-does-not-exist half of this check (ADR 0028 inventory), so the
		// residual the runtime backstop exists for is a prop that *is* there
		// and simply is not Slot-backed.
		const target = {
			localName: 'my-target',
			greeting: 'plain-value',
		} as unknown as HTMLElement & { greeting: string }
		const Ctor = defineComponent<{ greeting: string }>(
			uniqueName(),
			({ expose, host, pass, watch }) => {
				expose({ greeting: 'from-host' })
				pass(target, { greeting: () => host.greeting })
				watch(
					() => true,
					() => {
						ran.push('sibling')
					},
				)
			},
		)!
		const instance = new Ctor() as any
		instance.localName = 'test-broken-pass'
		let calls: unknown[][] = []
		try {
			process.env.DEV_MODE = 'true'
			calls = captureErrors(() => {
				expect(() => instance.connectedCallback()).not.toThrow()
			}).calls
		} finally {
			if (prevDevMode === undefined) delete process.env.DEV_MODE
			else process.env.DEV_MODE = prevDevMode
		}
		expect(calls).toHaveLength(1)
		expect(String(calls[0]?.[0])).toContain('pass()')
		expect(String(calls[0]?.[0])).toContain('<test-broken-pass>')
		expect(calls[0]?.[1]).toBeInstanceOf(InvalidPassPropertyError)
		// The sibling effect activated anyway, and the target is untouched —
		// no partial swap (ADR 0011's atomicity, preserved).
		expect(ran).toEqual(['sibling'])
		expect((target as any).greeting).toBe('plain-value')
	})

	test('a hand-authored descriptor gets a generic label', () => {
		const prevDevMode = process.env.DEV_MODE
		const Ctor = defineComponent(uniqueName(), () => [
			() => {
				throw new Error('activation boom')
			},
		])!
		const instance = new Ctor() as any
		let calls: unknown[][] = []
		try {
			process.env.DEV_MODE = 'true'
			calls = captureErrors(() => instance.connectedCallback()).calls
		} finally {
			if (prevDevMode === undefined) delete process.env.DEV_MODE
			else process.env.DEV_MODE = prevDevMode
		}
		expect(String(calls[0]?.[0])).toContain('hand-authored')
	})

	test('an error Le Truc raises itself is contained too — the brand is gone (ADR 0028)', () => {
		// ADR 0011's carve-out is retired. Nothing reaching connectedCallback
		// escapes it, and no marker decides otherwise.
		const Ctor = defineComponent(uniqueName(), () => [
			() => {
				throw new NoActiveCollectorError(undefined, 'watch')
			},
		])!
		const instance = new Ctor() as any
		const { calls } = captureErrors(() => {
			expect(() => instance.connectedCallback()).not.toThrow()
		})
		expect(calls[0]?.[1]).toBeInstanceOf(NoActiveCollectorError)
	})

	test('Tier 3 still escapes without a marker — a bad component name throws from defineComponent', () => {
		// Definition-time failures sit outside connectedCallback structurally,
		// so deleting the brand does not make them quiet (ADR 0028 sub-design 2).
		expect(() => defineComponent('nohyphen', () => {})).toThrow(
			InvalidComponentNameError,
		)
	})
})

/* === LT-006: implicit effect collection regression tests (ADR 0018) === */

describe('implicit effect collection — regression (ADR 0018)', () => {
	test('watch(task, fn) called as a bare statement (no return) still activates and runs the Task', async () => {
		const ranWith: string[] = []
		const Ctor = defineComponent<{ city: string }>(
			uniqueName(),
			({ expose, host, watch }) => {
				expose({ city: 'A' })
				const task = createTask(async () => host.city)
				// Bare call, no return — this is the exact shape from the original
				// bug report: watch(task, fn) silently never ran the Task.
				watch(task, c => {
					ranWith.push(c)
				})
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		await new Promise(r => setTimeout(r, 0))
		expect(ranWith).toEqual(['A'])
	})

	test('mixed bare and returned helper calls in one factory each activate exactly once', () => {
		const runs: string[] = []
		const Ctor = defineComponent<{ count: number }>(
			uniqueName(),
			({ expose, watch }) => {
				expose({ count: 1 })
				// Bare call — registers only via the implicit collector.
				watch('count', v => {
					runs.push(`bare:${v}`)
				})
				// Explicit return — already pushed into the collector too; must not
				// activate twice.
				return [
					watch('count', v => {
						runs.push(`returned:${v}`)
					}),
				]
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(runs).toEqual(['bare:1', 'returned:1'])
	})

	// each() with implicit collection nested 2+ levels deep is covered by the
	// `each — implicit collection (ADR 0018)` describe block in
	// reactive.test.ts, including a 3-level (row/col/cell) grid test — not
	// duplicated here.

	test('watch() called after an await inside the factory throws NoActiveCollectorError immediately', async () => {
		let thrown: unknown
		const Ctor = defineComponent(uniqueName(), ({ watch }) => {
			Promise.resolve().then(() => {
				try {
					watch(createState('x'), () => {})
				} catch (e) {
					thrown = e
				}
			})
		})!
		const instance = new Ctor() as any
		instance.connectedCallback()
		await new Promise(r => setTimeout(r, 0))
		expect(thrown).toBeInstanceOf(NoActiveCollectorError)
	})

	test('watch() called inside a detached setTimeout scheduled during factory setup throws immediately', async () => {
		let thrown: unknown
		const Ctor = defineComponent(uniqueName(), ({ watch }) => {
			setTimeout(() => {
				try {
					watch(createState('x'), () => {})
				} catch (e) {
					thrown = e
				}
			}, 0)
		})!
		const instance = new Ctor() as any
		instance.connectedCallback()
		await new Promise(r => setTimeout(r, 10))
		expect(thrown).toBeInstanceOf(NoActiveCollectorError)
	})
})

/* === ElementInternals declaration registry (ADR 0026 §3) === */

describe('ElementInternals declaration registry', () => {
	test('a constructed component is registered in globalThis._elementInternals with its internals', () => {
		const Ctor = defineComponent(uniqueName(), () => {})!
		const instance = new Ctor() as unknown as HTMLElement
		const internals = globalThisRegistry().get(instance)
		expect(internals).toBeInstanceOf(FakeElementInternals)
		// Reverse lookup (bindAria's stale-attribute rule, ADR 0026 §1) is
		// populated on the same constructor line.
		expect(internalsHosts.get(internals!)).toBe(instance)
	})

	test('the registry is shared across instances and created idempotently', () => {
		const first = new (defineComponent(uniqueName(), () => {})!)()
		const second = new (defineComponent(uniqueName(), () => {})!)()
		const registry = globalThisRegistry()
		expect(registry.has(first)).toBe(true)
		expect(registry.has(second)).toBe(true)
		// ??= semantics: an existing global is adopted, never replaced.
		expect((globalThis as any)._elementInternals).toBe(registry)
	})
})

/** Read-side helper for the protocol registry under test. */
const globalThisRegistry = (): WeakMap<Element, ElementInternals> =>
	(
		globalThis as unknown as {
			_elementInternals: WeakMap<Element, ElementInternals>
		}
	)._elementInternals
