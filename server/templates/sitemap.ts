/**
 * Sitemap Template
 *
 * Tagged template literal for generating XML sitemap.
 * Provides syntax highlighting and automatic XML escaping.
 */

import { BASE_URL } from '../config'
import type { PageInfo } from '../types'
import { SITEMAP_PRIORITIES, XML_NAMESPACES } from './constants'
import { xml } from './utils'

// Calculate priority based on page type and depth
function calculatePriority(page: PageInfo): string {
	if (page.url === 'index.html') {
		return SITEMAP_PRIORITIES.HOME
	} else if (!page.section) {
		// Root pages get higher priority
		return SITEMAP_PRIORITIES.ROOT_PAGE
	} else if (
		page.section === 'api'
		&& page.relativePath.includes('README.md')
	) {
		// API overview page
		return SITEMAP_PRIORITIES.API_OVERVIEW
	} else if (page.section === 'blog') {
		// Blog posts
		return SITEMAP_PRIORITIES.BLOG_POST
	}
	return SITEMAP_PRIORITIES.DEFAULT
}

// Individual sitemap URL entry
export function sitemapUrl(
	page: PageInfo,
	baseUrl: string,
	lastModified: string,
): string {
	const priority = calculatePriority(page)

	return xml`
	<url>
		<loc>${baseUrl}/${page.url}</loc>
		<lastmod>${lastModified}</lastmod>
		<priority>${priority}</priority>
	</url>`
}

// Main sitemap template
export function sitemap(pages: PageInfo[], baseUrl: string = BASE_URL): string {
	const now = new Date().toISOString()

	return xml`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="${XML_NAMESPACES.SITEMAP}">
	${pages.map(page => sitemapUrl(page, baseUrl, now))}
</urlset>`
}
