/**
 * Unit tests for extractAttributes in src/ui.ts
 */

import { describe, expect, test } from 'bun:test'
import { extractAttributes } from '../helpers/dom'

describe('extractAttributes', () => {
	test('detects class shorthand', () => {
		expect(extractAttributes('.foo')).toContain('class')
	})

	test('detects id shorthand', () => {
		expect(extractAttributes('#bar')).toContain('id')
	})

	test('extracts attribute name from [attr]', () => {
		expect(extractAttributes('[disabled]')).toContain('disabled')
	})

	test('extracts attribute name from [attr=value]', () => {
		expect(extractAttributes('[type=text]')).toContain('type')
	})

	test('does not produce false positive for # inside attribute value', () => {
		// [attr^="#anchor"] contains # inside the selector — must not trigger id detection
		expect(extractAttributes('[href^="#anchor"]')).not.toContain('id')
		expect(extractAttributes('[href^="#anchor"]')).toContain('href')
	})

	test('does not produce false positive for . inside attribute value', () => {
		// The . is inside the value — must not add 'class' as a shorthand detection,
		// but 'href' IS the attribute name so it appears via the [attr] extraction path.
		expect(extractAttributes('[href^="file.pdf"]')).not.toContain('class')
		expect(extractAttributes('[href^="file.pdf"]')).toContain('href')
	})

	test('handles combined selector', () => {
		const attrs = extractAttributes('.nav[aria-expanded]#main')
		expect(attrs).toContain('class')
		expect(attrs).toContain('id')
		expect(attrs).toContain('aria-expanded')
	})

	test('completes in linear time on pathological input with no closing bracket', () => {
		// ReDoS guard: must not hang on a long string of '[' without ']'
		const input = '['.repeat(10_000)
		const start = performance.now()
		extractAttributes(input)
		const elapsed = performance.now() - start
		expect(elapsed).toBeLessThan(100) // well under 100 ms
	})
})
