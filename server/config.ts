/**
 * Development server configuration
 */
const BASE_URL = 'https://zeixcom.github.io/le-truc'

// Path constants
const SRC_DIR = './src'

const COMPONENTS_DIR = './examples'
const CSS_FILE = './examples/main.css'
const TS_FILE = './examples/main.ts'

const TEMPLATES_DIR = './server/templates'

const INPUT_DIR = './docs-src'
const PAGES_DIR = './docs-src/pages'
const API_DIR = './docs-src/api'
const LAYOUTS_DIR = './docs-src/layouts'
const INCLUDES_DIR = './docs-src/includes'
const MENU_FILE = './docs-src/includes/menu.html'

const OUTPUT_DIR = './docs'
const ASSETS_DIR = './docs/assets'
const EXAMPLES_DIR = './docs/examples'
const SOURCES_DIR = './docs/sources'
const SITEMAP_FILE = './docs/sitemap.xml'

// Page ordering configuration
const PAGE_ORDER = [
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
export const CONTENT_MARKER = '{{ content }}'

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
const SERVER_CONFIG = {
	PORT: 3000,
	HOST: 'localhost',
	ENABLE_HMR: true,
	ENABLE_COMPRESSION: true,
	DEPENDENCY_TIMEOUT: 50,
} as const

// MIME types for static file serving
const MIME_TYPES = {
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
const COMPRESSIBLE_TYPES = [
	'.html',
	'.css',
	'.js',
	'.json',
	'.xml',
	'.svg',
	'.txt',
] as const

export {
	BASE_URL,
	SRC_DIR,
	COMPONENTS_DIR,
	CSS_FILE,
	TS_FILE,
	TEMPLATES_DIR,
	INPUT_DIR,
	EXAMPLES_DIR,
	PAGES_DIR,
	API_DIR,
	LAYOUTS_DIR,
	INCLUDES_DIR,
	MENU_FILE,
	OUTPUT_DIR,
	ASSETS_DIR,
	SOURCES_DIR,
	SITEMAP_FILE,
	PAGE_ORDER,
	SERVER_CONFIG,
	COMPRESSIBLE_TYPES,
	MIME_TYPES,
}
