import type { ComponentProps, ComponentUI, Parser, UI } from '../..'

/* === Types === */

type CacheEntry<T = unknown> = {
	content: T
	timestamp: number
	etag?: string
	lastModified?: string
	maxAge?: number
}

/* === Internal Stuff === */

const cache = new Map<string, CacheEntry>()

const parseCacheControl = (
	header: string,
): { maxAge?: number; noCache: boolean; noStore: boolean } => {
	const directives = header
		.toLowerCase()
		.split(',')
		.map(d => d.trim())
	const result = {
		noCache: false,
		noStore: false,
		maxAge: undefined as number | undefined,
	}

	for (const directive of directives) {
		if (directive === 'no-cache') result.noCache = true
		else if (directive === 'no-store') result.noStore = true
		else if (directive.startsWith('max-age=')) {
			const value = parseInt(directive.substring(8), 10)
			if (!isNaN(value)) result.maxAge = value
		}
	}

	return result
}

const isCacheEntryValid = (entry: CacheEntry): boolean => {
	if (entry.maxAge !== undefined) {
		const age = (Date.now() - entry.timestamp) / 1000
		return age < entry.maxAge
	}
	return true
}

/* === Exported Functions === */

/**
 * Check if an URL is recursive
 *
 * @param {string} value - URL to check
 * @param {HTMLElement} host - Host element
 * @param {string} attr - Attribute name
 * @returns {boolean} - True if the URL is recursive, false otherwise
 */
export const isRecursiveURL = (
	value: string,
	host: HTMLElement,
	attr: string = 'src',
): boolean =>
	!!value &&
	!!(host.parentElement || (host.getRootNode() as ShadowRoot).host)?.closest(
		`${host.localName}[${attr}="${value}"]`,
	)

/**
 * Check if an URL is valid
 *
 * @param {string} value - URL to check
 * @returns {boolean} - True if the URL is valid, false otherwise
 */
export const isValidURL = (value: string): boolean => {
	if (!value) return false
	try {
		const url = new URL(value, location.href)
		if (url.origin === location.origin) return true
	} catch {
		return false
	}
	return false
}

/**
 * Fetch with HTTP caching support
 *
 * @param url - URL to fetch
 * @param signal - AbortSignal for cancellation
 * @param parseResponse - Function to parse the response body (defaults to text)
 * @returns Promise with parsed content and cache status
 */
export const fetchWithCache = async <T = string>(
	url: string,
	signal?: AbortSignal,
	parseResponse: (response: Response) => Promise<T> = (response: Response) =>
		response.text() as Promise<T>,
): Promise<{ content: T; fromCache: boolean }> => {
	const cached = cache.get(url) as CacheEntry<T> | undefined
	const headers: HeadersInit = {}

	// Add conditional headers if we have cached data
	if (cached?.etag) headers['If-None-Match'] = cached.etag
	if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified

	const response = await fetch(url, { signal, headers })

	// Handle 304 Not Modified
	if (response.status === 304 && cached)
		return { content: cached.content, fromCache: true }

	if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`)

	const content = await parseResponse(response)
	const cacheControl = response.headers.get('cache-control')
	const etag = response.headers.get('etag')
	const lastModified = response.headers.get('last-modified')

	// Parse cache directives
	const cacheDirectives = cacheControl
		? parseCacheControl(cacheControl)
		: { noCache: false, noStore: false }

	// Store in cache if allowed
	if (!cacheDirectives.noStore) {
		const entry: CacheEntry<T> = {
			content,
			timestamp: Date.now(),
			etag: etag || undefined,
			lastModified: lastModified || undefined,
			maxAge: cacheDirectives.maxAge,
		}

		if (!cacheDirectives.noCache || isCacheEntryValid(entry))
			cache.set(url, entry)
	}

	return { content, fromCache: false }
}

/**
 * Clear the entire cache
 */
export const clearCache = (): void => {
	cache.clear()
}

/**
 * Remove a specific URL from cache
 */
export const removeCacheEntry = (url: string): boolean => {
	return cache.delete(url)
}

/**
 * Get cache size
 */
export const getCacheSize = (): number => {
	return cache.size
}
