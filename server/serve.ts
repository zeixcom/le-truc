#!/usr/bin/env bun

import { build } from './build'
import {
	COMPONENTS_DIR,
	COMPRESSIBLE_TYPES,
	type LayoutConfig,
	MIME_TYPES,
	OUTPUT_DIR,
	SERVER_CONFIG,
} from './config'
import {
	fileExists,
	getCompressedBuffer,
	getDirectoryEntries,
	getFileContent,
	getFilePath,
	isPlaywrightRunning,
} from './io'
import { DEFAULT_LAYOUTS, LayoutEngine } from './layout-engine'
import { hmrScriptTag } from './templates/hmr'
import { componentMarkup } from './file-signals'
import { UNSET } from '@zeix/cause-effect'

/* === Types === */

type ServerContext = {
	sockets: Set<any>
	isRebuilding: boolean
}

export type RequestContext = {
	path: string
	method: string
	headers: Headers
	acceptsGzip: boolean
	acceptsBrotli: boolean
}

export type ServerOptions = {
	port?: number
	host?: string
	layouts?: LayoutConfig[]
	enableHMR?: boolean
	enableCompression?: boolean
	buildFirst?: boolean
	disableFileWatching?: boolean
}

/* === Internal Functions === */

/**
 * Check if a file path is an HTML file
 */
function isHTMLPath(path: string): boolean {
	return path.endsWith('.html') || path === '/' || !path.includes('.')
}

/**
 * Check if a file is a versioned asset (has hash in filename)
 */
const isVersionedAsset = (path: string): boolean =>
	/\.[a-f0-9]{8,}\.(css|js|js\.map)$/.test(path)

/**
 * Get file extension from path
 */
const getFileExtension = (path: string): string =>
	path.split('.').pop()?.toLowerCase() || ''

/**
 * Check if a file type should be compressed
 */
const shouldCompress = (
	path: string,
	compressibleTypes: readonly string[],
): boolean => compressibleTypes.some(ext => path.endsWith(ext))

/**
 * Get MIME type for file extension
 */
const getMimeType = (
	path: string,
	mimeTypes: Record<string, string>,
): string => {
	const ext = getFileExtension(path)
	return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Generate asset hash for cache busting
 */
const generateAssetHash = (): string => Date.now().toString(36)

/**
 * Get component content from componentMarkup signal
 */
const getComponentContent = (componentName: string): string | null => {
	try {
		const markupSources = componentMarkup.sources.get()
		if (markupSources === UNSET) return null

		// Look for component HTML file in the markup sources
		for (const [path, fileInfo] of Object.entries(markupSources)) {
			if (fileInfo.filename === `${componentName}.html`) {
				return fileInfo.content
			}
		}

		return null
	} catch (error) {
		console.warn('Failed to get component content:', error)
		return null
	}
}

/* === DevServer Class Definition === */

/**
 * Unified development server that handles both documentation and examples
 * with flexible layout system
 */
export class DevServer {
	private server: any = null
	private context: ServerContext = {
		sockets: new Set(),
		isRebuilding: false,
	}
	private buildCleanup: (() => void) | null = null
	private layoutEngine: LayoutEngine
	private options: Required<ServerOptions>

	constructor(options: ServerOptions = {}) {
		const playwrightDetected = isPlaywrightRunning()

		this.options = {
			port: options.port || SERVER_CONFIG.PORT,
			host: options.host || SERVER_CONFIG.HOST,
			layouts: options.layouts || DEFAULT_LAYOUTS,
			enableHMR:
				options.enableHMR
				?? (playwrightDetected ? false : SERVER_CONFIG.ENABLE_HMR),
			enableCompression:
				options.enableCompression ?? SERVER_CONFIG.ENABLE_COMPRESSION,
			buildFirst: options.buildFirst ?? false,
			disableFileWatching: options.disableFileWatching ?? playwrightDetected,
		}

		this.layoutEngine = new LayoutEngine(this.options.layouts)

		if (playwrightDetected) {
			console.log('🎭 Playwright detected - HMR and file watching disabled')
		}
	}

	async start(): Promise<void> {
		try {
			console.log('🚀 Starting unified development server...')
			console.log(
				`🎨 Layouts: ${this.layoutEngine.getAvailableLayouts().join(', ')}`,
			)

			// Build documentation first if requested
			if (this.options.buildFirst) {
				console.log('🏗️ Building documentation first...')
				this.buildCleanup = await build()
				console.log('✅ Documentation build complete')
			}

			// Create Bun server with WebSocket support
			const serverConfig: any = {
				port: this.options.port,
				hostname: this.options.host,
				development: true,
				fetch: (req: Request) => this.handleRequest(req),
			}

			if (this.options.enableHMR) {
				serverConfig.websocket = {
					open: (ws: any) => {
						this.context.sockets.add(ws)
						console.log('🔌 Client connected')
					},
					close: (ws: any) => {
						this.context.sockets.delete(ws)
						console.log('🔌 Client disconnected')
					},
					message: (ws: any, message: string) => {
						try {
							const data = JSON.parse(message)
							if (data.type === 'ping') {
								ws.send(JSON.stringify({ type: 'pong' }))
							}
						} catch {
							// Ignore malformed messages
						}
					},
				}
			}

			this.server = Bun.serve(serverConfig)

			console.log(
				`✅ Server started at http://${this.options.host}:${this.options.port}`,
			)
			if (this.options.enableHMR) {
				console.log('🔥 Hot Module Reloading enabled')
			} else if (this.options.disableFileWatching) {
				console.log('📱 File watching disabled for testing')
			}
			console.log(`📁 Serving from: ${OUTPUT_DIR}`)
		} catch (error) {
			console.error('❌ Failed to start server:', error)
			throw error
		}
	}

	async stop(): Promise<void> {
		console.log('🛑 Stopping unified server...')

		// Close WebSocket connections
		for (const socket of this.context.sockets) {
			socket.close()
		}
		this.context.sockets.clear()

		// Stop build system
		if (this.buildCleanup) {
			this.buildCleanup()
		}

		// Stop server
		if (this.server) {
			this.server.stop()
		}

		console.log('✅ Server stopped')
	}

	private isMockFileRequest(path: string): boolean {
		// Check if this matches the pattern /component-name/file.html or /component-name/file.json
		// that should be served from component-name/mocks/ directory
		return !!(
			path.match(/^\/[a-zA-Z0-9-]+\/[^\/]+\.(html|json)$/)
			&& !path.includes('/mocks/')
		)
	}

	private createRequestContext(req: Request): RequestContext {
		const url = new URL(req.url)
		const acceptEncoding = req.headers.get('accept-encoding') || ''

		return {
			path: url.pathname,
			method: req.method,
			headers: req.headers,
			acceptsGzip: acceptEncoding.includes('gzip'),
			acceptsBrotli: acceptEncoding.includes('br'),
		}
	}

	private async handleRequest(req: Request): Promise<Response> {
		const context = this.createRequestContext(req)

		try {
			// Handle WebSocket upgrade
			if (this.options.enableHMR && context.path === '/ws') {
				const success = this.server.upgrade(req)
				if (success) {
					return new Response()
				}
				return new Response('WebSocket upgrade failed', { status: 400 })
			}

			// Handle component test pages: /test/{component}.html
			const testMatch = context.path.match(/^\/test\/([a-zA-Z0-9_-]+)\.html$/)
			if (testMatch) return this.handleExampleTestPage(testMatch[1], context)

			// Handle mock files as static files (before HTML handling)
			// This includes both direct /component/mocks/file paths and fallback /component/file paths
			if (
				context.path.includes('/mocks/')
				|| this.isMockFileRequest(context.path)
			)
				return this.handleStaticFile(context)

			// Handle HTML pages (documentation or examples)
			if (isHTMLPath(context.path)) return this.handleHTMLFile(context)

			// Handle static files
			return this.handleStaticFile(context)
		} catch (error) {
			console.error(`❌ Request error for ${context.path}:`, error)
			return new Response('Internal server error', { status: 500 })
		}
	}

	private async handleExampleTestPage(
		component: string,
		context: RequestContext,
	): Promise<Response> {
		try {
			const fragmentContent = getComponentContent(component)

			if (!fragmentContent) {
				return new Response('Component not found', { status: 404 })
			}

			// Use test layout with component-specific context
			const templateContext = {
				title: `${component} Component Test`,
				'component-name': component,
				section: 'test',
				'base-path': '../',
				'css-hash': generateAssetHash(),
				'js-hash': generateAssetHash(),
				description: `Testing ${component} component`,
			}

			let html = await this.layoutEngine.renderWithLayout(
				'test',
				fragmentContent,
				templateContext,
			)

			// Inject HMR script if enabled
			if (this.options.enableHMR) {
				html = this.injectHMRScript(html)
			}

			return this.createResponse(html, context, {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'no-cache, no-store, must-revalidate',
			})
		} catch (error) {
			console.error('Error rendering component test page:', error)
			return new Response('Error rendering test page', { status: 500 })
		}
	}

	private async handleHTMLFile(context: RequestContext): Promise<Response> {
		// Map root to index.html
		const filePath = context.path === '/' ? '/index.html' : context.path

		// Remove leading slash for file system path
		const fullPath = `${process.cwd()}/${String(OUTPUT_DIR)}/${filePath.slice(1)}`

		if (!fileExists(fullPath))
			return new Response('Page not found', { status: 404 })

		try {
			let content = await Bun.file(fullPath).text()

			// For documentation pages, check if we should apply a different layout
			const layoutName = this.layoutEngine.getLayoutForRoute(context.path)

			// If this is a built HTML file that might need layout enhancement
			if (layoutName !== 'page' && this.shouldEnhanceLayout(context.path)) {
				// Extract content from existing HTML and re-render with appropriate layout
				content = await this.enhanceWithLayout(
					content,
					context.path,
					layoutName,
				)
			}

			// Inject HMR script before closing body tag
			if (this.options.enableHMR) {
				content = this.injectHMRScript(content)
			}

			return this.createResponse(content, context, {
				'Content-Type': 'text/html; charset=UTF-8',
				'Cache-Control': 'no-cache, no-store, must-revalidate',
			})
		} catch (error) {
			console.error('Error reading HTML file:', error)
			return new Response('Error reading HTML file', { status: 500 })
		}
	}

	private async handleStaticFile(context: RequestContext): Promise<Response> {
		// Try multiple possible paths based on mode
		const possiblePaths = [
			// Try examples directory first for test assets (main.css, main.js, etc.)
			`${process.cwd()}/${String(COMPONENTS_DIR)}${context.path}`,
			// Try built output directory
			`${process.cwd()}/${String(OUTPUT_DIR)}/${context.path.slice(1)}`,
			// Try output assets directory directly
			`${process.cwd()}/${String(OUTPUT_DIR)}/assets/${context.path.replace(/^\/assets\//, '')}`,
			// Try examples subdirectories for specific component assets and mocks
			`${process.cwd()}/${String(COMPONENTS_DIR)}/${context.path.slice(1)}`,
		]

		// Add fallback for component mock files with different path patterns
		// Handle cases like /component-name/file.html -> component-name/mocks/file.html
		if (context.path.match(/^\/[a-zA-Z0-9-]+\/[^\/]+\.(html|json)$/)) {
			const pathParts = context.path.slice(1).split('/')
			if (pathParts.length === 2) {
				const [componentName, fileName] = pathParts
				const mockPath = `${process.cwd()}/${String(COMPONENTS_DIR)}/${componentName}/mocks/${fileName}`
				possiblePaths.push(mockPath)
			}
		}

		for (const fullPath of possiblePaths) {
			if (fileExists(fullPath)) {
				try {
					const file = Bun.file(fullPath)
					const content = await file.bytes()

					// Set cache headers based on file type
					const isVersioned = isVersionedAsset(context.path)
					const cacheControl = isVersioned
						? 'public, max-age=31536000, immutable' // 1 year for versioned assets
						: 'public, max-age=300' // 5 minutes for other assets

					return this.createResponse(content, context, {
						'Content-Type': getMimeType(context.path, MIME_TYPES),
						'Cache-Control': cacheControl,
					})
				} catch (error) {
					console.error('Error reading static file:', error)
				}
			}
		}

		return new Response('File not found', { status: 404 })
	}

	private shouldEnhanceLayout(path: string): boolean {
		// Only enhance certain routes that might benefit from specialized layouts
		return (
			path.startsWith('/api/')
			|| path.startsWith('/examples/')
			|| path.startsWith('/blog/')
		)
	}

	private async enhanceWithLayout(
		existingHTML: string,
		path: string,
		layoutName: string,
	): Promise<string> {
		try {
			// Extract main content from existing HTML
			const contentMatch = existingHTML.match(/<main[^>]*>(.*?)<\/main>/s)
			const content = contentMatch ? contentMatch[1].trim() : existingHTML

			// Extract title
			const titleMatch = existingHTML.match(/<title[^>]*>(.*?)<\/title>/s)
			const title = titleMatch
				? titleMatch[1].replace(' – Le Truc Docs', '')
				: 'Le Truc'

			// Create context based on path
			const context = this.createContextForPath(path, title)

			return await this.layoutEngine.renderWithLayout(
				layoutName,
				content,
				context,
			)
		} catch (error) {
			console.warn(`Failed to enhance layout for ${path}:`, error)
			return existingHTML
		}
	}

	private createContextForPath(
		path: string,
		title: string,
	): Record<string, string> {
		const context: Record<string, string> = {
			title,
			'base-path': '',
			'css-hash': generateAssetHash(),
			'js-hash': generateAssetHash(),
		}

		// Add path-specific context
		if (path.startsWith('/api/')) {
			const apiMatch = path.match(/\/api\/([^\/]+)\/([^\/]+)/)
			if (apiMatch) {
				context['api-category'] = apiMatch[1]
				context['api-name'] = apiMatch[2]
				context['api-kind'] = apiMatch[1].slice(0, -1) // Remove 's' from plural
			}
		} else if (path.startsWith('/examples/')) {
			const exampleMatch = path.match(/\/examples\/([^\/]+)/)
			if (exampleMatch) {
				context['example-name'] = exampleMatch[1]
				context['example-slug'] = exampleMatch[1]
			}
		}

		return context
	}

	private createResponse(
		content: string | Uint8Array,
		context: RequestContext,
		headers: Record<string, string> = {},
	): Response {
		const buffer =
			typeof content === 'string'
				? Buffer.from(content, 'utf8')
				: Buffer.from(content)

		let finalContent: Buffer | Uint8Array = buffer
		const responseHeaders = new Headers(headers)

		// Apply compression if enabled and beneficial
		if (
			this.options.enableCompression
			&& buffer.length > 1024
			&& shouldCompress(context.path, COMPRESSIBLE_TYPES)
			&& (context.acceptsBrotli || context.acceptsGzip)
		) {
			const { content, encoding } = getCompressedBuffer(buffer, context)
			finalContent = content
			responseHeaders.set('Content-Encoding', encoding)
		}

		responseHeaders.set('Content-Length', finalContent.length.toString())
		responseHeaders.set('X-Content-Type-Options', 'nosniff')

		return new Response(finalContent as BodyInit, {
			headers: responseHeaders,
		})
	}

	private injectHMRScript(html: string): string {
		if (!this.options.enableHMR) return html

		const hmrScript = hmrScriptTag({
			enableLogging: true,
			maxReconnectAttempts: 5,
		})

		return html.replace('</body>', `${hmrScript}</body>`)
	}

	// Notify connected clients to reload
	notifyReload(): void {
		if (this.options.enableHMR && this.context.sockets.size > 0) {
			console.log(`🔄 Notifying ${this.context.sockets.size} clients to reload`)
			for (const socket of this.context.sockets) {
				try {
					socket.send('reload')
				} catch (_error) {
					// Remove dead socket
					this.context.sockets.delete(socket)
				}
			}
		}
	}
}

// CLI interface
async function main(): Promise<void> {
	const args = process.argv.slice(2)

	// Parse command line arguments
	const options: ServerOptions = {}

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]

		switch (arg) {
			case '--port':
				options.port = parseInt(args[++i], 10)
				break
			case '--host':
				options.host = args[++i]
				break
			case '--no-hmr':
				options.enableHMR = false
				break
			case '--no-compression':
				options.enableCompression = false
				break
			case '--build-first':
				options.buildFirst = true
				break
			case '--no-watch':
				options.disableFileWatching = true
				break
			case '--help':
				console.log(`
Usage: bun server/serve.ts [options]

Options:
  --port <port>           Port number (default: 3000)
  --host <host>           Host address (default: localhost)
  --no-hmr                Disable Hot Module Reloading
  --no-compression        Disable response compression
  --build-first           Build documentation before starting server
  --no-watch              Disable file watching
  --help                  Show this help message

Examples:
  bun server/serve.ts --build-first
  bun server/serve.ts --port 4444
  bun server/serve.ts --no-watch --no-hmr
				`)
				process.exit(0)
		}
	}

	const server = new DevServer(options)

	// Graceful shutdown
	const shutdown = async () => {
		console.log('\n🛑 Shutting down...')
		await server.stop()
		process.exit(0)
	}

	process.on('SIGINT', shutdown)
	process.on('SIGTERM', shutdown)

	try {
		await server.start()
		console.log('👀 Server running... (Press Ctrl+C to stop)')
	} catch (error) {
		console.error('💥 Server failed to start:', error)
		process.exit(1)
	}
}

// Run if this file is executed directly
if (import.meta.main) {
	await main()
}
