/**
 * Tests for serve.ts — HTTP Server Routes & Utilities
 *
 * Covers:
 * - getLayoutForPath pure unit function
 * - Route responses via isolated Bun.serve instance
 * - HMR injection behaviour (dev vs production)
 * - Bare section roots (/blog, /examples): 301 redirect or 404, never sendfile on a directory
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
	ASSETS_DIR,
	DEFAULT_LOCALE,
	EXAMPLES_DIR,
	GENERATED_CLIENTS_DIR,
	LOCALES,
	OUTPUT_DIR,
	ROOT,
	SOURCES_DIR,
} from '../config'
import { fileExists, getFilePath, isDirectory } from '../io'
import {
	getLayoutForPath,
	handleComponentTest,
	handleSurfaceModule,
} from '../serve'
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

/** Mirrors serve.ts's locale-prefix guard (LT-174). */
const isLocale = (segment: string): boolean =>
	(LOCALES as readonly string[]).includes(segment)

// Mirrors serve.ts's `effectiveSurface` (kept in lockstep by hand): an
// explicit ?surface= query wins over the TEST_SURFACE env override.
const SURFACES = ['ts', 'tsrx', 'tsx'] as const

const parseSurface = (
	query: string | null,
): (typeof SURFACES)[number] | 'invalid' | undefined => {
	if (query) {
		return (SURFACES as readonly string[]).includes(query)
			? (query as (typeof SURFACES)[number])
			: 'invalid'
	}
	const env = process.env.TEST_SURFACE
	return (SURFACES as readonly string[]).includes(env || '')
		? (env as (typeof SURFACES)[number])
		: undefined
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
		// Directories pass existsSync but fail in sendfile — treat as not found
		if (!fileExists(filePath) || isDirectory(filePath))
			return new Response('Not Found', { status: 404 })
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

			'/assets/*': req => {
				const assetPath = new URL(req.url).pathname.slice('/assets/'.length)
				const filePath = getFilePath(ASSETS_DIR, assetPath)
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

			// Component test routes (LT-284) — wired to the REAL handlers, the
			// way serve.ts routes them.
			'/test/:component/surface.js': req =>
				handleSurfaceModule(
					req.params.component,
					parseSurface(new URL(req.url).searchParams.get('surface')),
				),

			'/test/:component': req =>
				handleComponentTest(
					req.params.component,
					parseSurface(new URL(req.url).searchParams.get('surface')),
				),

			// Pages live under a locale prefix since LT-174; these mirror
			// serve.ts's locale-prefixed routes.
			'/:locale/blog/:slug': req => {
				const { locale, slug } = req.params
				if (!isLocale(locale)) return new Response('Not Found', { status: 404 })
				const blogDir = getFilePath(OUTPUT_DIR, locale, 'blog')
				// `.md` serves the markdown mirror next to the page (LT-198)
				const name = slug.endsWith('.md')
					? slug
					: `${slug.replace(/\.html$/, '')}.html`
				const filePath = getFilePath(blogDir, name)
				const rel = filePath.startsWith(blogDir) ? filePath : null
				return rel ? serveFile(rel) : new Response('Not Found', { status: 404 })
			},

			'/:locale/:page': req => {
				const { locale, page } = req.params
				if (!isLocale(locale)) return new Response('Not Found', { status: 404 })
				const localeDir = getFilePath(OUTPUT_DIR, locale)
				const filePath = getFilePath(localeDir, page)
				// Extensionless page URLs redirect to the page (LT-174)
				if (!page.includes('.') || isDirectory(filePath)) {
					const name = page.replace(/\.html$/, '')
					if (fileExists(getFilePath(localeDir, `${name}.html`)))
						return new Response(null, {
							status: 301,
							headers: { Location: `/${locale}/${name}.html` },
						})
					return new Response('Not Found', { status: 404 })
				}
				return serveFile(filePath)
			},

			'/:locale': req => {
				const { locale } = req.params
				if (!isLocale(locale)) return new Response('Not Found', { status: 404 })
				return serveFile(getFilePath(OUTPUT_DIR, locale, 'index.html'))
			},

			'/index.html': () => serveFile(getFilePath(OUTPUT_DIR, 'index.html')),

			'/': () =>
				new Response(null, {
					status: 302,
					headers: { Location: `/${DEFAULT_LOCALE}/index.html` },
				}),
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

	test('GET / → 302 to the default locale', async () => {
		const res = await fetch(`${server.url}/`, { redirect: 'manual' })
		expect(res.status).toBe(302)
		expect(res.headers.get('location')).toBe(`/${DEFAULT_LOCALE}/index.html`)
	})

	test('GET /en → 200 with HTML (bare locale root)', async () => {
		const res = await fetch(`${server.url}/en`)
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

	test('GET /en/getting-started.html → 200 (existing page)', async () => {
		const res = await fetch(`${server.url}/en/getting-started.html`)
		expect(res.status).toBe(200)
	})

	test('GET /de/getting-started.html → 200 (the second locale tree)', async () => {
		const res = await fetch(`${server.url}/de/getting-started.html`)
		expect(res.status).toBe(200)
	})

	test('GET /fr/getting-started.html → 404 (locale not built)', async () => {
		const res = await fetch(`${server.url}/fr/getting-started.html`)
		expect(res.status).toBe(404)
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

/* === §14.5 Path traversal guard === */

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

/* === §14.6 Blog posts under a locale tree (/:locale/blog/:slug) === */

// The launch post is the corpus's oldest and stablest slug; both locale
// trees carry its .html page and .md mirror after a build.
const BLOG_SLUG = '2026-03-09-introducing-le-truc'

describe('/:locale/blog/:slug route', () => {
	let server: TestServer

	beforeAll(() => {
		server = startTestServer()
	})

	afterAll(() => {
		server.close()
	})

	test('GET /en/blog/<slug>.md → 200 text/markdown (LT-198: the mirror)', async () => {
		const res = await fetch(`${server.url}/en/blog/${BLOG_SLUG}.md`)
		expect(res.status).toBe(200)
		expect(res.headers.get('content-type')).toContain('text/markdown')
		const body = await res.text()
		expect(body.length).toBeGreaterThan(0)
		expect(body).not.toContain('<!doctype html')
	})

	test('GET /de/blog/<slug>.md → 200 (the second locale tree)', async () => {
		const res = await fetch(`${server.url}/de/blog/${BLOG_SLUG}.md`)
		expect(res.status).toBe(200)
		expect(res.headers.get('content-type')).toContain('text/markdown')
	})

	test('GET /en/blog/<slug>.html → 200 with HTML', async () => {
		const res = await fetch(`${server.url}/en/blog/${BLOG_SLUG}.html`)
		expect(res.status).toBe(200)
		const body = await res.text()
		expect(body.toLowerCase()).toContain('<!doctype html')
	})

	test('GET /en/blog/<slug> → 200 (extensionless serves the page)', async () => {
		const res = await fetch(`${server.url}/en/blog/${BLOG_SLUG}`)
		expect(res.status).toBe(200)
	})

	test('GET /en/blog/unknown-post.md → 404', async () => {
		const res = await fetch(`${server.url}/en/blog/unknown-post.md`)
		expect(res.status).toBe(404)
	})

	test('GET /fr/blog/<slug>.md → 404 (locale not built)', async () => {
		const res = await fetch(`${server.url}/fr/blog/${BLOG_SLUG}.md`)
		expect(res.status).toBe(404)
	})

	test('GET /en/blog/../../server/config.md → no source leak (traversal)', async () => {
		const res = await fetch(`${server.url}/en/blog/../../server/config.md`)
		if (res.status === 200) {
			const body = await res.text()
			expect(body).not.toContain('SERVER_CONFIG')
		} else {
			expect(res.status).toBe(404)
		}
	})
})

/* === Legacy root-level URLs (pre-LT-174 layout) === */

// Ruling (LT-198): these 404 by design. serve.ts redirects would not reach
// the static host that actually serves the site, and the locale layout has
// not shipped, so there is no population of broken external links yet.

describe('legacy root URLs', () => {
	let server: TestServer

	beforeAll(() => {
		server = startTestServer()
	})

	afterAll(() => {
		server.close()
	})

	test('GET /guide.html → 404 (root-level pages are gone)', async () => {
		const res = await fetch(`${server.url}/guide.html`)
		expect(res.status).toBe(404)
	})

	test('GET /blog/<existing-slug>.html → 404 (even for real posts)', async () => {
		const res = await fetch(`${server.url}/blog/${BLOG_SLUG}.html`)
		expect(res.status).toBe(404)
	})

	test('GET /blog/unknown-post → 404', async () => {
		const res = await fetch(`${server.url}/blog/unknown-post`)
		expect(res.status).toBe(404)
	})

	test('GET /blog/unknown-post.html → 404', async () => {
		const res = await fetch(`${server.url}/blog/unknown-post.html`)
		expect(res.status).toBe(404)
	})

	test('GET /blog/../config → 404 (path traversal rejected)', async () => {
		const res = await fetch(`${server.url}/blog/../config`)
		// Bun normalises the URL before routing, so this hits /config (404)
		// rather than the blog route. Either way, server/config.ts must not leak.
		if (res.status === 200) {
			const body = await res.text()
			expect(body).not.toContain('SERVER_CONFIG')
		} else {
			expect(res.status).toBe(404)
		}
	})
})

/* === Bare section roots (directories under docs/) === */

describe('bare section roots', () => {
	let server: TestServer

	beforeAll(() => {
		server = startTestServer()
	})

	afterAll(() => {
		server.close()
	})

	test('GET /en/blog → 301 to /en/blog.html', async () => {
		const res = await fetch(`${server.url}/en/blog`, { redirect: 'manual' })
		expect(res.status).toBe(301)
		expect(res.headers.get('location')).toBe('/en/blog.html')
	})

	test('GET /en/examples → 301 to /en/examples.html', async () => {
		const res = await fetch(`${server.url}/en/examples`, { redirect: 'manual' })
		expect(res.status).toBe(301)
		expect(res.headers.get('location')).toBe('/en/examples.html')
	})

	test('GET /en/api → 301 to /en/api.html', async () => {
		const res = await fetch(`${server.url}/en/api`, { redirect: 'manual' })
		expect(res.status).toBe(301)
		expect(res.headers.get('location')).toBe('/en/api.html')
	})

	test('GET /en/blog follows the redirect to the blog index page', async () => {
		const res = await fetch(`${server.url}/en/blog`)
		expect(res.status).toBe(200)
		const body = await res.text()
		expect(body.toLowerCase()).toContain('<!doctype html')
	})

	test('GET /assets → 404 (directory without a matching page)', async () => {
		const res = await fetch(`${server.url}/assets`, { redirect: 'manual' })
		expect(res.status).toBe(404)
	})

	test('GET /examples/basic → 404 (example group directory)', async () => {
		const res = await fetch(`${server.url}/examples/basic`)
		expect(res.status).toBe(404)
	})
})

/* === §14.7 Component test surface selection (LT-284, ADR 0039 s2) === */

// basic-counter is the fixture subject. The pins are corpus-state-ADAPTIVE
// rather than frozen: before the exemplar lands (LT-285) it is a singleton
// .tsrx tag with no twin; after, it is a three-surface variant set whose
// selected surface is whatever the last corpus build served. Either way the
// route must serve exactly the surfaces the corpus carries — availability
// on disk and response status have to agree. The surface legs need the
// corpus build (server/generated/) to exist — CI builds it in the
// typecheck step; locally run `bun run build:corpus` first. Without it
// they FAIL (LT-296): an early return would pass vacuously in exactly the
// state where the legs prove nothing.

const COMPONENT_TAG = 'basic-counter'
const COMPONENT_DIR = path.resolve(ROOT, 'examples/basic/counter')
type Surface = (typeof SURFACES)[number]

const twinExists = (): boolean =>
	fs.existsSync(path.join(COMPONENT_DIR, `${COMPONENT_TAG}.ts`))

const variantClientExists = (surface: Surface): boolean =>
	fs.existsSync(
		path.join(
			GENERATED_CLIENTS_DIR,
			'variants',
			`${COMPONENT_TAG}.${surface}.client.ts`,
		),
	)

const canonicalClientExists = (): boolean =>
	fs.existsSync(path.join(GENERATED_CLIENTS_DIR, `${COMPONENT_TAG}.client.ts`))

/** The registry's selected compiled surface, or null without a corpus build. */
const selectedSurface = (): Surface | null => {
	const registryPath = path.join(GENERATED_CLIENTS_DIR, 'registry.json')
	if (!fs.existsSync(registryPath)) return null
	try {
		const registry = JSON.parse(
			fs.readFileSync(registryPath, 'utf8'),
		) as Record<string, { source?: string }>
		const source = registry[COMPONENT_TAG]?.source
		if (typeof source !== 'string') return null
		return source.endsWith('.tsx') ? 'tsx' : 'tsrx'
	} catch {
		return null
	}
}

/** Whether the fixture folder carries an authored source for `surface`. */
const sourceExists = (surface: Surface): boolean =>
	fs.existsSync(path.join(COMPONENT_DIR, `${COMPONENT_TAG}.${surface}`))

/** The corpus build's selected surface — the surface legs' precondition,
 * asserted loudly rather than skipped (LT-296). */
const requireCorpusBuild = (): Surface => {
	const surface = selectedSurface()
	if (!surface)
		throw new Error(
			`No corpus build: ${GENERATED_CLIENTS_DIR}/registry.json is missing or has no ${COMPONENT_TAG} entry — run \`bun run build:corpus\` first`,
		)
	return surface
}

describe('component test surface selection', () => {
	let server: TestServer

	beforeAll(() => {
		server = startTestServer()
	})

	afterAll(() => {
		server.close()
	})

	test('GET /test/basic-counter → 200 with the default layout bundle, unchanged', async () => {
		const res = await fetch(`${server.url}/test/${COMPONENT_TAG}`)
		expect(res.status).toBe(200)
		const body = await res.text()
		expect(body).toContain('src="/assets/main.js"')
		expect(body).toContain('href="/assets/main.js"')
		expect(body).not.toContain('surface.js')
		// The fixture markup is still spliced in
		expect(body).toContain('<basic-counter')
	})

	test('GET /test/basic-counter?surface=bogus → 400 (unknown spelling)', async () => {
		const res = await fetch(`${server.url}/test/${COMPONENT_TAG}?surface=bogus`)
		expect(res.status).toBe(400)
	})

	test('the twin surface is served iff the twin exists', async () => {
		requireCorpusBuild()
		const res = await fetch(`${server.url}/test/${COMPONENT_TAG}?surface=ts`)
		expect(res.status).toBe(twinExists() ? 200 : 404)
		if (twinExists()) {
			const body = await res.text()
			expect(body).toContain(
				`src="/test/${COMPONENT_TAG}/surface.js?surface=ts"`,
			)
			expect(body).not.toContain('src="/assets/main.js"')
		}
	})

	test('each compiled surface is served iff its source is authored', async () => {
		const selected = requireCorpusBuild()
		expect(sourceExists(selected)).toBe(true)
		expect(canonicalClientExists()).toBe(true)
		for (const surface of ['tsrx', 'tsx'] as const) {
			// The kept variants/ client tracks the source set exactly — a
			// stale one left by a dissolved set would 200 here (LT-296).
			if (surface !== selected)
				expect(variantClientExists(surface)).toBe(sourceExists(surface))
			const res = await fetch(
				`${server.url}/test/${COMPONENT_TAG}?surface=${surface}`,
			)
			expect(res.status).toBe(sourceExists(surface) ? 200 : 404)
			if (res.status === 200) {
				const body = await res.text()
				expect(body).toContain(
					`src="/test/${COMPONENT_TAG}/surface.js?surface=${surface}"`,
				)
				expect(body).not.toContain('src="/assets/main.js"')
			}
		}
	})

	test('TEST_SURFACE env override serves the surface page without a query', async () => {
		const surface = requireCorpusBuild()
		process.env.TEST_SURFACE = surface
		try {
			const res = await fetch(`${server.url}/test/${COMPONENT_TAG}`)
			expect(res.status).toBe(200)
			const body = await res.text()
			expect(body).toContain(
				`src="/test/${COMPONENT_TAG}/surface.js?surface=${surface}"`,
			)
			// An explicit query still wins over the env: an uncarried surface
			// must 404 even with the override set
			const other = (['tsrx', 'tsx'] as const).find(
				s => s !== surface && !variantClientExists(s),
			)
			if (other) {
				const explicit = await fetch(
					`${server.url}/test/${COMPONENT_TAG}?surface=${other}`,
				)
				expect(explicit.status).toBe(404)
			}
		} finally {
			delete process.env.TEST_SURFACE
		}
	})

	test('the surface module registers the tag exactly once (selected surface)', async () => {
		const surface = requireCorpusBuild()
		const res = await fetch(
			`${server.url}/test/${COMPONENT_TAG}/surface.js?surface=${surface}`,
		)
		expect(res.status).toBe(200)
		expect(res.headers.get('content-type')).toContain('text/javascript')
		const js = await res.text()
		// The tag's component factory call appears exactly once — the
		// generated-client slot is emptied and the surface module is the
		// only registration, so a page load can never define it twice.
		// (Minifiers rename defineComponent; the quoted tag literal at a
		// call site is the stable marker.)
		const callSites = [
			...js.matchAll(new RegExp(`\\(['"]${COMPONENT_TAG}['"]`, 'g')),
		]
		expect(callSites.length).toBe(1)
		// The rest of the default layout graph rode along
		expect(js).toContain('basic-button')
	})

	test('the twin surface module also registers the tag exactly once', async () => {
		requireCorpusBuild()
		if (!twinExists()) return // no twin authored: the leg above pins the 404
		const res = await fetch(
			`${server.url}/test/${COMPONENT_TAG}/surface.js?surface=ts`,
		)
		expect(res.status).toBe(200)
		const js = await res.text()
		const callSites = [
			...js.matchAll(new RegExp(`\\(['"]${COMPONENT_TAG}['"]`, 'g')),
		]
		expect(callSites.length).toBe(1)
	})

	test('an on-disk variants client serves its surface module', async () => {
		const selected = requireCorpusBuild()
		const kept = (['tsrx', 'tsx'] as const).find(
			s => s !== selected && sourceExists(s),
		)
		// A single-surface fixture keeps no variants client; the leg above
		// pins that nothing stale is served in its place.
		if (!kept) return
		expect(variantClientExists(kept)).toBe(true)
		const res = await fetch(
			`${server.url}/test/${COMPONENT_TAG}/surface.js?surface=${kept}`,
		)
		expect(res.status).toBe(200)
		const js = await res.text()
		const callSites = [
			...js.matchAll(new RegExp(`\\(['"]${COMPONENT_TAG}['"]`, 'g')),
		]
		expect(callSites.length).toBe(1)
	})

	test('GET /test/basic-counter/surface.js?surface=bogus → 400', async () => {
		const res = await fetch(
			`${server.url}/test/${COMPONENT_TAG}/surface.js?surface=bogus`,
		)
		expect(res.status).toBe(400)
	})

	test('GET /test/basic-counter/surface.js (no surface) → 400', async () => {
		const res = await fetch(`${server.url}/test/${COMPONENT_TAG}/surface.js`)
		expect(res.status).toBe(400)
	})

	test('GET /test/unknown-component/surface.js?surface=tsrx → 404', async () => {
		const res = await fetch(
			`${server.url}/test/unknown-component/surface.js?surface=tsrx`,
		)
		expect(res.status).toBe(404)
	})
})
