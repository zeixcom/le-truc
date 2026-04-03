/**
 * Unit tests for module-listnav hash handling
 *
 * Tests the hash-to-value and value-to-hash conversions with relative paths
 */

import { describe, expect, test } from 'bun:test'

/**
 * Mock getBasePath helper (extracted from module-listnav.ts)
 */
const getBasePath = (
	firstOptionValue: string,
): { base: string; ext: string } | null => {
	if (!firstOptionValue) return null

	const value = firstOptionValue
	// Handle relative paths starting with "./"
	if (!value.startsWith('./')) return null

	// Find the second slash to get the first path segment: "./examples/"
	const secondSlash = value.indexOf('/', 2)
	if (secondSlash === -1) return null

	return {
		base: value.slice(0, secondSlash + 1),
		ext: value.slice(value.lastIndexOf('.')),
	}
}

/**
 * Mock hashToValue helper (extracted from module-listnav.ts)
 */
const hashToValue = (hash: string, firstOptionValue: string): string | null => {
	if (!hash) return null
	const fragment = hash.slice(1)
	if (!fragment) return null

	const paths = getBasePath(firstOptionValue)
	if (!paths) return null

	return `${paths.base}${fragment}${paths.ext}`
}

/**
 * Mock valueToHash helper (extracted from module-listnav.ts)
 */
const valueToHash = (value: string, firstOptionValue: string): string => {
	if (!value) return ''

	const paths = getBasePath(firstOptionValue)
	if (!paths) return ''

	let hash = value
	if (hash.startsWith(paths.base)) hash = hash.slice(paths.base.length)
	const dotIndex = hash.lastIndexOf('.')
	if (dotIndex > 0) hash = hash.slice(0, dotIndex)

	return hash
}

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

		test('Examples: value → hash → value preserves original', () => {
			const originalValue = './examples/module-carousel.html'
			const firstOption = './examples/basic-button.html'

			const hash = valueToHash(originalValue, firstOption)
			const roundTripValue = hashToValue(`#${hash}`, firstOption)

			expect(roundTripValue).toBe(originalValue)
		})
	})
})
