#!/usr/bin/env bun

import { existsSync } from 'fs'
import { resolve } from 'path'
import { brotliCompressSync, gzipSync } from 'zlib'
import { build } from './build'
import { OUTPUT_DIR } from './config'
import { html } from './templates/utils'

interface ServerContext {
	sockets: Set<any>
	isRebuilding: boolean
}

interface RequestContext {
	path: string
	method: string
	headers: Headers
	acceptsGzip: boolean
	acceptsBrotli: boolean
}

/**
 * Simple development server with HMR
 */
export class DevServer {
	private server: any = null
	private context: ServerContext = {
		sockets: new Set(),
		isRebuilding: false,
	}
	private buildCleanup: (() => void) | null = null

	constructor(
		private port: number = 3000,
		private host: string = 'localhost',
	) {}

	async start(): Promise<void> {
		try {
			console.log('🚀 Starting development server...')

			// Initialize reactive build system
			this.buildCleanup = await build()
			console.log('🏗️ Build system initialized')

			// Create Bun server with WebSocket support
			this.server = Bun.serve({
				port: this.port,
				hostname: this.host,
				development: true,

				// WebSocket for HMR
				websocket: {
					open: (ws: any) => {
						this.context.sockets.add(ws)
						console.log('🔌 Client connected')
					},
					close: (ws: any) => {
						this.context.sockets.delete(ws)
						console.log('🔌 Client disconnected')
					},
					message: (ws: any, message: string) => {
						// Handle ping/pong for connection keep-alive
						try {
							const data = JSON.parse(message)
							if (data.type === 'ping') {
								ws.send(JSON.stringify({ type: 'pong' }))
							}
						} catch {
							// Ignore malformed messages
						}
					},
				},

				fetch: (req: Request) => this.handleRequest(req),
			})

			console.log(`✅ Server started at http://${this.host}:${this.port}`)
			console.log('🔥 Hot Module Reloading enabled')
			console.log(`📁 Serving from: ${OUTPUT_DIR}`)
		} catch (error) {
			console.error('❌ Failed to start server:', error)
			throw error
		}
	}

	async stop(): Promise<void> {
		console.log('🛑 Stopping development server...')

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

	private async handleRequest(req: Request): Promise<Response> {
		const context = this.createRequestContext(req)

		try {
			// Handle WebSocket upgrade
			if (context.path === '/ws') {
				const success = this.server.upgrade(req)
				if (success) {
					return new Response()
				}
				return new Response('WebSocket upgrade failed', { status: 400 })
			}

			// Handle HTML files (inject HMR script)
			if (this.isHTMLPath(context.path)) {
				return this.handleHTMLFile(context)
			}

			// Handle static files
			return this.handleStaticFile(context)
		} catch (error) {
			console.error(`❌ Request error for ${context.path}:`, error)
			return new Response('Internal server error', { status: 500 })
		}
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

	private async handleHTMLFile(context: RequestContext): Promise<Response> {
		// Map root to index.html
		const filePath = context.path === '/' ? '/index.html' : context.path

		// Remove leading slash for file system path
		const fullPath = resolve(OUTPUT_DIR, filePath.slice(1))

		if (!existsSync(fullPath)) {
			return new Response('Page not found', { status: 404 })
		}

		try {
			let content = await Bun.file(fullPath).text()

			// Inject HMR script before closing body tag
			const hmrScript = this.generateHMRScript()
			content = content.replace('</body>', `${hmrScript}</body>`)

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
		const fullPath = resolve(OUTPUT_DIR, context.path.slice(1))

		if (!existsSync(fullPath)) {
			return new Response('File not found', { status: 404 })
		}

		try {
			const file = Bun.file(fullPath)
			const content = await file.bytes()

			// Set cache headers based on file type
			const isVersionedAsset = this.isVersionedAsset(context.path)
			const cacheControl = isVersionedAsset
				? 'public, max-age=31536000, immutable' // 1 year for versioned assets
				: 'public, max-age=300' // 5 minutes for other assets

			return this.createResponse(content, context, {
				'Content-Type': this.getContentType(context.path),
				'Cache-Control': cacheControl,
			})
		} catch (error) {
			console.error('Error reading static file:', error)
			return new Response('Error reading file', { status: 500 })
		}
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

		// Apply compression if supported and beneficial
		let finalContent: Buffer | Uint8Array = buffer
		const responseHeaders = new Headers(headers)

		if (
			buffer.length > 1024
			&& this.shouldCompress(context.path)
			&& (context.acceptsBrotli || context.acceptsGzip)
		) {
			if (context.acceptsBrotli) {
				finalContent = brotliCompressSync(buffer)
				responseHeaders.set('Content-Encoding', 'br')
			} else if (context.acceptsGzip) {
				finalContent = gzipSync(buffer)
				responseHeaders.set('Content-Encoding', 'gzip')
			}
		}

		responseHeaders.set('Content-Length', finalContent.length.toString())
		responseHeaders.set('X-Content-Type-Options', 'nosniff')

		return new Response(finalContent as BodyInit, {
			headers: responseHeaders,
		})
	}

	private generateHMRScript(): string {
		return html` <script>
			;(function () {
				console.log('🔥 HMR Client initialized')

				const ws = new WebSocket('ws://' + window.location.host + '/ws')
				let reconnectAttempts = 0
				const maxReconnectAttempts = 5

				ws.onopen = function () {
					console.log('🔌 Connected to dev server')
					reconnectAttempts = 0
				}

				ws.onmessage = function (event) {
					const data = event.data

					if (data === 'reload') {
						console.log('🔄 Reloading page...')
						window.location.reload()
					} else {
						try {
							const parsed = JSON.parse(data)
							if (parsed.type === 'build-error') {
								console.error('❌ Build error:', parsed.message)
							} else if (parsed.type === 'pong') {
								// Keep-alive response
							}
						} catch (e) {
							// Ignore non-JSON messages
						}
					}
				}

				ws.onclose = function () {
					console.log('🔌 Disconnected from dev server')
					if (reconnectAttempts < maxReconnectAttempts) {
						setTimeout(
							() => {
								console.log('🔄 Attempting to reconnect...')
								reconnectAttempts++
								location.reload()
							},
							1000 * Math.pow(2, reconnectAttempts),
						)
					}
				}

				ws.onerror = function (error) {
					console.error('❌ WebSocket error:', error)
				}

				// Send periodic ping to keep connection alive
				setInterval(() => {
					if (ws.readyState === WebSocket.OPEN) {
						ws.send(JSON.stringify({ type: 'ping' }))
					}
				}, 30000)
			})()
		</script>`
	}

	private isHTMLPath(path: string): boolean {
		return path.endsWith('.html') || path === '/' || !path.includes('.')
	}

	private isVersionedAsset(path: string): boolean {
		// Check if file has hash in name (e.g., main.abc123.css)
		return /\.[a-f0-9]{8,}\.(css|js|js\.map)$/.test(path)
	}

	private shouldCompress(path: string): boolean {
		const compressibleTypes = [
			'.html',
			'.css',
			'.js',
			'.json',
			'.xml',
			'.svg',
			'.txt',
		]
		return compressibleTypes.some(ext => path.endsWith(ext))
	}

	private getContentType(path: string): string {
		const ext = path.split('.').pop()?.toLowerCase()

		const mimeTypes: Record<string, string> = {
			html: 'text/html',
			css: 'text/css',
			js: 'application/javascript',
			json: 'application/json',
			xml: 'application/xml',
			svg: 'image/svg+xml',
			png: 'image/png',
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			gif: 'image/gif',
			webp: 'image/webp',
			avif: 'image/avif',
			ico: 'image/x-icon',
			woff: 'font/woff',
			woff2: 'font/woff2',
			ttf: 'font/ttf',
			otf: 'font/otf',
			pdf: 'application/pdf',
			txt: 'text/plain',
			map: 'application/json', // Source maps
		}

		return mimeTypes[ext || ''] || 'application/octet-stream'
	}

	// Notify connected clients to reload
	notifyReload(): void {
		if (this.context.sockets.size > 0) {
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
async function main() {
	const port = parseInt(process.env.PORT || '3000', 10)
	const host = process.env.HOST || 'localhost'

	const server = new DevServer(port, host)

	// Graceful shutdown
	process.on('SIGINT', async () => {
		console.log('\n🛑 Shutting down...')
		await server.stop()
		process.exit(0)
	})

	process.on('SIGTERM', async () => {
		console.log('\n🛑 Shutting down...')
		await server.stop()
		process.exit(0)
	})

	try {
		await server.start()

		// Keep server running
		console.log('👀 Server running... (Press Ctrl+C to stop)')
	} catch (error) {
		console.error('💥 Server failed to start:', error)
		process.exit(1)
	}
}

// Run if this file is executed directly
if (import.meta.main) {
	main()
}
