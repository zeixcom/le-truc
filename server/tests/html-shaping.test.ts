/**
 * Unit Tests for html-shaping.ts
 */

import { describe, expect, test } from 'bun:test'
import { injectTableOfContents } from '../html-shaping'

const PLACEHOLDER = '<div class="toc-placeholder" data-toc="true"></div>'

describe('injectTableOfContents', () => {
	test('replaces placeholder with nav when toc has 2+ items', () => {
		const html = `<section-hero>${PLACEHOLDER}</section-hero>`
		const toc = [
			{ id: 'getting-started', text: 'Getting started' },
			{ id: 'advanced', text: 'Advanced' },
		]
		const result = injectTableOfContents(html, toc)
		expect(result).toContain('<nav class="toc" aria-label="On this page">')
		expect(result).toContain('<a href="#getting-started">Getting started</a>')
		expect(result).toContain('<a href="#advanced">Advanced</a>')
		expect(result).not.toContain('toc-placeholder')
	})

	test('removes placeholder when toc has fewer than 2 items', () => {
		const html = `<section-hero>${PLACEHOLDER}</section-hero>`
		const result = injectTableOfContents(html, [{ id: 'only', text: 'Only' }])
		expect(result).not.toContain('toc-placeholder')
		expect(result).not.toContain('<nav class="toc"')
		expect(result).toBe('<section-hero></section-hero>')
	})

	test('removes placeholder when toc is empty', () => {
		const html = `<p>Content</p>${PLACEHOLDER}`
		const result = injectTableOfContents(html, [])
		expect(result).toBe('<p>Content</p>')
	})

	test('leaves html unchanged when no placeholder present', () => {
		const html = '<p>No hero here</p>'
		const toc = [
			{ id: 'a', text: 'A' },
			{ id: 'b', text: 'B' },
		]
		expect(injectTableOfContents(html, toc)).toBe(html)
	})

	test('generates ordered list with one item per heading', () => {
		const html = PLACEHOLDER
		const toc = [
			{ id: 'one', text: 'One' },
			{ id: 'two', text: 'Two' },
			{ id: 'three', text: 'Three' },
		]
		const result = injectTableOfContents(html, toc)
		expect(result).toContain('<ol>')
		expect((result.match(/<li>/g) ?? []).length).toBe(3)
	})
})
