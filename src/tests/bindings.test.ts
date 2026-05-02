/**
 * Unit tests for src/bindings.ts
 *
 * Pure functions only — no DOM required.
 */

import { describe, expect, test } from 'bun:test'
import { escapeHTML, safeSetAttribute } from '../bindings'

describe('safeSetAttribute', () => {
	const makeEl = () => {
		const attrs: Record<string, string> = {}
		return {
			localName: 'a',
			setAttribute: (attr: string, val: string) => {
				attrs[attr] = val
			},
			_attrs: attrs,
		} as unknown as Element & { _attrs: Record<string, string> }
	}

	test('blocks javascript: URIs', () => {
		expect(() =>
			safeSetAttribute(makeEl(), 'href', 'javascript:alert(1)'),
		).toThrow()
	})

	test('blocks data: URIs', () => {
		expect(() =>
			safeSetAttribute(makeEl(), 'href', 'data:text/html,<h1>XSS</h1>'),
		).toThrow()
	})

	test('blocks vbscript: URIs', () => {
		expect(() =>
			safeSetAttribute(makeEl(), 'href', 'vbscript:MsgBox(1)'),
		).toThrow()
	})

	test('blocks on* event handler attributes', () => {
		expect(() => safeSetAttribute(makeEl(), 'onclick', 'alert(1)')).toThrow()
	})

	test('allows https: URIs', () => {
		const el = makeEl()
		expect(() =>
			safeSetAttribute(el, 'href', 'https://example.com'),
		).not.toThrow()
	})

	test('allows mailto: URIs', () => {
		const el = makeEl()
		expect(() =>
			safeSetAttribute(el, 'href', 'mailto:foo@example.com'),
		).not.toThrow()
	})

	test('allows relative paths', () => {
		const el = makeEl()
		expect(() => safeSetAttribute(el, 'href', '/page')).not.toThrow()
	})
})

describe('escapeHTML', () => {
	test('escapes ampersand', () => {
		expect(escapeHTML('foo & bar')).toBe('foo &amp; bar')
	})

	test('escapes less than', () => {
		expect(escapeHTML('foo < bar')).toBe('foo &lt; bar')
	})

	test('escapes greater than', () => {
		expect(escapeHTML('foo > bar')).toBe('foo &gt; bar')
	})

	test('escapes double quotes', () => {
		expect(escapeHTML('foo "bar"')).toBe('foo &quot;bar&quot;')
	})

	test('escapes single quotes', () => {
		expect(escapeHTML("foo 'bar'")).toBe('foo &#39;bar&#39;')
	})

	test('escapes multiple special characters', () => {
		expect(escapeHTML('<script>alert("XSS")</script>')).toBe(
			'&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
		)
	})

	test('returns empty string for empty input', () => {
		expect(escapeHTML('')).toBe('')
	})

	test('returns same string when no special characters', () => {
		expect(escapeHTML('hello world')).toBe('hello world')
	})

	test('escapes all special characters together', () => {
		expect(escapeHTML('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;')
	})
})
