import pkg from '../package.json'
import { buildOnce } from './build'
import {
	ASSETS_DIR,
	BLOG_OUTPUT_DIR,
	COMPONENTS_DIR,
	DEFAULT_LOCALE,
	EXAMPLES_DIR,
	LAYOUTS_DIR,
	LOCALES,
	OUTPUT_DIR,
	PAGES_DIR,
	ROUTE_LAYOUT_MAP,
	SERVER_CONFIG,
	SOURCES_DIR,
} from './config'
import { fileExists, getFilePath, getRelativePath, isDirectory } from './io'
import { hmrScriptTag } from './templates/hmr'

/* === Command Line Args === */

const args = process.argv.slice(2)
const isDocsMode =
	args.includes('--mode') && args[args.indexOf('--mode') + 1] === 'docs'
const buildFirst = args.includes('--build-first')

/* === Types === */

export type RequestContext = {
	path: string
	method: string
	headers: Headers
	acceptsGzip: boolean
	acceptsBrotli: boolean
}

export type TemplateContext = Record<string, string>

export type HMRMessage = {
	type: 'reload' | 'pong' | 'build-error' | 'build-success' | 'file-changed'
	message?: string
	path?: string
}

/* === HMR State === */

const hmrClients = new Set<import('bun').ServerWebSocket<unknown>>()
const isDevelopment =
	process.env.NODE_ENV === 'development' && !process.env.PLAYWRIGHT

/* === Utility Functions === */

const layoutsCache = new Map<string, string>()

const clearLayoutCache = () => layoutsCache.clear()

const getLayoutForPath = (urlPath: string): string => {
	for (const [prefix, layout] of Object.entries(ROUTE_LAYOUT_MAP)) {
		if (prefix === '/') continue
		if (prefix.endsWith('/')) {
			if (urlPath.startsWith(prefix)) return layout
		} else {
			if (urlPath === prefix) return layout
		}
	}
	return ROUTE_LAYOUT_MAP['/'] || 'page'
}

const getCachedLayout = async (file: string) => {
	if (isDevelopment || !layoutsCache.has(file)) {
		const layoutContent = await Bun.file(getFilePath(LAYOUTS_DIR, file)).text()
		if (!isDevelopment) layoutsCache.set(file, layoutContent)
		return layoutContent
	}
	return layoutsCache.get(file) || ''
}

const replaceTemplateVariables = (
	content: string,
	context: TemplateContext,
): string => {
	return content.replace(/{{\s*([\w\-]+)\s*}}/g, (_, key) => {
		const trimmedKey = key.trim() as keyof TemplateContext
		return context[trimmedKey] || ''
	})
}

const injectHMRScript = (html: string): string => {
	if (!isDevelopment) return html

	const hmrScript = hmrScriptTag({
		enableLogging: true,
		maxReconnectAttempts: 10,
		reconnectInterval: 1000,
		pingInterval: 30000,
	})

	// Inject before closing </head> tag, or before closing </body> if no </head>
	if (html.includes('</head>')) {
		return html.replace('</head>', `${hmrScript}\n</head>`)
	} else if (html.includes('</body>')) {
		return html.replace('</body>', `${hmrScript}\n</body>`)
	} else {
		return html + hmrScript
	}
}

const findComponentHtmlPath = (componentName: string): string | null => {
	const glob = new Bun.Glob(`**/${componentName}.html`)
	for (const match of glob.scanSync(COMPONENTS_DIR)) {
		return getFilePath(COMPONENTS_DIR, match)
	}
	return null
}

const findMockFilePath = (
	componentName: string,
	mockName: string,
): string | null => {
	const htmlPath = findComponentHtmlPath(componentName)
	if (!htmlPath) return null
	const componentDir = htmlPath.substring(0, htmlPath.lastIndexOf('/'))
	const mockPath = getFilePath(componentDir, 'mocks', mockName)
	if (!guardPath(COMPONENTS_DIR, mockPath) || !fileExists(mockPath)) return null
	return mockPath
}

const handleComponentTest = async (
	componentName: string,
): Promise<Response> => {
	try {
		const componentPath = findComponentHtmlPath(componentName)
		if (!componentPath) {
			return new Response('Component not found', { status: 404 })
		}

		const componentContent = await Bun.file(componentPath).text()
		const layoutName = getLayoutForPath(`/test/${componentName}`)
		const layoutContent = await getCachedLayout(`${layoutName}.html`)
		let finalContent = replaceTemplateVariables(layoutContent, {
			content: componentContent,
			title: componentName,
			version: pkg.version,
			// The test layout shares `{{ lang }}` with the page layouts
			// (LT-174); an unreplaced key renders `lang=""`, which is worse
			// than the default it stands in for.
			lang: DEFAULT_LOCALE,
		})

		// Inject HMR script in development
		finalContent = injectHMRScript(finalContent)

		return new Response(finalContent, {
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'no-cache, no-store, must-revalidate',
			},
		})
	} catch (error) {
		console.error('Error generating component test response:', error)
		return new Response('Internal server error', { status: 500 })
	}
}

const handleStaticFile = async (filePath: string): Promise<Response> => {
	// Directories pass existsSync but fail in sendfile — treat as not found
	if (!fileExists(filePath) || isDirectory(filePath))
		return new Response('Not Found', { status: 404 })

	try {
		// For HTML files in development, inject HMR script
		if (isDevelopment && filePath.endsWith('.html')) {
			const content = await Bun.file(filePath).text()
			const enhancedContent = injectHMRScript(content)
			return new Response(enhancedContent, {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Cache-Control': 'no-cache, no-store, must-revalidate',
				},
			})
		}

		return new Response(Bun.file(filePath))
	} catch (error) {
		console.error('Error serving static file:', error)
		return new Response('Internal server error', { status: 500 })
	}
}

/**
 * Guard a resolved file path against directory traversal.
 * Returns null if the path escapes the expected base directory.
 */
const guardPath = (baseDir: string, resolvedPath: string): string | null =>
	getRelativePath(baseDir, resolvedPath) !== null ? resolvedPath : null

const acceptsMarkdown = (req: Request): boolean =>
	(req.headers.get('Accept') || '').includes('text/markdown')

/**
 * Whether a first path segment names one of the built locales (LT-174).
 *
 * Pages live under `docs/<locale>/`, so a request for `/de/guide.html` has to
 * be told apart from a request for a root-level file. Anything not in
 * `LOCALES` falls through to the un-prefixed routes, which still serve the
 * locale-independent trees (assets, api, examples, sources).
 */
const isLocale = (segment: string): boolean =>
	(LOCALES as readonly string[]).includes(segment)

const handleMarkdownSource = async (
	pageName: string,
): Promise<Response | null> => {
	const mdPath = guardPath(PAGES_DIR, getFilePath(PAGES_DIR, `${pageName}.md`))
	if (!mdPath || !fileExists(mdPath)) return null
	return new Response(Bun.file(mdPath), {
		headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
	})
}

/* === HMR Functions === */

const broadcastToHMRClients = (message: HMRMessage | string) => {
	const data = typeof message === 'string' ? message : JSON.stringify(message)

	for (const client of hmrClients) {
		try {
			client.send(data)
		} catch (error) {
			console.error('Error sending HMR message:', error)
			hmrClients.delete(client)
		}
	}
}

/* === Server === */

let server: ReturnType<typeof Bun.serve>

async function checkPort(port: number): Promise<void> {
	try {
		const response = await fetch(`http://localhost:${port}/api/status`, {
			signal: AbortSignal.timeout(1000),
		})
		if (response.ok) {
			console.error(
				`❌ Port ${port} is already in use by another server.\n\n` +
					`   Kill the blocking process:\n` +
					`     lsof -ti:${port} | xargs kill\n\n` +
					`   Or change the port in server/config.ts\n`,
			)
			process.exit(1)
		}
	} catch {
		// Connection refused or timeout = port is free
	}
}

async function startServer() {
	const port = SERVER_CONFIG.PORT

	await checkPort(port)

	// Run build first if requested
	if (buildFirst) {
		console.log('🔨 Running build before starting server...')
		try {
			await buildOnce()
			console.log('✅ Build completed')
		} catch (error) {
			console.error('❌ Build failed:', error)
			process.exit(1)
		}
	}

	server = Bun.serve({
		port,
		routes: {
			'/api/status': new Response('OK'),

			// WebSocket endpoint for HMR
			'/ws': req => {
				if (!isDevelopment)
					return new Response('Not available in production', {
						status: 404,
					})

				const success = server.upgrade(req, { data: {} })
				if (success) return // connection hijacked — must not return a Response

				return new Response('WebSocket upgrade failed', { status: 400 })
			},

			// Static assets (wildcard to support subdirectories like img/avatar/)
			'/assets/*': req => {
				const assetPath = new URL(req.url).pathname.slice('/assets/'.length)
				const filePath = guardPath(
					ASSETS_DIR,
					getFilePath(ASSETS_DIR, assetPath),
				)
				return filePath
					? handleStaticFile(filePath)
					: new Response('Not Found', { status: 404 })
			},

			// Example component's source code
			'/examples/:component': req => {
				const filePath = guardPath(
					EXAMPLES_DIR,
					getFilePath(EXAMPLES_DIR, req.params.component),
				)
				return filePath
					? handleStaticFile(filePath)
					: new Response('Not Found', { status: 404 })
			},

			// Source code fragments for documentation
			'/sources/:file': req => {
				const filePath = guardPath(
					SOURCES_DIR,
					getFilePath(SOURCES_DIR, req.params.file),
				)
				return filePath
					? handleStaticFile(filePath)
					: new Response('Not Found', { status: 404 })
			},

			// Component tests mock files
			'/test/:component/mocks/:mock': req => {
				const filePath = findMockFilePath(req.params.component, req.params.mock)
				return filePath
					? handleStaticFile(filePath)
					: new Response('Not Found', { status: 404 })
			},

			// Component tests
			'/test/:component': req => handleComponentTest(req.params.component),

			// Not found for test routes
			'/test/*': new Response('Not Found', { status: 404 }),

			// API documentation fragments (lazy-loaded by listnav)
			'/api/:category/:page': req => {
				const filePath = guardPath(
					OUTPUT_DIR,
					getFilePath(OUTPUT_DIR, 'api', req.params.category, req.params.page),
				)
				return filePath
					? handleStaticFile(filePath)
					: new Response('Not Found', { status: 404 })
			},

			// Individual blog post pages, inside a locale tree
			'/:locale/blog/:slug': req => {
				const { locale, slug } = req.params
				if (!isLocale(locale)) return new Response('Not Found', { status: 404 })
				const localeBlogDir = getFilePath(OUTPUT_DIR, locale, 'blog')
				const filePath = guardPath(
					localeBlogDir,
					getFilePath(localeBlogDir, `${slug.replace(/\.html$/, '')}.html`),
				)
				return filePath
					? handleStaticFile(filePath)
					: new Response('Not Found', { status: 404 })
			},

			// Documentation pages, inside a locale tree (`/de/guide.html`).
			// The locale is a PATH PREFIX, not a negotiated header: the page was
			// rendered for it at build time (ADR 0030 sub-design 1), so there is
			// exactly one file to serve and no content negotiation to do.
			'/:locale/:page': async req => {
				const { locale, page } = req.params
				if (!isLocale(locale)) return new Response('Not Found', { status: 404 })
				const localeDir = getFilePath(OUTPUT_DIR, locale)
				if (acceptsMarkdown(req)) {
					const mdResponse = await handleMarkdownSource(
						page.replace(/\.html$/, ''),
					)
					if (mdResponse) return mdResponse
				}
				const filePath = guardPath(localeDir, getFilePath(localeDir, page))
				if (!filePath) return new Response('Not Found', { status: 404 })

				// Extensionless page URLs (/en/examples, /en/blog) redirect to
				// the page itself. Before LT-174 this fired only where a
				// same-named DIRECTORY happened to sit next to the page — an
				// accident of the output layout, which the locale split removed
				// for api/ and examples/ (their fragments stayed at the root).
				// Keyed on the missing extension instead, it is a property of
				// the URL rather than of what else got written nearby.
				if (!page.includes('.') || isDirectory(filePath)) {
					const name = page.replace(/\.html$/, '')
					if (fileExists(getFilePath(localeDir, `${name}.html`)))
						return new Response(null, {
							status: 301,
							headers: { Location: `/${locale}/${name}.html` },
						})
					return new Response('Not Found', { status: 404 })
				}
				return handleStaticFile(filePath)
			},

			// A bare locale root serves that locale's index
			'/:locale': req => {
				const { locale } = req.params
				if (!isLocale(locale)) return new Response('Not Found', { status: 404 })
				return handleStaticFile(getFilePath(OUTPUT_DIR, locale, 'index.html'))
			},

			// Serve favicon
			'/favicon.ico': () =>
				handleStaticFile(getFilePath(OUTPUT_DIR, 'favicon.ico')),

			// The root redirect stub the pages effect writes — what a static
			// host serves for `/`, kept reachable by its own URL too.
			'/index.html': () =>
				handleStaticFile(getFilePath(OUTPUT_DIR, 'index.html')),

			// Index — every page now lives under a locale prefix, so the site
			// root is a redirect rather than a page. 302, not 301: which locale
			// is "default" is a build decision (config's LOCALES[0]) that may
			// change, and a permanently cached redirect would outlive it.
			'/': async req => {
				if (acceptsMarkdown(req)) {
					const mdResponse = await handleMarkdownSource('index')
					if (mdResponse) return mdResponse
				}
				return new Response(null, {
					status: 302,
					headers: { Location: `/${DEFAULT_LOCALE}/index.html` },
				})
			},
		},

		websocket: {
			message: (ws, message) => {
				try {
					const data = JSON.parse(message.toString())
					if (data.type === 'ping') {
						ws.send(JSON.stringify({ type: 'pong' }))
					}
				} catch (_error) {
					// Ignore non-JSON messages
				}
			},
			open: ws => {
				hmrClients.add(ws)
				console.log(`🔌 HMR client connected (${hmrClients.size} total)`)
				ws.send(JSON.stringify({ type: 'build-success' }))
			},
			close: ws => {
				hmrClients.delete(ws)
				console.log(`🔌 HMR client disconnected (${hmrClients.size} total)`)
			},
		},

		fetch() {
			return new Response('Not Found', { status: 404 })
		},
	})

	if (isDevelopment) {
		console.log('🔥 HMR enabled')
	}

	console.log(`🚀 Server running at ${server.url}`)
	console.log(`🔧 Environment: ${isDevelopment ? 'development' : 'production'}`)
	if (isDocsMode) console.log('📚 Mode: Documentation')
	if (buildFirst) console.log('🔨 Build first enabled')
	if (process.env.PLAYWRIGHT) console.log('🎭 Playwright mode (HMR disabled)')
}

// Start the server only when run directly
if (import.meta.main) {
	startServer()
}

export {
	broadcastToHMRClients,
	clearLayoutCache,
	getLayoutForPath,
	hmrClients,
	startServer,
}
