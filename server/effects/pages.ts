import { createEffect, match, resolve } from '@zeix/cause-effect'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { ASSETS_DIR, INCLUDES_DIR, LAYOUT_FILE, OUTPUT_DIR } from '../config'
import { markdownFiles } from '../file-signals'
import { performanceHints } from '../templates/performance-hints'
import { toc } from '../templates/toc'
import type { ProcessedMarkdownFile } from '../types'

const generateAssetHash = (_filePath: string): string => {
	// Simple timestamp-based hash for development
	// In production, this would read the actual file hash
	return Date.now().toString(36)
}

const getAssetHashes = (): { css: string; js: string } => {
	try {
		return {
			css: generateAssetHash(join(ASSETS_DIR, 'main.css')),
			js: generateAssetHash(join(ASSETS_DIR, 'main.js')),
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
			const includePath = join(INCLUDES_DIR, filename)
			const includeContent = await readFile(includePath, 'utf8')
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
): Promise<string> => {
	try {
		let layout = await readFile(LAYOUT_FILE, 'utf8')

		// Load includes first
		layout = await loadIncludes(layout)

		// Generate TOC and performance hints
		const tocHtml = toc(processedFile.processedContent)
		const additionalPreloads = analyzePageForPreloads(processedFile.htmlContent)
		const performanceHintsHtml = performanceHints(additionalPreloads)

		// Replace TOC placeholders in content with actual TOC HTML
		const contentWithToc = processedFile.htmlContent.replace(
			/<div class="toc-placeholder" data-toc="true"><\/div>/g,
			tocHtml,
		)

		// Replace content
		layout = layout.replace('{{ content }}', contentWithToc)

		// Get asset hashes
		const assetHashes = getAssetHashes()

		// Replace template variables
		const replacements: { [key: string]: string } = {
			url: processedFile.relativePath.replace('.md', '.html'),
			section: processedFile.section || '',
			'base-path': processedFile.basePath,
			title: processedFile.title,
			toc: tocHtml,
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
		match(
			resolve({
				processedFiles: markdownFiles.fullyProcessed,
			}),
			{
				ok: async ({ processedFiles }) => {
					try {
						console.log('📚 Generating HTML pages from processed markdown...')

						// Process all markdown files
						const processPromises = Array.from(processedFiles.values()).map(
							async (processedFile: ProcessedMarkdownFile) => {
								try {
									// Apply template
									const finalHtml = await applyTemplate(processedFile)

									// Write output file
									const outputPath = join(
										OUTPUT_DIR,
										processedFile.relativePath.replace('.md', '.html'),
									)
									await mkdir(dirname(outputPath), {
										recursive: true,
									})
									await writeFile(outputPath, finalHtml, 'utf8')

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
			},
		)
	})
