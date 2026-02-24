import { codeToHtml } from 'shiki'

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
	const replacements: { start: number; end: number; replacement: string }[] =
		[]
	let match: RegExpExecArray | null

	while ((match = codeBlockRegex.exec(html)) !== null) {
		const [fullMatch, beforeLanguageAttrs, lang, afterLanguageAttrs, codeHtml] =
			match
		const attrs = `${beforeLanguageAttrs}${afterLanguageAttrs}`
		const dataCode = attrs.match(/\sdata-code="([^"]*)"/)?.[1]
		const decodedCode = decodeHtmlEntities(dataCode ?? codeHtml)

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
		const { start, end, replacement } = replacements[i]
		result = result.slice(0, start) + replacement + result.slice(end)
	}

	return result
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
