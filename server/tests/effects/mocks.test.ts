/**
 * Unit Tests for effects/mocks.ts — Mock File Output Path Derivation
 */

import { join } from 'path'
import { describe, expect, test } from 'bun:test'
import { COMPONENTS_DIR, TEST_DIR } from '../../config'
import { getMockOutputPath } from '../../effects/mocks'

describe('getMockOutputPath', () => {
	test('maps an HTML mock path to docs/test/', () => {
		const result = getMockOutputPath(
			join(COMPONENTS_DIR, 'module-lazyload/mocks/simple-text.html'),
		)
		expect(result).toBe(join(TEST_DIR, 'module-lazyload/mocks/simple-text.html'))
	})

	test('maps a JSON mock path to docs/test/', () => {
		const result = getMockOutputPath(
			join(COMPONENTS_DIR, 'form-listbox/mocks/timezones.json'),
		)
		expect(result).toBe(join(TEST_DIR, 'form-listbox/mocks/timezones.json'))
	})

	test('preserves subdirectory structure under mocks/', () => {
		const result = getMockOutputPath(
			join(COMPONENTS_DIR, 'module-listnav/mocks/page3.html'),
		)
		expect(result).toBe(join(TEST_DIR, 'module-listnav/mocks/page3.html'))
	})

	test('output path starts with TEST_DIR', () => {
		const result = getMockOutputPath(
			join(COMPONENTS_DIR, 'some-component/mocks/data.json'),
		)
		expect(result).toStartWith(TEST_DIR)
	})

	test('output path does not contain COMPONENTS_DIR', () => {
		const result = getMockOutputPath(
			join(COMPONENTS_DIR, 'module-lazyload/mocks/snippet.html'),
		)
		expect(result).not.toContain(COMPONENTS_DIR)
	})
})
