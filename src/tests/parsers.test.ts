/**
 * Unit tests for src/parsers/*.ts
 *
 * Pure functions only — no DOM required.
 */

import { describe, expect, test } from 'bun:test'
import { asBoolean } from '../parsers/boolean'
import { asJSON } from '../parsers/json'
import { asClampedInteger, asInteger, asNumber } from '../parsers/number'
import { asEnum, asString } from '../parsers/string'

/* === parsers/boolean.ts === */

describe('asBoolean', () => {
	test('returns true when attribute is present with empty string', () => {
		const parser = asBoolean()
		expect(parser('')).toBe(true)
	})

	test('returns true when attribute is present with any value except "false"', () => {
		const parser = asBoolean()
		expect(parser('true')).toBe(true)
		expect(parser('yes')).toBe(true)
		expect(parser('1')).toBe(true)
		expect(parser('random')).toBe(true)
	})

	test('returns false when attribute value is "false"', () => {
		const parser = asBoolean()
		expect(parser('false')).toBe(false)
	})

	test('returns false when attribute value is "false" in any case (case-insensitive)', () => {
		const parser = asBoolean()
		expect(parser('FALSE')).toBe(false)
		expect(parser('False')).toBe(false)
		expect(parser('fAlSe')).toBe(false)
	})

	test('returns false when attribute is null', () => {
		const parser = asBoolean()
		expect(parser(null)).toBe(false)
	})

	test('returns false when attribute is undefined', () => {
		const parser = asBoolean()
		expect(parser(undefined)).toBe(false)
	})

	test('returns true for whitespace-only values', () => {
		const parser = asBoolean()
		expect(parser('   ')).toBe(true)
	})

	test('returns true for "false" with surrounding whitespace or as a substring (whitespace is not trimmed)', () => {
		const parser = asBoolean()
		expect(parser('false ')).toBe(true) // has trailing space
		expect(parser(' false')).toBe(true) // has leading space
		expect(parser('not-false')).toBe(true)
	})
})

/* === parsers/string.ts === */

describe('asEnum', () => {
	const parse = asEnum(['red', 'green', 'blue'])

	test('returns the canonical (lowercase) form when attribute has different case', () => {
		expect(parse('RED')).toBe('red')
		expect(parse('Green')).toBe('green')
		expect(parse('BLUE')).toBe('blue')
	})

	test('returns exact match when case already matches', () => {
		expect(parse('red')).toBe('red')
	})

	test('returns first valid entry for unknown values', () => {
		expect(parse('yellow')).toBe('red')
	})

	test('returns first valid entry when value is null', () => {
		expect(parse(null)).toBe('red')
	})

	test('returns first valid entry when value is undefined', () => {
		expect(parse(undefined)).toBe('red')
	})
})

describe('asString', () => {
	test('returns value when present', () => {
		expect(asString()('hello')).toBe('hello')
	})

	test('returns fallback for null', () => {
		expect(asString('default')(null)).toBe('default')
	})

	test('returns empty string fallback by default', () => {
		expect(asString()(undefined)).toBe('')
	})
})

/* === parsers/json.ts === */

describe('asJSON', () => {
	test('parses a valid JSON object', () => {
		expect(asJSON({})('{"a":1}')).toEqual({ a: 1 })
	})

	test('returns fallback for null', () => {
		expect(asJSON({ default: true })(null)).toEqual({ default: true })
	})

	test('throws SyntaxError for empty string', () => {
		expect(() => asJSON({})(``)).toThrow(SyntaxError)
	})

	test('throws SyntaxError for malformed JSON', () => {
		expect(() => asJSON({})('not json')).toThrow(SyntaxError)
	})

	test('throws TypeError when value and fallback are both null/undefined', () => {
		// @ts-expect-error testing runtime guard
		expect(() => asJSON(null)(null)).toThrow(TypeError)
	})

	test('strips a top-level __proto__ key instead of polluting the prototype', () => {
		const result = asJSON<Record<string, unknown>>({})(
			'{"__proto__":{"polluted":true},"a":1}',
		)
		expect(Object.hasOwn(result, '__proto__')).toBe(false)
		expect(result.a).toBe(1)
		expect((result as { polluted?: boolean }).polluted).toBeUndefined()
	})

	test('strips a nested __proto__ key', () => {
		const result = asJSON<Record<string, unknown>>({})(
			'{"nested":{"__proto__":{"polluted":true},"b":2}}',
		)
		const nested = result.nested as Record<string, unknown>
		expect(Object.hasOwn(nested, '__proto__')).toBe(false)
		expect(nested.b).toBe(2)
	})

	test('strips a constructor key', () => {
		const result = asJSON<Record<string, unknown>>({})(
			'{"constructor":{"polluted":true},"a":2}',
		)
		expect(Object.hasOwn(result, 'constructor')).toBe(false)
		expect(result.a).toBe(2)
	})
})

/* === parsers/number.ts === */

describe('asInteger', () => {
	test('parses integer string', () => {
		expect(asInteger()('42')).toBe(42)
	})

	test('truncates float', () => {
		expect(asInteger()('3.9')).toBe(3)
	})

	test('parses hex', () => {
		expect(asInteger()('0xff')).toBe(255)
	})

	test('returns fallback for null', () => {
		expect(asInteger(7)(null)).toBe(7)
	})

	test('returns fallback for non-numeric', () => {
		expect(asInteger(0)('abc')).toBe(0)
	})
})

describe('asNumber', () => {
	test('parses float', () => {
		expect(asNumber()('3.14')).toBeCloseTo(3.14)
	})

	test('returns fallback for null', () => {
		expect(asNumber(99)(null)).toBe(99)
	})
})

describe('asClampedInteger', () => {
	test('returns value within range', () => {
		expect(asClampedInteger(0, 10)('5')).toBe(5)
	})

	test('clamps to min', () => {
		expect(asClampedInteger(0, 10)('-3')).toBe(0)
	})

	test('clamps to max', () => {
		expect(asClampedInteger(0, 10)('99')).toBe(10)
	})

	test('truncates float before clamping', () => {
		expect(asClampedInteger(0, 10)('7.9')).toBe(7)
	})

	test('returns min for null', () => {
		expect(asClampedInteger(3, 10)(null)).toBe(3)
	})

	test('parses hex within range', () => {
		expect(asClampedInteger(0, 100)('0x0f')).toBe(15)
	})
})
