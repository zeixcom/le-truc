import {
	ASSETS_DIR,
	COMPONENTS_DIR,
	EXAMPLES_DIR,
	LAYOUTS_DIR,
	OUTPUT_DIR,
} from './config'
import { fileExists, getFilePath } from './io'

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
		const trimmedKey = key.trim()
		return context[trimmedKey] || ''
	})
}

const handleComponentTest = async (
	componentName: string,
): Promise<Response> => {
	const componentContent = await Bun.file(
		getFilePath(COMPONENTS_DIR, componentName, `${componentName}.html`),
	).text()
	const layoutContent = await getCachedLayout('test.html')
	const finalContent = replaceTemplateVariables(layoutContent, {
		content: componentContent,
		title: componentName,
	})

	return new Response(finalContent, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'no-cache, no-store, must-revalidate',
		},
	})
}

const handleStaticFile = async (filePath: string): Promise<Response> => {
	if (!fileExists(filePath)) return new Response('Not Found', { status: 404 })
	return new Response(Bun.file(filePath))
}

/* === Server === */

const server = Bun.serve({
	routes: {
		'/api/status': new Response('OK'),

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

		// Not found
		'/test/*': new Response('Not Found', { status: 404 }),

		// Documentation pages
		'/:page': req => handleStaticFile(getFilePath(OUTPUT_DIR, req.params.page)),

		// Serve a file by lazily loading it into memory
		'/favicon.ico': req =>
			handleStaticFile(getFilePath(OUTPUT_DIR, 'favicon.ico')),

		// Index
		'/': req => handleStaticFile(getFilePath(OUTPUT_DIR, 'index.html')),
	},

	fetch() {
		return new Response('Not Found', { status: 404 })
	},
})

console.log(`Server running at ${server.url}`)
