import { join } from 'node:path'
import Markdoc, { type Node } from '@markdoc/markdoc'
import { COMPONENTS_DIR, CONTENT_MARKER, EXAMPLES_DIR } from '../config'
import {
	componentMarkdown,
	componentMarkup,
	type FileInfo,
} from '../file-signals'
import { highlightCodeBlocks, injectModuleDemoPreview } from '../html-shaping'
import { getFilePath, writeFileSafe } from '../io'
import markdocConfig from '../markdoc.config'
import { createBuildEffect } from './build-effect'

/* === Internal Functions === */

const toPathMap = (files: FileInfo[]): Map<string, FileInfo> => {
	const map = new Map<string, FileInfo>()
	for (const file of files) map.set(file.path, file)
	return map
}

// Shared fragments referenced via Markdoc's built-in `{% partial file="..." /%}`
// tag. Keyed by the exact `file` attribute value used in component docs.
const PARTIALS: Record<string, string> = {
	'form-associated.md': join(COMPONENTS_DIR, '_common', 'form-associated.md'),
}

// Not cached across calls: re-reading picks up edits to the fragment file
// immediately under HMR/file-watch rebuilds, and the files are tiny.
const loadPartials = async (): Promise<Record<string, Node>> => {
	const entries = await Promise.all(
		Object.entries(PARTIALS).map(async ([name, path]) => {
			const content = await Bun.file(path).text()
			return [name, Markdoc.parse(content)] as const
		}),
	)
	return Object.fromEntries(entries)
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

	const partials = await loadPartials()
	const config = { ...markdocConfig, partials }

	// Validate the document
	const errors = Markdoc.validate(ast, config)
	if (errors.length > 0) {
		console.warn(`Markdoc validation errors for ${componentName}:`, errors)
	}

	// Transform the AST
	const transformed = Markdoc.transform(ast, config)

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

export const examplesEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'Examples',
		[componentMarkdown.sources, componentMarkup.sources],
		async ([mdFiles, htmlFiles]) => {
			console.log('🔄 Rebuilding example documentation...')

			const htmlMap = toPathMap(htmlFiles)

			for (const md of mdFiles) {
				const pathParts = md.path.split('/')

				if (pathParts.length < 4) continue

				const typeName = pathParts[pathParts.length - 3]!
				const dirName = pathParts[pathParts.length - 2]!
				const fileName = pathParts[pathParts.length - 1]!.replace(/\.md$/, '')

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

					const outputPath = getFilePath(EXAMPLES_DIR, `${componentName}.html`)
					const success = await writeFileSafe(outputPath, htmlContent)

					if (success) {
						console.log(`✅ Generated examples/${componentName}.html`)
					} else {
						console.error(`❌ Failed to write ${outputPath}`)
					}
				} catch (error) {
					console.error(`Failed to process example ${componentName}:`, error)
				}
			}

			console.log('📝 Examples processing completed')
		},
		onRebuild,
	)
