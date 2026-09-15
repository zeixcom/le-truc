/**
 * Sitemap Template
 *
 * Tagged template literal for generating XML sitemap.
 * Provides syntax highlighting and automatic XML escaping.
 */

import { BASE_URL, LOCALES } from '../config'
import type { PageInfo } from '../file-signals'
import { SITEMAP_PRIORITIES, XML_NAMESPACES } from './constants'
import { raw, xml } from './utils'

// Calculate priority based on page type and depth
function calculatePriority(page: PageInfo): string {
	if (page.url === 'index.html') {
		return SITEMAP_PRIORITIES.HOME
	} else if (!page.section) {
		// Root pages get higher priority
		return SITEMAP_PRIORITIES.ROOT_PAGE
	} else if (
		page.section === 'api' &&
		page.relativePath.includes('README.md')
	) {
		// API overview page
		return SITEMAP_PRIORITIES.API_OVERVIEW
	} else if (page.section === 'blog') {
		// Blog posts
		return SITEMAP_PRIORITIES.BLOG_POST
	}
	return SITEMAP_PRIORITIES.DEFAULT
}

// Individual sitemap URL entry, for one page in one locale.
//
// Every locale gets its own <loc> under its path prefix (LT-174), each
// carrying the full xhtml:link alternate set — search engines expect the
// alternates to be reciprocal, listed on every member of the group.
export function sitemapUrl(
	page: PageInfo,
	baseUrl: string,
	lastModified: string,
	locale: string = LOCALES[0],
): string {
	const priority = calculatePriority(page)
	const alternate = (hreflang: string, target: string) => xml`
		<xhtml:link rel="alternate" hreflang="${hreflang}" href="${baseUrl}/${target}/${page.url}" />`
	// x-default joins every member's set, pointing at the default locale —
	// the same set pages.ts emits into the page heads, so the two hreflang
	// channels agree.
	const alternates = [
		...LOCALES.map(l => alternate(l, l)),
		alternate('x-default', LOCALES[0]),
	].join('')

	return xml`
	<url>
		<loc>${baseUrl}/${locale}/${page.url}</loc>${raw(alternates)}
		<lastmod>${lastModified}</lastmod>
		<priority>${priority}</priority>
	</url>`
}

// Main sitemap template
export function sitemap(pages: PageInfo[], baseUrl: string = BASE_URL): string {
	const now = new Date().toISOString()

	return xml`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="${XML_NAMESPACES.SITEMAP}" xmlns:xhtml="${XML_NAMESPACES.XHTML}">
	${LOCALES.flatMap(locale =>
		pages.map(page => sitemapUrl(page, baseUrl, now, locale)),
	)}
</urlset>`
}
