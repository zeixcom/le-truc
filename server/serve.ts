import { buildOnce } from './build'
import {
	ASSETS_DIR,
	COMPONENTS_DIR,
	EXAMPLES_DIR,
	LAYOUTS_DIR,
	OUTPUT_DIR,
	PAGES_DIR,
	ROUTE_LAYOUT_MAP,
	SOURCES_DIR,
	SERVER_CONFIG,
} from './config'
import { fileExists, getFilePath } from './io'
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

const hmrClients = new Set<any>()
const isDevelopment =
	process.env.NODE_ENV !== 'production' && !process.env.PLAYWRIGHT

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
	if (!layoutsCache.has(file)) {
		const layoutContent = await Bun.file(getFilePath(LAYOUTS_DIR, file)).text()
		layoutsCache.set(file, layoutContent)
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

const handleComponentTest = async (
	componentName: string,
): Promise<Response> => {
	try {
		const componentPath = getFilePath(
			COMPONENTS_DIR,
			componentName,
			`${componentName}.html`,
		)
		if (!fileExists(componentPath)) {
			return new Response('Component not found', { status: 404 })
		}

		const componentContent = await Bun.file(componentPath).text()
		const layoutName = getLayoutForPath(`/test/${componentName}`)
		const layoutContent = await getCachedLayout(`${layoutName}.html`)
		let finalContent = replaceTemplateVariables(layoutContent, {
			content: componentContent,
			title: componentName,
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
	if (!fileExists(filePath)) return new Response('Not Found', { status: 404 })

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

const acceptsMarkdown = (req: Request): boolean =>
	(req.headers.get('Accept') || '').includes('text/markdown')

const handleMarkdownSource = async (
	pageName: string,
): Promise<Response | null> => {
	const mdPath = getFilePath(PAGES_DIR, `${pageName}.md`)
	if (!fileExists(mdPath)) return null
	return new Response(Bun.file(mdPath), {
		headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
	})
}

/* === HMR Functions === */

const broadcastToHMRClients = (message: HMRMessage | string) => {
	const data = typeof message === 'string' ? message : JSON.stringify(message)

	for (const client of Array.from(hmrClients)) {
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
				`❌ Port ${port} is already in use by another server.\n\n`
					+ `   Kill the blocking process:\n`
					+ `     lsof -ti:${port} | xargs kill\n\n`
					+ `   Or change the port in server/config.ts\n`,
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

			// Static assets
			'/assets/:file': req =>
				handleStaticFile(getFilePath(ASSETS_DIR, req.params.file)),

			// Example component's source code
			'/examples/:component': req =>
				handleStaticFile(getFilePath(EXAMPLES_DIR, req.params.component)),

			// Source code fragments for documentation
			'/sources/:file': req =>
				handleStaticFile(getFilePath(SOURCES_DIR, req.params.file)),

			// Component tests mock files
			'/test/:component/mocks/:mock': req =>
				handleStaticFile(
					getFilePath(
						COMPONENTS_DIR,
						req.params.component,
						'mocks',
						req.params.mock,
					),
				),

			// Component tests
			'/test/:component': req => handleComponentTest(req.params.component),

			// Not found for test routes
			'/test/*': new Response('Not Found', { status: 404 }),

			// API documentation fragments (lazy-loaded by listnav)
			'/api/:category/:page': req =>
				handleStaticFile(
					getFilePath(OUTPUT_DIR, 'api', req.params.category, req.params.page),
				),

			// Documentation pages
			'/:page': async req => {
				if (acceptsMarkdown(req)) {
					const pageName = req.params.page.replace(/\.html$/, '')
					const mdResponse = await handleMarkdownSource(pageName)
					if (mdResponse) return mdResponse
				}
				return handleStaticFile(getFilePath(OUTPUT_DIR, req.params.page))
			},

			// Serve favicon
			'/favicon.ico': () =>
				handleStaticFile(getFilePath(OUTPUT_DIR, 'favicon.ico')),

			// Index
			'/': async req => {
				if (acceptsMarkdown(req)) {
					const mdResponse = await handleMarkdownSource('index')
					if (mdResponse) return mdResponse
				}
				return handleStaticFile(getFilePath(OUTPUT_DIR, 'index.html'))
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
				hmrClients.add(ws as any)
				console.log(`🔌 HMR client connected (${hmrClients.size} total)`)
				ws.send(JSON.stringify({ type: 'build-success' }))
			},
			close: ws => {
				hmrClients.delete(ws as any)
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

export { broadcastToHMRClients, clearLayoutCache, hmrClients, startServer }
