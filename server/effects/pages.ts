import { createEffect, match } from '@zeix/cause-effect'
import pkg from '../../package.json'
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

	// Collect all matches with their positions first, then apply replacements
	// from right to left so earlier offsets remain valid.
	const replacements: { start: number; end: number; replacement: string }[] = []
	let match: RegExpExecArray | null

	while ((match = includeRegex.exec(html)) !== null) {
		const [fullMatch, filename] = match
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
		const { start, end, replacement } = replacements[i]
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

/** Extract h2/h3 headings from HTML and build a nav list for TOC */
const buildToc = (htmlContent: string): string => {
	const headingRegex = /<h([23])[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h[23]>/gi
	const items: string[] = []
	let match: RegExpExecArray | null
	while ((match = headingRegex.exec(htmlContent)) !== null) {
		const level = match[1]
		const id = match[2]
		// Strip inner tags to get plain text
		const text = match[3].replace(/<[^>]+>/g, '').trim()
		const indent = level === '3' ? ' style="padding-left:1rem"' : ''
		items.push(`<a href="#${id}"${indent}>${text}</a>`)
	}
	return items.length > 0 ? `<nav>${items.join('\n')}</nav>` : ''
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
			version: pkg.version,
			'css-hash': assetHashes.css,
			'js-hash': assetHashes.js,
			'performance-hints': performanceHintsHtml,
			'additional-preloads': additionalPreloads.join('\n\t\t'),
			toc: buildToc(processedFile.htmlContent),
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

export const pagesEffect = () => {
	let resolve: (() => void) | undefined
	const ready = new Promise<void>(res => {
		resolve = res
	})
	const cleanup = createEffect(() => {
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
				} finally {
					resolve?.()
					resolve = undefined
				}
			},
			err: errors => {
				console.error('Error in pages effect:', errors[0].message)
				resolve?.()
				resolve = undefined
			},
		})
	})
	return { cleanup, ready }
}
