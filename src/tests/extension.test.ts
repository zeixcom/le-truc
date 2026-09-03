/**
 * Unit tests for the `ComponentExtension` dependency-injection mechanism
 * (src/extension.ts + defineComponent's `extensions` parameter).
 *
 * Uses the same fake `HTMLElement` / `customElements` pattern as
 * component.test.ts and form.test.ts.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { defineComponent } from '../component'
import { ExtensionCollisionError, InvalidPropertyNameError } from '../errors'
import type { ComponentExtension } from '../extension'
import { observedAttributes } from '../extensions/attributes'
import { asParser } from '../types'

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
	attachInternals(): null {
		throw new DOMException(
			'NotSupportedError',
			'ElementInternals is not supported',
		)
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
const uniqueName = () => `test-extension-${nameCounter++}`

beforeEach(() => {
	installFakeCustomElements()
})

afterEach(() => {
	registry.clear()
})

/* === Composition: array order === */

describe('extension composition', () => {
	test('installOnPrototype and onConnect run in array order', () => {
		const order: string[] = []
		const first: ComponentExtension = {
			name: 'first',
			installOnPrototype: () => order.push('install:first'),
			onConnect: () => {
				order.push('connect:first')
			},
		}
		const second: ComponentExtension = {
			name: 'second',
			installOnPrototype: () => order.push('install:second'),
			onConnect: () => {
				order.push('connect:second')
			},
		}
		const Ctor = defineComponent(uniqueName(), () => [], [first, second])!
		expect(order).toEqual(['install:first', 'install:second'])
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(order).toEqual([
			'install:first',
			'install:second',
			'connect:first',
			'connect:second',
		])
	})

	test('reservedMembers from multiple extensions union without conflict', () => {
		const a: ComponentExtension = {
			name: 'a',
			reservedMembers: new Set(['foo']),
		}
		const b: ComponentExtension = {
			name: 'b',
			reservedMembers: new Set(['bar']),
		}
		const Ctor = defineComponent<{ foo: string; bar: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ foo: 'x' })
			},
			[a, b],
		)!
		const instance = new Ctor() as any
		// Both names are reserved, so exposing 'foo' collides. Contained and
		// reported rather than thrown (ADR 0028 Tier 2).
		const originalError = console.error
		const calls: unknown[][] = []
		console.error = (...args: unknown[]) => calls.push(args)
		try {
			expect(() => instance.connectedCallback()).not.toThrow()
		} finally {
			console.error = originalError
		}
		expect(calls).toHaveLength(1)
		expect(calls[0]?.[1]).toBeInstanceOf(InvalidPropertyNameError)
	})
})

/* === Collision policy === */

describe('extension staticProps collision', () => {
	test('throws ExtensionCollisionError in DEV_MODE', () => {
		const prevDevMode = process.env.DEV_MODE
		process.env.DEV_MODE = 'true'
		try {
			const a: ComponentExtension = { name: 'a', staticProps: { flag: 1 } }
			const b: ComponentExtension = { name: 'b', staticProps: { flag: 2 } }
			expect(() => defineComponent(uniqueName(), () => [], [a, b])).toThrow(
				ExtensionCollisionError,
			)
		} finally {
			if (prevDevMode === undefined) delete process.env.DEV_MODE
			else process.env.DEV_MODE = prevDevMode
		}
	})

	test('first extension wins silently in production', () => {
		const prevDevMode = process.env.DEV_MODE
		delete process.env.DEV_MODE
		try {
			const a: ComponentExtension = { name: 'a', staticProps: { flag: 1 } }
			const b: ComponentExtension = { name: 'b', staticProps: { flag: 2 } }
			const Ctor = defineComponent(uniqueName(), () => [], [a, b])!
			expect((Ctor as any).flag).toBe(1)
		} finally {
			if (prevDevMode === undefined) delete process.env.DEV_MODE
			else process.env.DEV_MODE = prevDevMode
		}
	})
})

/* === observedAttributes() === */

describe('observedAttributes()', () => {
	test('static observedAttributes reflects the requested names', () => {
		const Ctor = defineComponent(uniqueName(), () => [], [
			observedAttributes(['variant']),
		])!
		expect((Ctor as any).observedAttributes).toEqual(['variant'])
	})

	test('re-parses a Parser-backed prop when its attribute mutates post-connect', () => {
		const Ctor = defineComponent<{ variant: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ variant: asParser(v => v ?? 'default') })
			},
			[observedAttributes(['variant'])],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()
		expect(instance.variant).toBe('default')

		instance.attributeChangedCallback('variant', null, 'compact')
		expect(instance.variant).toBe('compact')
	})

	test('leaves a non-Parser-backed prop untouched on attribute mutation', () => {
		const Ctor = defineComponent<{ variant: string }>(
			uniqueName(),
			({ expose }) => {
				expose({ variant: 'static' })
			},
			[observedAttributes(['variant'])],
		)!
		const instance = new Ctor() as any
		instance.connectedCallback()

		instance.attributeChangedCallback('variant', null, 'compact')
		expect(instance.variant).toBe('static')
	})
})
