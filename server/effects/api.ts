import { API_DIR, PAGES_DIR, ROOT } from '../config'
import { apiMarkdown, docsMarkdown, libraryScripts } from '../file-signals'
import {
	calculateFileHash,
	fileExists,
	getFileContent,
	getFilePath,
	writeFileSafe,
} from '../io'
import { createBuildEffect, runCommand } from './build-effect'

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
				name: headingMatch[1]!.trim(),
				slug: headingMatch[1]!.trim().toLowerCase().replace(/\s+/g, '-'),
				entries: [],
			}
			categories.push(current)
			continue
		}

		// Match list entries: - [Name](category/Name.md)
		if (current) {
			const entryMatch = line.match(/^-\s+\[([^\]]+)\]\(([^)]+)\/([^)]+)\.md\)/)
			if (entryMatch) {
				const name = entryMatch[1]!
				const filename = entryMatch[3]!
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
# API Reference

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

export type { ApiCategory }
// Exported for testing
export {
	computeSourcesHash,
	generateApiIndexMarkdown,
	parseGlobals,
	sortCategories,
}

export const apiEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'API documentation',
		[libraryScripts.sources],
		async ([sources]) => {
			// Skip TypeDoc run if library sources haven't changed
			const currentHash = computeSourcesHash(sources)
			if (currentHash === previousSourcesHash) {
				console.log('📚 Library sources unchanged, skipping TypeDoc')
				return
			}

			console.log('📚 Rebuilding API documentation...')

			// Generate API docs using TypeDoc. Configuration is in
			// typedoc.json at project root. A non-zero exit (e.g. a type
			// error surfaced while type-checking the project) throws here.
			await runCommand(['typedoc'], { cwd: ROOT })

			previousSourcesHash = currentHash
			console.log('📚 API documentation rebuilt successfully')

			// docs-src/api is generated (gitignored): on a fresh checkout the
			// initial scan ran before TypeDoc wrote anything and no fs watcher
			// was attached, so push the new files through the signal explicitly.
			await apiMarkdown.sources.rescan()

			// Generate listnav-compatible API index page
			// TypeDoc 0.28+ uses README.md instead of globals.md
			const readmePath = getFilePath(API_DIR, 'README.md')
			if (fileExists(readmePath)) {
				const readmeContent = await getFileContent(readmePath)
				const categories = parseGlobals(readmeContent)

				if (categories.length > 0) {
					const apiIndexMd = generateApiIndexMarkdown(categories)
					await writeFileSafe(getFilePath(PAGES_DIR, 'api.md'), apiIndexMd)
					// api.md is generated (gitignored) — same reasoning as the
					// apiMarkdown rescan above, and the fs watcher's 50ms debounce
					// would race buildOnce's cleanup on a one-shot build.
					await docsMarkdown.sources.rescan()
					console.log(
						`📖 Generated API index with ${categories.length} categories`,
					)
				} else {
					console.warn('⚠️ No API categories found in README.md')
				}
			} else {
				console.warn('⚠️ README.md not found, skipping API index generation')
			}
		},
		onRebuild,
	)
