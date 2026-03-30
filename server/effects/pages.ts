import { createEffect, match } from '@zeix/cause-effect'
import pkg from '../../package.json'
import { ASSETS_DIR, INCLUDES_DIR, LAYOUTS_DIR, OUTPUT_DIR } from '../config'
import { docsMarkdown, type ProcessedMarkdownFile } from '../file-signals'
import {
	calculateFileHash,
	getFileContent,
	getFilePath,
	writeFileSafe,
} from '../io'
import { performanceHints } from '../templates/performance-hints'
import { escapeHtml, generateSlug } from '../templates/utils'

/* === Internal Functionals === */

const getAssetHashes = async (): Promise<{ css: string; js: string }> => {
	try {
		const [cssContent, jsContent] = await Promise.all([
			getFileContent(getFilePath(ASSETS_DIR, 'main.css')),
			getFileContent(getFilePath(ASSETS_DIR, 'main.js')),
		])
		return {
			css: calculateFileHash(cssContent),
			js: calculateFileHash(jsContent),
		}
	} catch {
		return { css: 'dev', js: 'dev' }
	}
}

const loadIncludes = async (html: string): Promise<string> => {
	const includeRegex = /{{\s*include\s+'(.+?)'\s*}}/g

	// Collect all matches with their positions first, then apply replacements
	// from right to left so earlier offsets remain valid.
	const replacements: { start: number; end: number; replacement: string }[] = []
	let match: RegExpExecArray | null

	while ((match = includeRegex.exec(html)) !== null) {
		const [fullMatch, filename = ''] = match
		try {
			const includeContent = await getFileContent(
				getFilePath(INCLUDES_DIR, filename),
			)
			replacements.push({
				start: match.index,
				end: match.index + fullMatch.length,
				replacement: includeContent,
			})
		} catch (error) {
			console.warn(`Failed to load include ${filename}:`, error)
			replacements.push({
				start: match.index,
				end: match.index + fullMatch.length,
				replacement: '',
			})
		}
	}

	// Apply replacements right-to-left so earlier positions stay valid.
	let result = html
	for (let i = replacements.length - 1; i >= 0; i--) {
		const { start, end, replacement } = replacements[i]!
		result = result.slice(0, start) + replacement + result.slice(end)
	}

	return result
}

const API_KIND_MAP: Record<string, string> = {
	functions: 'Function',
	classes: 'Class',
	'type-aliases': 'Type Alias',
	variables: 'Variable',
	interfaces: 'Interface',
	enumerations: 'Enumeration',
}

/** Extract h2/h3 headings from HTML and build a nav list for TOC */
const buildToc = (htmlContent: string): string => {
	const headingRegex = /<h([23])[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h[23]>/gi
	const items: string[] = []
	let match: RegExpExecArray | null
	while ((match = headingRegex.exec(htmlContent)) !== null) {
		const level = match[1]!
		const id = escapeHtml(match[2]!)
		// Normalize whitespace in heading text, then HTML-escape what remains
		const rawText = match[3]!.replace(/\s+/g, ' ').trim()
		const text = escapeHtml(rawText)
		const indent = level === '3' ? ' style="padding-left:1rem"' : ''
		items.push(`<a href="#${id}"${indent}>${text}</a>`)
	}
	return items.length > 0 ? `<nav>${items.join('\n')}</nav>` : ''
}

/** Compute api-category, api-name, api-kind for api layout pages */
const getApiVariables = (
	relativePath: string,
): { 'api-category': string; 'api-name': string; 'api-kind': string } => {
	// relativePath e.g. "api/functions/defineComponent.md"
	const parts = relativePath.replace(/\\/g, '/').replace(/\.md$/, '').split('/')
	const category = parts[1] || ''
	const name = parts[2] || ''
	return {
		'api-category': category,
		'api-name': name,
		'api-kind': API_KIND_MAP[category] || category,
	}
}

const analyzePageForPreloads = (htmlContent: string): string[] => {
	const preloads: string[] = []

	// Extract CSS and JS assets
	const cssMatches = htmlContent.match(/href="([^"]*\.css[^"]*)"/g) || []
	const jsMatches = htmlContent.match(/src="([^"]*\.js[^"]*)"/g) || []

	const allMatches: string[] = [...cssMatches, ...jsMatches]
	allMatches.forEach(match => {
		const asset = match.match(/(?:href|src)="([^"]*)"/)?.[1]
		if (asset && !preloads.includes(asset)) {
			preloads.push(asset)
		}
	})

	return preloads
}

/* === Blog Helpers === */

/** Compute reading time and blog tag HTML for a processed blog post. */
export const getBlogVariables = (
	processedFile: ProcessedMarkdownFile,
): {
	'published-date': string
	'reading-time': string
	'blog-tags': string
	'author-avatar': string
} => {
	const { metadata, htmlContent, basePath } = processedFile

	// Strip HTML tags and count words
	const wordCount = htmlContent
		.replace(/<[^>]+>/g, ' ')
		.split(/\s+/)
		.filter(Boolean).length
	const readingTime = String(Math.max(1, Math.ceil(wordCount / 200)))

	// Render tags as <span class="tag"> elements
	const blogTags = (metadata.tags ?? [])
		.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`)
		.join(' ')

	// Derive avatar path from author name if not explicitly set
	const author = metadata.author ?? ''
	const authorAvatar =
		metadata['author-avatar']
		|| (author
			? `${basePath}assets/img/avatar/${generateSlug(author)}.jpg`
			: '')

	return {
		'published-date': metadata.date ?? '',
		'reading-time': readingTime,
		'blog-tags': blogTags,
		'author-avatar': authorAvatar,
	}
}

/**
 * Pre-compute prev/next navigation links for each blog post.
 * Posts are sorted date-descending (newest first).
 * "prev" = chronologically older (higher index), "next" = chronologically newer (lower index).
 */
export const computeBlogPrevNext = (
	sortedPosts: ProcessedMarkdownFile[],
): Map<string, Record<string, string>> => {
	const map = new Map<string, Record<string, string>>()

	sortedPosts.forEach((post, i) => {
		const slug = (p: ProcessedMarkdownFile) =>
			p.relativePath.replace(/^blog\//, '').replace(/\.md$/, '')

		const prev = sortedPosts[i + 1] // older
		const next = sortedPosts[i - 1] // newer

		map.set(post.path, {
			'prev-post': prev ? `${post.basePath}blog/${slug(prev)}.html` : '',
			'prev-post-title': prev?.title ?? '',
			'next-post': next ? `${post.basePath}blog/${slug(next)}.html` : '',
			'next-post-title': next?.title ?? '',
		})
	})

	return map
}

/** Generate blog overview excerpt cards for the 3 most-recent non-draft posts. */
export const generateBlogExcerpts = (
	sortedPosts: ProcessedMarkdownFile[],
	basePath: string = './',
): string => {
	if (sortedPosts.length === 0) return '<p>No blog posts yet.</p>'

	return sortedPosts
		.slice(0, 3)
		.map(post => {
			const slug = post.relativePath.replace(/^blog\//, '').replace(/\.md$/, '')
			const url = `${basePath}blog/${slug}.html`
			const { 'reading-time': readingTime } = getBlogVariables(post)
			const date = escapeHtml(post.metadata.date ?? '')
			const rawAuthor = post.metadata.author ?? ''
			const author = escapeHtml(rawAuthor)
			const avatar = escapeHtml(
				post.metadata['author-avatar']
					|| (rawAuthor
						? `${basePath}assets/img/avatar/${generateSlug(rawAuthor)}.jpg`
						: ''),
			)
			const emoji = escapeHtml(post.metadata.emoji ?? '📝')
			const title = escapeHtml(post.title)
			const description = escapeHtml(post.metadata.description ?? '')

			return (
				`<card-blogpost>\n`
				+ `\t<h2><a href="${escapeHtml(url)}">${emoji} ${title}</a></h2>\n`
				+ `\t<card-blogmeta>\n`
				+ `\t\t<span>${avatar ? `\t\t<img src="${avatar}" alt="Avatar of${author}" />` : ''} <span>${author}</span></span>\n`
				+ `\t\t<time datetime="${date}">${date}</time>\n`
				+ `\t\t<span>${escapeHtml(readingTime)} min read</span>\n`
				+ `\t</card-blogmeta>\n`
				+ (description ? `\t<p>${description}</p>\n` : '')
				+ `</card-blogpost>`
			)
		})
		.join('\n')
}

/* === Template Application === */

const applyTemplate = async (
	processedFile: ProcessedMarkdownFile,
	assetHashes: { css: string; js: string },
	extraReplacements: Record<string, string> = {},
): Promise<string> => {
	try {
		const layoutName = processedFile.metadata.layout || 'page'
		let layout = await getFileContent(
			getFilePath(LAYOUTS_DIR, `${layoutName}.html`),
		)

		// Load includes first
		layout = await loadIncludes(layout)

		// Generate performance hints
		const additionalPreloads = analyzePageForPreloads(processedFile.htmlContent)
		const performanceHintsHtml = performanceHints(additionalPreloads)

		// Replace content
		layout = layout.replace('{{ content }}', processedFile.htmlContent)

		// Replace template variables
		const replacements: { [key: string]: string } = {
			url: processedFile.relativePath.replace('.md', '.html'),
			section: processedFile.section || '',
			'base-path': processedFile.basePath,
			title: processedFile.title,
			version: pkg.version,
			'css-hash': assetHashes.css,
			'js-hash': assetHashes.js,
			'performance-hints': performanceHintsHtml,
			'additional-preloads': additionalPreloads.join('\n\t\t'),
			toc: buildToc(processedFile.htmlContent),
			// Convert metadata values to strings
			...Object.fromEntries(
				Object.entries(processedFile.metadata).map(([key, value]) => [
					key,
					String(value || ''),
				]),
			),
			// API layout variables
			...(layoutName === 'api'
				? getApiVariables(processedFile.relativePath)
				: {}),
			// Caller-provided overrides (blog-specific vars, prev/next)
			...extraReplacements,
		}

		return layout.replace(/{{\s*(.*?)\s*}}/g, (_, key) => {
			return replacements[key.trim()] || ''
		})
	} catch (error) {
		console.error(
			`Failed to apply template for ${processedFile.relativePath}:`,
			error,
		)
		return processedFile.htmlContent
	}
}

export const pagesEffect = (onRebuild?: () => void) => {
	let resolve: (() => void) | undefined
	const ready = new Promise<void>(res => {
		resolve = res
	})
	const cleanup = createEffect(() => {
		match([docsMarkdown.fullyProcessed], {
			ok: async ([processedFiles]) => {
				const firstRun = !!resolve
				try {
					console.log('📚 Generating HTML pages from processed markdown...')

					const assetHashes = await getAssetHashes()

					// Pre-compute sorted blog posts and prev/next navigation
					const sortedBlogPosts = Array.from(processedFiles.values())
						.filter(f => f.section === 'blog' && !f.metadata.draft)
						.sort((a, b) =>
							(b.metadata.date ?? '').localeCompare(a.metadata.date ?? ''),
						)
					const prevNextMap = computeBlogPrevNext(sortedBlogPosts)
					// blog.md is at depth 0, so basePath is always './'
					const blogOverviewBasePath =
						[...processedFiles.values()].find(f => f.relativePath === 'blog.md')
							?.basePath ?? './'
					const blogExcerpts = generateBlogExcerpts(
						sortedBlogPosts,
						blogOverviewBasePath,
					)

					// Process all markdown files
					const processPromises = Array.from(processedFiles.values()).map(
						async (processedFile: ProcessedMarkdownFile) => {
							try {
								let fileToRender = processedFile
								let extra: Record<string, string> = {}

								if (processedFile.relativePath === 'blog.md') {
									// Inject hero + excerpt cards into the blog overview
									const { metadata } = processedFile
									const heroHtml =
										`<section-hero>\n`
										+ `\t<h1>${escapeHtml(metadata.emoji ?? '')} ${escapeHtml(metadata.title ?? 'Blog')}</h1>\n`
										+ `<div class="hero-layout">\n`
										+ `<div class="lead">\n`
										+ (metadata.description
											? `\t<p>${escapeHtml(metadata.description)}</p>\n`
											: '')
										+ `</div>`
										+ `</div>`
										+ `</section-hero>`
									fileToRender = {
										...processedFile,
										htmlContent:
											heroHtml
											+ `\n<section class="blog-posts">\n${blogExcerpts}\n</section>`,
									}
								} else if (processedFile.section === 'blog') {
									// Add blog-specific template variables
									extra = {
										...getBlogVariables(processedFile),
										...(prevNextMap.get(processedFile.path) ?? {}),
									}
								}

								// Apply template
								const finalHtml = await applyTemplate(
									fileToRender,
									assetHashes,
									extra,
								)

								// Write output file
								await writeFileSafe(
									getFilePath(
										OUTPUT_DIR,
										processedFile.relativePath.replace('.md', '.html'),
									),
									finalHtml,
								)

								console.log(
									`📄 Generated ${processedFile.relativePath.replace('.md', '.html')}`,
								)
							} catch (error) {
								console.error(
									`Failed to generate ${processedFile.relativePath}:`,
									error,
								)
							}
						},
					)

					// Wait for all processing to complete
					await Promise.all(processPromises)

					console.log(
						`📚 Successfully generated ${processedFiles.size} HTML pages`,
					)
					if (!firstRun) onRebuild?.()
				} catch (error) {
					console.error('Failed to generate HTML pages:', error)
				} finally {
					resolve?.()
					resolve = undefined
				}
			},
			err: errors => {
				console.error('Error in pages effect:', errors[0]!.message)
				resolve?.()
				resolve = undefined
			},
		})
	})
	return { cleanup, ready }
}
