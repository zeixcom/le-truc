import { createEffect, match } from '@zeix/cause-effect'
import { API_DIR, PAGES_DIR, ROOT } from '../config'
import { libraryScripts } from '../file-signals'
import {
	calculateFileHash,
	fileExists,
	getFileContent,
	getFilePath,
	writeFileSafe,
} from '../io'

/* === Types === */

type ApiCategory = {
	name: string
	slug: string
	entries: { name: string; slug: string }[]
}

/* === Internal Functions === */

/**
 * Define custom order for API categories.
 * Functions are most important, then classes and variables, with type aliases last.
 */
const CATEGORY_ORDER: Record<string, number> = {
	functions: 0,
	classes: 1,
	variables: 2,
	'type-aliases': 3,
	interfaces: 4,
	enumerations: 5,
}

/**
 * Sort categories according to predefined order.
 * Unknown categories appear after known ones, sorted alphabetically.
 */
const sortCategories = (categories: ApiCategory[]): ApiCategory[] => {
	return [...categories].sort((a, b) => {
		const orderA = CATEGORY_ORDER[a.slug] ?? 999
		const orderB = CATEGORY_ORDER[b.slug] ?? 999

		if (orderA !== orderB) {
			return orderA - orderB
		}

		// If same order value (or both unknown), sort alphabetically
		return a.name.localeCompare(b.name)
	})
}

/**
 * Parse README.md to extract grouped API entries.
 * TypeDoc generates sections like "#### Classes", "#### Functions" etc.
 * (Note: Headings are H4 because our heading shift plugin converts H2 → H4)
 * Each entry is a markdown link: `- [Name](category/Name.md)`
 */
const parseGlobals = (content: string): ApiCategory[] => {
	const categories: ApiCategory[] = []
	let current: ApiCategory | null = null

	for (const line of content.split('\n')) {
		// Match category headings: #### Classes, #### Functions, etc.
		// (H4 because our heading shift plugin converts H2 → H4)
		const headingMatch = line.match(/^####\s+(.+)$/)
		if (headingMatch) {
			current = {
				name: headingMatch[1].trim(),
				slug: headingMatch[1].trim().toLowerCase().replace(/\s+/g, '-'),
				entries: [],
			}
			categories.push(current)
			continue
		}

		// Match list entries: - [Name](category/Name.md)
		if (current) {
			const entryMatch = line.match(/^-\s+\[([^\]]+)\]\(([^)]+)\/([^)]+)\.md\)/)
			if (entryMatch) {
				const name = entryMatch[1]
				const filename = entryMatch[3]
				current.entries.push({
					name,
					slug: filename,
				})
			}
		}
	}

	const filtered = categories.filter(c => c.entries.length > 0)
	return sortCategories(filtered)
}

/**
 * Generate a listnav-compatible Markdown index page for the API section.
 * Models the structure on docs-src/pages/examples.md.
 */
const generateApiIndexMarkdown = (categories: ApiCategory[]): string => {
	const defaultSelection = 'defineComponent'

	const listItems = categories
		.map(category => {
			const items = category.entries
				.map(entry => {
					const isDefault = entry.slug === defaultSelection
					const selectedAttr = isDefault ? ' selected' : ''
					return `  - [${entry.name}](./api/${category.slug}/${entry.slug}.html)${selectedAttr}`
				})
				.join('\n')
			return `- ${category.name}\n${items}`
		})
		.join('\n')

	return `---
title: 'API'
emoji: '📖'
description: 'API reference documentation'
layout: 'page'
---

{% hero %}
# 📖 API Reference

**Browse the complete Le Truc API.** Functions, error classes, variables, and type aliases — all generated from the TypeScript source.
{% /hero %}

{% section .breakout %}

{% listnav title="Select a Symbol" %}
${listItems}
{% /listnav %}

{% /section %}
`
}

/* === Exported Functions === */

// Hash of library sources from the last successful TypeDoc run
let previousSourcesHash = ''

/**
 * Compute a composite hash of all library source files.
 * Used to skip redundant TypeDoc runs when nothing changed.
 */
const computeSourcesHash = (
	sources: { hash: string; path: string }[],
): string => {
	const combined = sources
		.map(s => s.hash)
		.sort()
		.join('')
	return calculateFileHash(combined)
}

// Exported for testing
export {
	parseGlobals,
	generateApiIndexMarkdown,
	computeSourcesHash,
	sortCategories,
}
export type { ApiCategory }

export const apiEffect = () => {
	let resolve: (() => void) | undefined
	const ready = new Promise<void>(res => { resolve = res })
	const cleanup = createEffect(() => {
		match([libraryScripts.sources], {
			ok: async ([sources]) => {
				try {
					// Skip TypeDoc run if library sources haven't changed
					const currentHash = computeSourcesHash(sources)
					if (currentHash === previousSourcesHash) {
						console.log('📚 Library sources unchanged, skipping TypeDoc')
						return
					}

					console.log('📚 Rebuilding API documentation...')

					// Generate API docs using TypeDoc (async)
					// Configuration is in typedoc.json at project root
					const proc = Bun.spawn(['typedoc'], {
						stdout: 'inherit',
						stderr: 'inherit',
						cwd: ROOT,
					})
					const exitCode = await proc.exited

					if (exitCode !== 0) {
						console.error(`TypeDoc exited with code ${exitCode}`)
						return
					}

					previousSourcesHash = currentHash
					console.log('📚 API documentation rebuilt successfully')

					// Generate listnav-compatible API index page
					// TypeDoc 0.28+ uses README.md instead of globals.md
					const readmePath = getFilePath(API_DIR, 'README.md')
					if (fileExists(readmePath)) {
						const readmeContent = await getFileContent(readmePath)
						const categories = parseGlobals(readmeContent)

						if (categories.length > 0) {
							const apiIndexMd = generateApiIndexMarkdown(categories)
							await writeFileSafe(getFilePath(PAGES_DIR, 'api.md'), apiIndexMd)
							console.log(
								`📖 Generated API index with ${categories.length} categories`,
							)
						} else {
							console.warn('⚠️ No API categories found in README.md')
						}
					} else {
						console.warn(
							'⚠️ README.md not found, skipping API index generation',
						)
					}
				} catch (error) {
					console.error('Failed to rebuild API documentation:', error)
				} finally {
					resolve?.()
					resolve = undefined
				}
			},
			err: errors => {
				console.error('API reference failed to rebuild', String(errors[0]))
				resolve?.()
				resolve = undefined
			},
		})
	})
	return { cleanup, ready }
}
