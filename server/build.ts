#!/usr/bin/env bun

import { apiEffect } from './effects/api'
import { cssEffect } from './effects/css'
import { jsEffect } from './effects/js'
import { menuEffect } from './effects/menu'
import { pagesEffect } from './effects/pages'
import { serviceWorkerEffect } from './effects/service-worker'
import { sitemapEffect } from './effects/sitemap'
import { sourcesEffect } from './effects/sources'
import { getFilePath } from './io'

/**
 * Simple reactive build system orchestration with HMR integration
 *
 * This file initializes the file signals and starts the effects
 * in the correct order for both initial builds and incremental updates.
 * In development mode, it also integrates with HMR for live reloading.
 */

// Global reference to HMR broadcast function
let hmrBroadcast: ((message: any) => void) | null = null

export function setHMRBroadcast(broadcast: (message: any) => void) {
	hmrBroadcast = broadcast
}

function notifyHMR(type: string, message?: string, path?: string) {
	if (hmrBroadcast && process.env.NODE_ENV !== 'production') {
		hmrBroadcast({ type, message, path })
	}
}

export async function build(
	options: {
		watch?: boolean
		hmrBroadcast?: (message: any) => void
	} = {},
) {
	const startTime = performance.now()
	const { watch = false, hmrBroadcast: broadcast } = options

	console.log(`🚀 Starting ${watch ? 'watch' : 'build'} mode...`)

	// Set up HMR broadcast if provided
	if (broadcast) {
		setHMRBroadcast(broadcast)
	}

	try {
		// Change to project root directory since config paths are relative to it
		const projectRoot = getFilePath(import.meta.dir, '..')
		process.chdir(projectRoot)
		console.log(`📁 Working directory: ${process.cwd()}`)

		// Wait a moment for file watchers to initialize
		await new Promise(resolve => setTimeout(resolve, 1000))

		// Initialize effects in order
		// API docs should be generated first, then CSS/JS, then pages processing
		console.log('🚀 Initializing effects...')

		// let buildError: Error | null = null

		const apiCleanup = apiEffect()
		const cssCleanup = cssEffect()
		const jsCleanup = jsEffect()
		const serviceWorkerCleanup = serviceWorkerEffect()
		const examplesCleanup = sourcesEffect()
		const pagesCleanup = pagesEffect()
		const menuCleanup = menuEffect()
		const sitemapCleanup = sitemapEffect()

		// Wait a moment for initial processing to complete
		await new Promise(resolve => setTimeout(resolve, 500))

		const duration = performance.now() - startTime
		console.log(`✅ Build completed in ${duration.toFixed(2)}ms`)

		// Notify HMR clients of successful build
		if (watch) {
			notifyHMR('build-success')
		}

		// Return cleanup function for graceful shutdown
		return () => {
			apiCleanup?.()
			cssCleanup?.()
			jsCleanup?.()
			serviceWorkerCleanup?.()
			examplesCleanup?.()
			pagesCleanup?.()
			menuCleanup?.()
			sitemapCleanup?.()
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error('❌ Build failed:', errorMessage)

		// Notify HMR clients of build error
		if (watch) {
			notifyHMR('build-error', errorMessage)
		}

		if (!watch) {
			throw error
		}

		// In watch mode, don't crash on build errors
		console.log('📝 Waiting for file changes to retry...')
		return () => {} // Return empty cleanup function
	}
}

export async function buildAndWatch() {
	try {
		const cleanup = await build({ watch: true })

		// Handle graceful shutdown
		process.on('SIGINT', () => {
			console.log('\n🛑 Shutting down...')
			cleanup?.()
			process.exit(0)
		})

		// Keep process alive in watch mode
		console.log('👀 Watching for changes... (Press Ctrl+C to stop)')
		await new Promise(() => {}) // Keep alive indefinitely
	} catch (error) {
		console.error('💥 Fatal error:', error)
		process.exit(1)
	}
}

export async function buildOnce() {
	try {
		const cleanup = await build({ watch: false })
		cleanup?.()
		console.log('🎯 Single build completed successfully')
	} catch (error) {
		console.error('💥 Build failed:', error)
		process.exit(1)
	}
}

async function main() {
	const args = process.argv.slice(2)
	const hasWatchFlag = args.includes('--watch') || args.includes('-w')

	if (hasWatchFlag) {
		await buildAndWatch()
	} else {
		await buildOnce()
	}
}

// Run if this file is executed directly
if (import.meta.main) {
	main()
}
