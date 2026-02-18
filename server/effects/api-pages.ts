import Markdoc from '@markdoc/markdoc'
import { createEffect, match } from '@zeix/cause-effect'
import { codeToHtml } from 'shiki'
import { API_DIR, OUTPUT_DIR } from '../config'
import { apiMarkdown, type FileInfo } from '../file-signals'
import { getFilePath, getRelativePath, writeFileSafe } from '../io'
import markdocConfig from '../markdoc.config'
import { postProcessHtml } from '../markdoc-helpers'

/* === Internal Functions === */

/** Strip TypeDoc navigation breadcrumbs above the first H1 heading */
const stripBreadcrumbs = (content: string): string => {
	const h1Match = content.match(/^(#\s+.+)$/m)
	if (h1Match) {
		const h1Index = content.indexOf(h1Match[0])
		return content.substring(h1Index)
	}
	return content
}

/** Highlight code blocks in HTML using Shiki */
const highlightCodeBlocks = async (html: string): Promise<string> => {
	const codeBlockRegex =
		/<pre data-language="([^"]*)" data-code="([^"]*)"><code class="language-[^"]*">[\s\S]*?<\/code><\/pre>/g
	let result = html
	let match: RegExpExecArray | null

	while ((match = codeBlockRegex.exec(html)) !== null) {
		const [fullMatch, lang, encodedCode] = match
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
			result = result.replace(fullMatch, highlighted)
		} catch {
			// Keep the original code block as fallback
		}
	}

	return result
}

/**
 * Process a single API markdown file into an HTML fragment.
 *
 * Fragments are suitable for injection by module-lazyload (no doctype/head/body).
 * The server applies the full api.html layout on-the-fly for direct navigation.
 */
const processApiFile = async (file: FileInfo): Promise<void> => {
	const relativePath = getRelativePath(API_DIR, file.path)
	if (!relativePath) return

	// Skip index files — only process individual API entries
	const filename = relativePath.split('/').pop() || ''
	if (
		filename === 'globals.md'
		|| filename === 'README.md'
		|| filename.startsWith('_')
	) {
		return
	}

	// Strip TypeDoc navigation breadcrumbs
	const cleanContent = stripBreadcrumbs(file.content)

	// Parse with Markdoc
	const ast = Markdoc.parse(cleanContent)
	const errors = Markdoc.validate(ast, markdocConfig)
	if (errors.length > 0) {
		console.warn(`Markdoc validation warnings for ${relativePath}:`, errors)
	}

	const transformed = Markdoc.transform(ast, markdocConfig)
	let htmlContent = Markdoc.renderers.html(transformed)

	// Remove automatic <article> wrapper
	htmlContent = htmlContent.replace(/^<article>([\s\S]*)<\/article>$/m, '$1')

	// Highlight code blocks
	htmlContent = await highlightCodeBlocks(htmlContent)

	// Post-process HTML (wraps in api-content section)
	htmlContent = postProcessHtml(htmlContent, 'api')

	// Rewrite relative API cross-references to hash links
	const category = relativePath.split('/')[0] // e.g. "type-aliases"

	// "../type-aliases/Fallback.html" → "#type-aliases/Fallback"
	htmlContent = htmlContent.replace(
		/href="\.\.\/([^"]+)\.html"/g,
		(_, path) => `href="#${path}"`,
	)

	// "ComponentProp.html" → "#type-aliases/ComponentProp" (same-directory links)
	htmlContent = htmlContent.replace(
		/href="([A-Za-z][^/"]*?)\.html"/g,
		(_, name) => `href="#${category}/${name}"`,
	)

	// Write HTML fragment to output (for listnav lazy-loading)
	const outputPath = getFilePath(
		OUTPUT_DIR,
		'api',
		relativePath.replace('.md', '.html'),
	)
	await writeFileSafe(outputPath, htmlContent)
}

/* === Exported Functions === */

// Exported for testing
export { stripBreadcrumbs, highlightCodeBlocks }

export const apiPagesEffect = () =>
	createEffect(() => {
		match([apiMarkdown.sources], {
			ok: async ([apiFiles]) => {
				try {
					console.log('📖 Generating API page fragments...')

					let count = 0
					const processPromises = apiFiles.map(async (file: FileInfo) => {
						try {
							await processApiFile(file)
							count++
						} catch (error) {
							console.error(`Failed to process API file ${file.path}:`, error)
						}
					})

					await Promise.all(processPromises)
					console.log(`📖 Generated ${count} API page fragments`)
				} catch (error) {
					console.error('Failed to generate API pages:', error)
				}
			},
			err: errors => {
				console.error('Error in API pages effect:', errors[0].message)
			},
		})
	})
