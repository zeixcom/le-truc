import Markdoc from '@markdoc/markdoc'
import {
	createComputed,
	type List,
	type Memo,
	type Task,
} from '@zeix/cause-effect'
import { codeToHtml } from 'shiki'
import {
	// API_DIR,
	COMPONENTS_DIR,
	// INCLUDES_DIR,
	INPUT_DIR,
	// LAYOUTS_DIR,
	PAGES_DIR,
	SRC_DIR,
	TEMPLATES_DIR,
} from './config'
import { watchFiles } from './file-watcher'
import { getRelativePath } from './io'
import markdocConfig from './markdoc.config'
import { postProcessHtml } from './markdoc-helpers'

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
	section?: string
}

export type PageMetadata = {
	title?: string
	description?: string
	emoji?: string
	url?: string
	section?: string
	order?: number
	draft?: boolean
	tags?: string[]
	created?: Date
	updated?: Date
}

export type ProcessedMarkdownFile = FileInfo & {
	metadata: PageMetadata
	processedContent: string
	htmlContent: string
	section?: string
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
		const yamlContent = match[1]
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

		return { metadata, content: match[2] }
	} catch (error) {
		console.warn(`Failed to parse frontmatter in content:`, error)
		return { metadata: {}, content: match[2] || content }
	}
}

/* === Exported Signals === */

const docsMarkdown: {
	sources: List<FileInfo>
	processed: Memo<Map<string, FileInfo & { metadata: PageMetadata }>>
	pageInfos: Memo<PageInfo[]>
	fullyProcessed: Task<Map<string, ProcessedMarkdownFile>>
} = await (async () => {
	const sources = await watchFiles(PAGES_DIR, '**/*.md')

	const processed = createComputed(() => {
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

	const pageInfos = createComputed(() => {
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
				section: relativePath.includes('/') ? relativePath.split('/')[0] : '',
			})
		}
		return pageInfos
	})

	const fullyProcessed = createComputed(async () => {
		const files = processed.get()

		const processedFiles = new Map<string, ProcessedMarkdownFile>()

		for (const [path, file] of files) {
			try {
				// Calculate relative path from pages directory
				const pagesDir = PAGES_DIR.replace(/^\.\//, '')
				const relativePath = path
					.replace(PAGES_DIR + '/', '')
					.replace(pagesDir + '/', '')
					.replace(/\\/g, '/')

				// Calculate path info
				const pathParts = relativePath.split('/')
				const section = pathParts.length > 1 ? pathParts[0] : undefined
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

				// Transform the AST
				const transformed = Markdoc.transform(ast, markdocConfig)

				// Render to HTML
				let htmlContent = Markdoc.renderers.html(transformed)

				// Remove automatic <article> wrapper added by Markdoc
				htmlContent = htmlContent.replace(
					/^<article>([\s\S]*)<\/article>$/m,
					'$1',
				)

				// Process code blocks with syntax highlighting
				const codeBlockRegex =
					/<pre data-language="([^"]*)" data-code="([^"]*)"><code class="language-[^"]*">[\s\S]*?<\/code><\/pre>/g
				let match: RegExpExecArray | null

				while ((match = codeBlockRegex.exec(htmlContent)) !== null) {
					const [fullMatch, lang, encodedCode] = match

					// Decode HTML entities
					const code = encodedCode
						.replace(/&quot;/g, '"')
						.replace(/&#39;/g, "'")
						.replace(/&lt;/g, '<')
						.replace(/&gt;/g, '>')
						.replace(/&amp;/g, '&')

					try {
						const highlighted = await codeToHtml(code, {
							lang: lang || 'text',
							theme: 'monokai',
						})

						htmlContent = htmlContent.replace(fullMatch, highlighted)
					} catch (error) {
						console.warn(`Failed to highlight ${lang} code block:`, error)
						// Keep the original code block as fallback
					}
				}

				// Process module-demo components with raw HTML
				htmlContent = htmlContent.replace(
					/<module-demo([^>]*) preview-html="([^"]*)"([^>]*)>([\s\S]*?)<\/module-demo>/g,
					(fullMatch, beforeAttrs, encodedHtml, afterAttrs, content) => {
						// Decode HTML entities that may have been encoded
						const previewHtml = encodedHtml
							.replace(/&quot;/g, '"')
							.replace(/&#39;/g, "'")
							.replace(/&lt;/g, '<')
							.replace(/&gt;/g, '>')
							.replace(/&amp;/g, '&')
							.replace(/>\s{2,}</g, '><')
							.replace(/\s{2,}/g, ' ')
							.trim()

						// Build the complete module-demo structure
						const previewDiv = `<div class="preview">${previewHtml}</div>`
						return `<module-demo${beforeAttrs}${afterAttrs}>${previewDiv}${content}</module-demo>`
					},
				)

				// Post-process HTML (fix links, wrap API content)
				htmlContent = postProcessHtml(htmlContent, section)

				// Extract title
				let title = frontmatter.title
				if (!title && section === 'api') {
					const headingMatch = processedContent.match(
						/^#\s+(Function|Type Alias|Variable):\s*(.+?)(?:\(\))?$/m,
					)
					if (headingMatch) {
						title = headingMatch[2].trim()
					} else {
						const fallbackMatch = processedContent.match(/^#\s+(.+)$/m)
						if (fallbackMatch) {
							title = fallbackMatch[1].replace(/\(.*?\)$/, '').trim()
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

const docsStyles = {
	sources: await watchFiles(INPUT_DIR, '*.css'),
}

const docsScripts = {
	sources: await watchFiles(INPUT_DIR, '*.ts'),
}

/* const layoutFiles = {
	sources: await watchFiles(LAYOUTS_DIR, '*.html'),
}

const includeFiles = {
	sources: await watchFiles(INCLUDES_DIR, '*.html'),
} */

const templateScripts = {
	sources: await watchFiles(TEMPLATES_DIR, '**/*.ts'),
}

const libraryScripts = {
	sources: await watchFiles(SRC_DIR, '**/*.ts'),
}

/* const apiMarkdown = {
	sources: await watchFiles(API_DIR, '** /*.md'),
} */

const componentMarkup = {
	sources: await watchFiles(COMPONENTS_DIR, '**/*.html', '**/mocks/**'),
}

const componentMarkdown = {
	sources: await watchFiles(COMPONENTS_DIR, '**/*.md'),
}

const componentStyles = {
	sources: await watchFiles(COMPONENTS_DIR, '**/*.css'),
}

const componentScripts = {
	sources: await watchFiles(COMPONENTS_DIR, '**/*.ts'),
}

export {
	// apiMarkdown,
	componentMarkdown,
	componentMarkup,
	componentScripts,
	componentStyles,
	docsMarkdown,
	docsScripts,
	docsStyles,
	// includeFiles,
	// layoutFiles,
	libraryScripts,
	templateScripts,
}
