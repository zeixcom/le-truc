import { serve } from 'bun'
import { readdir, readFile } from 'fs/promises'
import { basename, join } from 'path'

// Directory containing example fragments
const EXAMPLES_DIR = './examples'
const LAYOUT_PATH = join(EXAMPLES_DIR, 'layout.html')

// Helper to get all component fragments (*.html in examples/*/)
async function getComponentFragments() {
	const dirs = await readdir(EXAMPLES_DIR, { withFileTypes: true })
	const fragments: Record<string, string> = {}
	for (const dir of dirs) {
		if (!dir.isDirectory() || dir.name === 'assets' || dir.name === '_common')
			continue
		const files = await readdir(join(EXAMPLES_DIR, dir.name))
		for (const file of files) {
			if (file.endsWith('.html')) {
				const component = file.replace(/\.html$/, '')
				fragments[component] = join(EXAMPLES_DIR, dir.name, file)
			}
		}
	}
	return fragments
}

// Serve /test/{component}.html with injected fragment
async function serveTestPage(component: string): Promise<Response> {
	try {
		const fragments = await getComponentFragments()
		const fragmentPath = fragments[component]
		if (!fragmentPath) {
			return new Response('Component not found', { status: 404 })
		}
		const [layout, fragment] = await Promise.all([
			readFile(LAYOUT_PATH, 'utf8'),
			readFile(fragmentPath, 'utf8'),
		])
		// Replace marker in layout with fragment
		const html = layout.replace(/<!-- \{\{content}} -->/, fragment)
		return new Response(html, {
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
		})
	} catch (_err) {
		return new Response('Error rendering test page', { status: 500 })
	}
}

// Serve static assets (main.js, main.css, etc.)
async function serveStaticAsset(url: string): Promise<Response> {
	try {
		const assetPath = join('.', url)
		const asset = await readFile(assetPath)
		let contentType = 'application/octet-stream'
		if (url.endsWith('.js')) contentType = 'application/javascript'
		if (url.endsWith('.css')) contentType = 'text/css'
		if (url.endsWith('.html')) contentType = 'text/html'
		if (url.endsWith('.json')) contentType = 'application/json'
		return new Response(asset, { headers: { 'Content-Type': contentType } })
	} catch (_err) {
		return new Response('Asset not found', { status: 404 })
	}
}

// Main server
serve({
	port: 4173,
	async fetch(req) {
		const url = new URL(req.url)
		// Serve /test/{component}.html
		const testMatch = url.pathname.match(/^\/test\/([a-zA-Z0-9_-]+)\.html$/)
		if (testMatch) {
			const component = testMatch[1]
			return await serveTestPage(component)
		}
		// Serve static assets from /examples/assets/
		if (url.pathname.startsWith('/assets/')) {
			return await serveStaticAsset('examples' + url.pathname)
		}
		// Serve static fragments and other files for manual inspection
		const fragmentMatch = url.pathname.match(
			/^\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\.(html|json)$/,
		)
		if (fragmentMatch) {
			return await serveStaticAsset('examples' + url.pathname)
		}
		// Serve layout.html for root
		if (url.pathname === '/' || url.pathname === '/layout.html') {
			return await serveStaticAsset('examples/layout.html')
		}
		return new Response('Not found', { status: 404 })
	},
})

console.log('Bun example server running at http://localhost:4173/')
