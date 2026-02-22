// Le Truc Docs Service Worker
// Generated at 2026-02-22T14:22:59.317Z
// Auto-generated - do not edit manually

const CACHE_NAME = 'le-truc-docs-131162a4-af0ed8ab';

// Assets to cache on install
const STATIC_ASSETS = [
	'/',
	'/index.html',
	'/assets/main.131162a471abc0a0.css',
	'/assets/main.af0ed8ab299399e3.js'
];

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
});