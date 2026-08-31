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

/* === InvalidPropertyNameError (reserved words regression) === */

describe('reserved word guard', () => {
	test('throws InvalidPropertyNameError for a reserved word prop name', () => {
		const Ctor = defineComponent<Record<string, NonNullable<unknown>>>(
			uniqueName(),
			({ expose }) => {
				expose({ constructor: 'evil' } as any)
			},
		)!
		const instance = new Ctor() as any
		expect(() => instance.connectedCallback()).toThrow(InvalidPropertyNameError)
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

/* === Element-internals-declaration registry (ADR 0026 §3) === */

describe('element-internals-declaration registry', () => {
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
