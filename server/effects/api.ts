import { createEffect, match } from '@zeix/cause-effect'
import { execSync } from 'child_process'
import { API_DIR, PAGES_DIR } from '../config'
import { libraryScripts } from '../file-signals'
import { fileExists, getFileContent, getFilePath, writeFileSafe } from '../io'

/* === Types === */

type ApiCategory = {
	name: string
	slug: string
	entries: { name: string; slug: string }[]
}

/* === Internal Functions === */

/**
 * Parse globals.md to extract grouped API entries.
 * TypeDoc generates sections like "## Classes", "## Functions" etc.
 * Each entry is a markdown link: `- [Name](category/Name.md)`
 */
const parseGlobals = (content: string): ApiCategory[] => {
	const categories: ApiCategory[] = []
	let current: ApiCategory | null = null

	for (const line of content.split('\n')) {
		// Match category headings: ## Classes, ## Functions, etc.
		const headingMatch = line.match(/^##\s+(.+)$/)
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

	return categories.filter(c => c.entries.length > 0)
}

/**
 * Generate a listnav-compatible Markdown index page for the API section.
 * Models the structure on docs-src/pages/examples.md.
 */
const generateApiIndexMarkdown = (categories: ApiCategory[]): string => {
	const listItems = categories
		.map(category => {
			const items = category.entries
				.map(
					entry =>
						`  - [${entry.name}](/api/${category.slug}/${entry.slug}.html)`,
				)
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

**Browse the complete Le Truc API.** Classes, functions, type aliases, and variables — all generated from the TypeScript source.
{% /hero %}

{% section .breakout %}

{% listnav title="Symbols" %}
${listItems}
{% /listnav %}

{% /section %}
`
}

/* === Exported Functions === */

// Exported for testing
export { parseGlobals, generateApiIndexMarkdown }
export type { ApiCategory }

export const apiEffect = () =>
	createEffect(() => {
		match([libraryScripts.sources], {
			ok: async () => {
				try {
					console.log('📚 Rebuilding API documentation...')

					// Generate API docs using TypeDoc
					execSync(
						`typedoc --plugin typedoc-plugin-markdown --out ${API_DIR}/ index.ts`,
						{ stdio: 'inherit' },
					)

					console.log('📚 API documentation rebuilt successfully')

					// Generate listnav-compatible API index page
					const globalsPath = getFilePath(API_DIR, 'globals.md')
					if (fileExists(globalsPath)) {
						const globalsContent = await getFileContent(globalsPath)
						const categories = parseGlobals(globalsContent)

						if (categories.length > 0) {
							const apiIndexMd = generateApiIndexMarkdown(categories)
							await writeFileSafe(getFilePath(PAGES_DIR, 'api.md'), apiIndexMd)
							console.log(
								`📖 Generated API index with ${categories.length} categories`,
							)
						} else {
							console.warn('⚠️ No API categories found in globals.md')
						}
					} else {
						console.warn(
							'⚠️ globals.md not found, skipping API index generation',
						)
					}
				} catch (error) {
					console.error('Failed to rebuild API documentation:', error)
				}
			},
			err: errors => {
				console.error('API reference failed to rebuild', String(errors[0]))
			},
		})
	})
