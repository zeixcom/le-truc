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
import { createEffect } from '@zeix/cause-effect'
import { defineComponent } from '../component'
import { InvalidComponentNameError, InvalidPropertyNameError } from '../errors'
import { asParser, defineMethod } from '../types'

/* === Fake customElements registry + HTMLElement base === */

class FakeHTMLElement {
	#attrs = new Map<string, string>()
	localName = 'fake-element'
	shadowRoot: null = null
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

/* === reconnect (LT-004 regression) === */

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
		// already true. The regression (LT-004) overwrote #cleanup without
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
				return []
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
				return []
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
				return []
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(instance.count).toBe(5)
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
			return []
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
				return []
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
				return []
			},
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(instance.totallyNewProp).toBe(42)
	})
})

/* === InvalidPropertyNameError (reserved words, LT-003 regression) === */

describe('reserved word guard', () => {
	test('throws InvalidPropertyNameError for a reserved word prop name', () => {
		const Ctor = defineComponent<Record<string, NonNullable<unknown>>>(
			uniqueName(),
			({ expose }) => {
				expose({ constructor: 'evil' } as any)
				return []
			},
		)!
		const instance = new Ctor() as any
		expect(() => instance.connectedCallback()).toThrow(InvalidPropertyNameError)
	})
})
