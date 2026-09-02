import { join } from 'path'

/**
 * Development server configuration
 */
const BASE_URL = 'https://zeixcom.github.io/le-truc'

// Absolute path to project root — avoids relying on process.chdir
const ROOT = join(import.meta.dir, '..')

// Path constants
const SRC_DIR = join(ROOT, 'src')
const ADR_DIR = join(ROOT, 'adr')

const COMPONENTS_DIR = join(ROOT, 'examples')
const CSS_FILE = join(ROOT, 'examples/main.css')
const TS_FILE = join(ROOT, 'examples/main.ts')

const TEMPLATES_DIR = join(ROOT, 'server/templates')

const INPUT_DIR = join(ROOT, 'docs-src')
const PAGES_DIR = join(ROOT, 'docs-src/pages')
const API_DIR = join(ROOT, 'docs-src/api')
const LAYOUTS_DIR = join(ROOT, 'docs-src/layouts')
const INCLUDES_DIR = join(ROOT, 'docs-src/includes')
const STATIC_DIR = join(ROOT, 'docs-src/static')

const OUTPUT_DIR = join(ROOT, 'docs')
const ASSETS_DIR = join(ROOT, 'docs/assets')
const BLOG_OUTPUT_DIR = join(ROOT, 'docs/blog')
const EXAMPLES_DIR = join(ROOT, 'docs/examples')
const SOURCES_DIR = join(ROOT, 'docs/sources')
const TEST_DIR = join(ROOT, 'docs/test')
const SITEMAP_FILE = join(ROOT, 'docs/sitemap.xml')
const LLMS_TXT_FILE = join(ROOT, 'docs/llms.txt')
const LLMS_FULL_TXT_FILE = join(ROOT, 'docs/llms-full.txt')

// Page ordering configuration
const PAGE_ORDER = [
	'index',
	'getting-started',
	'components',
	'props',
	'effects',
	'styling',
	'accessibility',
	'extensions',
	'data-flow',
	'lists',
	'async',
	'context',
	'examples',
	'api',
	'blog',
	'about',
]

/**
 * Guide chapters — pages grouped under a heading in the sidebar menu and
 * linked by a prev/next stepper on every member page.
 * Member slugs must appear in PAGE_ORDER; the group heading renders
 * before the first member present in the menu.
 */
const CHAPTERS = [
	{
		title: 'Building Components',
		pages: [
			'components',
			'props',
			'effects',
			'styling',
			'accessibility',
			'extensions',
		],
	},
	{
		title: 'Coordinating Components',
		pages: ['data-flow', 'lists', 'async', 'context'],
	},
] as const

/**
 * Sidebar menu groups — every root page belongs to exactly one group,
 * rendered as a heading in the sidebar in this order. The two guide
 * chapters double as menu groups (same title, same page list as
 * CHAPTERS); the other groups are sidebar-only and carry no stepper.
 * Member slugs must appear in PAGE_ORDER; each group's members should be
 * contiguous in it so the heading renders once, before the first member.
 */
const MENU_GROUPS = [
	{
		title: 'Get Started',
		pages: ['index', 'getting-started'],
	},
	{
		title: CHAPTERS[0].title,
		pages: CHAPTERS[0].pages,
	},
	{
		title: CHAPTERS[1].title,
		pages: CHAPTERS[1].pages,
	},
	{
		title: 'Reference',
		pages: ['examples', 'api'],
	},
	{
		title: 'Community',
		pages: ['blog', 'about'],
	},
] as const

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
	ADR_DIR,
	API_DIR,
	ASSETS_DIR,
	BASE_URL,
	BLOG_OUTPUT_DIR,
	CHAPTERS,
	COMPONENTS_DIR,
	COMPRESSIBLE_TYPES,
	CSS_FILE,
	EXAMPLES_DIR,
	INCLUDES_DIR,
	INPUT_DIR,
	LAYOUTS_DIR,
	LLMS_FULL_TXT_FILE,
	LLMS_TXT_FILE,
	MENU_GROUPS,
	MIME_TYPES,
	OUTPUT_DIR,
	PAGE_ORDER,
	PAGES_DIR,
	ROOT,
	SERVER_CONFIG,
	SITEMAP_FILE,
	SOURCES_DIR,
	SRC_DIR,
	STATIC_DIR,
	TEMPLATES_DIR,
	TEST_DIR,
	TS_FILE,
}
