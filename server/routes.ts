import pkg from '../package.json'
import {
	ASSETS_DIR,
	COMPONENTS_DIR,
	DEFAULT_LOCALE,
	EXAMPLES_DIR,
	GENERATED_CLIENTS_DIR,
	LAYOUTS_DIR,
	LOCALES,
	OUTPUT_DIR,
	PAGES_DIR,
	ROOT,
	ROUTE_LAYOUT_MAP,
	SOURCES_DIR,
	TS_FILE,
} from './config'
import { fileExists, getFilePath, getRelativePath, isDirectory } from './io'
import { hmrScriptTag } from './templates/hmr'

/* === Types === */

export type TemplateContext = Record<string, string>

/** The docs server's whole HTTP surface, minus the `/ws` upgrade (LT-364). */
export type RequestHandler = (req: Request) => Promise<Response>

export type RequestHandlerOptions = {
	/** Inject the HMR client into HTML and bypass the layout cache. */
	development: boolean
}

type RouteParams = Record<string, string>

type RouteHandler = (
	req: Request,
	params: RouteParams,
) => Response | Promise<Response>

/* === Utility Functions === */

const notFound = () => new Response('Not Found', { status: 404 })

const layoutsCache = new Map<string, string>()

const clearLayoutCache = () => layoutsCache.clear()

const getLayoutForPath = (urlPath: string): string => {
	for (const [prefix, layout] of Object.entries(ROUTE_LAYOUT_MAP)) {
		if (prefix === '/') continue
		if (prefix.endsWith('/')) {
			if (urlPath.startsWith(prefix)) return layout
		} else {
			if (urlPath === prefix) return layout
		}
	}
	return ROUTE_LAYOUT_MAP['/'] || 'page'
}

const getCachedLayout = async (file: string, development: boolean) => {
	if (development || !layoutsCache.has(file)) {
		const layoutContent = await Bun.file(getFilePath(LAYOUTS_DIR, file)).text()
		if (!development) layoutsCache.set(file, layoutContent)
		return layoutContent
	}
	return layoutsCache.get(file) || ''
}

const replaceTemplateVariables = (
	content: string,
	context: TemplateContext,
): string => {
	return content.replace(/{{\s*([\w\-]+)\s*}}/g, (_, key) => {
		const trimmedKey = key.trim() as keyof TemplateContext
		return context[trimmedKey] || ''
	})
}

const injectHMRScript = (html: string, development: boolean): string => {
	if (!development) return html

	const hmrScript = hmrScriptTag({
		enableLogging: true,
		maxReconnectAttempts: 10,
		reconnectInterval: 1000,
		pingInterval: 30000,
	})

	// Inject before closing </head> tag, or before closing </body> if no </head>
	if (html.includes('</head>')) {
		return html.replace('</head>', `${hmrScript}\n</head>`)
	} else if (html.includes('</body>')) {
		return html.replace('</body>', `${hmrScript}\n</body>`)
	} else {
		return html + hmrScript
	}
}

const findComponentHtmlPath = (componentName: string): string | null => {
	const glob = new Bun.Glob(`**/${componentName}.html`)
	for (const match of glob.scanSync(COMPONENTS_DIR)) {
		return getFilePath(COMPONENTS_DIR, match)
	}
	return null
}

const findMockFilePath = (
	componentName: string,
	mockName: string,
): string | null => {
	const htmlPath = findComponentHtmlPath(componentName)
	if (!htmlPath) return null
	const componentDir = htmlPath.substring(0, htmlPath.lastIndexOf('/'))
	const mockPath = getFilePath(componentDir, 'mocks', mockName)
	if (!guardPath(COMPONENTS_DIR, mockPath) || !fileExists(mockPath)) return null
	return mockPath
}

/* === Component test surface selection (LT-284, ADR 0039 s2) === */

/**
 * The authored spellings a variant set may carry: the hand-written twin
 * (`ts`, served from the example folder) and the two compiled members
 * (`tsrx`/`tsx`, served from their generated clients).
 */
export type SurfaceSpelling = 'ts' | 'tsrx' | 'tsx'

const SURFACE_SPELLINGS: readonly SurfaceSpelling[] = ['ts', 'tsrx', 'tsx']

const isSurfaceSpelling = (value: string): value is SurfaceSpelling =>
	(SURFACE_SPELLINGS as readonly string[]).includes(value)

/**
 * Per-request surface override for the spec matrix runner
 * (`scripts/test-variants.ts`): with `TEST_SURFACE=ts|tsrx|tsx` in the
 * server's environment, the plain `/test/<tag>` URL serves that surface's
 * page, so the same unchanged Playwright spec exercises every spelling.
 * Read per request (not cached at module load) so tests can toggle it.
 */
const readEnvSurface = (): SurfaceSpelling | undefined => {
	const raw = process.env.TEST_SURFACE
	return isSurfaceSpelling(raw || '') ? (raw as SurfaceSpelling) : undefined
}

/**
 * Effective surface for a `/test/:component` request: an explicit
 * `?surface=` query wins; otherwise the runner's `TEST_SURFACE` env override
 * applies; otherwise the default (selected-surface) page is served.
 */
const effectiveSurface = (
	query: string | null,
): SurfaceSpelling | 'invalid' | undefined => {
	if (query) return isSurfaceSpelling(query) ? query : 'invalid'
	return readEnvSurface()
}

/**
 * The surface whose compiled client occupies the canonical artifact names:
 * the registry entry's `source` names the selected authored member
 * (LT-283), so its extension decides. Null when no corpus has been built.
 */
const registrySelectedSurface = async (
	tag: string,
): Promise<SurfaceSpelling | null> => {
	const registryPath = getFilePath(GENERATED_CLIENTS_DIR, 'registry.json')
	if (!fileExists(registryPath)) return null
	try {
		const registry = JSON.parse(await Bun.file(registryPath).text())
		const source: unknown = registry?.[tag]?.source
		if (typeof source !== 'string') return null
		return source.endsWith('.tsx') ? 'tsx' : 'tsrx'
	} catch {
		return null
	}
}

/**
 * Resolve the authored module a surface page must register for a component:
 * the hand-written twin from the example folder (`ts`), or the generated
 * client of the requested compiled member (`tsrx`/`tsx`) — the canonical
 * artifact when that member is the registry's selected surface, otherwise
 * the per-surface variant module the corpus compile writes for the
 * non-selected member (`variants/<tag>.<surface>.client.ts`, the LT-283
 * contract). Null when the component does not carry that surface.
 */
const resolveSurfaceModule = async (
	tag: string,
	componentDir: string,
	surface: SurfaceSpelling,
): Promise<string | null> => {
	if (surface === 'ts') {
		const twinPath = getFilePath(componentDir, `${tag}.ts`)
		return fileExists(twinPath) ? twinPath : null
	}
	const selected = await registrySelectedSurface(tag)
	if (selected === surface) {
		const canonicalPath = getFilePath(GENERATED_CLIENTS_DIR, `${tag}.client.ts`)
		if (fileExists(canonicalPath)) return canonicalPath
	}
	const variantPath = getFilePath(
		GENERATED_CLIENTS_DIR,
		'variants',
		`${tag}.${surface}.client.ts`,
	)
	return fileExists(variantPath) ? variantPath : null
}

const escapeRegExp = (value: string): string =>
	value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Bundled surface pages, keyed by tag, surface and the swapped module's
 * mtime — so a dev-mode edit to the twin or a variant client rebuilds on
 * the next page load. Fresh server processes (the runner starts one per
 * surface) always start cold.
 */
const surfaceBundleCache = new Map<string, string>()

/**
 * Build a browser bundle that registers exactly one surface's module for
 * the component: the full `examples/main.ts` graph, with the component's
 * generated-client slot emptied out and the selected surface's module
 * appended through a virtual entry. Emptied slot + appended module means
 * the tag is defined exactly once by construction — never twice, whether
 * or not the component is part of the default layout bundle. Every other
 * component keeps registering from the default bundle, so a spec passing
 * against the default page sees an identical page state apart from the
 * component under test.
 *
 * When the requested surface IS the canonical client (the registry's
 * selected member), the default graph already registers it: nothing is
 * emptied or appended.
 */
const buildSurfaceBundle = async (
	tag: string,
	surface: SurfaceSpelling,
	modulePath: string,
): Promise<string> => {
	const mtime = Bun.file(modulePath).lastModified
	const cacheKey = `${tag}::${surface}::${mtime}`
	const cached = surfaceBundleCache.get(cacheKey)
	if (cached) return cached

	const canonicalPath = getFilePath(GENERATED_CLIENTS_DIR, `${tag}.client.ts`)
	const swap = modulePath !== canonicalPath
	const entryId = 'le-truc-surface-entry'
	const entry = [TS_FILE, ...(swap ? [modulePath] : [])]
		.map(path => `import ${JSON.stringify(path)};`)
		.join('\n')
	const result = await Bun.build({
		entrypoints: [entryId],
		target: 'browser',
		minify: true,
		// Matches build:examples:js — the library's dev-mode guards compare
		// `process.env.DEV_MODE === 'true'` inline, and Playwright always
		// wants DEV_MODE instrumentation live (SERVER.md § Environment).
		define: { 'process.env.DEV_MODE': '"true"' },
		plugins: [
			{
				name: 'le-truc-surface-serving',
				setup(build) {
					build.onResolve({ filter: new RegExp(`^${entryId}$`) }, () => ({
						path: entryId,
						namespace: 'surface-entry',
					}))
					build.onLoad({ filter: /.*/, namespace: 'surface-entry' }, () => ({
						contents: entry,
						loader: 'ts',
						resolveDir: ROOT,
					}))
					if (!swap) return
					// Empty the component's canonical client slot in the default
					// graph — main.ts and any composing parent import it — so the
					// appended surface module is the tag's single definition.
					build.onLoad(
						{
							filter: new RegExp(
								`generated[\\\\/]components[\\\\/]${escapeRegExp(tag)}\\.client\\.ts$`,
							),
						},
						() => ({
							contents: 'export {}',
							loader: 'ts',
							resolveDir: GENERATED_CLIENTS_DIR,
						}),
					)
				},
			},
		],
	})
	if (!result.success) {
		const logs = await Promise.all(result.logs.map(String))
		throw new Error(
			`Surface bundle for ${tag} (${surface}) failed to build:\n${logs.join('\n')}`,
		)
	}
	const [output] = result.outputs
	if (!output)
		throw new Error(`Surface bundle for ${tag} (${surface}) produced no output`)
	const js = await output.text()
	surfaceBundleCache.set(cacheKey, js)
	return js
}

const handleSurfaceModule = async (
	componentName: string,
	surface: SurfaceSpelling | 'invalid' | undefined,
): Promise<Response> => {
	try {
		if (!surface || surface === 'invalid') {
			return new Response(
				'Missing or invalid surface — expected ts, tsrx or tsx',
				{
					status: 400,
				},
			)
		}
		const componentPath = findComponentHtmlPath(componentName)
		if (!componentPath) {
			return new Response('Component not found', { status: 404 })
		}
		const componentDir = componentPath.substring(
			0,
			componentPath.lastIndexOf('/'),
		)
		const modulePath = await resolveSurfaceModule(
			componentName,
			componentDir,
			surface,
		)
		if (!modulePath) {
			return new Response(
				`Surface "${surface}" is not available for component "${componentName}"`,
				{ status: 404 },
			)
		}
		const js = await buildSurfaceBundle(componentName, surface, modulePath)
		return new Response(js, {
			headers: {
				'Content-Type': 'text/javascript; charset=utf-8',
				'Cache-Control': 'no-cache, no-store, must-revalidate',
			},
		})
	} catch (error) {
		console.error('Error building component surface module:', error)
		return new Response('Internal server error', { status: 500 })
	}
}

const handleComponentTest = async (
	componentName: string,
	surface: SurfaceSpelling | 'invalid' | undefined,
	development: boolean,
): Promise<Response> => {
	try {
		if (surface === 'invalid') {
			return new Response('Invalid surface — expected ts, tsrx or tsx', {
				status: 400,
			})
		}
		const componentPath = findComponentHtmlPath(componentName)
		if (!componentPath) {
			return new Response('Component not found', { status: 404 })
		}

		// The default page keeps the layout bundle (which registers the
		// selected surface); a surface page swaps in exactly that surface's
		// module instead (LT-284).
		let testScript = '/assets/main.js'
		if (surface) {
			const componentDir = componentPath.substring(
				0,
				componentPath.lastIndexOf('/'),
			)
			const modulePath = await resolveSurfaceModule(
				componentName,
				componentDir,
				surface,
			)
			if (!modulePath) {
				return new Response(
					`Surface "${surface}" is not available for component "${componentName}"`,
					{ status: 404 },
				)
			}
			testScript = `/test/${componentName}/surface.js?surface=${surface}`
		}

		const componentContent = await Bun.file(componentPath).text()
		const layoutName = getLayoutForPath(`/test/${componentName}`)
		const layoutContent = await getCachedLayout(
			`${layoutName}.html`,
			development,
		)
		let finalContent = replaceTemplateVariables(layoutContent, {
			content: componentContent,
			title: componentName,
			version: pkg.version,
			// The test layout shares `{{ lang }}` with the page layouts
			// (LT-174); an unreplaced key renders `lang=""`, which is worse
			// than the default it stands in for.
			lang: DEFAULT_LOCALE,
			'test-script': testScript,
		})

		// Inject HMR script in development
		finalContent = injectHMRScript(finalContent, development)

		return new Response(finalContent, {
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'no-cache, no-store, must-revalidate',
			},
		})
	} catch (error) {
		console.error('Error generating component test response:', error)
		return new Response('Internal server error', { status: 500 })
	}
}

const handleStaticFile = async (
	filePath: string,
	development: boolean,
): Promise<Response> => {
	// Directories pass existsSync but fail in sendfile — treat as not found
	if (!fileExists(filePath) || isDirectory(filePath)) return notFound()

	try {
		// For HTML files in development, inject HMR script
		if (development && filePath.endsWith('.html')) {
			const content = await Bun.file(filePath).text()
			const enhancedContent = injectHMRScript(content, development)
			return new Response(enhancedContent, {
				headers: {
					'Content-Type': 'text/html; charset=utf-8',
					'Cache-Control': 'no-cache, no-store, must-revalidate',
				},
			})
		}

		return new Response(Bun.file(filePath))
	} catch (error) {
		console.error('Error serving static file:', error)
		return new Response('Internal server error', { status: 500 })
	}
}

/**
 * Guard a resolved file path against directory traversal.
 * Returns null if the path escapes the expected base directory.
 */
const guardPath = (baseDir: string, resolvedPath: string): string | null =>
	getRelativePath(baseDir, resolvedPath) !== null ? resolvedPath : null

const acceptsMarkdown = (req: Request): boolean =>
	(req.headers.get('Accept') || '').includes('text/markdown')

/**
 * Whether a first path segment names one of the built locales (LT-174).
 *
 * Pages live under `docs/<locale>/`, so a request for `/de/guide.html` has to
 * be told apart from a request for a root-level file. Anything not in
 * `LOCALES` falls through to the un-prefixed routes, which still serve the
 * locale-independent trees (assets, api, examples, sources).
 */
const isLocale = (segment: string): boolean =>
	(LOCALES as readonly string[]).includes(segment)

const handleMarkdownSource = async (
	pageName: string,
): Promise<Response | null> => {
	const mdPath = guardPath(PAGES_DIR, getFilePath(PAGES_DIR, `${pageName}.md`))
	if (!mdPath || !fileExists(mdPath)) return null
	return new Response(Bun.file(mdPath), {
		headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
	})
}

/* === Route Matching === */

// Segment kinds double as precedence ranks: at the first segment where two
// matching patterns differ, static beats `:param` beats `*` — Bun's router
// order, reproduced so the table below means what it meant under `routes`.
const STATIC = 0
const PARAM = 1
const WILDCARD = 2

type Segment = { kind: number; value: string }

type CompiledRoute = { segments: Segment[]; handle: RouteHandler }

const splitPath = (path: string): string[] =>
	path === '/' ? [] : path.slice(1).split('/')

const compileRoute = (
	pattern: string,
	handle: RouteHandler,
): CompiledRoute => ({
	segments: splitPath(pattern).map(part =>
		part === '*'
			? { kind: WILDCARD, value: part }
			: part.startsWith(':')
				? { kind: PARAM, value: part.slice(1) }
				: { kind: STATIC, value: part },
	),
	handle,
})

const comparePrecedence = (a: CompiledRoute, b: CompiledRoute): number => {
	const length = Math.min(a.segments.length, b.segments.length)
	for (let i = 0; i < length; i++) {
		const diff = (a.segments[i]?.kind ?? 0) - (b.segments[i]?.kind ?? 0)
		if (diff) return diff
	}
	return b.segments.length - a.segments.length
}

/**
 * Match a raw (still percent-encoded) path against a pattern. Params are
 * decoded like Bun's `req.params`, so an encoded `..%2f` reaches the
 * handlers' traversal guards as `../`; a wildcard takes the rest of the
 * path, at least one segment. Null on no match or a malformed escape.
 */
const matchRoute = (
	route: CompiledRoute,
	parts: string[],
): RouteParams | null => {
	const params: RouteParams = {}
	for (const [i, segment] of route.segments.entries()) {
		if (segment.kind === WILDCARD) return i < parts.length ? params : null
		const part = parts[i]
		if (part === undefined) return null
		if (segment.kind === STATIC) {
			if (part !== segment.value) return null
			continue
		}
		if (!part) return null
		try {
			params[segment.value] = decodeURIComponent(part)
		} catch {
			return null
		}
	}
	return route.segments.length === parts.length ? params : null
}

/* === Request Handler === */

/**
 * Build the docs server's request handler: every route but the `/ws`
 * upgrade, which needs the `Server` and stays in `serve.ts` (LT-364). Pure
 * over `Request → Response`, so tests drive it without binding a socket.
 */
const createRequestHandler = ({
	development,
}: RequestHandlerOptions): RequestHandler => {
	const serveFile = (filePath: string) =>
		handleStaticFile(filePath, development)

	const routes: Record<string, RouteHandler> = {
		'/api/status': () => new Response('OK'),

		// `serve.ts` upgrades `/ws` itself in development; any request that
		// reaches the handler has no live socket to hand over.
		'/ws': () =>
			development
				? new Response('WebSocket upgrade failed', { status: 400 })
				: new Response('Not available in production', { status: 404 }),

		// Static assets (wildcard to support subdirectories like img/avatar/)
		'/assets/*': req => {
			const assetPath = new URL(req.url).pathname.slice('/assets/'.length)
			const filePath = guardPath(ASSETS_DIR, getFilePath(ASSETS_DIR, assetPath))
			return filePath ? serveFile(filePath) : notFound()
		},

		// Example component's source code
		'/examples/:component': (_, { component = '' }) => {
			const filePath = guardPath(
				EXAMPLES_DIR,
				getFilePath(EXAMPLES_DIR, component),
			)
			return filePath ? serveFile(filePath) : notFound()
		},

		// Source code fragments for documentation
		'/sources/:file': (_, { file = '' }) => {
			const filePath = guardPath(SOURCES_DIR, getFilePath(SOURCES_DIR, file))
			return filePath ? serveFile(filePath) : notFound()
		},

		// Component tests mock files
		'/test/:component/mocks/:mock': (_, { component = '', mock = '' }) => {
			const filePath = findMockFilePath(component, mock)
			return filePath ? serveFile(filePath) : notFound()
		},

		// A variant set component's per-surface client bundle (LT-284):
		// the full layout graph with the component's module swapped for the
		// requested surface's. The page references it; specs hit it only
		// through the page.
		'/test/:component/surface.js': (req, { component = '' }) => {
			const query = new URL(req.url).searchParams.get('surface')
			return handleSurfaceModule(component, effectiveSurface(query))
		},

		// Component tests. `?surface=ts|tsrx|tsx` (LT-284, ADR 0039 s2)
		// selects which spelling of a variant set the page registers; the
		// TEST_SURFACE env override (the spec matrix runner) applies when
		// the query is absent. Without either, the page is unchanged.
		'/test/:component': (req, { component = '' }) => {
			const query = new URL(req.url).searchParams.get('surface')
			return handleComponentTest(
				component,
				effectiveSurface(query),
				development,
			)
		},

		// Not found for test routes
		'/test/*': notFound,

		// API documentation fragments (lazy-loaded by listnav)
		'/api/:category/:page': (_, { category = '', page = '' }) => {
			const filePath = guardPath(
				OUTPUT_DIR,
				getFilePath(OUTPUT_DIR, 'api', category, page),
			)
			return filePath ? serveFile(filePath) : notFound()
		},

		// Individual blog post pages, inside a locale tree. A `.md` suffix
		// serves the markdown mirror that sits next to the page (LT-174):
		// static hosts serve it at this URL directly, so the dev server
		// does too instead of force-suffixing `.html` (LT-198).
		'/:locale/blog/:slug': (_, { locale = '', slug = '' }) => {
			if (!isLocale(locale)) return notFound()
			const localeBlogDir = getFilePath(OUTPUT_DIR, locale, 'blog')
			const name = slug.endsWith('.md')
				? slug
				: `${slug.replace(/\.html$/, '')}.html`
			const filePath = guardPath(
				localeBlogDir,
				getFilePath(localeBlogDir, name),
			)
			return filePath ? serveFile(filePath) : notFound()
		},

		// Documentation pages, inside a locale tree (`/de/guide.html`).
		// The locale is a PATH PREFIX, not a negotiated header: the page was
		// rendered for it at build time (ADR 0030 sub-design 1), so there is
		// exactly one file to serve and no content negotiation to do.
		'/:locale/:page': async (req, { locale = '', page = '' }) => {
			if (!isLocale(locale)) return notFound()
			const localeDir = getFilePath(OUTPUT_DIR, locale)
			if (acceptsMarkdown(req)) {
				const mdResponse = await handleMarkdownSource(
					page.replace(/\.html$/, ''),
				)
				if (mdResponse) return mdResponse
			}
			const filePath = guardPath(localeDir, getFilePath(localeDir, page))
			if (!filePath) return notFound()

			// Extensionless page URLs (/en/examples, /en/blog) redirect to
			// the page itself. Before LT-174 this fired only where a
			// same-named DIRECTORY happened to sit next to the page — an
			// accident of the output layout, which the locale split removed
			// for api/ and examples/ (their fragments stayed at the root).
			// Keyed on the missing extension instead, it is a property of
			// the URL rather than of what else got written nearby.
			if (!page.includes('.') || isDirectory(filePath)) {
				const name = page.replace(/\.html$/, '')
				if (fileExists(getFilePath(localeDir, `${name}.html`)))
					return new Response(null, {
						status: 301,
						headers: { Location: `/${locale}/${name}.html` },
					})
				return notFound()
			}
			return serveFile(filePath)
		},

		// A bare locale root serves that locale's index
		'/:locale': (_, { locale = '' }) => {
			if (!isLocale(locale)) return notFound()
			return serveFile(getFilePath(OUTPUT_DIR, locale, 'index.html'))
		},

		// Serve favicon
		'/favicon.ico': () => serveFile(getFilePath(OUTPUT_DIR, 'favicon.ico')),

		// The root redirect stub the pages effect writes — what a static
		// host serves for `/`, kept reachable by its own URL too.
		'/index.html': () => serveFile(getFilePath(OUTPUT_DIR, 'index.html')),

		// Index — every page now lives under a locale prefix, so the site
		// root is a redirect rather than a page. 302, not 301: which locale
		// is "default" is a build decision (config's LOCALES[0]) that may
		// change, and a permanently cached redirect would outlive it.
		'/': async req => {
			if (acceptsMarkdown(req)) {
				const mdResponse = await handleMarkdownSource('index')
				if (mdResponse) return mdResponse
			}
			return new Response(null, {
				status: 302,
				headers: { Location: `/${DEFAULT_LOCALE}/index.html` },
			})
		},
	}

	const compiled = Object.entries(routes)
		.map(([pattern, handle]) => compileRoute(pattern, handle))
		.sort(comparePrecedence)

	return async req => {
		const parts = splitPath(new URL(req.url).pathname)
		for (const route of compiled) {
			const params = matchRoute(route, parts)
			if (params) return route.handle(req, params)
		}
		return notFound()
	}
}

export {
	clearLayoutCache,
	createRequestHandler,
	getLayoutForPath,
	readEnvSurface,
}
