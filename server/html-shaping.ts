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
	let result = html
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
			result = result.replace(fullMatch, highlighted)
		} catch {
			// Keep the original code block as fallback.
		}
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
