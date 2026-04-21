import { codeToHtml } from 'shiki'
import type { TocItem } from './markdoc-helpers'

const decodeHtmlEntities = (value: string): string =>
	value
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')

export const highlightSnippet = async (
	content: string,
	lang: string,
): Promise<string> =>
	await codeToHtml(content, {
		lang,
		theme: 'monokai',
	})

export const highlightCodeBlocks = async (html: string): Promise<string> => {
	const codeBlockRegex =
		/<pre([^>]*)data-language="([^"]*)"([^>]*)>\s*<code class="language-[^"]*">([\s\S]*?)<\/code>\s*<\/pre>/g

	// Collect all matches with their positions first, then apply replacements
	// from right to left so earlier offsets remain valid.
	const replacements: { start: number; end: number; replacement: string }[] = []
	let match: RegExpExecArray | null

	while ((match = codeBlockRegex.exec(html)) !== null) {
		const [fullMatch, beforeLanguageAttrs, lang, afterLanguageAttrs, codeHtml] =
			match
		const attrs = `${beforeLanguageAttrs}${afterLanguageAttrs}`
		const dataCode = attrs.match(/\sdata-code="([^"]*)"/)?.[1]
		const decodedCode = decodeHtmlEntities(dataCode ?? codeHtml ?? '')

		try {
			const highlighted = await codeToHtml(decodedCode, {
				lang: lang || 'text',
				theme: 'monokai',
			})
			replacements.push({
				start: match.index,
				end: match.index + fullMatch.length,
				replacement: highlighted,
			})
		} catch {
			// Keep the original code block as fallback.
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

/**
 * Rewrite internal links in markdown-generated HTML to be basePath-relative
 * with `.html` extensions, so they work on GitHub Pages.
 *
 * - `href="./foo.md"` → `href="./foo.html"`
 * - `href="/foo.md"` → `href="${basePath}foo.html"`
 * - `href="/foo.html"` → `href="${basePath}foo.html"` (markdoc already converts .md → .html)
 * - `href="/blog/slug"` (no extension) → `href="${basePath}blog/slug.html"`
 *
 * External URLs, anchors, and paths with a file extension are left untouched.
 */
export const resolveInternalLinks = (html: string, basePath: string): string =>
	html.replace(/href="([^"#?]*)"/g, (_match, href: string) => {
		if (/^(?:https?:|mailto:|tel:|\/\/)/.test(href)) return _match
		if (href.endsWith('.md')) {
			const resolved = href.startsWith('/')
				? `${basePath}${href.slice(1, -3)}.html`
				: `${href.slice(0, -3)}.html`
			return `href="${resolved}"`
		}
		if (href.startsWith('/') && !href.endsWith('/')) {
			const lastSegment = href.slice(href.lastIndexOf('/') + 1)
			if (!lastSegment.includes('.')) {
				return `href="${basePath}${href.slice(1)}.html"`
			}
			if (lastSegment.endsWith('.html')) {
				return `href="${basePath}${href.slice(1)}"`
			}
		}
		return _match
	})

export const injectTableOfContents = (html: string, toc: TocItem[]): string => {
	if (toc.length < 2)
		return html.replace(
			/<div class="toc-placeholder" data-toc="true"><\/div>/g,
			'',
		)
	const items = toc
		.map(({ id, text }) => `<li><a href="#${id}">${text}</a></li>`)
		.join('')
	const nav = `<nav class="toc" aria-label="On this page"><ol>${items}</ol></nav>`
	return html.replace(
		/<div class="toc-placeholder" data-toc="true"><\/div>/g,
		nav,
	)
}

export const injectModuleDemoPreview = (html: string): string =>
	html.replace(
		/<module-demo([^>]*) preview-html="([^"]*)"([^>]*)>([\s\S]*?)<\/module-demo>/g,
		(_fullMatch, beforeAttrs, encodedHtml, afterAttrs, content) => {
			const previewHtml = decodeHtmlEntities(encodedHtml)
				.replace(/>\s{2,}</g, '><')
				.replace(/\s{2,}/g, ' ')
				.trim()

			const previewDiv = `<div class="preview">${previewHtml}</div>`
			return `<module-demo${beforeAttrs}${afterAttrs}>${previewDiv}${content}</module-demo>`
		},
	)
