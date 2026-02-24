/**
 * Unit Tests for templates/menu.ts — Menu Template
 *
 * Tests for menuItem and menu template functions.
 * Pure functions over mock data — no I/O required.
 */

import { describe, expect, test } from 'bun:test'
import type { PageInfo } from '../../file-signals'
import { menu, menuItem } from '../../templates/menu'

/* === Helpers === */

function mockPage(overrides: Partial<PageInfo> = {}): PageInfo {
	return {
		title: 'Test Page',
		emoji: '📄',
		description: 'A test page',
		url: 'test.html',
		filename: 'test.md',
		relativePath: 'test.md',
		lastModified: 0,
		section: '',
		...overrides,
	}
}

/* === menuItem === */

describe('menuItem', () => {
	test('renders an <li> element', () => {
		const result = menuItem(mockPage())
		expect(result).toContain('<li>')
		expect(result).toContain('</li>')
	})

	test('renders a link with the page URL', () => {
		const result = menuItem(mockPage({ url: 'getting-started.html' }))
		expect(result).toContain('href="getting-started.html"')
	})

	test('renders the emoji in an icon span', () => {
		const result = menuItem(mockPage({ emoji: '🚀' }))
		expect(result).toContain('<span class="icon">')
		expect(result).toContain('🚀')
	})

	test('renders the title in a <strong> element', () => {
		const result = menuItem(mockPage({ title: 'Getting Started' }))
		expect(result).toContain('<strong>')
		expect(result).toContain('Getting Started')
	})

	test('renders the description in a <small> element', () => {
		const result = menuItem(mockPage({ description: 'Learn the basics' }))
		expect(result).toContain('<small>')
		expect(result).toContain('Learn the basics')
	})

	test('escapes HTML special characters in title', () => {
		const result = menuItem(mockPage({ title: 'A & B' }))
		expect(result).toContain('&amp;')
		expect(result).not.toContain('A & B')
	})

	test('escapes HTML special characters in description', () => {
		const result = menuItem(mockPage({ description: '<script>evil</script>' }))
		expect(result).toContain('&lt;script&gt;')
		expect(result).not.toContain('<script>')
	})
})

/* === menu === */

describe('menu', () => {
	test('wraps output in <section-menu>', () => {
		const result = menu([mockPage()])
		expect(result).toContain('<section-menu>')
		expect(result).toContain('</section-menu>')
	})

	test('wraps items in <nav> with <ol>', () => {
		const result = menu([mockPage()])
		expect(result).toContain('<nav>')
		expect(result).toContain('<ol>')
	})

	test('includes a visually-hidden heading', () => {
		const result = menu([mockPage()])
		expect(result).toContain('visually-hidden')
		expect(result).toContain('Main Menu')
	})

	test('renders all root pages', () => {
		const pages = [
			mockPage({ title: 'Home', url: 'index.html' }),
			mockPage({ title: 'About', url: 'about.html' }),
		]
		const result = menu(pages)
		expect(result).toContain('Home')
		expect(result).toContain('About')
	})

	test('filters out pages with a section property', () => {
		const pages = [
			mockPage({ title: 'Root Page', section: '' }),
			mockPage({ title: 'API Page', section: 'api' }),
		]
		const result = menu(pages)
		expect(result).toContain('Root Page')
		expect(result).not.toContain('API Page')
	})

	test('sorts pages by PAGE_ORDER — "index" appears before "about"', () => {
		const pages = [
			mockPage({ title: 'About', url: 'about.html', filename: 'about.md' }),
			mockPage({ title: 'Home', url: 'index.html', filename: 'index.md' }),
		]
		const result = menu(pages)
		const indexPos = result.indexOf('index.html')
		const aboutPos = result.indexOf('about.html')
		expect(indexPos).toBeLessThan(aboutPos)
	})

	test('renders empty <ol> when no root pages exist', () => {
		const pages = [
			mockPage({ title: 'API Page', section: 'api' }),
		]
		const result = menu(pages)
		expect(result).toContain('<section-menu>')
		expect(result).toContain('<ol>')
		expect(result).not.toContain('<li>')
	})

	test('renders empty <ol> for empty input', () => {
		const result = menu([])
		expect(result).toContain('<section-menu>')
		expect(result).toContain('<ol>')
		expect(result).not.toContain('<li>')
	})
})
