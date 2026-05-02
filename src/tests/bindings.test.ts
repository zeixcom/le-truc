/**
 * Unit tests for src/bindings.ts
 *
 * Pure functions only — no DOM required.
 */

import { describe, expect, test } from 'bun:test'
import { safeSetAttribute } from '../bindings'

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
