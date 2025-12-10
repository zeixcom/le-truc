/**
 * Performance Hints Template
 *
 * Tagged template literal for generating performance hint HTML elements.
 * Provides syntax highlighting and automatic escaping.
 */

import { getResourceType, html, requiresCrossorigin } from './utils'

// Individual preload link template
export function preloadLink(url: string): string {
	const asType = getResourceType(url)

	// Add crossorigin for fonts
	const crossorigin = requiresCrossorigin(url) ? ' crossorigin' : ''

	return html`<link
		rel="preload"
		href="${url}"
		as="${asType}"
		${crossorigin}
	/>`
}

// DNS prefetch template
export function dnsPrefetch(domain: string): string {
	return html`<link rel="dns-prefetch" href="${domain}" />`
}

// Preconnect template
export function preconnect(
	origin: string,
	crossorigin: boolean = false,
): string {
	const crossoriginAttr = crossorigin ? ' crossorigin' : ''
	return html`<link rel="preconnect" href="${origin}" ${crossoriginAttr} />`
}

// Module preload template (for ES modules)
export function modulePreload(url: string): string {
	return html`<link rel="modulepreload" href="${url}" />`
}

// Main performance hints template
export function performanceHints(preloads: string[]): string {
	if (!preloads || preloads.length === 0) {
		return ''
	}

	return html`${preloads.map(url => preloadLink(url))}`
}

// Enhanced performance hints with different resource types
export function enhancedPerformanceHints(options: {
	preloads?: string[]
	dnsPrefetches?: string[]
	preconnects?: Array<{ origin: string; crossorigin?: boolean }>
	modulePreloads?: string[]
}): string {
	const {
		preloads = [],
		dnsPrefetches = [],
		preconnects = [],
		modulePreloads = [],
	} = options

	const hints: string[] = []

	// Add DNS prefetches first (earliest in the loading process)
	if (dnsPrefetches.length > 0) {
		hints.push(...dnsPrefetches.map(domain => dnsPrefetch(domain)))
	}

	// Add preconnects
	if (preconnects.length > 0) {
		hints.push(
			...preconnects.map(({ origin, crossorigin }) =>
				preconnect(origin, crossorigin),
			),
		)
	}

	// Add module preloads
	if (modulePreloads.length > 0) {
		hints.push(...modulePreloads.map(url => modulePreload(url)))
	}

	// Add regular preloads
	if (preloads.length > 0) {
		hints.push(...preloads.map(url => preloadLink(url)))
	}

	return hints.join('\n\t\t')
}
