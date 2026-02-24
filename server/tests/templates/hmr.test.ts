/**
 * Unit Tests for templates/hmr.ts — HMR Client Templates
 *
 * Covers:
 * - hmrClient: script content, config options, no HTML escaping
 * - hmrScriptTag: wrapping, no entity escaping (regression for &#39; bug)
 * - hmrClientMinimal: minimal script content
 */

import { describe, expect, test } from 'bun:test'
import { hmrClient, hmrClientMinimal, hmrScriptTag } from '../../templates/hmr'

/* === §hmrClient === */

describe('hmrClient', () => {
	test('returns a self-invoking function wrapper', () => {
		const result = hmrClient()
		expect(result).toContain('(function ()')
		expect(result).toContain('})()')
	})

	test('includes "use strict" directive', () => {
		const result = hmrClient()
		expect(result).toContain("'use strict'")
	})

	test('connects to /ws by default', () => {
		const result = hmrClient()
		expect(result).toContain("'/ws'")
	})

	test('respects custom path option', () => {
		const result = hmrClient({ path: '/hmr' })
		expect(result).toContain("'/hmr'")
		expect(result).not.toContain("'/ws'")
	})

	test('uses window.location.host by default', () => {
		const result = hmrClient()
		expect(result).toContain('window.location.host')
	})

	test('uses literal host string when host does not reference window.location', () => {
		const result = hmrClient({ host: 'localhost:3000' })
		expect(result).toContain("'localhost:3000'")
	})

	test('includes reconnect logic with default maxReconnectAttempts', () => {
		const result = hmrClient()
		expect(result).toContain('reconnectAttempts >= 5')
	})

	test('respects maxReconnectAttempts option', () => {
		const result = hmrClient({ maxReconnectAttempts: 3 })
		expect(result).toContain('reconnectAttempts >= 3')
	})

	test('includes reconnectInterval value', () => {
		const result = hmrClient({ reconnectInterval: 2000 })
		expect(result).toContain('2000')
	})

	test('includes ping interval value', () => {
		const result = hmrClient({ pingInterval: 15000 })
		expect(result).toContain('15000')
	})

	test('includes console.log calls when enableLogging is true', () => {
		const result = hmrClient({ enableLogging: true })
		expect(result).toContain('console.log')
	})

	test('omits console.log calls when enableLogging is false', () => {
		const result = hmrClient({ enableLogging: false })
		expect(result).not.toContain('console.log')
	})

	test('exposes window.__HMR__ when enableLogging is true', () => {
		const result = hmrClient({ enableLogging: true })
		expect(result).toContain('window.__HMR__')
	})

	test('omits window.__HMR__ entirely when enableLogging is false', () => {
		const result = hmrClient({ enableLogging: false })
		expect(result).not.toContain('window.__HMR__')
		expect(result).not.toContain('if (false)')
	})

	test('handles all HMR message types', () => {
		const result = hmrClient()
		expect(result).toContain("case 'pong'")
		expect(result).toContain("case 'build-error'")
		expect(result).toContain("case 'build-success'")
		expect(result).toContain("case 'file-changed'")
	})

	test('does not contain HTML entities — single quotes are literal', () => {
		const result = hmrClient()
		expect(result).not.toContain('&#39;')
		expect(result).not.toContain('&quot;')
		expect(result).not.toContain('&amp;')
		expect(result).not.toContain('&lt;')
		expect(result).not.toContain('&gt;')
	})
})

/* === §hmrScriptTag === */

describe('hmrScriptTag', () => {
	test('wraps output in a <script> element', () => {
		const result = hmrScriptTag()
		expect(result).toMatch(/^<script>/)
		expect(result).toMatch(/<\/script>$/)
	})

	test('script content contains the IIFE', () => {
		const result = hmrScriptTag()
		expect(result).toContain('(function ()')
	})

	test('does not HTML-escape single quotes — regression for &#39; bug', () => {
		const result = hmrScriptTag()
		expect(result).not.toContain('&#39;')
	})

	test('does not HTML-escape double quotes', () => {
		const result = hmrScriptTag()
		expect(result).not.toContain('&quot;')
	})

	test('does not HTML-escape ampersands', () => {
		const result = hmrScriptTag()
		expect(result).not.toContain('&amp;')
	})

	test('does not HTML-escape angle brackets in the script body', () => {
		const result = hmrScriptTag()
		// Strip the outer <script> tags before checking, so we only look inside
		const inner = result.replace(/^<script>/, '').replace(/<\/script>$/, '')
		expect(inner).not.toContain('&lt;')
		expect(inner).not.toContain('&gt;')
	})

	test('forwards config options to hmrClient', () => {
		const result = hmrScriptTag({ enableLogging: false })
		expect(result).not.toContain('console.log')
	})

	test('uses default config when no argument is provided', () => {
		const result = hmrScriptTag()
		expect(result).toContain('window.location.host')
		expect(result).toContain("'/ws'")
	})
})

/* === §hmrClientMinimal === */

describe('hmrClientMinimal', () => {
	test('returns a self-invoking function', () => {
		const result = hmrClientMinimal()
		expect(result).toContain('(function()')
		expect(result).toContain('})()')
	})

	test('connects to /ws', () => {
		const result = hmrClientMinimal()
		expect(result).toContain('/ws')
	})

	test('reloads on message', () => {
		const result = hmrClientMinimal()
		expect(result).toContain('location.reload()')
	})

	test('schedules reconnect on close', () => {
		const result = hmrClientMinimal()
		expect(result).toContain('setTimeout')
		expect(result).toContain('location.reload()')
	})

	test('does not contain HTML entities', () => {
		const result = hmrClientMinimal()
		expect(result).not.toContain('&#39;')
		expect(result).not.toContain('&amp;')
		expect(result).not.toContain('&quot;')
	})
})
