import Markdoc from '@markdoc/markdoc'
import {
	type Computed,
	createComputed,
	createEffect,
	UNSET,
} from '@zeix/cause-effect'
import { COMPONENTS_DIR, EXAMPLES_OUTPUT_DIR } from '../config'
import { componentMarkdown } from '../file-signals'
import { fileExists, getFilePath, writeFileSafe } from '../io'
import markdocConfig from '../markdoc/markdoc.config'

/**
 * Examples effect - processes component documentation and generates HTML fragments
 *
 * This effect:
 * 1. Watches for component documentation markdown files (*.md)
 * 2. Processes them with Markdoc, replacing {{content}} with component HTML
 * 3. Outputs HTML fragments to docs/examples/ for lazy loading
 */

type ExampleFile = {
	componentName: string
	markdownPath: string
	htmlPath: string
	outputPath: string
	content: string
}

const componentExamples: Computed<Map<string, ExampleFile>> = createComputed(
	async () => {
		const markdownFiles = componentMarkdown.sources.get()
		const exampleFiles = new Map<string, ExampleFile>()

		for (const [path, fileInfo] of Object.entries(markdownFiles)) {
			if (!fileInfo || !path.endsWith('.md')) continue

			// Extract component name from path (e.g., "./examples/basic-button/basic-button.md")
			const pathParts = path.split('/')
			if (pathParts.length < 3) continue

			const componentName = pathParts[pathParts.length - 2] // e.g., "basic-button"
			const markdownPath = path

			// Find corresponding HTML file
			const htmlPath = getFilePath(
				COMPONENTS_DIR,
				componentName,
				`${componentName}.html`,
			)

			if (!fileExists(htmlPath)) {
				console.warn(`No HTML file found for component: ${componentName}`)
				continue
			}

			// Output path in docs/examples/
			const outputPath = getFilePath(
				EXAMPLES_OUTPUT_DIR,
				`${componentName}.html`,
			)

			exampleFiles.set(componentName, {
				componentName,
				markdownPath,
				htmlPath,
				outputPath,
				content: fileInfo.content,
			})
		}
		return exampleFiles
	},
)

const processedExamples: Computed<Map<string, string>> = createComputed(
	async () => {
		const examples = componentExamples.get()
		if (examples === UNSET) return UNSET
		const processed = new Map<string, string>()

		for (const [componentName, example] of examples) {
			try {
				// Read the component HTML file
				let componentHtml = ''
				if (fileExists(example.htmlPath)) {
					const htmlFile = Bun.file(example.htmlPath)
					componentHtml = await htmlFile.text()
				}

				// Replace {{content}} placeholder with actual HTML wrapped in a fence block
				const processedContent = example.content.replace(
					/\{\{\s*content\s*\}\}/g,
					`\`\`\`html\n${componentHtml}\n\`\`\``,
				)

				// Process with Markdoc
				const ast = Markdoc.parse(processedContent)

				// Validate the document
				const errors = Markdoc.validate(ast, markdocConfig)
				if (errors.length > 0) {
					console.warn(
						`Markdoc validation errors for ${example.markdownPath}:`,
						errors,
					)
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

				processed.set(componentName, htmlContent)
			} catch (error) {
				console.error(`Failed to process example ${componentName}:`, error)
				processed.set(
					componentName,
					`<p>Error processing example: ${error}</p>`,
				)
			}
		}

		return processed
	},
)

export function examplesEffect(): () => void {
	console.log('🔄 Starting examples effect...')

	const unsubscribe = createEffect(async () => {
		const processed = processedExamples.get()
		const examples = componentExamples.get()

		if (processed === UNSET || examples === UNSET || processed.size === 0)
			return

		// Write each processed example to output directory
		for (const [componentName, htmlContent] of processed) {
			const example = examples.get(componentName)
			if (!example) continue

			const success = await writeFileSafe(example.outputPath, htmlContent)
			if (success) {
				console.log(
					`✅ Generated ${getFilePath('examples', `${componentName}.html`)}`,
				)
			} else {
				console.error(`❌ Failed to write ${example.outputPath}`)
			}
		}

		console.log('📝 Examples processing completed')
	})

	return unsubscribe
}
