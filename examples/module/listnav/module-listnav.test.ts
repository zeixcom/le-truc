/**
 * Unit tests for module-listnav hash handling
 *
 * Tests the hash-to-value and value-to-hash conversions with relative paths,
 * against `listnav-hash.ts` — the module the compiled component's client
 * imports (LT-107), not a copy of it.
 */

import { describe, expect, test } from 'bun:test'
import { getBasePath, hashToValue, valueToHash } from './listnav-hash'

describe('module-listnav hash handling', () => {
	describe('getBasePath', () => {
		test('extracts base path and extension from API URLs', () => {
			const result = getBasePath('./api/functions/defineComponent.html')

			expect(result).not.toBeNull()
			expect(result?.base).toBe('./api/')
			expect(result?.ext).toBe('.html')
		})

		test('extracts base path and extension from examples URLs', () => {
			const result = getBasePath('./examples/form-combobox.html')

			expect(result).not.toBeNull()
			expect(result?.base).toBe('./examples/')
			expect(result?.ext).toBe('.html')
		})

		test('extracts base path from parent-relative URLs (locale tree)', () => {
			const result = getBasePath('../examples/form-combobox.html')

			expect(result).not.toBeNull()
			expect(result?.base).toBe('../examples/')
			expect(result?.ext).toBe('.html')
		})

		test('returns null for absolute paths (old format)', () => {
			const result = getBasePath('/api/functions/defineComponent.html')
			expect(result).toBeNull()
		})

		test('returns null for empty value', () => {
			const result = getBasePath('')
			expect(result).toBeNull()
		})

		test('returns null for malformed paths', () => {
			const result = getBasePath('./api')
			expect(result).toBeNull()
		})
	})

	describe('hashToValue', () => {
		test('converts API hash to relative value URL', () => {
			const hash = '#functions/defineComponent'
			const firstOption = './api/functions/defineComponent.html'

			const result = hashToValue(hash, firstOption)
			expect(result).toBe('./api/functions/defineComponent.html')
		})

		test('converts nested API hash to relative value URL', () => {
			const hash = '#type-aliases/Component'
			const firstOption = './api/functions/asBoolean.html'

			const result = hashToValue(hash, firstOption)
			expect(result).toBe('./api/type-aliases/Component.html')
		})

		test('converts examples hash to relative value URL', () => {
			const hash = '#form-combobox'
			const firstOption = './examples/basic-button.html'

			const result = hashToValue(hash, firstOption)
			expect(result).toBe('./examples/form-combobox.html')
		})

		test('converts multi-segment examples hash', () => {
			const hash = '#module-carousel'
			const firstOption = './examples/basic-button.html'

			const result = hashToValue(hash, firstOption)
			expect(result).toBe('./examples/module-carousel.html')
		})

		test('returns null for empty hash', () => {
			const result = hashToValue('', './api/functions/defineComponent.html')
			expect(result).toBeNull()
		})

		test('returns null for hash without fragment', () => {
			const result = hashToValue('#', './api/functions/defineComponent.html')
			expect(result).toBeNull()
		})
	})

	describe('valueToHash', () => {
		test('converts API relative value URL to hash', () => {
			const value = './api/functions/defineComponent.html'
			const firstOption = './api/functions/asBoolean.html'

			const result = valueToHash(value, firstOption)
			expect(result).toBe('functions/defineComponent')
		})

		test('converts nested API relative value URL to hash', () => {
			const value = './api/type-aliases/Component.html'
			const firstOption = './api/functions/asBoolean.html'

			const result = valueToHash(value, firstOption)
			expect(result).toBe('type-aliases/Component')
		})

		test('converts examples relative value URL to hash', () => {
			const value = './examples/form-combobox.html'
			const firstOption = './examples/basic-button.html'

			const result = valueToHash(value, firstOption)
			expect(result).toBe('form-combobox')
		})

		test('converts multi-segment examples value', () => {
			const value = './examples/module-carousel.html'
			const firstOption = './examples/basic-button.html'

			const result = valueToHash(value, firstOption)
			expect(result).toBe('module-carousel')
		})

		test('returns empty string for empty value', () => {
			const result = valueToHash('', './api/functions/defineComponent.html')
			expect(result).toBe('')
		})
	})

	describe('round-trip conversions', () => {
		test('API: hash → value → hash preserves original', () => {
			const originalHash = '#functions/defineComponent'
			const firstOption = './api/functions/asBoolean.html'

			const value = hashToValue(originalHash, firstOption)
			const roundTripHash = valueToHash(value!, firstOption)

			expect(roundTripHash).toBe('functions/defineComponent')
		})

		test('API: value → hash → value preserves original', () => {
			const originalValue = './api/type-aliases/Component.html'
			const firstOption = './api/functions/asBoolean.html'

			const hash = valueToHash(originalValue, firstOption)
			const roundTripValue = hashToValue(`#${hash}`, firstOption)

			expect(roundTripValue).toBe(originalValue)
		})

		test('Examples: hash → value → hash preserves original', () => {
			const originalHash = '#form-combobox'
			const firstOption = './examples/basic-button.html'

			const value = hashToValue(originalHash, firstOption)
			const roundTripHash = valueToHash(value!, firstOption)

			expect(roundTripHash).toBe('form-combobox')
		})

		test('Locale tree: value ↔ hash round-trips "../" values', () => {
			const originalValue = '../examples/form-listbox.html'
			const hash = valueToHash(originalValue, originalValue)
			expect(hash).toBe('form-listbox')
			expect(hashToValue(`#${hash}`, originalValue)).toBe(originalValue)
		})

		test('Examples: value → hash → value preserves original', () => {
			const originalValue = './examples/module-carousel.html'
			const firstOption = './examples/basic-button.html'

			const hash = valueToHash(originalValue, firstOption)
			const roundTripValue = hashToValue(`#${hash}`, firstOption)

			expect(roundTripValue).toBe(originalValue)
		})
	})
})
