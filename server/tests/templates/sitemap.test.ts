/**
 * Unit Tests for templates/sitemap.ts — Sitemap Template
 *
 * Tests for sitemapUrl and sitemap template functions.
 * Pure functions over mock data — no I/O required.
 */

import { describe, expect, test } from 'bun:test'
import type { PageInfo } from '../../file-signals'
import { sitemap, sitemapUrl } from '../../templates/sitemap'

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

const BASE = 'https://example.com'
const LAST_MOD = '2026-02-24T00:00:00.000Z'

/* === sitemapUrl === */

describe('sitemapUrl', () => {
	test('generates a <url> element', () => {
		const result = sitemapUrl(mockPage(), BASE, LAST_MOD)
		expect(result).toContain('<url>')
		expect(result).toContain('</url>')
	})

	test('includes a <loc> element with the full URL', () => {
		const result = sitemapUrl(mockPage({ url: 'about.html' }), BASE, LAST_MOD)
		expect(result).toContain('<loc>')
		expect(result).toContain(`${BASE}/about.html`)
	})

	test('includes a <lastmod> element', () => {
		const result = sitemapUrl(mockPage(), BASE, LAST_MOD)
		expect(result).toContain('<lastmod>')
		expect(result).toContain(LAST_MOD)
	})

	test('includes a <priority> element', () => {
		const result = sitemapUrl(mockPage(), BASE, LAST_MOD)
		expect(result).toContain('<priority>')
	})

	test('gives priority "1.0" to index.html', () => {
		const result = sitemapUrl(mockPage({ url: 'index.html' }), BASE, LAST_MOD)
		expect(result).toContain('<priority>1.0</priority>')
	})

	test('gives priority "0.8" to root pages (no section)', () => {
		const result = sitemapUrl(
			mockPage({ url: 'about.html', section: '' }),
			BASE,
			LAST_MOD,
		)
		expect(result).toContain('<priority>0.8</priority>')
	})

	test('gives priority "0.5" to default (sectioned) pages', () => {
		const result = sitemapUrl(
			mockPage({ url: 'api/functions/foo.html', section: 'api' }),
			BASE,
			LAST_MOD,
		)
		expect(result).toContain('<priority>0.5</priority>')
	})
})

/* === sitemap === */

describe('sitemap', () => {
	test('starts with XML declaration', () => {
		const result = sitemap([mockPage()], BASE)
		expect(result.trimStart()).toMatch(/^<\?xml version="1\.0"/)
	})

	test('includes the sitemap xmlns on <urlset>', () => {
		const result = sitemap([mockPage()], BASE)
		expect(result).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
	})

	test('wraps entries in <urlset>', () => {
		const result = sitemap([mockPage()], BASE)
		expect(result).toContain('<urlset')
		expect(result).toContain('</urlset>')
	})

	test('includes one <url> per page', () => {
		const pages = [mockPage({ url: 'a.html' }), mockPage({ url: 'b.html' })]
		const result = sitemap(pages, BASE)
		const urlCount = (result.match(/<url>/g) || []).length
		expect(urlCount).toBe(2)
	})

	test('includes all page URLs', () => {
		const pages = [mockPage({ url: 'foo.html' }), mockPage({ url: 'bar.html' })]
		const result = sitemap(pages, BASE)
		expect(result).toContain(`${BASE}/foo.html`)
		expect(result).toContain(`${BASE}/bar.html`)
	})

	test('handles empty page list', () => {
		const result = sitemap([], BASE)
		expect(result).toContain('<?xml')
		expect(result).toContain('<urlset')
		expect(result).not.toContain('<url>')
	})
})
