#!/usr/bin/env bun

import { join } from 'path'
import { apiEffect } from './effects/api'
import { cssEffect } from './effects/css'
import { examplesEffect } from './effects/examples'
import { jsEffect } from './effects/js'
import { menuEffect } from './effects/menu'
import { pagesEffect } from './effects/pages'
import { serviceWorkerEffect } from './effects/service-worker'
import { sitemapEffect } from './effects/sitemap'

/**
 * Simple reactive build system orchestration
 *
 * This file initializes the file signals and starts the effects
 * in the correct order for both initial builds and incremental updates.
 */

export async function build() {
	const startTime = performance.now()
	console.log('🚀 Starting build...')

	try {
		// Change to project root directory since config paths are relative to it
		const projectRoot = join(import.meta.dir, '..')
		process.chdir(projectRoot)
		console.log(`📁 Working directory: ${process.cwd()}`)

		// Wait a moment for file watchers to initialize
		await new Promise(resolve => setTimeout(resolve, 1000))

		// Initialize effects in order
		// API docs should be generated first, then CSS/JS, then pages processing
		console.log('🚀 Initializing effects...')
		const apiCleanup = apiEffect()
		const cssCleanup = cssEffect()
		const jsCleanup = jsEffect()
		const serviceWorkerCleanup = serviceWorkerEffect()
		const examplesCleanup = examplesEffect()
		const pagesCleanup = pagesEffect()
		const menuCleanup = menuEffect()
		const sitemapCleanup = sitemapEffect()

		// Wait a moment for initial processing to complete
		await new Promise(resolve => setTimeout(resolve, 500))

		const duration = performance.now() - startTime
		console.log(`✅ Build completed in ${duration.toFixed(2)}ms`)

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
		console.error('❌ Build failed:', error)
		throw error
	}
}

async function main() {
	try {
		const cleanup = await build()

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

// Run if this file is executed directly
if (import.meta.main) {
	main()
}
