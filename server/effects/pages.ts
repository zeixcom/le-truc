import pkg from '../../package.json'
import {
	ASSETS_DIR,
	BASE_URL,
	CHAPTERS,
	INCLUDES_DIR,
	LAYOUTS_DIR,
	LOCALES,
	localeAssetPath,
	OUTPUT_DIR,
	rewriteFragmentRefs,
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
import { renderPageOccurrences } from './page-render'

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
	const { metadata, htmlContent, relativePath } = processedFile

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

	// Derive avatar path from author name if not explicitly set. Avatars are
	// ASSETS: they hang off the docs root (single-copy, LT-174), so the path
	// goes through localeAssetPath — the locale-relative basePath would name
	// a directory inside the locale tree that does not exist.
	const author = metadata.author ?? ''
	const authorAvatar =
		metadata['author-avatar'] ||
		(author
			? `${localeAssetPath(pageDepth(relativePath))}assets/img/avatar/${generateSlug(author)}.jpg`
			: '')

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

/** Generate blog overview excerpt cards for the most-recent non-draft posts.
 *
 * `basePath` is the overview page's LOCALE-relative base — post links stay
 * inside the locale tree. `assetBasePath` is its DOCS-root base: avatars are
 * single-copy assets (LT-174) and must not ride the locale-relative base.
 * The default assumes the overview sits at depth 0, which it does
 * (`blog.md` — see the pagesEffect call site).
 */
export const generateBlogExcerpts = (
	sortedPosts: ProcessedMarkdownFile[],
	basePath: string = './',
	assetBasePath: string = localeAssetPath(0),
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
					? `${assetBasePath}assets/img/avatar/${generateSlug(author)}.jpg`
					: '')
			const title = post.title
			const description = post.metadata.description ?? ''

			return html`<card-blogpost itemscope itemtype="https://schema.org/BlogPosting">
				<h2 itemprop="headline"><a href="${url}" itemprop="url">${title}</a></h2>
				<basic-blogmeta>
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
				</basic-blogmeta>
				${description ? raw(html`<p itemprop="description">${description}</p>`) : ''}
			</card-blogpost>`
		})
		.join('\n')
}

/**
 * Generate a compact archive of non-draft posts beyond the featured cards,
 * grouped by year into collapsible `<details>` sections (only the current
 * year starts open), date-descending within each year (caller sorts).
 * Returns '' when every post fits the featured cards.
 */
export const generateBlogArchive = (
	sortedPosts: ProcessedMarkdownFile[],
	basePath: string = './',
): string => {
	const archived = sortedPosts.slice(FEATURED_POSTS)
	if (archived.length === 0) return ''

	const currentYear = String(new Date().getFullYear())

	const postsByYear = new Map<string, ProcessedMarkdownFile[]>()
	for (const post of archived) {
		const year = (post.metadata.date ?? '').slice(0, 4) || 'Undated'
		const group = postsByYear.get(year)
		if (group) group.push(post)
		else postsByYear.set(year, [post])
	}

	const groups = Array.from(postsByYear.entries())
		.map(([year, posts]) => {
			const items = posts
				.map(post => {
					const slug = post.relativePath
						.replace(/^blog\//, '')
						.replace(/\.md$/, '')
					const url = `${basePath}blog/${slug}.html`
					const date = post.metadata.date ?? ''
					return html`<li>
						<a href="${url}">${post.title}</a>
						<basic-blogmeta>
							<time class="published" datetime="${date}">${date}</time>
						</basic-blogmeta>
					</li>`
				})
				.join('\n')

			return html`<details${year === currentYear ? raw(' open') : ''}>
				<summary>${year}</summary>
				<ul>
					${raw(items)}
				</ul>
			</details>`
		})
		.join('\n')

	return html`<section class="blog-archive" aria-labelledby="blog-archive-title">
		<module-blogarchive>
			<h2 id="blog-archive-title">Archive</h2>
			${raw(groups)}
		</module-blogarchive>
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

/* === Locale Helpers === */

/**
 * How deep a page sits inside its locale tree.
 *
 * `guide.md` is 0, `blog/post.md` is 1. Drives `localeAssetPath` — the path
 * back out to the docs root, where assets and the locale-independent
 * fragment directories live (LT-174).
 */
export const pageDepth = (relativePath: string): number =>
	relativePath.split('/').length - 1

/**
 * `<link rel="alternate" hreflang>` set for one page across every locale.
 *
 * Absolute URLs, because search engines resolve hreflang against the
 * document rather than the site root. `x-default` points at the default
 * locale, which is also where `/` redirects (serve.ts).
 */
export const hreflangAlternates = (
	pageUrl: string,
	baseUrl: string = BASE_URL,
): string => {
	const link = (hreflang: string, locale: string) =>
		html`<link rel="alternate" hreflang="${hreflang}" href="${baseUrl}/${locale}/${pageUrl}">`
	return [
		...LOCALES.map(locale => link(locale, locale)),
		link('x-default', LOCALES[0]),
	].join('\n\t\t')
}

/**
 * The site root's redirect stub (LT-174).
 *
 * Every page now lives under a locale prefix, which leaves `docs/index.html`
 * — the URL people actually type and the one static hosts serve for `/` —
 * with nothing behind it. The dev server answers with a 302 (serve.ts), but
 * a static host has no such hook, so the build emits a real file.
 *
 * Belt and braces on purpose: the `<meta http-equiv="refresh">` is what
 * actually redirects, the canonical link tells crawlers where the content
 * lives, and the visible link is the no-JS, no-refresh fallback. No script,
 * so it works with JS disabled; no locale sniffing, because the locale is a
 * build-time decision and guessing it here would contradict ADR 0030's whole
 * premise.
 */
export const rootRedirectPage = (locale: string = LOCALES[0]): string =>
	html`<!doctype html>
<html lang="${locale}">
	<head>
		<meta charset="utf-8">
		<title>Le Truc</title>
		<meta http-equiv="refresh" content="0; url=./${locale}/index.html">
		<link rel="canonical" href="./${locale}/index.html">
		${raw(hreflangAlternates('index.html'))}
		<meta name="robots" content="noindex">
	</head>
	<body>
		<p>Redirecting to <a href="./${locale}/index.html">the documentation</a>.</p>
	</body>
</html>`

/* === Template Application === */

const applyTemplate = async (
	processedFile: ProcessedMarkdownFile,
	assetHashes: { css: string; js: string },
	rootPages: PageInfo[],
	locale: string,
	extraReplacements: Record<string, string> = {},
): Promise<string> => {
	try {
		const layoutName = processedFile.metadata.layout || 'page'
		let layout = await getFileContent(
			getFilePath(LAYOUTS_DIR, `${layoutName}.html`),
		)

		// Load includes first
		layout = await loadIncludes(layout)

		// LT-194: server-render locale-consuming component occurrences in the
		// page content at THIS tree's locale. Runs per locale, inside the
		// loop that already fixed the locale as a build constant, so each
		// locale tree bakes its own renders; a positional `[lang]` ancestor
		// or the occurrence's own `lang` attribute wins over the page locale.
		const occurrenceResult = await renderPageOccurrences(
			processedFile.htmlContent,
			{ pageLocale: locale },
		)
		if (occurrenceResult.rendered.length > 0)
			console.log(
				`🌐 Server-rendered ${occurrenceResult.rendered.length} component occurrence(s) in ${locale}/${processedFile.relativePath.replace('.md', '.html')}`,
			)

		// Generate performance hints
		const additionalPreloads = analyzePageForPreloads(processedFile.htmlContent)
		const performanceHintsHtml = performanceHints(additionalPreloads)

		// Replace content
		layout = layout.replace('{{ content }}', occurrenceResult.html)

		// Render the sidebar menu for this page, marking the current page
		// active. Sectioned pages (blog posts, API symbols) mark their parent
		// root page (the section slug) active instead of themselves, since
		// only root pages appear in the menu.
		const currentSlug =
			processedFile.section || processedFile.filename.replace('.md', '')
		const menuHtml = menu(rootPages, currentSlug, processedFile.basePath)

		// Replace template variables.
		//
		// TWO path variables, because a locale prefix splits what used to be
		// one (LT-174). `base-path` reaches the DOCS ROOT — assets, llms.txt,
		// and the locale-independent fragment directories all hang off it, one
		// level further up now that the page sits inside `docs/<locale>/`.
		// `processedFile.basePath` stays LOCALE-RELATIVE and keeps driving page
		// links (the menu, resolved internal links, blog URLs): a sibling page
		// lives in the same locale tree, so those paths are unchanged.
		const pageUrl = processedFile.relativePath.replace('.md', '.html')
		const replacements: { [key: string]: string } = {
			url: pageUrl,
			section: processedFile.section || '',
			'base-path': localeAssetPath(pageDepth(processedFile.relativePath)),
			lang: locale,
			'hreflang-alternates': hreflangAlternates(pageUrl),
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

		const rendered = layout.replace(/{{\s*(.*?)\s*}}/g, (_, key) => {
			return replacements[key.trim()] || ''
		})

		// Point fragment references at the single root copy. Runs on the FULLY
		// rendered page so it covers both authored content (`./api/...` links)
		// and anything a Markdoc schema emitted (listnav's `value="./examples/..."`).
		return rewriteFragmentRefs(rendered, pageDepth(processedFile.relativePath))
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

			// One complete page tree per locale (ADR 0030 sub-design 1, LT-174).
			// The locale is fixed HERE, before any rendering begins — everything
			// downstream of this loop sees it as a constant, which is what keeps
			// `Intl` foldable and i18n components on the Folded tier (ADR 0029).
			// Only PAGES multiply: the api/, examples/ and sources/ fragment
			// trees are generated reference content no catalog can translate, so
			// they stay single-copy at the docs root (LOCALE_INDEPENDENT_DIRS).
			const processPromises = LOCALES.flatMap(locale =>
				Array.from(processedFiles.values()).map(
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
								<h1>${metadata.title ?? 'Blog'}</h1>
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
								locale,
								extra,
							)

							// Write output file, under this locale's page tree
							await writeFileSafe(
								getFilePath(
									OUTPUT_DIR,
									locale,
									processedFile.relativePath.replace('.md', '.html'),
								),
								finalHtml,
							)

							console.log(
								`📄 Generated ${locale}/${processedFile.relativePath.replace('.md', '.html')}`,
							)
						} catch (error) {
							console.error(
								`Failed to generate ${locale}/${processedFile.relativePath}:`,
								error,
							)
						}
					},
				),
			)

			// Wait for all processing to complete
			await Promise.all(processPromises)

			// The site root, which is no longer a page but a signpost
			await writeFileSafe(
				getFilePath(OUTPUT_DIR, 'index.html'),
				rootRedirectPage(),
			)

			console.log(
				`📚 Successfully generated ${processPromises.length} HTML pages ` +
					`(${processedFiles.size} × ${LOCALES.length} locale(s): ${LOCALES.join(', ')})`,
			)
		},
		onRebuild,
	)
