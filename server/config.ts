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
// The tsrx effect's gitignored compile output (server/effects/compile.ts);
// migrated components' generated clients are bundle inputs for main.ts
// (LT-091), so the js effect watches this directory for rebuilds.
const GENERATED_CLIENTS_DIR = join(ROOT, 'server/generated/components')

const INPUT_DIR = join(ROOT, 'docs-src')
const PAGES_DIR = join(ROOT, 'docs-src/pages')
const API_DIR = join(ROOT, 'docs-src/api')
const LAYOUTS_DIR = join(ROOT, 'docs-src/layouts')
const INCLUDES_DIR = join(ROOT, 'docs-src/includes')
const STATIC_DIR = join(ROOT, 'docs-src/static')

const OUTPUT_DIR = join(ROOT, 'docs')
const ASSETS_DIR = join(ROOT, 'docs/assets')
const EXAMPLES_DIR = join(ROOT, 'docs/examples')
const SOURCES_DIR = join(ROOT, 'docs/sources')
const TEST_DIR = join(ROOT, 'docs/test')
const SITEMAP_FILE = join(ROOT, 'docs/sitemap.xml')
const LLMS_TXT_FILE = join(ROOT, 'docs/llms.txt')
const LLMS_FULL_TXT_FILE = join(ROOT, 'docs/llms-full.txt')

/**
 * The locales the docs site is built for (ADR 0030 sub-design 1, LT-174).
 *
 * Every entry produces one complete page tree under `docs/<locale>/`, and the
 * locale is fixed BEFORE rendering begins — that build-time-constant property
 * is load-bearing, not an infrastructure preference: it is what lets `Intl`
 * fold (LT-142) and keeps i18n components on the Folded tier (ADR 0029). A
 * request-time locale would unfold every `Intl` call and push the whole i18n
 * corpus to the Simulated tier.
 *
 * The FIRST entry is the default locale — the one `/` redirects to and the one
 * the source strings are written in (`SOURCE_LOCALE` in effects/i18n.ts).
 * Adding a locale here costs one more page tree; measured at ~1.5 s per locale
 * (LT-175), because only PAGES multiply — see `LOCALE_INDEPENDENT_DIRS`.
 */
const LOCALES = ['en', 'de'] as const

type Locale = (typeof LOCALES)[number]

/** The locale `/` redirects to, and the source locale of the inline strings. */
const DEFAULT_LOCALE: Locale = LOCALES[0]

/**
 * Output subdirectories that stay SINGLE-COPY at the docs root rather than
 * multiplying per locale (LT-174).
 *
 * These hold generated reference content — TypeDoc API fragments, component
 * example fragments, source-code fragments — which is lazy-loaded by
 * `module-lazyload` rather than navigated to, and which no catalog can
 * translate: it is derived from `src/` and `examples/` verbatim. Duplicating
 * it per locale would copy byte-identical output at ~2.3 s per locale
 * (LT-175's per-stage figures: apiPages 731 ms + examples 1597 ms) for no
 * translatable difference.
 *
 * Pages under a locale prefix reference these one level up; `localeAssetPath`
 * is the path math that gets them there.
 */
const LOCALE_INDEPENDENT_DIRS = [
	'api',
	'examples',
	'sources',
	'assets',
] as const

/**
 * Path from a page at `depth` inside a locale tree back to the DOCS ROOT.
 *
 * A page at `docs/<locale>/guide.html` is depth 0 and needs `../` to reach
 * `docs/`; `docs/<locale>/blog/post.html` is depth 1 and needs `../../`. This
 * is the `{{ base-path }}` layout variable — assets, `llms.txt`, and the
 * locale-independent fragment directories all hang off the docs root.
 */
const localeAssetPath = (depth: number): string => '../'.repeat(depth + 1)

/**
 * Rewrite a page's references to locale-independent fragment directories so
 * they resolve from inside the locale tree (LT-174).
 *
 * Authored content links fragments page-relatively (`./api/functions/abort.html`,
 * `./examples/basic-button.html`) and `module-lazyload` fetches them relative to
 * the page URL. Once the page lives at `docs/<locale>/api.html`, that resolves to
 * `/<locale>/api/...`, which does not exist — the fragments stayed at the root.
 * Rewriting the reference to `../api/...` puts it back on the single copy.
 *
 * Deliberately a build-pipeline transform over generated HTML rather than an
 * authoring change: `docs-src/` content should not have to know that a locale
 * prefix exists. Same class of transform as `resolveInternalLinks`.
 */
const rewriteFragmentRefs = (html: string, depth: number): string => {
	const up = localeAssetPath(depth)
	const dirs = LOCALE_INDEPENDENT_DIRS.join('|')
	return html.replace(
		new RegExp(`((?:href|src|value)=")\\./(${dirs})/`, 'g'),
		(_, attr: string, dir: string) => `${attr}${up}${dir}/`,
	)
}

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

export type { Locale }

export {
	ADR_DIR,
	API_DIR,
	ASSETS_DIR,
	BASE_URL,
	CHAPTERS,
	COMPONENTS_DIR,
	COMPRESSIBLE_TYPES,
	CSS_FILE,
	DEFAULT_LOCALE,
	EXAMPLES_DIR,
	GENERATED_CLIENTS_DIR,
	INCLUDES_DIR,
	INPUT_DIR,
	LAYOUTS_DIR,
	LLMS_FULL_TXT_FILE,
	LLMS_TXT_FILE,
	LOCALE_INDEPENDENT_DIRS,
	LOCALES,
	localeAssetPath,
	MENU_GROUPS,
	MIME_TYPES,
	OUTPUT_DIR,
	PAGE_ORDER,
	PAGES_DIR,
	ROOT,
	rewriteFragmentRefs,
	SERVER_CONFIG,
	SITEMAP_FILE,
	SOURCES_DIR,
	SRC_DIR,
	STATIC_DIR,
	TEMPLATES_DIR,
	TEST_DIR,
	TS_FILE,
}
