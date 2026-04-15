#!/usr/bin/env bun

import { build } from './build'
import { broadcastToHMRClients, startServer } from './serve'

/**
 * Unified Development Server
 *
 * This script combines the build system with the development server,
 * enabling Hot Module Replacement (HMR) for a smooth development experience.
 *
 * Features:
 * - File watching and automatic rebuilds
 * - WebSocket-based HMR with live reloading
 * - Integrated build system and server
 * - Graceful error handling and recovery
 */

const isDevelopment = process.env.NODE_ENV !== 'production'

async function startDevServer() {
	console.log('🔥 Starting Le Truc Development Server...')

	if (!isDevelopment) {
		console.warn(
			'⚠️  Running dev server in production mode. Set NODE_ENV=development for optimal experience.',
		)
	}

	try {
		// Start the HTTP server explicitly
		await startServer()

		// Start the build system in watch mode
		console.log('📦 Initializing build system...')
		const buildCleanup = await build({
			watch: true,
			hmrBroadcast: broadcastToHMRClients,
		})

		console.log('🎯 Development server ready!')
		console.log('💡 Features enabled:')
		console.log('   • Hot Module Replacement (HMR)')
		console.log('   • File watching and auto-rebuild')
		console.log('   • Live browser reloading')
		console.log('   • Component test pages')
		console.log('')
		console.log('🌐 Open your browser and start developing!')
		console.log('📝 Edit files and see changes instantly')
		console.log('🔧 Press Ctrl+C to stop the server')

		// Handle graceful shutdown
		const shutdown = () => {
			console.log('\n🛑 Shutting down development server...')
			buildCleanup?.()
			console.log('✅ Development server stopped')
			process.exit(0)
		}

		process.on('SIGINT', shutdown)
		process.on('SIGTERM', shutdown)

		// Keep the process alive
		await new Promise(() => {}) // Wait indefinitely
	} catch (error) {
		console.error('💥 Failed to start development server:', error)
		process.exit(1)
	}
}

async function main() {
	const args = process.argv.slice(2)

	// Handle command line arguments
	if (args.includes('--help') || args.includes('-h')) {
		console.log(`
Le Truc Development Server

Usage:
  bun run server/dev.ts [options]

Options:
  --help, -h     Show this help message
  --port PORT    Set server port (default: from Bun.serve)
  --host HOST    Set server host (default: localhost)

Environment Variables:
  NODE_ENV       Set to 'development' for dev features (default)
  DEBUG          Enable debug logging

Examples:
  bun run server/dev.ts
  NODE_ENV=development bun run server/dev.ts
  DEBUG=1 bun run server/dev.ts
`)
		process.exit(0)
	}

	// Set development environment if not already set
	if (!process.env.NODE_ENV) {
		process.env.NODE_ENV = 'development'
	}

	await startDevServer()
}

// Only run if this file is executed directly
if (import.meta.main) {
	main().catch(error => {
		console.error('💥 Fatal error:', error)
		process.exit(1)
	})
}

export { startDevServer }
