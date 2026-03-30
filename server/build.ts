#!/usr/bin/env bun

import { apiEffect } from './effects/api'
import { apiPagesEffect } from './effects/api-pages'
import { cssEffect } from './effects/css'
import { examplesEffect } from './effects/examples'
import { jsEffect } from './effects/js'
import { menuEffect } from './effects/menu'
import { mocksEffect } from './effects/mocks'
import { pagesEffect } from './effects/pages'
import { serviceWorkerEffect } from './effects/service-worker'
import { sitemapEffect } from './effects/sitemap'
import { sourcesEffect } from './effects/sources'

/**
 * Simple reactive build system orchestration with HMR integration
 *
 * This file initializes the file signals and starts the effects
 * in the correct order for both initial builds and incremental updates.
 * In development mode, it also integrates with HMR for live reloading.
 */

export async function build(
	options: {
		watch?: boolean
		hmrBroadcast?: (message: any) => void
	} = {},
) {
	const startTime = performance.now()
	const { watch = false, hmrBroadcast: broadcast } = options

	console.log(`🚀 Starting ${watch ? 'watch' : 'build'} mode...`)

	try {
		// Initialize effects in order
		// API docs should be generated first, then CSS/JS, then pages processing
		console.log('🚀 Initializing effects...')

		// Debounced reload: coalesces rapid back-to-back rebuilds into one HMR message
		let reloadTimer: ReturnType<typeof setTimeout> | null = null
		const scheduleReload = watch && broadcast
			? () => {
					if (reloadTimer) clearTimeout(reloadTimer)
					reloadTimer = setTimeout(() => {
						reloadTimer = null
						broadcast('reload')
					}, 50)
				}
			: undefined

		const api = apiEffect(scheduleReload)
		const apiPages = apiPagesEffect(scheduleReload)
		const css = cssEffect(scheduleReload)
		const js = jsEffect(scheduleReload)
		const sw = serviceWorkerEffect(scheduleReload)
		const examples = examplesEffect(scheduleReload)
		const mocks = mocksEffect(scheduleReload)
		const sources = sourcesEffect(scheduleReload)
		const pages = pagesEffect(scheduleReload)
		const menuEff = menuEffect(scheduleReload)
		const sitemap = sitemapEffect(scheduleReload)

		// Wait for all effects to complete their first run
		await Promise.all([
			api.ready,
			apiPages.ready,
			css.ready,
			js.ready,
			sw.ready,
			examples.ready,
			mocks.ready,
			sources.ready,
			pages.ready,
			menuEff.ready,
			sitemap.ready,
		])

		const duration = performance.now() - startTime
		console.log(`✅ Build completed in ${duration.toFixed(2)}ms`)

		// Notify HMR clients of successful build and trigger reload
		if (watch && broadcast) {
			broadcast({ type: 'build-success' })
			broadcast('reload')
		}

		// Return cleanup function for graceful shutdown
		return () => {
			api.cleanup?.()
			apiPages.cleanup?.()
			css.cleanup?.()
			js.cleanup?.()
			sw.cleanup?.()
			examples.cleanup?.()
			mocks.cleanup?.()
			sources.cleanup?.()
			pages.cleanup?.()
			menuEff.cleanup?.()
			sitemap.cleanup?.()
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error('❌ Build failed:', errorMessage)

		// Notify HMR clients of build error
		if (watch && broadcast) {
			broadcast({ type: 'build-error', message: errorMessage })
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
