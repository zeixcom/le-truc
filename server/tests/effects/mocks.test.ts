/**
 * Unit Tests for effects/mocks.ts — Mock File Output Path Derivation
 */

import { describe, expect, test } from 'bun:test'
import { getMockOutputPath } from '../../effects/mocks'

describe('getMockOutputPath', () => {
	test('maps an HTML mock path to docs/test/', () => {
		const result = getMockOutputPath(
			'examples/module-lazyload/mocks/simple-text.html',
		)
		expect(result).toBe('docs/test/module-lazyload/mocks/simple-text.html')
	})

	test('maps a JSON mock path to docs/test/', () => {
		const result = getMockOutputPath(
			'examples/form-listbox/mocks/timezones.json',
		)
		expect(result).toBe('docs/test/form-listbox/mocks/timezones.json')
	})

	test('preserves subdirectory structure under mocks/', () => {
		const result = getMockOutputPath(
			'examples/module-listnav/mocks/page3.html',
		)
		expect(result).toBe('docs/test/module-listnav/mocks/page3.html')
	})

	test('output path starts with docs/test/', () => {
		const result = getMockOutputPath(
			'examples/some-component/mocks/data.json',
		)
		expect(result).toStartWith('docs/test/')
	})

	test('output path does not contain the examples/ prefix', () => {
		const result = getMockOutputPath(
			'examples/module-lazyload/mocks/snippet.html',
		)
		expect(result).not.toContain('examples/')
	})
})
