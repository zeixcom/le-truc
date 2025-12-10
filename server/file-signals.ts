import {
	type Computed,
	createComputed,
	type Store,
	UNSET,
} from '@zeix/cause-effect'
import matter from 'gray-matter'
import { marked } from 'marked'
import { codeToHtml } from 'shiki'
import {
	COMPONENTS_DIR,
	INPUT_DIR,
	PAGES_DIR,
	SRC_DIR,
	TEMPLATES_DIR,
} from './config'
import { watchFiles } from './file-watcher'
import { extractFrontmatter, getRelativePath } from './io'
import { generateSlug } from './templates/utils'
import type {
	CodeBlock,
	FileInfo,
	PageInfo,
	PageMetadata,
	ProcessedMarkdownFile,
} from './types'

// Configure marked for GitHub Flavored Markdown
marked.setOptions({
	gfm: true,
	breaks: true,
})

const createCodeBlockPlaceholder = (index: number): string =>
	`__CODE_BLOCK_PLACEHOLDER_${index}__`

const createCodeBlockMap = (codeBlocks: CodeBlock[]): Map<string, string> => {
	const map = new Map<string, string>()
	codeBlocks.forEach((block, index) => {
		const placeholder = createCodeBlockPlaceholder(index)
		const html = `<module-codeblock language="${block.header}" copy-success="Copied!" copy-error="Error trying to copy to clipboard!">${block.highlightedCode}</module-codeblock>`
		map.set(placeholder, html)
	})
	return map
}

const transformCodeBlocks = async (
	markdown: string,
): Promise<{
	processedMarkdown: string
	codeBlockMap: Map<string, string>
}> => {
	const codeBlocks: CodeBlock[] = []
	let processedMarkdown = markdown
	const codeBlockRegex = /```(\w+)(?:\s\(([^)]+)\))?\n(.*?)```/gs
	let match: RegExpExecArray | null

	while ((match = codeBlockRegex.exec(markdown)) !== null) {
		const [fullMatch, lang, filename, code] = match
		const header = filename ? `${lang} (${filename})` : lang

		try {
			const highlighted = await codeToHtml(code, {
				lang,
				theme: 'monokai',
			})

			codeBlocks.push({ header, code, highlightedCode: highlighted })
			const placeholder = createCodeBlockPlaceholder(codeBlocks.length - 1)
			processedMarkdown = processedMarkdown.replace(fullMatch, placeholder)
		} catch (error) {
			console.warn(`Failed to highlight ${lang} code block:`, error)
		}
	}

	return {
		processedMarkdown,
		codeBlockMap: createCodeBlockMap(codeBlocks),
	}
}

export const markdownFiles: {
	sources: Store<Record<string, FileInfo>>
	processed: Computed<Map<string, FileInfo & { metadata: PageMetadata }>>
	pageInfos: Computed<PageInfo[]>
	fullyProcessed: Computed<Map<string, ProcessedMarkdownFile>>
} = (() => {
	const sources = watchFiles(PAGES_DIR, {
		recursive: true,
		extensions: ['.md'],
		ignore: ['README.md'],
	})

	const processed = createComputed(async () => {
		const rawFiles = sources.get()
		if (rawFiles === UNSET) return UNSET

		const files = new Map<string, FileInfo & { metadata: PageMetadata }>()
		for (const path in rawFiles) {
			const fileInfo = rawFiles[path]
			if (!fileInfo) continue
			const { metadata, content } = extractFrontmatter(fileInfo.content)
			files.set(path, {
				...fileInfo,
				content, // Content without frontmatter
				metadata,
			})
		}
		return files
	})

	const pageInfos = createComputed(async () => {
		const pageInfos: PageInfo[] = []
		const files = processed.get()
		if (files === UNSET) return UNSET

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
		if (files === UNSET) return UNSET

		const processedFiles = new Map<string, ProcessedMarkdownFile>()

		for (const [path, file] of files) {
			try {
				// Calculate relative path from pages directory
				const pagesDir = PAGES_DIR.replace(/^\.\//, '')
				const relativePath = path
					.replace(PAGES_DIR + '/', '')
					.replace(pagesDir + '/', '')
					.replace(/\\/g, '/')

				// Parse frontmatter again to get clean content
				const { data: frontmatter, content } = matter(file.content)

				// Calculate path info
				const pathParts = relativePath.split('/')
				const section = pathParts.length > 1 ? pathParts[0] : undefined
				const depth = pathParts.length - 1
				const basePath = depth > 0 ? '../'.repeat(depth) : './'

				// Clean API content (remove everything above first H1)
				let processedContent = content
				if (section === 'api') {
					const h1Match = content.match(/^(#\s+.+)$/m)
					if (h1Match) {
						const h1Index = content.indexOf(h1Match[0])
						processedContent = content.substring(h1Index)
					}
				}

				// Transform code blocks
				const { processedMarkdown, codeBlockMap } =
					await transformCodeBlocks(processedContent)

				// Convert markdown to HTML
				let htmlContent = await marked.parse(processedMarkdown)

				// Add permalinks to headings
				htmlContent = htmlContent.replace(
					/<h([1-6])>(.+?)<\/h[1-6]>/g,
					(_, level, text) => {
						const textForSlug = text
							.replace(/&quot;/g, '"')
							.replace(/&#39;/g, "'")
							.replace(/&amp;/g, '&')
						const slug = generateSlug(textForSlug)
						return `<h${level} id="${slug}">
							<a name="${slug}" class="anchor" href="#${slug}">
								<span class="permalink">🔗</span>
								<span class="title">${text}</span>
							</a>
						</h${level}>`
					},
				)

				// Fix internal links (.md -> .html)
				htmlContent = htmlContent.replace(
					/href="([^"]*\.md)"/g,
					(_, href) => `href="${href.replace(/\.md$/, '.html')}"`,
				)

				// Replace code block placeholders
				codeBlockMap.forEach((code, placeholder) => {
					htmlContent = htmlContent.replace(
						new RegExp(`(<p>\\s*${placeholder}\\s*</p>)`, 'g'),
						code,
					)
				})

				// Wrap API pages
				if (section === 'api') {
					htmlContent = `<section class="api-content">\n${htmlContent}\n</section>`
				}

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

export const libraryScripts = (() => {
	const sources = watchFiles(SRC_DIR, {
		recursive: true,
		extensions: ['.ts'],
	})

	return {
		sources,
	}
})()

export const docsScripts = (() => {
	const sources = watchFiles(INPUT_DIR, {
		recursive: false,
		extensions: ['.ts'],
	})

	return {
		sources,
	}
})()

export const componentScripts = (() => {
	const sources = watchFiles(COMPONENTS_DIR, {
		recursive: true,
		extensions: ['.ts'],
	})

	return {
		sources,
	}
})()

export const templateScripts = (() => {
	const sources = watchFiles(TEMPLATES_DIR, {
		recursive: true,
		extensions: ['.ts'],
	})

	return {
		sources,
	}
})()

export const docsStyles = (() => {
	const sources = watchFiles(INPUT_DIR, {
		recursive: false,
		extensions: ['.css'],
	})

	return {
		sources,
	}
})()

export const componentStyles = (() => {
	const sources = watchFiles(COMPONENTS_DIR, {
		recursive: true,
		extensions: ['.css'],
	})

	return {
		sources,
	}
})()

export const componentMarkup = (() => {
	const sources = watchFiles(COMPONENTS_DIR, {
		recursive: true,
		extensions: ['.html'],
		ignore: ['-test.html'],
	})

	return {
		sources,
	}
})()
