import { buildOnce } from './build'
import { SERVER_CONFIG } from './config'
import {
	clearLayoutCache,
	createRequestHandler,
	getLayoutForPath,
	readEnvSurface,
} from './routes'

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

export type { SurfaceSpelling, TemplateContext } from './routes'

export type HMRMessage = {
	type: 'reload' | 'pong' | 'build-error' | 'build-success' | 'file-changed'
	message?: string
	path?: string
}

/* === HMR State === */

const hmrClients = new Set<import('bun').ServerWebSocket<unknown>>()
const isDevelopment =
	process.env.NODE_ENV === 'development' && !process.env.PLAYWRIGHT

if (process.env.TEST_SURFACE && !readEnvSurface()) {
	console.error(
		`❌ Invalid TEST_SURFACE "${process.env.TEST_SURFACE}" — expected one of: ts, tsrx, tsx`,
	)
	process.exit(1)
}

const handleRequest = createRequestHandler({ development: isDevelopment })

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

/**
 * Bind the docs server: the pure request handler plus the `/ws` upgrade and
 * its WebSocket callbacks, the only parts that need the `Server` (LT-364).
 */
const listen = (port: number) =>
	Bun.serve({
		port,
		// `/ws` is the one route outside the handler: the upgrade needs the
		// `Server`, and a successful one must return no Response (LT-364).
		fetch: (req, srv) => {
			if (isDevelopment && new URL(req.url).pathname === '/ws') {
				if (srv.upgrade(req)) return
				return new Response('WebSocket upgrade failed', { status: 400 })
			}
			return handleRequest(req)
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
	})

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

	server = listen(port)

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
	listen,
	startServer,
}
