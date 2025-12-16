/**
 * Development server configuration
 */
export const BASE_URL = 'https://zeixcom.github.io/le-truc'

// Path constants
export const SRC_DIR = './src'

export const COMPONENTS_DIR = './examples'
export const CSS_FILE = './examples/main.css'
export const TS_FILE = './examples/main.ts'

export const TEMPLATES_DIR = './server/templates'

export const INPUT_DIR = './docs-src'
export const PAGES_DIR = './docs-src/pages'
export const API_DIR = './docs-src/api'
export const LAYOUT_FILE = './docs-src/layout.html'
export const INCLUDES_DIR = './docs-src/includes'
export const MENU_FILE = './docs-src/includes/menu.html'

export const OUTPUT_DIR = './docs'
export const ASSETS_DIR = './docs/assets'
export const EXAMPLES_DIR = './docs/examples'
export const SITEMAP_FILE = './docs/sitemap.xml'

// Page ordering configuration
export const PAGE_ORDER = [
	'index',
	'getting-started',
	'components',
	'styling',
	'data-flow',
	'examples',
	'api',
	'blog',
	'about',
]

// Layout system configuration
export const LAYOUTS_DIR = './server/layouts'
export const CONTENT_MARKER = '{{ content }}'

// Layout file paths
export const LAYOUT_PATHS = {
	page: `${LAYOUTS_DIR}/page.html`,
	test: `${LAYOUTS_DIR}/test.html`,
	api: `${LAYOUTS_DIR}/api.html`,
	example: `${LAYOUTS_DIR}/example.html`,
	blog: `${LAYOUTS_DIR}/blog.html`,
	overview: `${LAYOUTS_DIR}/overview.html`,
} as const

// Route patterns for automatic layout selection
export const ROUTE_LAYOUT_MAP = {
	'/test/': 'test',
	'/api/classes/': 'api',
	'/api/functions/': 'api',
	'/api/type-aliases/': 'api',
	'/api/variables/': 'api',
	'/examples/': 'example',
	'/blog/': 'blog',
	'/api/': 'overview', // API overview
	'/examples': 'overview', // Examples overview
	'/blog': 'overview', // Blog index
	'/': 'page', // Default pages
} as const

// Server configuration
export const SERVER_CONFIG = {
	PORT: 3000,
	HOST: 'localhost',
	ENABLE_HMR: true,
	ENABLE_COMPRESSION: true,
	DEPENDENCY_TIMEOUT: 50,
} as const

// Layout configuration interface
export interface LayoutConfig {
	name: string
	path: string
	type: 'simple' | 'template'
	contentMarker: string
	defaultContext?: Record<string, string>
}

// MIME types for static file serving
export const MIME_TYPES = {
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
} as const

// Compressible file types
export const COMPRESSIBLE_TYPES = [
	'.html',
	'.css',
	'.js',
	'.json',
	'.xml',
	'.svg',
	'.txt',
] as const

// Helper function to get layout for route
export function getLayoutForRoute(path: string): keyof typeof LAYOUT_PATHS {
	for (const [routePrefix, layoutName] of Object.entries(ROUTE_LAYOUT_MAP)) {
		if (path.startsWith(routePrefix)) {
			return layoutName as keyof typeof LAYOUT_PATHS
		}
	}
	return 'page' // Default fallback
}
