import Markdoc from '@markdoc/markdoc'
import { createEffect, match } from '@zeix/cause-effect'
import { COMPONENTS_DIR, CONTENT_MARKER, EXAMPLES_DIR } from '../config'
import {
	componentMarkdown,
	componentMarkup,
	type FileInfo,
} from '../file-signals'
import { highlightCodeBlocks, injectModuleDemoPreview } from '../html-shaping'
import { getFilePath, writeFileSafe } from '../io'
import markdocConfig from '../markdoc.config'

/* === Internal Functions === */

const toPathMap = (files: FileInfo[]): Map<string, FileInfo> => {
	const map = new Map<string, FileInfo>()
	for (const file of files) map.set(file.path, file)
	return map
}

const processExample = async (
	componentName: string,
	markdownContent: string,
	componentHtml: string,
): Promise<string> => {
	// Replace {{ content }} placeholder with actual HTML wrapped in a fence block
	const processedContent = markdownContent.replace(
		CONTENT_MARKER,
		`\`\`\`html\n${componentHtml}\n\`\`\``,
	)

	// Parse with Markdoc
	const ast = Markdoc.parse(processedContent)

	// Validate the document
	const errors = Markdoc.validate(ast, markdocConfig)
	if (errors.length > 0) {
		console.warn(`Markdoc validation errors for ${componentName}:`, errors)
	}

	// Transform the AST
	const transformed = Markdoc.transform(ast, markdocConfig)

	// Render to HTML
	let htmlContent = Markdoc.renderers.html(transformed)

	// Remove automatic <article> wrapper added by Markdoc
	htmlContent = htmlContent.replace(/^<article>([\s\S]*)<\/article>$/m, '$1')

	htmlContent = await highlightCodeBlocks(htmlContent)
	htmlContent = injectModuleDemoPreview(htmlContent)

	return htmlContent
}

export { processExample }

/* === Exported Effect === */

export const examplesEffect = (onRebuild?: () => void) => {
	let resolve: (() => void) | undefined
	const ready = new Promise<void>(res => { resolve = res })
	const cleanup = createEffect(() => {
		match([componentMarkdown.sources, componentMarkup.sources], {
			ok: async ([mdFiles, htmlFiles]) => {
				const firstRun = !!resolve
				try {
					console.log('🔄 Rebuilding example documentation...')

					const htmlMap = toPathMap(htmlFiles)

					for (const md of mdFiles) {
						const pathParts = md.path.split('/')

						if (pathParts.length < 4) continue

						const typeName = pathParts[pathParts.length - 3]!
						const dirName = pathParts[pathParts.length - 2]!
						const fileName = pathParts[pathParts.length - 1]!.replace(
							/\.md$/,
							'',
						)

						// Only process markdown files that match <type>-<name> pattern
						if (fileName !== `${typeName}-${dirName}`) continue

						const componentName = fileName

						// Find corresponding HTML file
						const htmlPath = getFilePath(
							COMPONENTS_DIR,
							typeName,
							dirName,
							`${componentName}.html`,
						)
						const htmlFile = htmlMap.get(htmlPath)

						if (!htmlFile) {
							console.warn(`No HTML file found for component: ${componentName}`)
							continue
						}

						try {
							const htmlContent = await processExample(
								componentName,
								md.content,
								htmlFile.content,
							)

							const outputPath = getFilePath(
								EXAMPLES_DIR,
								`${componentName}.html`,
							)
							const success = await writeFileSafe(outputPath, htmlContent)

							if (success) {
								console.log(`✅ Generated examples/${componentName}.html`)
							} else {
								console.error(`❌ Failed to write ${outputPath}`)
							}
						} catch (error) {
							console.error(
								`Failed to process example ${componentName}:`,
								error,
							)
						}
					}

					console.log('📝 Examples processing completed')
					if (!firstRun) onRebuild?.()
				} catch (error) {
					console.error('Failed to process examples:', error)
				} finally {
					resolve?.()
					resolve = undefined
				}
			},
			err: errors => {
				console.error('Error in examples effect:', errors[0]!.message)
				resolve?.()
				resolve = undefined
			},
		})
	})
	return { cleanup, ready }
}
