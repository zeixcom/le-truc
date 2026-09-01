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
		expect(result).toContain('href="./getting-started.html"')
	})

	test('prefixes the URL with basePath for nested pages', () => {
		const result = menuItem(
			mockPage({ url: 'getting-started.html' }),
			undefined,
			'../',
		)
		expect(result).toContain('href="../getting-started.html"')
	})

	test('renders the title as the link text', () => {
		const result = menuItem(mockPage({ title: 'Getting Started' }))
		expect(result).toContain('Getting Started')
	})

	test('does not render a description caption', () => {
		const result = menuItem(mockPage({ description: 'Learn the basics' }))
		expect(result).not.toContain('<small>')
		expect(result).not.toContain('Learn the basics')
	})

	test('escapes HTML special characters in title', () => {
		const result = menuItem(mockPage({ title: 'A & B' }))
		expect(result).toContain('&amp;')
		expect(result).not.toContain('A & B')
	})

	test('does not mark the item active when no currentSlug is given', () => {
		const result = menuItem(mockPage({ filename: 'index.md' }))
		expect(result).not.toContain('aria-current')
		expect(result).not.toContain('class="active"')
	})

	test('marks the item active when currentSlug matches its slug', () => {
		const result = menuItem(mockPage({ filename: 'index.md' }), 'index')
		expect(result).toContain('aria-current="page"')
		expect(result).toContain('class="active"')
	})

	test('does not mark the item active when currentSlug does not match', () => {
		const result = menuItem(mockPage({ filename: 'index.md' }), 'about')
		expect(result).not.toContain('aria-current')
		expect(result).not.toContain('class="active"')
	})
})

/* === menu === */

describe('menu', () => {
	test('wraps output in <section-menu> with a sidebar id', () => {
		const result = menu([mockPage()])
		expect(result).toContain('<section-menu id="sidebar">')
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
			mockPage({ title: 'Home', url: 'index.html', filename: 'index.md' }),
			mockPage({ title: 'About', url: 'about.html', filename: 'about.md' }),
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
		const pages = [mockPage({ title: 'API Page', section: 'api' })]
		const result = menu(pages)
		expect(result).toContain('<section-menu')
		expect(result).toContain('<ol>')
		expect(result).not.toContain('<li>')
	})

	test('renders empty <ol> for empty input', () => {
		const result = menu([])
		expect(result).toContain('<section-menu')
		expect(result).toContain('<ol>')
		expect(result).not.toContain('<li>')
	})

	test('marks the page matching currentSlug active', () => {
		const pages = [
			mockPage({ title: 'Home', url: 'index.html', filename: 'index.md' }),
			mockPage({ title: 'About', url: 'about.html', filename: 'about.md' }),
		]
		const result = menu(pages, 'about')
		const aboutIndex = result.indexOf('about.html')
		const aboutLinkStart = result.lastIndexOf('<a', aboutIndex)
		const aboutLinkEnd = result.indexOf('>', aboutIndex)
		const aboutLink = result.slice(aboutLinkStart, aboutLinkEnd)
		expect(aboutLink).toContain('aria-current="page"')

		const homeIndex = result.indexOf('index.html')
		const homeLinkStart = result.lastIndexOf('<a', homeIndex)
		const homeLinkEnd = result.indexOf('>', homeIndex)
		const homeLink = result.slice(homeLinkStart, homeLinkEnd)
		expect(homeLink).not.toContain('aria-current')
	})

	test('marks a sectioned page active via its parent section slug', () => {
		// currentSlug "blog" marks the root "blog" menu item active when
		// rendering an individual blog post (which has section: "blog")
		const pages = [
			mockPage({ title: 'Blog', url: 'blog.html', filename: 'blog.md' }),
		]
		const result = menu(pages, 'blog')
		expect(result).toContain('aria-current="page"')
	})
})

/* === menu grouping === */

describe('menu group headings', () => {
	const groupPage = (overrides: Partial<PageInfo>): PageInfo =>
		mockPage({ section: '', ...overrides })

	test('renders a group heading before the first group member', () => {
		const result = menu([
			groupPage({ filename: 'index.md', url: 'index.html' }),
			groupPage({ filename: 'components.md', url: 'components.html' }),
			groupPage({ filename: 'about.md', url: 'about.html' }),
		])
		const headingPos = result.indexOf('Building Components')
		const memberPos = result.indexOf('components.html')
		expect(headingPos).toBeGreaterThanOrEqual(0)
		expect(headingPos).toBeLessThan(memberPos)
	})

	test('renders each group heading only once', () => {
		const result = menu([
			groupPage({ filename: 'components.md', url: 'components.html' }),
			groupPage({ filename: 'props.md', url: 'props.html' }),
			groupPage({ filename: 'effects.md', url: 'effects.html' }),
		])
		expect(result.split('Building Components').length - 1).toBe(1)
	})

	test('every root page belongs to a group, so every page gets a heading somewhere', () => {
		const result = menu([
			groupPage({ filename: 'index.md', url: 'index.html' }),
			groupPage({ filename: 'about.md', url: 'about.html' }),
		])
		expect(result).toContain('Get Started')
		expect(result).toContain('Community')
	})

	test('group heading carries presentation role', () => {
		const result = menu([
			groupPage({ filename: 'components.md', url: 'components.html' }),
		])
		expect(result).toContain('role="presentation"')
	})
})
