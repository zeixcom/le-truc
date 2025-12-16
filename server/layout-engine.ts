import {
	CONTENT_MARKER,
	INCLUDES_DIR,
	LAYOUTS_DIR,
	LAYOUT_PATHS,
	getLayoutForRoute,
	type LayoutConfig,
} from './config'
import { fileExists, getFileContent, getFilePath } from './io'

interface TemplateContext extends Record<string, string | undefined> {
	content?: string
	title?: string
	section?: string
	'base-path'?: string
	'css-hash'?: string
	'js-hash'?: string
}

/**
 * Layout engine for handling different template types and content injection
 */
export class LayoutEngine {
	private layouts = new Map<string, LayoutConfig>()
	private layoutCache = new Map<string, string>()
	private includeCache = new Map<string, string>()

	constructor(layouts: LayoutConfig[]) {
		for (const layout of layouts) {
			this.layouts.set(layout.name, layout)
		}
	}

	/**
	 * Get layout configuration for a route
	 */
	getLayoutForRoute(path: string): string {
		return getLayoutForRoute(path)
	}

	/**
	 * Load layout content from file (with caching)
	 */
	async loadLayout(layoutName: string): Promise<string> {
		if (this.layoutCache.has(layoutName)) {
			return this.layoutCache.get(layoutName)!
		}

		const config = this.layouts.get(layoutName)
		if (!config) {
			// Fallback to predefined layout paths
			const layoutPath = LAYOUT_PATHS[layoutName as keyof typeof LAYOUT_PATHS]
			if (layoutPath && fileExists(layoutPath)) {
				const content = await getFileContent(layoutPath)
				this.layoutCache.set(layoutName, content)
				return content
			}
			throw new Error(`Layout '${layoutName}' not found`)
		}

		if (!fileExists(config.path)) {
			throw new Error(`Layout file not found: ${config.path}`)
		}

		const layoutContent = await getFileContent(config.path)
		this.layoutCache.set(layoutName, layoutContent)
		return layoutContent
	}

	/**
	 * Load include file content (with caching)
	 */
	async loadInclude(filename: string): Promise<string> {
		if (this.includeCache.has(filename)) {
			return this.includeCache.get(filename)!
		}

		try {
			const includeContent = await getFileContent(
				getFilePath(INCLUDES_DIR, filename),
			)
			this.includeCache.set(filename, includeContent)
			return includeContent
		} catch (error) {
			console.warn(`Failed to load include ${filename}:`, error)
			return ''
		}
	}

	/**
	 * Process includes in template content
	 */
	async processIncludes(html: string): Promise<string> {
		const includeRegex = /{{\s*include\s+'([^']+)'\s*}}/g
		let result = html
		let match: RegExpExecArray | null

		const includePromises: Promise<void>[] = []

		while ((match = includeRegex.exec(html)) !== null) {
			const [fullMatch, filename] = match

			const promise = this.loadInclude(filename).then(includeContent => {
				result = result.replace(fullMatch, includeContent)
			})

			includePromises.push(promise)
		}

		await Promise.all(includePromises)
		return result
	}

	/**
	 * Replace template variables in content
	 */
	replaceTemplateVariables(content: string, context: TemplateContext): string {
		return content.replace(/{{\s*([\w\-]+)\s*}}/g, (_, key) => {
			const trimmedKey = key.trim()
			return context[trimmedKey] || ''
		})
	}

	/**
	 * Render content with specified layout
	 *
	 * Supports layout inheritance via a directive in the child layout:
	 *   {{ extends 'base.html' }}
	 *
	 * When a child layout extends a base, the child may provide a <head> fragment,
	 * an optional <title>, and a <body> fragment (inner content). The base layout
	 * must include placeholders for `{{ head }}`, `{{ body-class }}`, `{{ title }}` and `{{ content }}`.
	 *
	 * The algorithm:
	 *  - load child layout
	 *  - process includes in child
	 *  - if child contains an extends directive:
	 *     - extract child's <head>, <title>, body class and inner body
	 *     - load parent/base layout and process its includes
	 *     - inject child's head into parent's `{{ head }}` placeholder
	 *     - merge child's body class into parent's `{{ body-class }}` placeholder
	 *     - if child provides <title>, override parent's `{{ title }}`
	 *     - set `content` to the child's inner body (or provided content if child has none)
	 */
	async renderWithLayout(
		layoutName: string,
		content: string,
		context: TemplateContext = {},
	): Promise<string> {
		const config = this.layouts.get(layoutName)

		// Load layout content (child)
		let layoutContent = await this.loadLayout(layoutName)

		// Process includes in child first
		layoutContent = await this.processIncludes(layoutContent)

		// Detect extends directive (e.g. {{ extends 'base.html' }})
		const extendsMatch = layoutContent.match(/{{\s*extends\s+'([^']+)'\s*}}/)

		// If we have an extends directive, merge child into parent
		if (extendsMatch) {
			// Remove the extends directive from the child markup
			layoutContent = layoutContent.replace(extendsMatch[0], '')

			// Extract child's head (if any)
			const headMatch = layoutContent.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
			const childHead = headMatch ? headMatch[1].trim() : ''

			// Extract child's title (if any)
			const titleMatch = layoutContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
			const childTitle = titleMatch ? titleMatch[1].trim() : ''

			// Extract child's body inner content and optional body class
			let childBodyInner = ''
			let childBodyClass = ''
			const bodyMatch = layoutContent.match(/<body([^>]*)>([\s\S]*?)<\/body>/i)
			if (bodyMatch) {
				const bodyAttrs = bodyMatch[1] || ''
				childBodyInner = bodyMatch[2].trim()
				const classMatch = bodyAttrs.match(/class=["']([^"']+)["']/i)
				if (classMatch) {
					childBodyClass = classMatch[1].trim()
				}
			} else {
				// If the child layout did not include explicit <body>, treat the whole
				// layoutContent (after removing head/title) as the inner content.
				// Remove any head/title fragments from layoutContent to get inner.
				let withoutHead = layoutContent.replace(
					/<head[^>]*>[\s\S]*?<\/head>/i,
					'',
				)
				withoutHead = withoutHead.replace(/<title[^>]*>[\s\S]*?<\/title>/i, '')
				childBodyInner = withoutHead.trim()
			}

			// Resolve parent path. Try mapping from LAYOUT_PATHS using base name,
			// otherwise assume the extends value is a filename in LAYOUTS_DIR.
			const extendsValue = extendsMatch[1] // e.g. 'base.html' or 'page.html'
			const parentKey = Object.keys(LAYOUT_PATHS).find(
				k =>
					LAYOUT_PATHS[k as keyof typeof LAYOUT_PATHS].endsWith(
						`/${extendsValue}`,
					)
					|| LAYOUT_PATHS[k as keyof typeof LAYOUT_PATHS].endsWith(
						`\\${extendsValue}`,
					),
			)
			let parentPath: string
			if (parentKey) {
				parentPath = LAYOUT_PATHS[parentKey as keyof typeof LAYOUT_PATHS]
			} else {
				parentPath = getFilePath(LAYOUTS_DIR, extendsValue)
			}

			// Load parent layout
			let parentLayout = ''
			try {
				parentLayout = await getFileContent(parentPath)
			} catch (err) {
				throw new Error(
					`Failed to load parent layout '${extendsValue}' at ${parentPath}: ${String(err)}`,
				)
			}

			// Process includes in parent
			parentLayout = await this.processIncludes(parentLayout)

			// Inject child's head into parent's {{ head }} placeholder if present,
			// otherwise append to <head> contents of parent.
			if (parentLayout.includes('{{ head }}')) {
				parentLayout = parentLayout.replace(/{{\s*head\s*}}/g, childHead || '')
			} else {
				// Try to inject into parent's <head> if exists
				parentLayout = parentLayout.replace(
					/(<head[^>]*>)([\s\S]*?)(<\/head>)/i,
					(_m, open, existing, close) => {
						const joined = [existing || '', childHead || '']
							.filter(Boolean)
							.join('\n')
						return `${open}${joined}${close}`
					},
				)
			}

			// Override parent's title if child provides one
			if (childTitle) {
				parentLayout = parentLayout.replace(/{{\s*title\s*}}/g, childTitle)
				// Also replace any literal <title>...</title> occurrences
				parentLayout = parentLayout.replace(
					/<title[^>]*>[\s\S]*?<\/title>/i,
					`<title>${childTitle}</title>`,
				)
			}

			// Merge body-class: replace parent's placeholder if present, otherwise
			// try to inject into parent's <body> tag.
			if (parentLayout.includes('{{ body-class }}')) {
				parentLayout = parentLayout.replace(
					/{{\s*body-class\s*}}/g,
					childBodyClass || '',
				)
			} else {
				parentLayout = parentLayout.replace(/<body([^>]*)>/i, (_m, attrs) => {
					// If parent already has a class attr, preserve it and append child's classes
					const existingClassMatch = attrs.match(/class=["']([^"']+)["']/i)
					let newAttrs = attrs
					if (existingClassMatch) {
						const existing = existingClassMatch[1].trim()
						const combined = [existing, childBodyClass]
							.filter(Boolean)
							.join(' ')
						newAttrs = attrs.replace(
							existingClassMatch[0],
							`class="${combined}"`,
						)
					} else if (childBodyClass) {
						newAttrs = `${attrs} class="${childBodyClass}"`
					}
					return `<body${newAttrs}>`
				})
			}

			// Final parent layout becomes the effective layout, and child's inner body
			// becomes the content to render.
			layoutContent = parentLayout

			// Process template variables in child content before merging
			const childContent = childBodyInner || content
			const tempContext = {
				...this.getDefaultContext(),
				...context,
				content, // Original content passed to the function
			}
			const processedChildContent = this.replaceTemplateVariables(
				childContent,
				tempContext,
			)
			content = processedChildContent
		}

		// Prepare full context with content
		const fullContext = {
			...this.getDefaultContext(),
			...context,
			content,
		}

		// If the requested layout configuration is explicitly simple, use marker replacement.
		if (config?.type === 'simple') {
			const marker = config.contentMarker || CONTENT_MARKER
			return layoutContent.replace(marker, content)
		}

		// Default: perform template variable replacement
		return this.replaceTemplateVariables(layoutContent, fullContext)
	}

	/**
	 * Auto-detect and render with appropriate layout for route
	 */
	async renderForRoute(
		path: string,
		content: string,
		context: TemplateContext = {},
	): Promise<string> {
		const layoutName = this.getLayoutForRoute(path)
		return this.renderWithLayout(layoutName, content, context)
	}

	/**
	 * Get default context values
	 */
	private getDefaultContext(): Record<string, string> {
		return {
			'base-path': '',
			'css-hash': this.generateAssetHash('css'),
			'js-hash': this.generateAssetHash('js'),
			section: '',
			title: 'Le Truc',
			description: 'Web component framework built on reactive signals',
		}
	}

	/**
	 * Generate asset hash for cache busting
	 */
	private generateAssetHash(type: 'css' | 'js'): string {
		// Simple timestamp-based hash for development
		// In production, this would read the actual file hash
		return Date.now().toString(36)
	}

	/**
	 * Clear all caches (useful for development)
	 */
	clearCache(): void {
		this.layoutCache.clear()
		this.includeCache.clear()
	}

	/**
	 * Add or update layout configuration
	 */
	addLayout(config: LayoutConfig): void {
		this.layouts.set(config.name, config)
		// Clear cached layout if it exists
		this.layoutCache.delete(config.name)
	}

	/**
	 * Remove layout configuration
	 */
	removeLayout(name: string): void {
		this.layouts.delete(name)
		this.layoutCache.delete(name)
	}

	/**
	 * Get all available layout names
	 */
	getAvailableLayouts(): string[] {
		return Array.from(this.layouts.keys()).concat(Object.keys(LAYOUT_PATHS))
	}

	/**
	 * Validate layout configuration
	 */
	static validateConfig(config: LayoutConfig): string[] {
		const errors: string[] = []

		if (!config.name) {
			errors.push('Layout name is required')
		}

		if (!config.path) {
			errors.push('Layout path is required')
		}

		if (!['simple', 'template'].includes(config.type)) {
			errors.push('Layout type must be "simple" or "template"')
		}

		if (!config.contentMarker) {
			errors.push('Content marker is required')
		}

		return errors
	}
}

/**
 * Default layout configurations
 */
export const DEFAULT_LAYOUTS: LayoutConfig[] = [
	{
		name: 'page',
		path: LAYOUT_PATHS.page,
		type: 'template',
		contentMarker: CONTENT_MARKER,
		defaultContext: {
			section: 'docs',
		},
	},
	{
		name: 'test',
		path: LAYOUT_PATHS.test,
		type: 'template',
		contentMarker: CONTENT_MARKER,
		defaultContext: {
			section: 'test',
		},
	},
	{
		name: 'api',
		path: LAYOUT_PATHS.api,
		type: 'template',
		contentMarker: CONTENT_MARKER,
		defaultContext: {
			section: 'api',
		},
	},
	{
		name: 'example',
		path: LAYOUT_PATHS.example,
		type: 'template',
		contentMarker: CONTENT_MARKER,
		defaultContext: {
			section: 'examples',
		},
	},
	{
		name: 'blog',
		path: LAYOUT_PATHS.blog,
		type: 'template',
		contentMarker: CONTENT_MARKER,
		defaultContext: {
			section: 'blog',
		},
	},
	{
		name: 'overview',
		path: LAYOUT_PATHS.overview,
		type: 'template',
		contentMarker: CONTENT_MARKER,
		defaultContext: {
			section: 'overview',
		},
	},
]
