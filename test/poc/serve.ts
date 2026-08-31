/**
 * Minimal dev server for the ARIA-reflection proof-of-concept (TODO.md LT-001).
 *
 * Serves the PoC pages in `test/poc/pages/` and bundles PoC component modules
 * on demand with Bun.build — PoC components may import the library's TS source
 * (`../../index`) directly, with `DEV_MODE` defined on so dev diagnostics are
 * visible. The main docs server (`server/serve.ts`) is deliberately untouched:
 * `examples/` is the published demo surface, PoC code is throwaway.
 *
 * Routes:
 *   /                    → plain-text index of the pages
 *   /<name>              → test/poc/pages/<name>.html
 *   /poc/<module>.js     → Bun.build(test/poc/<module>.ts), cached by mtime
 *
 * Runs on port 3100 (the docs/examples server owns 3000).
 */
import { join } from 'node:path'

const PORT = 3100
const ROOT = import.meta.dir

/* In-memory bundle cache, keyed by source mtime+size so edits invalidate. */
const bundles = new Map<string, { key: string; js: string }>()

/**
 * Bundle `test/poc/<name>.ts` on demand. `name` is restricted to `[\w-]+` by
 * the route regex — no separators, no dots — so the joined path cannot escape
 * the `test/poc/` directory.
 */
async function bundleModule(name: string): Promise<string | null> {
	const entry = join(ROOT, name + '.ts')
	const file = Bun.file(entry)
	if (!(await file.exists())) return null
	const key = String(await file.lastModified) + ':' + String(await file.size)
	const cached = bundles.get(entry)
	if (cached && cached.key === key) return cached.js
	const result = await Bun.build({
		entrypoints: [entry],
		target: 'browser',
		format: 'esm',
		define: { 'process.env.DEV_MODE': '"true"' },
		minify: false,
	})
	const output = result.outputs[0]
	if (!output) {
		console.error('[poc] bundle failed for', name, result.logs)
		return null
	}
	const js = await output.text()
	bundles.set(entry, { key, js })
	return js
}

const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8' }

async function pageResponse(name: string): Promise<Response | null> {
	const file = Bun.file(join(ROOT, 'pages', name + '.html'))
	if (!(await file.exists())) return null
	return new Response(await file.text(), { headers: HTML_HEADERS })
}

/** Plain-text listing — no HTML interpolation of dynamic values. */
async function indexResponse(): Promise<Response> {
	const pages = await Array.fromAsync(
		new Bun.Glob('*.html').scan({ cwd: join(ROOT, 'pages') }),
	)
	const body = pages
		.map(p => p.replace(/\.html$/, ''))
		.sort()
		.map(name => 'http://localhost:' + PORT + '/' + name)
		.join('\n')
	return new Response('le-truc PoC pages\n\n' + body + '\n', {
		headers: { 'content-type': 'text/plain; charset=utf-8' },
	})
}

Bun.serve({
	port: PORT,
	async fetch(req) {
		const { pathname } = new URL(req.url)
		if (pathname === '/' || pathname === '/index.html') return indexResponse()
		const moduleMatch = pathname.match(/^\/poc\/([\w-]+)\.js$/)
		if (moduleMatch) {
			const js = await bundleModule(moduleMatch[1])
			if (js == null) return new Response('Not found', { status: 404 })
			return new Response(js, {
				headers: { 'content-type': 'text/javascript; charset=utf-8' },
			})
		}
		const pageMatch = pathname.match(/^\/([\w-]+)$/)
		if (pageMatch) {
			const page = await pageResponse(pageMatch[1])
			if (page) return page
		}
		return new Response('Not found', { status: 404 })
	},
})

console.log('[poc] serving test/poc on http://localhost:' + PORT)
