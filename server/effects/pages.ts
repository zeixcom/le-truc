import pkg from '../../package.json'
import {
	ASSETS_DIR,
	CHAPTERS,
	INCLUDES_DIR,
	LAYOUTS_DIR,
	OUTPUT_DIR,
} from '../config'
import {
	docsMarkdown,
	type PageInfo,
	type ProcessedMarkdownFile,
} from '../file-signals'
import {
	calculateFileHash,
	getFileContent,
	getFilePath,
	writeFileSafe,
} from '../io'
import { type ChapterLink, chapterNav } from '../templates/chapter-nav'
import { menu } from '../templates/menu'
import { performanceHints } from '../templates/performance-hints'
import { escapeHtml, generateSlug, html, raw } from '../templates/utils'
import { createBuildEffect } from './build-effect'

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

/** Posts featured as excerpt cards on the blog overview; the rest go to the archive list. */
const FEATURED_POSTS = 3

/** Compute reading time and blog tag HTML for a processed blog post. */
export const getBlogVariables = (
	processedFile: ProcessedMarkdownFile,
): {
	'published-date': string
	'modified-date': string
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
		metadata['author-avatar'] ||
		(author ? `${basePath}assets/img/avatar/${generateSlug(author)}.jpg` : '')

	return {
		'published-date': metadata.date ?? '',
		'modified-date': metadata['modified-date'] ?? '',
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

/** Generate blog overview excerpt cards for the most-recent non-draft posts. */
export const generateBlogExcerpts = (
	sortedPosts: ProcessedMarkdownFile[],
	basePath: string = './',
): string => {
	if (sortedPosts.length === 0) return '<p>No blog posts yet.</p>'

	return sortedPosts
		.slice(0, FEATURED_POSTS)
		.map(post => {
			const slug = post.relativePath.replace(/^blog\//, '').replace(/\.md$/, '')
			const url = `${basePath}blog/${slug}.html`
			const { 'reading-time': readingTime } = getBlogVariables(post)
			const publishedDate = post.metadata.date ?? ''
			const modifiedDate = post.metadata['modified-date'] ?? ''
			const author = post.metadata.author ?? ''
			const avatar =
				post.metadata['author-avatar'] ||
				(author
					? `${basePath}assets/img/avatar/${generateSlug(author)}.jpg`
					: '')
			const emoji = post.metadata.emoji ?? '📝'
			const title = post.title
			const description = post.metadata.description ?? ''

			return html`<card-blogpost itemscope itemtype="https://schema.org/BlogPosting">
				<h2><a href="${url}" itemprop="url">${emoji} <span itemprop="headline">${title}</span></a></h2>
				<card-blogmeta>
					<span
						class="author"
						itemprop="author"
						itemscope
						itemtype="https://schema.org/Person"
						>${
							avatar
								? raw(
										html`<img class="avatar" src="${avatar}" alt="Avatar of ${author}" />`,
									)
								: ''
						} <span itemprop="name">${author}</span></span
					>
					<span
						><time class="published" itemprop="datePublished" datetime="${publishedDate}"
							>${publishedDate}</time
						>${
							modifiedDate
								? raw(
										html`<span class="modified">
										· updated on
										<time itemprop="dateModified" datetime="${modifiedDate}">${modifiedDate}</time>
									</span>`,
									)
								: ''
						}
					</span>
					<span
						><meta itemprop="timeRequired" content="PT${readingTime}M" />${readingTime}
						min read</span
					>
				</card-blogmeta>
				${description ? raw(html`<p itemprop="description">${description}</p>`) : ''}
			</card-blogpost>`
		})
		.join('\n')
}

/**
 * Generate a compact archive list of non-draft posts beyond the featured
 * cards: linked title + date per post, date-descending (caller sorts).
 * Returns '' when every post fits the featured cards.
 */
export const generateBlogArchive = (
	sortedPosts: ProcessedMarkdownFile[],
	basePath: string = './',
): string => {
	const archived = sortedPosts.slice(FEATURED_POSTS)
	if (archived.length === 0) return ''

	const items = archived
		.map(post => {
			const slug = post.relativePath.replace(/^blog\//, '').replace(/\.md$/, '')
			const url = `${basePath}blog/${slug}.html`
			const date = post.metadata.date ?? ''
			return html`<li>
				<a href="${url}">${post.title}</a>
				<time datetime="${date}">${date}</time>
			</li>`
		})
		.join('\n')

	return html`<section class="blog-archive" aria-labelledby="blog-archive-title">
		<h2 id="blog-archive-title">Archive</h2>
		<ul>
			${raw(items)}
		</ul>
	</section>`
}

/* === Chapter Helpers === */

const slugOf = (file: ProcessedMarkdownFile): string =>
	file.filename.replace('.md', '')

/**
 * Compute the `chapter-nav` template variable for a page.
 * Returns {} for pages outside every chapter, so the layout's
 * `{{ chapter-nav }}` placeholder collapses to nothing for them.
 * Missing siblings (a chapter page not present in the build) are skipped.
 */
export const getChapterVars = (
	file: ProcessedMarkdownFile,
	rootPagesBySlug: Map<string, ProcessedMarkdownFile>,
): Record<string, string> => {
	if (file.section) return {}
	const slug = slugOf(file)
	const chapter = CHAPTERS.find(c => c.pages.includes(slug as never))
	if (!chapter) return {}
	const pages = chapter.pages as readonly string[]
	const index = pages.indexOf(slug)
	const link = (s: string | undefined): ChapterLink | undefined => {
		if (!s || !rootPagesBySlug.has(s)) return undefined
		return { url: `${s}.html`, title: rootPagesBySlug.get(s)!.title }
	}
	return {
		'chapter-nav': chapterNav(
			chapter.title,
			index + 1,
			pages.length,
			link(pages[index - 1]),
			link(pages[index + 1]),
		),
	}
}

/* === Template Application === */

const applyTemplate = async (
	processedFile: ProcessedMarkdownFile,
	assetHashes: { css: string; js: string },
	rootPages: PageInfo[],
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

		// Render the sidebar menu for this page, marking the current page
		// active. Sectioned pages (blog posts, API symbols) mark their parent
		// root page (the section slug) active instead of themselves, since
		// only root pages appear in the menu.
		const currentSlug =
			processedFile.section || processedFile.filename.replace('.md', '')
		const menuHtml = menu(rootPages, currentSlug)

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
			'alternate-link': `./${processedFile.relativePath}`,
			menu: menuHtml,
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

export const pagesEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'Pages',
		[docsMarkdown.fullyProcessed],
		async ([processedFiles]) => {
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
			const blogArchive = generateBlogArchive(
				sortedBlogPosts,
				blogOverviewBasePath,
			)

			// Root pages by slug, for chapter prev/next resolution
			const rootPagesBySlug = new Map<string, ProcessedMarkdownFile>()
			for (const f of processedFiles.values()) {
				if (!f.section) rootPagesBySlug.set(f.filename.replace('.md', ''), f)
			}

			// Root pages as PageInfo-shaped objects, for the sidebar menu
			// (rendered per-page below, with the current page marked active)
			const rootPages: PageInfo[] = Array.from(rootPagesBySlug.values()).map(
				f => ({
					title: f.title,
					emoji: f.metadata.emoji || '📄',
					description: f.metadata.description || '',
					url: f.relativePath.replace('.md', '.html'),
					filename: f.filename,
					relativePath: f.relativePath,
					lastModified: f.lastModified,
					section: f.section,
				}),
			)

			// Process all markdown files
			const processPromises = Array.from(processedFiles.values()).map(
				async (processedFile: ProcessedMarkdownFile) => {
					try {
						let fileToRender = processedFile
						let extra: Record<string, string> = getChapterVars(
							processedFile,
							rootPagesBySlug,
						)

						if (processedFile.relativePath === 'blog.md') {
							// Inject hero + excerpt cards into the blog overview
							const { metadata } = processedFile
							const heroHtml = html`<section-hero>
								<h1>${metadata.emoji ?? ''} ${metadata.title ?? 'Blog'}</h1>
								<div class="hero-layout">
									<div class="lead">
										${
											metadata.description
												? raw(html`<p>${metadata.description}</p>`)
												: ''
										}
									</div>
								</div>
							</section-hero>`
							fileToRender = {
								...processedFile,
								htmlContent: html`${raw(heroHtml)}
									<section class="blog-posts">
										${raw(blogExcerpts)}
									</section>
									${raw(blogArchive)}`,
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
							rootPages,
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

			console.log(`📚 Successfully generated ${processedFiles.size} HTML pages`)
		},
		onRebuild,
	)
