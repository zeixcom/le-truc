/**
 * Unit tests for src/util.ts
 *
 * Pure functions only — no DOM required.
 */

import { describe, expect, test } from 'bun:test'
import { elementName, isCustomElement, isNotYetDefinedComponent } from '../util'

/* === Helper to create mock DOMTokenList === */

const createMockDOMTokenList = (classes: string[]): DOMTokenList => {
	const list = new Set(classes)
	return {
		length: list.size,
		item: (index: number) => classes[index] || null,
		contains: (token: string) => list.has(token),
		add: (token: string) => {
			list.add(token)
		},
		remove: (token: string) => {
			list.delete(token)
		},
		toggle: (token: string, force?: boolean) => {
			if (force !== undefined) {
				if (force) list.add(token)
				else list.delete(token)
				return force
			}
			const has = list.has(token)
			if (has) list.delete(token)
			else list.add(token)
			return !has
		},
		replace: (token: string, newToken: string) => {
			if (list.has(token)) {
				list.delete(token)
				list.add(newToken)
			}
		},
		supports: () => false,
		[Symbol.iterator]: () => list.values(),
	} as unknown as DOMTokenList
}

/* === isCustomElement === */

describe('isCustomElement', () => {
	test('returns true for element with hyphen in localName', () => {
		const el = { localName: 'my-element' } as unknown as Element
		expect(isCustomElement(el)).toBe(true)
	})

	test('returns false for standard element without hyphen', () => {
		const el = { localName: 'div' } as unknown as Element
		expect(isCustomElement(el)).toBe(false)
	})

	test('returns true for element with multiple hyphens', () => {
		const el = { localName: 'my-custom-element' } as unknown as Element
		expect(isCustomElement(el)).toBe(true)
	})

	test('returns false for empty localName', () => {
		const el = { localName: '' } as unknown as Element
		expect(isCustomElement(el)).toBe(false)
	})
})

/* === isNotYetDefinedComponent === */

describe('isNotYetDefinedComponent', () => {
	test('returns true for custom element that is not yet defined', () => {
		const el = {
			localName: 'my-element',
			matches: (selector: string) => selector === ':not(:defined)',
		} as unknown as Element
		expect(isNotYetDefinedComponent(el)).toBe(true)
	})

	test('returns false for custom element that is defined', () => {
		const el = {
			localName: 'my-element',
			matches: (selector: string) => selector !== ':not(:defined)',
		} as unknown as Element
		expect(isNotYetDefinedComponent(el)).toBe(false)
	})

	test('returns false for standard element', () => {
		const el = {
			localName: 'div',
			matches: (selector: string) => selector === ':not(:defined)',
		} as unknown as Element
		expect(isNotYetDefinedComponent(el)).toBe(false)
	})
})

/* === elementName === */

describe('elementName', () => {
	test('returns element string with tag name only for element without id or class', () => {
		const el = {
			localName: 'div',
			id: '',
			classList: createMockDOMTokenList([]),
		} as unknown as Element
		expect(elementName(el)).toBe('<div>')
	})

	test('returns element string with id', () => {
		const el = {
			localName: 'div',
			id: 'my-id',
			classList: createMockDOMTokenList([]),
		} as unknown as Element
		expect(elementName(el)).toBe('<div#my-id>')
	})

	test('returns element string with class', () => {
		const el = {
			localName: 'div',
			id: '',
			classList: createMockDOMTokenList(['foo', 'bar']),
		} as unknown as Element
		expect(elementName(el)).toBe('<div.foo.bar>')
	})

	test('returns element string with both id and class', () => {
		const el = {
			localName: 'div',
			id: 'my-id',
			classList: createMockDOMTokenList(['test-class']),
		} as unknown as Element
		expect(elementName(el)).toBe('<div#my-id.test-class>')
	})

	test('returns "<unknown>" for null element', () => {
		expect(elementName(null)).toBe('<unknown>')
	})

	test('returns "<unknown>" for undefined element', () => {
		expect(elementName(undefined)).toBe('<unknown>')
	})
})
