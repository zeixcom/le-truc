import { createEffect, match } from '@zeix/cause-effect'
import { ASSETS_DIR, INCLUDES_DIR, LAYOUTS_DIR, OUTPUT_DIR } from '../config'
import { docsMarkdown, type ProcessedMarkdownFile } from '../file-signals'
import {
	calculateFileHash,
	getFileContent,
	getFilePath,
	writeFileSafe,
} from '../io'
import { performanceHints } from '../templates/performance-hints'

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
	let result = html
	let match: RegExpExecArray | null

	while ((match = includeRegex.exec(html)) !== null) {
		const [fullMatch, filename] = match
		try {
			const includeContent = await getFileContent(
				getFilePath(INCLUDES_DIR, filename),
			)
			result = result.replace(fullMatch, includeContent)
		} catch (error) {
			console.warn(`Failed to load include ${filename}:`, error)
			result = result.replace(fullMatch, '')
		}
	}

	return result
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

const applyTemplate = async (
	processedFile: ProcessedMarkdownFile,
	assetHashes: { css: string; js: string },
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
			'css-hash': assetHashes.css,
			'js-hash': assetHashes.js,
			'performance-hints': performanceHintsHtml,
			'additional-preloads': additionalPreloads.join('\n\t\t'),
			// Convert metadata values to strings
			...Object.fromEntries(
				Object.entries(processedFile.metadata).map(([key, value]) => [
					key,
					String(value || ''),
				]),
			),
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

export const pagesEffect = () =>
	createEffect(() => {
		match([docsMarkdown.fullyProcessed], {
			ok: async ([processedFiles]) => {
				try {
					console.log('📚 Generating HTML pages from processed markdown...')

					const assetHashes = await getAssetHashes()

					// Process all markdown files
					const processPromises = Array.from(processedFiles.values()).map(
						async (processedFile: ProcessedMarkdownFile) => {
							try {
								// Apply template
								const finalHtml = await applyTemplate(
									processedFile,
									assetHashes,
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
				} catch (error) {
					console.error('Failed to generate HTML pages:', error)
				}
			},
			err: errors => {
				console.error('Error in pages effect:', errors[0].message)
			},
		})
	})
