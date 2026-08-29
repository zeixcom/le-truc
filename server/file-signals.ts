import Markdoc from '@markdoc/markdoc'
import { deriveCell, type List, type Signal } from '@zeix/cause-effect'
import {
	API_DIR,
	COMPONENTS_DIR,
	// INCLUDES_DIR,
	GENERATED_CLIENTS_DIR,
	INPUT_DIR,
	// LAYOUTS_DIR,
	PAGES_DIR,
	SRC_DIR,
	TEMPLATES_DIR,
} from './config'
import { type WatchedFiles, watchFiles } from './file-watcher'
import {
	highlightCodeBlocks,
	injectModuleDemoPreview,
	injectTableOfContents,
	resolveInternalLinks,
} from './html-shaping'
import { getRelativePath } from './io'
import markdocConfig from './markdoc.config'
import { extractTocItems } from './markdoc-helpers'

/* === Types === */

export type FileInfo = {
	path: string
	filename: string
	content: string
	hash: string
	lastModified: number
	size: number
	exists: boolean
}

export type PageInfo = {
	title: string
	emoji: string
	description: string
	url: string
	filename: string
	relativePath: string
	lastModified: number
	section: string | undefined
}

export type PageMetadata = {
	title?: string
	description?: string
	emoji?: string
	section?: string
	layout?: string
	order?: number
	draft?: boolean
	tags?: string[]
	date?: string
	author?: string
	'modified-date'?: string
	'author-avatar'?: string
	'author-bio'?: string
}

export type ProcessedMarkdownFile = FileInfo & {
	metadata: PageMetadata
	processedContent: string
	htmlContent: string
	section: string | undefined
	depth: number
	relativePath: string
	basePath: string
	title: string
}

/* === Internal Functions === */

function extractFrontmatter(content: string): {
	metadata: PageMetadata
	content: string
} {
	const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
	const match = content.match(frontmatterRegex)

	if (!match) {
		return { metadata: {}, content }
	}

	try {
		// Simple YAML-like parsing for basic frontmatter
		const yamlContent = match[1]!
		const metadata: PageMetadata = {}

		const lines = yamlContent.split('\n')
		for (const line of lines) {
			const colonIndex = line.indexOf(':')
			if (colonIndex === -1) continue

			const key = line.slice(0, colonIndex).trim()
			const value = line
				.slice(colonIndex + 1)
				.trim()
				.replace(/^['"]|['"]$/g, '')

			// Parse common metadata fields
			switch (key) {
				case 'title':
				case 'description':
				case 'emoji':
				case 'section':
				case 'layout':
				case 'date':
				case 'author':
				case 'author-avatar':
				case 'author-bio':
				case 'modified-date':
					metadata[key] = value
					break
				case 'order':
					metadata.order = parseInt(value, 10)
					break
				case 'draft':
					metadata.draft = value === 'true'
					break
				case 'tags':
					metadata.tags = value.split(',').map(t => t.trim())
					break
			}
		}

		return { metadata, content: match[2]! }
	} catch (error) {
		console.warn(`Failed to parse frontmatter in content:`, error)
		return { metadata: {}, content: match[2] || content }
	}
}

/* === Exported Signals === */

const docsMarkdown: {
	sources: WatchedFiles
	processed: Signal<Map<string, FileInfo & { metadata: PageMetadata }>>
	pageInfos: Signal<PageInfo[]>
	fullyProcessed: Signal<Map<string, ProcessedMarkdownFile>>
} = await (async () => {
	const sources = await watchFiles(PAGES_DIR, '**/*.md')

	const processed = deriveCell(() => {
		const rawFiles = sources.get()

		const files = new Map<string, FileInfo & { metadata: PageMetadata }>()
		for (const fileInfo of rawFiles) {
			if (!fileInfo) continue
			const { metadata, content } = extractFrontmatter(fileInfo.content)
			files.set(fileInfo.path, {
				...fileInfo,
				content, // Content without frontmatter
				metadata,
			})
		}
		return files
	})

	const pageInfos = deriveCell(() => {
		const pageInfos: PageInfo[] = []
		const files = processed.get()

		for (const [path, file] of files) {
			const relativePath = getRelativePath(PAGES_DIR, path)
			if (!relativePath) continue
			pageInfos.push({
				url: relativePath.replace('.md', '.html'),
				title: file.metadata.title || file.filename.replace('.md', ''),
				emoji: file.metadata.emoji || '📄',
				description: file.metadata.description || '',
				filename: file.filename,
				relativePath,
				lastModified: file.lastModified,
				section: relativePath.includes('/')
					? (relativePath.split('/')[0] ?? '')
					: undefined,
			})
		}
		return pageInfos
	})

	const fullyProcessed = deriveCell(async () => {
		const files = processed.get()

		const processedFiles = new Map<string, ProcessedMarkdownFile>()

		for (const [path, file] of files) {
			try {
				// Calculate relative path from pages directory
				const relativePath = getRelativePath(PAGES_DIR, path)?.replace(
					/\\/g,
					'/',
				)
				if (!relativePath) continue

				// Calculate path info
				const pathParts = relativePath.split('/')
				const section = pathParts.length > 1 ? pathParts[0]! : undefined
				const depth = pathParts.length - 1
				const basePath = depth > 0 ? '../'.repeat(depth) : './'

				// Extract frontmatter and content
				const { metadata: frontmatter, content } = file

				// Clean API content (remove everything above first H1)
				let processedContent = content
				if (section === 'api') {
					const h1Match = content.match(/^(#\s+.+)$/m)
					if (h1Match) {
						const h1Index = content.indexOf(h1Match[0])
						processedContent = content.substring(h1Index)
					}
				}

				// Parse with Markdoc
				const ast = Markdoc.parse(processedContent)

				// Validate the document
				const errors = Markdoc.validate(ast, markdocConfig)
				if (errors.length > 0) {
					console.warn(`Markdoc validation errors for ${path}:`, errors)
				}

				// Transform the AST (pass basePath and toc headings for template use)
				const toc = extractTocItems(ast)
				const transformed = Markdoc.transform(ast, {
					...markdocConfig,
					variables: { basePath, toc },
				})

				// Render to HTML
				let htmlContent = Markdoc.renderers.html(transformed)

				// Remove automatic <article> wrapper added by Markdoc
				htmlContent = htmlContent.replace(
					/^<article>([\s\S]*)<\/article>$/m,
					'$1',
				)

				// Apply shared HTML shaping for code fences and demo previews.
				htmlContent = await highlightCodeBlocks(htmlContent)
				htmlContent = injectModuleDemoPreview(htmlContent)
				htmlContent = resolveInternalLinks(htmlContent, basePath)
				htmlContent = injectTableOfContents(htmlContent, toc)

				// Extract title
				let title = frontmatter.title
				if (!title && section === 'api') {
					const headingMatch = processedContent.match(
						/^#\s+(Function|Type Alias|Variable):\s*(.+?)(?:\(\))?$/m,
					)
					if (headingMatch) {
						title = headingMatch[2]!.trim()
					} else {
						const fallbackMatch = processedContent.match(/^#\s+(.+)$/m)
						if (fallbackMatch) {
							title = fallbackMatch[1]!.replace(/\(.*?\)$/, '').trim()
						}
					}
				}

				processedFiles.set(path, {
					...file,
					processedContent,
					htmlContent,
					section,
					depth,
					relativePath,
					basePath,
					title: title || 'Untitled',
				})
			} catch (error) {
				console.error(`Failed to process markdown file ${path}:`, error)
			}
		}

		return processedFiles
	})

	return {
		sources,
		processed,
		pageInfos,
		fullyProcessed,
	}
})()

const [
	docsStylesSources,
	docsScriptsSources,
	templateScriptsSources,
	libraryScriptsSources,
	apiMarkdownSources,
	componentMarkupSources,
	componentMocksSources,
	componentMarkdownSources,
	componentStylesSources,
	componentScriptsSources,
	componentTsrxSources,
	generatedClientScriptsSources,
] = await Promise.all([
	watchFiles(INPUT_DIR, '*.css'),
	watchFiles(INPUT_DIR, '*.ts'),
	watchFiles(TEMPLATES_DIR, '**/*.ts'),
	watchFiles(SRC_DIR, '**/*.ts'),
	watchFiles(API_DIR, '**/*.md'),
	watchFiles(COMPONENTS_DIR, '**/*.html', '**/mocks/**'), // componentMarkup excludes mocks (handled separately below)
	watchFiles(COMPONENTS_DIR, '**/mocks/**'), // componentMocks: only mock files excluded from componentMarkup
	watchFiles(COMPONENTS_DIR, '**/*.md'),
	watchFiles(COMPONENTS_DIR, '**/*.css'),
	watchFiles(COMPONENTS_DIR, '**/*.ts'),
	watchFiles(COMPONENTS_DIR, '**/*.tsrx'),
	// LT-091: migrated components' generated clients are bundle inputs
	// (examples/main.ts imports them) — a `.tsrx` edit re-runs the compiler
	// effect, which rewrites these files, which must re-trigger the js
	// bundle. Tolerates the directory not existing yet on a fresh checkout
	// (the tsrx effect creates it in phase 1 before anything reads it).
	watchFiles(GENERATED_CLIENTS_DIR, '*.client.ts'),
])

/* const layoutFiles = {
	sources: await watchFiles(LAYOUTS_DIR, '*.html'),
}

const includeFiles = {
	sources: await watchFiles(INCLUDES_DIR, '*.html'),
} */

const docsStyles = { sources: docsStylesSources }
const docsScripts = { sources: docsScriptsSources }
const templateScripts = { sources: templateScriptsSources }
const libraryScripts = { sources: libraryScriptsSources }
const apiMarkdown = { sources: apiMarkdownSources }
const componentMarkup = { sources: componentMarkupSources }
const componentMocks = { sources: componentMocksSources }
const componentMarkdown = { sources: componentMarkdownSources }
const componentStyles = { sources: componentStylesSources }
const componentScripts = { sources: componentScriptsSources }
const componentTsrx = { sources: componentTsrxSources }
const generatedClientScripts = { sources: generatedClientScriptsSources }

export {
	apiMarkdown,
	componentMarkdown,
	componentMarkup,
	componentMocks,
	componentScripts,
	componentStyles,
	componentTsrx,
	docsMarkdown,
	docsScripts,
	docsStyles,
	generatedClientScripts,
	// includeFiles,
	// layoutFiles,
	libraryScripts,
	templateScripts,
}
