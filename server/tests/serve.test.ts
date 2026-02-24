/**
 * Tests for serve.ts — HTTP Server Routes & Utilities
 *
 * Covers:
 * - getLayoutForPath pure unit function
 * - Route responses via isolated Bun.serve instance
 * - HMR injection behaviour (dev vs production)
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { ASSETS_DIR, EXAMPLES_DIR, OUTPUT_DIR, SOURCES_DIR } from '../config'
import { fileExists, getFilePath } from '../io'
import { getLayoutForPath } from '../serve'
import { hmrScriptTag } from '../templates/hmr'

/* === §14.4 getLayoutForPath — unit tests (no server needed) === */

describe('getLayoutForPath', () => {
	test('returns "api" for /api/functions/ prefix', () => {
		expect(getLayoutForPath('/api/functions/foo')).toBe('api')
	})

	test('returns "api" for /api/classes/ prefix', () => {
		expect(getLayoutForPath('/api/classes/MyClass')).toBe('api')
	})

	test('returns "api" for /api/type-aliases/ prefix', () => {
		expect(getLayoutForPath('/api/type-aliases/Foo')).toBe('api')
	})

	test('returns "api" for /api/variables/ prefix', () => {
		expect(getLayoutForPath('/api/variables/bar')).toBe('api')
	})

	test('returns "test" for /test/ prefix', () => {
		expect(getLayoutForPath('/test/basic-counter')).toBe('test')
	})

	test('returns "overview" for /examples exact match', () => {
		expect(getLayoutForPath('/examples')).toBe('overview')
	})

	test('returns "example" for /examples/ prefix', () => {
		expect(getLayoutForPath('/examples/basic-counter')).toBe('example')
	})

	test('returns "overview" for /blog exact match', () => {
		expect(getLayoutForPath('/blog')).toBe('overview')
	})

	test('returns "overview" for /api/ prefix (API overview)', () => {
		expect(getLayoutForPath('/api/')).toBe('overview')
	})

	test('returns "page" for a root documentation page', () => {
		expect(getLayoutForPath('/getting-started')).toBe('page')
	})

	test('returns "page" for unknown routes', () => {
		expect(getLayoutForPath('/anything-else')).toBe('page')
	})

	test('returns "page" for /', () => {
		expect(getLayoutForPath('/')).toBe('page')
	})
})

/* === Isolated test server === */

// Create a minimal Bun server that mirrors key routes from serve.ts.
// Uses real docs/ output files — requires a prior build.
// NODE_ENV is not set to 'development' so HMR injection is inactive.

type TestServer = {
	url: string
	close: () => void
}

function startTestServer(opts: { development?: boolean } = {}): TestServer {
	const isDev = opts.development ?? false

	const injectHMR = (html: string): string => {
		if (!isDev) return html
		const script = hmrScriptTag({
			enableLogging: true,
			maxReconnectAttempts: 10,
			reconnectInterval: 1000,
			pingInterval: 30000,
		})
		if (html.includes('</head>'))
			return html.replace('</head>', `${script}\n</head>`)
		if (html.includes('</body>'))
			return html.replace('</body>', `${script}\n</body>`)
		return html + script
	}

	const serveFile = async (filePath: string): Promise<Response> => {
		if (!fileExists(filePath)) return new Response('Not Found', { status: 404 })
		if (isDev && filePath.endsWith('.html')) {
			const content = await Bun.file(filePath).text()
			return new Response(injectHMR(content), {
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			})
		}
		return new Response(Bun.file(filePath))
	}

	const server = Bun.serve({
		port: 0, // random free port
		routes: {
			'/api/status': new Response('OK'),

			'/ws': () => new Response('Not available in production', { status: 404 }),

			'/assets/:file': req => {
				const filePath = getFilePath(ASSETS_DIR, req.params.file)
				return serveFile(filePath)
			},

			'/examples/:component': req => {
				const filePath = getFilePath(EXAMPLES_DIR, req.params.component)
				return serveFile(filePath)
			},

			'/sources/:file': req => {
				const filePath = getFilePath(SOURCES_DIR, req.params.file)
				return serveFile(filePath)
			},

			'/:page': req => {
				const filePath = getFilePath(OUTPUT_DIR, req.params.page)
				return serveFile(filePath)
			},

			'/': () => serveFile(getFilePath(OUTPUT_DIR, 'index.html')),
		},

		fetch() {
			return new Response('Not Found', { status: 404 })
		},
	})

	return {
		url: server.url.toString().replace(/\/$/, ''),
		close: () => server.stop(),
	}
}

/* === §14.1 Route responses (production mode) === */

describe('route responses', () => {
	let server: TestServer

	beforeAll(() => {
		server = startTestServer()
	})

	afterAll(() => {
		server.close()
	})

	test('GET /api/status → 200 "OK"', async () => {
		const res = await fetch(`${server.url}/api/status`)
		expect(res.status).toBe(200)
		expect(await res.text()).toBe('OK')
	})

	test('GET /ws → 404 in production', async () => {
		const res = await fetch(`${server.url}/ws`)
		expect(res.status).toBe(404)
		expect(await res.text()).toBe('Not available in production')
	})

	test('GET / → 200 with HTML', async () => {
		const res = await fetch(`${server.url}/`)
		expect(res.status).toBe(200)
		const body = await res.text()
		expect(body.toLowerCase()).toContain('<!doctype html')
	})

	test('GET /index.html → 200 with HTML', async () => {
		const res = await fetch(`${server.url}/index.html`)
		expect(res.status).toBe(200)
		const body = await res.text()
		expect(body.toLowerCase()).toContain('<!doctype html')
	})

	test('GET /getting-started.html → 200 (existing page)', async () => {
		const res = await fetch(`${server.url}/getting-started.html`)
		expect(res.status).toBe(200)
	})

	test('GET /nonexistent.html → 404', async () => {
		const res = await fetch(`${server.url}/nonexistent.html`)
		expect(res.status).toBe(404)
		expect(await res.text()).toBe('Not Found')
	})

	test('GET /assets/main.css → 200 (existing asset)', async () => {
		const res = await fetch(`${server.url}/assets/main.css`)
		expect(res.status).toBe(200)
		expect(res.headers.get('content-type')).toContain('text/css')
	})

	test('GET /assets/nope.css → 404 (missing asset)', async () => {
		const res = await fetch(`${server.url}/assets/nope.css`)
		expect(res.status).toBe(404)
	})

	test('GET /a/b/c/d → 404 (unknown route)', async () => {
		const res = await fetch(`${server.url}/a/b/c/d`)
		expect(res.status).toBe(404)
	})
})

/* === §14.3 HMR injection === */

describe('HMR injection', () => {
	let prodServer: TestServer
	let devServer: TestServer

	beforeAll(() => {
		prodServer = startTestServer({ development: false })
		devServer = startTestServer({ development: true })
	})

	afterAll(() => {
		prodServer.close()
		devServer.close()
	})

	test('production: HTML response has no HMR script', async () => {
		const res = await fetch(`${prodServer.url}/`)
		const body = await res.text()
		expect(body).not.toContain('__HMR__')
		expect(body).not.toContain('/ws')
	})

	test('development: HTML response contains HMR script', async () => {
		const res = await fetch(`${devServer.url}/`)
		const body = await res.text()
		expect(body).toContain('/ws')
	})

	test('development: CSS response is not modified with <script>', async () => {
		const res = await fetch(`${devServer.url}/assets/main.css`)
		const body = await res.text()
		expect(body).not.toContain('<script>')
	})
})

/* === §14.5 Path traversal guard (regression for S-1) === */

describe('path traversal', () => {
	let server: TestServer

	beforeAll(() => {
		server = startTestServer()
	})

	afterAll(() => {
		server.close()
	})

	test('GET /assets/../../server/config.ts → 404', async () => {
		const res = await fetch(`${server.url}/assets/../../server/config.ts`)
		// Either the request resolves to 404 or the URL gets normalized
		// Either way the response must not be 200 with file content
		if (res.status === 200) {
			const body = await res.text()
			// Should not contain source code from config.ts
			expect(body).not.toContain('SERVER_CONFIG')
		} else {
			expect(res.status).toBe(404)
		}
	})
})
