/**
 * Unit Tests for the locale helpers in effects/pages.ts (LT-174)
 *
 * Covers:
 * - pageDepth: depth of a page inside its locale tree
 * - hreflangAlternates: per-locale <link rel="alternate"> set + x-default
 * - rootRedirectPage: the site root's static redirect stub
 *
 * Pure functions — no I/O, no build needed.
 */

import { describe, expect, test } from 'bun:test'
import { BASE_URL, LOCALES } from '../../config'
import {
	hreflangAlternates,
	pageDepth,
	rootRedirectPage,
} from '../../effects/pages'

/* === pageDepth === */

describe('pageDepth', () => {
	test('a root page of the locale tree is depth 0', () => {
		expect(pageDepth('guide.md')).toBe(0)
	})

	test('a blog post is depth 1', () => {
		expect(pageDepth('blog/2026-03-09-introducing-le-truc.md')).toBe(1)
	})

	test('deeper nesting counts each segment', () => {
		expect(pageDepth('a/b/c.md')).toBe(2)
		expect(pageDepth('a/b/c/d.md')).toBe(3)
	})
})

/* === hreflangAlternates === */

describe('hreflangAlternates', () => {
	test('emits one link per locale plus x-default', () => {
		const html = hreflangAlternates('guide.html')
		const links = html.match(/<link /g)?.length ?? 0
		expect(links).toBe(LOCALES.length + 1)
	})

	test('every built locale gets an absolute URL under the base', () => {
		const html = hreflangAlternates('guide.html')
		for (const locale of LOCALES) {
			expect(html).toContain(
				`hreflang="${locale}" href="${BASE_URL}/${locale}/guide.html"`,
			)
		}
	})

	test('x-default points at the default locale', () => {
		const html = hreflangAlternates('guide.html')
		expect(html).toContain(
			`hreflang="x-default" href="${BASE_URL}/${LOCALES[0]}/guide.html"`,
		)
	})

	test('accepts a custom base URL', () => {
		const html = hreflangAlternates('index.html', 'https://example.com')
		expect(html).toContain(
			`href="https://example.com/${LOCALES[0]}/index.html"`,
		)
	})

	test('keeps nested page paths (blog posts) in the URL', () => {
		const html = hreflangAlternates('blog/post.html')
		expect(html).toContain(`/${LOCALES[0]}/blog/post.html`)
	})
})

/* === rootRedirectPage === */

describe('rootRedirectPage', () => {
	test('defaults to the default locale', () => {
		const html = rootRedirectPage()
		expect(html).toContain(`lang="${LOCALES[0]}"`)
		expect(html).toContain(`./${LOCALES[0]}/index.html`)
	})

	test('meta refresh, canonical, and fallback link all target the locale index', () => {
		const html = rootRedirectPage(LOCALES[1])
		expect(html).toContain(
			`<meta http-equiv="refresh" content="0; url=./${LOCALES[1]}/index.html">`,
		)
		expect(html).toContain(
			`<link rel="canonical" href="./${LOCALES[1]}/index.html">`,
		)
		expect(html).toContain(`<a href="./${LOCALES[1]}/index.html">`)
	})

	test('is noindex and carries the hreflang set', () => {
		const html = rootRedirectPage()
		expect(html).toContain('<meta name="robots" content="noindex">')
		expect(html).toContain('rel="alternate"')
		expect(html).toContain('hreflang="x-default"')
	})

	test('carries no script (works with JS disabled)', () => {
		expect(rootRedirectPage()).not.toContain('<script')
	})
})
