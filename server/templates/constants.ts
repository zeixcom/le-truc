/**
 * Template Constants
 *
 * Shared constants and configuration values used across all templates.
 * Centralizes common values to improve consistency and maintainability.
 */

// Common HTML attributes and values
export const COMMON_ATTRIBUTES = {
	VISUALLY_HIDDEN: 'visually-hidden',
	ROLE_TAB: 'tab',
	ROLE_TABPANEL: 'tabpanel',
	ROLE_TABLIST: 'tablist',
	ARIA_SELECTED: 'aria-selected',
	ARIA_CONTROLS: 'aria-controls',
	ARIA_LABELLEDBY: 'aria-labelledby',
} as const

// Self-closing HTML tags that don't need closing tags
export const SELF_CLOSING_TAGS = [
	'img',
	'br',
	'hr',
	'input',
	'meta',
	'link',
	'area',
	'base',
	'col',
	'embed',
	'source',
	'track',
	'wbr',
] as const

// Resource type mappings for performance hints
export const RESOURCE_TYPE_MAP = {
	'.css': 'style',
	'.js': 'script',
	'.mjs': 'script',
	'.woff': 'font',
	'.woff2': 'font',
	'.jpg': 'image',
	'.jpeg': 'image',
	'.png': 'image',
	'.gif': 'image',
	'.webp': 'image',
	'.avif': 'image',
	'.svg': 'image',
} as const

// Default resource type for unknown extensions
export const DEFAULT_RESOURCE_TYPE = 'fetch'

// File extensions that require crossorigin attribute
export const CROSSORIGIN_EXTENSIONS = ['.woff', '.woff2'] as const

// Common validation patterns
export const VALIDATION_PATTERNS = {
	HEX_HASH: /^[a-f0-9]+$/,
	URL_PATH: /^\/[a-zA-Z0-9\-_/.]*$/,
	HTML_FILENAME: /^[a-zA-Z0-9\-_]+\.html$/,
	CSS_FILENAME: /^[a-zA-Z0-9\-_]+\.css$/,
	JS_FILENAME: /^[a-zA-Z0-9\-_]+\.(js|mjs)$/,
} as const

// Minimum hash lengths for different use cases
export const MIN_HASH_LENGTHS = {
	ASSET_HASH: 8,
	CACHE_BUST: 6,
	CONTENT_HASH: 12,
} as const

// Default cache configuration
export const DEFAULT_CACHE_CONFIG = {
	TIMEOUT: 86400000, // 24 hours in milliseconds
	MAX_AGE: 31536000, // 1 year in seconds
	STALE_WHILE_REVALIDATE: 3600000, // 1 hour in milliseconds
} as const

// Service worker event types
export const SERVICE_WORKER_EVENTS = {
	INSTALL: 'install',
	ACTIVATE: 'activate',
	FETCH: 'fetch',
	MESSAGE: 'message',
} as const

// Service worker caching strategies
export const CACHING_STRATEGIES = {
	CACHE_FIRST: 'cache-first',
	NETWORK_FIRST: 'network-first',
	STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
	NETWORK_ONLY: 'network-only',
	CACHE_ONLY: 'cache-only',
} as const

// Default static assets for service worker
export const DEFAULT_STATIC_ASSETS = ['/', '/index.html'] as const

// Common sitemap priorities
export const SITEMAP_PRIORITIES = {
	HOME: '1.0',
	ROOT_PAGE: '0.8',
	API_OVERVIEW: '0.7',
	BLOG_POST: '0.6',
	DEFAULT: '0.5',
} as const

// XML namespaces
export const XML_NAMESPACES = {
	SITEMAP: 'http://www.sitemaps.org/schemas/sitemap/0.9',
	XHTML: 'http://www.w3.org/1999/xhtml',
	ATOM: 'http://www.w3.org/2005/Atom',
} as const

// Template error messages
export const ERROR_MESSAGES = {
	MISSING_REQUIRED_FIELD: (field: string) => `${field} is required`,
	INVALID_TYPE: (field: string, expected: string) =>
		`${field} must be of type ${expected}`,
	INVALID_FORMAT: (field: string, format: string) =>
		`${field} must match format: ${format}`,
	DUPLICATE_FOUND: (field: string, value: string) =>
		`Duplicate ${field}: ${value}`,
	EMPTY_ARRAY: (field: string) => `${field} cannot be empty`,
	INVALID_RANGE: (field: string, min: number, max?: number) =>
		max !== undefined
			? `${field} must be between ${min} and ${max}`
			: `${field} must be at least ${min}`,
	TEMPLATE_GENERATION_FAILED: (template: string) =>
		`Failed to generate ${template} template`,
	VALIDATION_FAILED: (template: string, errors: string[]) =>
		`${template} validation failed: ${errors.join(', ')}`,
} as const

// Development environment constants
export const DEVELOPMENT_CONFIG = {
	ENABLE_LOGGING: process.env.NODE_ENV === 'development',
	ENABLE_VALIDATION: process.env.NODE_ENV === 'development',
	ENABLE_PERFORMANCE_MONITORING: process.env.NODE_ENV === 'development',
	MAX_TEMPLATE_LENGTH_FOR_LOGGING: 200,
} as const

// Template generation metadata
export const TEMPLATE_METADATA = {
	GENERATOR: 'Le Truc Template System',
	VERSION: '1.0.0',
	GENERATION_TIMESTAMP: () => new Date().toISOString(),
	AUTO_GENERATED_WARNING: 'Auto-generated - do not edit manually',
} as const

// Common HTML elements and structures
export const HTML_ELEMENTS = {
	BUTTON: 'button',
	NAV: 'nav',
	SECTION: 'section',
	ARTICLE: 'article',
	HEADER: 'header',
	MAIN: 'main',
	FOOTER: 'footer',
	DIV: 'div',
	SPAN: 'span',
	PARAGRAPH: 'p',
	HEADING_1: 'h1',
	HEADING_2: 'h2',
	HEADING_3: 'h3',
	ORDERED_LIST: 'ol',
	UNORDERED_LIST: 'ul',
	LIST_ITEM: 'li',
	ANCHOR: 'a',
} as const

// Template performance thresholds
export const PERFORMANCE_THRESHOLDS = {
	MAX_RENDER_TIME_MS: 100,
	MAX_TEMPLATE_SIZE_BYTES: 1024 * 1024, // 1MB
	MAX_ARRAY_LENGTH: 1000,
	WARNING_RENDER_TIME_MS: 50,
} as const

// Common CSS classes used in templates
export const CSS_CLASSES = {
	VISUALLY_HIDDEN: 'visually-hidden',
	ACTIVE: 'active',
	SELECTED: 'selected',
	DISABLED: 'disabled',
	HIDDEN: 'hidden',
	ERROR: 'error',
	WARNING: 'warning',
	SUCCESS: 'success',
	ICON: 'icon',
	META: 'meta',
	COPY: 'copy',
	SECONDARY: 'secondary',
	SMALL: 'small',
	TOC: 'toc',
} as const

// Environment-specific configurations
export const ENVIRONMENT_CONFIG = {
	PRODUCTION: {
		MINIFY_OUTPUT: true,
		REMOVE_COMMENTS: true,
		REMOVE_DEBUG_LOGS: true,
		ENABLE_COMPRESSION: true,
	},
	DEVELOPMENT: {
		MINIFY_OUTPUT: false,
		REMOVE_COMMENTS: false,
		REMOVE_DEBUG_LOGS: false,
		ENABLE_COMPRESSION: false,
		PRETTY_PRINT: true,
		ADD_DEBUG_INFO: true,
	},
	TEST: {
		MINIFY_OUTPUT: false,
		REMOVE_COMMENTS: false,
		REMOVE_DEBUG_LOGS: false,
		ENABLE_COMPRESSION: false,
		MOCK_TIMESTAMPS: true,
	},
} as const

// Get environment-specific config
export function getEnvironmentConfig() {
	const env = process.env.NODE_ENV || 'development'
	switch (env) {
		case 'production':
			return ENVIRONMENT_CONFIG.PRODUCTION
		case 'test':
			return ENVIRONMENT_CONFIG.TEST
		default:
			return ENVIRONMENT_CONFIG.DEVELOPMENT
	}
}
