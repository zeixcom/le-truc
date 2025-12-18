import {
	CONTENT_MARKER,
	LAYOUTS_DIR,
	LAYOUT_PATHS,
	ROUTE_LAYOUT_MAP,
} from './config'
import { includeFiles, layoutFiles } from './file-signals'
import { getFileContent, getFilePath } from './io'

/* === Types === */

export type LayoutConfig = {
	name: string
	path: string
	defaultContext?: Record<string, string>
}

type TemplateContext = {
	content?: string
	title?: string
	section?: string
	'base-path'?: string
	'css-hash'?: string
	'js-hash'?: string
}

/* === Internal Stuff === */

const getDefaultContext = (): Record<string, string> => {
	const assetHash = Date.now().toString(36)
	return {
		'base-path': '',
		'css-hash': assetHash,
		'js-hash': assetHash,
		section: '',
		title: 'Le Truc',
		description: 'Web component framework built on reactive signals',
	}
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

/* === Exported Functions === */

const getLayoutForRoute = (path: string): keyof typeof LAYOUT_PATHS => {
	for (const [routePrefix, layoutName] of Object.entries(ROUTE_LAYOUT_MAP)) {
		if (path.startsWith(routePrefix)) {
			return layoutName as keyof typeof LAYOUT_PATHS
		}
	}
	return 'page' // Default fallback
}

const processIncludes = (html: string): string => {
	const includeRegex = /{{\s*include\s+'([^']+)'\s*}}/g
	let result = html
	let match: RegExpExecArray | null

	while ((match = includeRegex.exec(html)) !== null) {
		const [fullMatch, filename] = match

		const includeContent = includeFiles[filename] ?? ''
		result.replace(fullMatch, includeContent)
	}
	return result
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
const renderWithLayout = async (
	path: string,
	content: string,
	context: TemplateContext = {},
): Promise<string> => {
	const layoutName = getLayoutForRoute(path)

	// Load layout content (child)
	const layoutPath = getFilePath(LAYOUTS_DIR, `${layoutName}.html`)
	let layoutContent = layoutFiles[layoutPath]

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
			if (classMatch) childBodyClass = classMatch[1].trim()
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
		const parentPath = parentKey
			? LAYOUT_PATHS[parentKey as keyof typeof LAYOUT_PATHS]
			: getFilePath(LAYOUTS_DIR, extendsValue)

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
		parentLayout = processIncludes(parentLayout)

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
					const combined = [existing, childBodyClass].filter(Boolean).join(' ')
					newAttrs = attrs.replace(existingClassMatch[0], `class="${combined}"`)
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
			...getDefaultContext(),
			...context,
			content, // Original content passed to the function
		}
		const processedChildContent = replaceTemplateVariables(
			childContent,
			tempContext,
		)
		content = processedChildContent
	}

	// Prepare full context with content
	const fullContext = {
		...getDefaultContext(),
		...context,
		content,
	}

	// Default: perform template variable replacement
	return replaceTemplateVariables(layoutContent, fullContext)
}
