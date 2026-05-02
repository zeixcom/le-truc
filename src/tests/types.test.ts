/**
 * Unit tests for src/types.ts
 *
 * Pure functions only — no DOM required.
 */

import { describe, expect, test } from 'bun:test'
import { asParser, defineMethod, isMethodProducer, isParser } from '../types'

/* === isParser === */

describe('isParser', () => {
	test('returns true for branded parser function', () => {
		const parser = asParser(
			(value: string | null | undefined) => value ?? 'default',
		)
		expect(isParser(parser)).toBe(true)
	})

	test('returns false for unbranded function', () => {
		const unbranded = (value: string | null | undefined) => value ?? 'default'
		expect(isParser(unbranded)).toBe(false)
	})

	test('returns false for non-function value', () => {
		expect(isParser('not a function')).toBe(false)
		expect(isParser(42)).toBe(false)
		expect(isParser(null)).toBe(false)
		expect(isParser(undefined)).toBe(false)
		expect(isParser({})).toBe(false)
	})
})

/* === isMethodProducer === */

describe('isMethodProducer', () => {
	test('returns true for branded method producer function', () => {
		const method = defineMethod(() => {})
		expect(isMethodProducer(method)).toBe(true)
	})

	test('returns false for unbranded function', () => {
		const unbranded = () => {}
		expect(isMethodProducer(unbranded)).toBe(false)
	})

	test('returns false for non-function value', () => {
		expect(isMethodProducer('not a function')).toBe(false)
		expect(isMethodProducer(42)).toBe(false)
		expect(isMethodProducer(null)).toBe(false)
		expect(isMethodProducer(undefined)).toBe(false)
		expect(isMethodProducer({})).toBe(false)
	})
})

/* === asParser === */

describe('asParser', () => {
	test('returns the same function with PARSER_BRAND symbol', () => {
		const fn = (value: string | null | undefined) => value ?? 'default'
		const parser = asParser(fn)
		expect(parser).toBe(fn)
		expect(isParser(parser)).toBe(true)
	})

	test('preserves function behavior', () => {
		const fn = (value: string | null | undefined) => value ?? 'fallback'
		const parser = asParser(fn)
		expect(parser('test')).toBe('test')
		expect(parser(null)).toBe('fallback')
		expect(parser(undefined)).toBe('fallback')
	})
})

/* === defineMethod === */

describe('defineMethod', () => {
	test('returns the same function with METHOD_BRAND symbol', () => {
		const fn = () => {}
		const method = defineMethod(fn)
		expect(isMethodProducer(method)).toBe(true)
	})

	test('preserves function behavior', () => {
		let called = false
		const fn = () => {
			called = true
		}
		const method = defineMethod(fn)
		method()
		expect(called).toBe(true)
	})

	test('works with function that takes arguments', () => {
		const fn = (a: number, b: number) => a + b
		const method = defineMethod(fn)
		expect(method(2, 3)).toBe(5)
	})
})
