import { watch } from 'node:fs'
import {
	ASSETS_DIR,
	COMPONENTS_DIR,
	EXAMPLES_DIR,
	LAYOUTS_DIR,
	OUTPUT_DIR,
	SERVER_CONFIG,
} from './config'
import { fileExists, getFilePath } from './io'
import { hmrScriptTag } from './templates/hmr'
import { buildOnce } from './build'

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

export type TemplateContext = {
	content?: string
	title?: string
	section?: string
}

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
		const layoutContent = await getCachedLayout('test.html')
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

/* const handleComponentMock = async (filePath: string): Promise<Response> => {
	if (!fileExists(filePath)) {
		// Try fallback pattern: /component-name/file.html -> component-name/mocks/file.html
		const pathSegments = filePath.split('/')
		const fileName = pathSegments.pop()
		const componentName = pathSegments.pop()

		if (componentName && fileName) {
			const fallbackPath = getFilePath(
				COMPONENTS_DIR,
				componentName,
				'mocks',
				fileName,
			)
			if (fileExists(fallbackPath)) {
				return handleStaticFile(fallbackPath)
			}
		}

		return new Response('Not Found', { status: 404 })
	}

	return handleStaticFile(filePath)
} */

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

const setupFileWatcher = () => {
	if (!isDevelopment) return

	const watchPaths = [
		'src',
		'examples',
		'docs-src',
		'server/effects',
		'server/templates',
		'index.ts',
		'package.json',
	]

	console.log('📁 Setting up file watchers for:', watchPaths.join(', '))

	watchPaths.forEach(watchPath => {
		if (fileExists(watchPath)) {
			try {
				watch(watchPath, { recursive: true }, (eventType, filename) => {
					if (filename) {
						console.log(`📝 File changed: ${watchPath}/${filename}`)

						// Clear layout cache on template changes
						if (watchPath.includes('layouts')) {
							layoutsCache.clear()
						}

						// Broadcast file change to HMR clients
						broadcastToHMRClients({
							type: 'file-changed',
							path: `${watchPath}/${filename}`,
						})

						// Trigger page reload after short delay to allow for build completion
						setTimeout(() => {
							broadcastToHMRClients('reload')
						}, 500)
					}
				})
			} catch (error) {
				console.warn(`⚠️  Could not watch ${watchPath}:`, error)
			}
		}
	})
}

// WebSocket handling is now done in the websocket handlers below

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

				const success = server.upgrade(req)
				if (success) return new Response()

				return new Response('WebSocket upgrade failed', { status: 400 })
			},

			// Static assets
			'/assets/:file': req =>
				handleStaticFile(getFilePath(ASSETS_DIR, req.params.file)),

			// Example component's source code
			'/examples/:component': req =>
				handleStaticFile(getFilePath(EXAMPLES_DIR, req.params.component)),

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

			// Documentation pages
			'/:page': req =>
				handleStaticFile(getFilePath(OUTPUT_DIR, req.params.page)),

			// Serve favicon
			'/favicon.ico': () =>
				handleStaticFile(getFilePath(OUTPUT_DIR, 'favicon.ico')),

			// Index
			'/': () => handleStaticFile(getFilePath(OUTPUT_DIR, 'index.html')),
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

	// Setup file watching for HMR
	if (isDevelopment) {
		setupFileWatcher()
		console.log('🔥 HMR enabled - watching for file changes...')
	}

	console.log(`🚀 Server running at ${server.url}`)
	console.log(`🔧 Environment: ${isDevelopment ? 'development' : 'production'}`)
	if (isDocsMode) console.log('📚 Mode: Documentation')
	if (buildFirst) console.log('🔨 Build first enabled')
	if (process.env.PLAYWRIGHT) console.log('🎭 Playwright mode (HMR disabled)')
}

// Start the server
startServer()

// Export for use in build system
export { broadcastToHMRClients, hmrClients }
