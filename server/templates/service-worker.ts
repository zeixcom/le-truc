/**
 * Service Worker Template
 *
 * Tagged template literal for generating service worker JavaScript code.
 * Provides syntax highlighting and proper JavaScript generation.
 */

import {
	createValidator,
	js,
	validateArrayField,
	validateHashString,
	validateRequiredString,
} from './utils'

// Service worker configuration interface
export interface ServiceWorkerConfig {
	cssHash: string
	jsHash: string
	cacheName?: string
	staticAssets?: string[]
	cacheTimeout?: number
	enableNetworkFirst?: boolean
	enableStaleWhileRevalidate?: boolean
}

// Default static assets to cache
const DEFAULT_STATIC_ASSETS = ['/', '/index.html']

/**
 * Generate cache name with timestamp
 */
function generateCacheName(baseName: string = 'le-truc-docs'): string {
	return `${baseName}-v${Date.now()}`
}

/**
 * Generate the static assets array for the service worker
 */
function generateStaticAssets(config: ServiceWorkerConfig): string[] {
	const assets = config.staticAssets || DEFAULT_STATIC_ASSETS
	const versionedAssets = [
		`/assets/main.${config.cssHash}.css`,
		`/assets/main.${config.jsHash}.js`,
	]

	return [...assets, ...versionedAssets]
}

/**
 * Generate install event listener
 */
export function installEventListener(): string {
	return js`
self.addEventListener('install', (event) => {
	console.log('Service worker installing...');
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then(cache => {
				console.log('Caching static assets:', STATIC_ASSETS);
				return cache.addAll(STATIC_ASSETS);
			})
			.then(() => {
				console.log('Service worker installed successfully');
				return self.skipWaiting();
			})
			.catch(error => {
				console.error('Service worker installation failed:', error);
			})
	);
});`
}

/**
 * Generate activate event listener
 */
export function activateEventListener(): string {
	return js`
self.addEventListener('activate', (event) => {
	console.log('Service worker activating...');
	event.waitUntil(
		caches.keys()
			.then(cacheNames => {
				console.log('Existing caches:', cacheNames);
				return Promise.all(
					cacheNames
						.filter(cache => cache !== CACHE_NAME)
						.map(cache => {
							console.log('Deleting old cache:', cache);
							return caches.delete(cache);
						})
				);
			})
			.then(() => {
				console.log('Service worker activated');
				return self.clients.claim();
			})
			.catch(error => {
				console.error('Service worker activation failed:', error);
			})
	);
});`
}

/**
 * Generate basic fetch event listener with cache-first strategy
 */
export function fetchEventListener(): string {
	return js`
self.addEventListener('fetch', (event) => {
	const { request } = event;

	// Only handle GET requests
	if (request.method !== 'GET') return;

	// Skip cross-origin requests
	if (!request.url.startsWith(self.location.origin)) return;

	// Skip non-HTTP requests
	if (!request.url.startsWith('http')) return;

	event.respondWith(
		caches.match(request)
			.then(cachedResponse => {
				if (cachedResponse) {
					console.log('Cache hit for:', request.url);
					return cachedResponse;
				}

				console.log('Cache miss for:', request.url);
				return fetch(request)
					.then(response => {
						// Don't cache non-successful responses
						if (!response.ok) {
							console.warn('Non-OK response for:', request.url, response.status);
							return response;
						}

						// Clone the response before caching
						const responseToCache = response.clone();

						// Cache static assets and HTML pages
						if (request.url.includes('/assets/') ||
							request.url.endsWith('.html') ||
							request.url.endsWith('/')) {
							caches.open(CACHE_NAME)
								.then(cache => {
									console.log('Caching:', request.url);
									return cache.put(request, responseToCache);
								})
								.catch(error => {
									console.error('Caching failed for:', request.url, error);
								});
						}

						return response;
					})
					.catch(error => {
						console.error('Fetch failed for:', request.url, error);
						throw error;
					});
			})
	);
});`
}

/**
 * Generate network-first fetch strategy (for dynamic content)
 */
export function networkFirstFetchListener(): string {
	return js`
self.addEventListener('fetch', (event) => {
	const { request } = event;

	// Only handle GET requests
	if (request.method !== 'GET') return;
	if (!request.url.startsWith(self.location.origin)) return;
	if (!request.url.startsWith('http')) return;

	event.respondWith(
		fetch(request)
			.then(response => {
				if (response.ok) {
					const responseToCache = response.clone();
					caches.open(CACHE_NAME)
						.then(cache => cache.put(request, responseToCache))
						.catch(error => console.error('Caching failed:', error));
				}
				return response;
			})
			.catch(() => {
				// Fallback to cache if network fails
				return caches.match(request)
					.then(cachedResponse => {
						if (cachedResponse) {
							console.log('Serving from cache (network failed):', request.url);
							return cachedResponse;
						}
						throw new Error('No cached response available');
					});
			})
	);
});`
}

/**
 * Generate stale-while-revalidate fetch strategy
 */
export function staleWhileRevalidateFetchListener(): string {
	return js`
self.addEventListener('fetch', (event) => {
	const { request } = event;

	if (request.method !== 'GET') return;
	if (!request.url.startsWith(self.location.origin)) return;
	if (!request.url.startsWith('http')) return;

	event.respondWith(
		caches.match(request)
			.then(cachedResponse => {
				// Start fetch request regardless of cache status
				const fetchPromise = fetch(request)
					.then(response => {
						if (response.ok) {
							const responseToCache = response.clone();
							caches.open(CACHE_NAME)
								.then(cache => cache.put(request, responseToCache));
						}
						return response;
					})
					.catch(error => {
						console.error('Fetch failed:', request.url, error);
						return null;
					});

				// Return cached response immediately if available,
				// otherwise wait for network
				return cachedResponse || fetchPromise;
			})
	);
});`
}

/**
 * Generate service worker header comment
 */
export function serviceWorkerHeader(version?: string): string {
	const versionText = version ? ` v${version}` : ''
	return js`// Le Truc Docs Service Worker${versionText}
// Generated at ${new Date().toISOString()}
// Auto-generated - do not edit manually`
}

/**
 * Generate complete service worker with cache-first strategy
 */
export function serviceWorker(config: ServiceWorkerConfig): string {
	const cacheName = config.cacheName || generateCacheName()
	const staticAssets = generateStaticAssets(config)

	return js`${serviceWorkerHeader()}

const CACHE_NAME = '${cacheName}';

// Assets to cache on install
const STATIC_ASSETS = [
	${staticAssets.map(asset => `'${asset}'`).join(',\n\t')}
];

${installEventListener()}

${activateEventListener()}

${fetchEventListener()}`
}

/**
 * Generate enhanced service worker with configurable caching strategies
 */
export function enhancedServiceWorker(config: ServiceWorkerConfig): string {
	const cacheName = config.cacheName || generateCacheName()
	const staticAssets = generateStaticAssets(config)

	let fetchStrategy = fetchEventListener()

	if (config.enableNetworkFirst) {
		fetchStrategy = networkFirstFetchListener()
	} else if (config.enableStaleWhileRevalidate) {
		fetchStrategy = staleWhileRevalidateFetchListener()
	}

	return js`${serviceWorkerHeader()}

const CACHE_NAME = '${cacheName}';

// Assets to cache on install
const STATIC_ASSETS = [
	${staticAssets.map(asset => `'${asset}'`).join(',\n\t')}
];

// Configuration
const CONFIG = {
	cacheTimeout: ${config.cacheTimeout || 86400000}, // 24 hours
	enableNetworkFirst: ${config.enableNetworkFirst || false},
	enableStaleWhileRevalidate: ${config.enableStaleWhileRevalidate || false},
};

self.addEventListener('install', (event) => {
	console.log('Service worker installing...');
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then(cache => {
				console.log('Caching static assets:', STATIC_ASSETS);
				return cache.addAll(STATIC_ASSETS);
			})
			.then(() => {
				console.log('Service worker installed successfully');
				return self.skipWaiting();
			})
			.catch(error => {
				console.error('Service worker installation failed:', error);
			})
	);
});

self.addEventListener('activate', (event) => {
	console.log('Service worker activating...');
	event.waitUntil(
		caches.keys()
			.then(cacheNames => {
				console.log('Existing caches:', cacheNames);
				return Promise.all(
					cacheNames
						.filter(cache => cache !== CACHE_NAME)
						.map(cache => {
							console.log('Deleting old cache:', cache);
							return caches.delete(cache);
						})
				);
			})
			.then(() => {
				console.log('Service worker activated');
				return self.clients.claim();
			})
			.catch(error => {
				console.error('Service worker activation failed:', error);
			})
	);
});

${fetchStrategy}`
}

/**
 * Validate service worker configuration
 */
export const validateServiceWorkerConfig = createValidator<ServiceWorkerConfig>(
	[
		config => validateRequiredString(config.cssHash, 'CSS hash'),
		config => validateRequiredString(config.jsHash, 'JS hash'),
		config => {
			const errors: string[] = []
			if (config.cssHash && !validateHashString(config.cssHash)) {
				errors.push('CSS hash must be a valid hex string (min 8 chars)')
			}
			return errors
		},
		config => {
			const errors: string[] = []
			if (config.jsHash && !validateHashString(config.jsHash)) {
				errors.push('JS hash must be a valid hex string (min 8 chars)')
			}
			return errors
		},
		config => {
			const errors: string[] = []
			if (config.cacheTimeout !== undefined && config.cacheTimeout < 0) {
				errors.push('Cache timeout must be non-negative')
			}
			return errors
		},
		config =>
			validateArrayField(
				config.staticAssets,
				'Static assets',
				item => typeof item === 'string',
			),
	],
)

/**
 * Generate minimized service worker (removes console.log statements)
 */
export function minifiedServiceWorker(config: ServiceWorkerConfig): string {
	const fullServiceWorker = enhancedServiceWorker(config)

	// Remove console.log statements and extra whitespace for production
	return fullServiceWorker
		.replace(/\s*console\.(log|warn|error)\([^)]*\);?\s*/g, '')
		.replace(/\n\s*\n/g, '\n')
		.replace(/\t+/g, '\t')
		.trim()
}
