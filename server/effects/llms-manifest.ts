import { createEffect, match } from '@zeix/cause-effect'
import { LLMS_TXT_FILE, PAGE_ORDER } from '../config'
import { docsMarkdown, type PageInfo } from '../file-signals'
import { writeFileSafe } from '../io'

/* === Generation Helpers === */

const SECTION_NAMES: Record<string, string> = {
	api: 'API Reference',
	components: 'Component Library',
	blog: 'Blog',
	examples: 'Examples',
}

const SECTION_ORDER = [
	'Core Reference',
	'API Reference',
	'Component Library',
	'Blog',
	'Examples',
]

const capitalize = (s: string): string =>
	s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s

const getSectionName = (section: string | undefined): string =>
	section ? (SECTION_NAMES[section] ?? capitalize(section)) : 'Core Reference'

/** Sort key for a page within its section: PAGE_ORDER index first, then title */
const pageOrderIndex = (pageInfo: PageInfo): number => {
	const basename =
		pageInfo.relativePath.replace(/\.md$/, '').split('/')[0] ?? ''
	const idx = PAGE_ORDER.indexOf(basename)
	return idx === -1 ? PAGE_ORDER.length : idx
}

/** Generate the full llms.txt content from an array of page infos */
export const generateLlmsTxt = (pageInfos: PageInfo[]): string => {
	// Group pages by resolved section name
	const sections = new Map<string, PageInfo[]>()
	for (const page of pageInfos) {
		const name = getSectionName(page.section)
		if (!sections.has(name)) sections.set(name, [])
		sections.get(name)!.push(page)
	}

	// Sort pages within each section
	for (const pages of sections.values()) {
		pages.sort((a, b) => {
			const order = pageOrderIndex(a) - pageOrderIndex(b)
			return order !== 0 ? order : a.title.localeCompare(b.title)
		})
	}

	// Sort sections: known order first, then alphabetically
	const sortedSections = [...sections.entries()].sort(([a], [b]) => {
		const ai = SECTION_ORDER.indexOf(a)
		const bi = SECTION_ORDER.indexOf(b)
		if (ai !== -1 && bi !== -1) return ai - bi
		if (ai !== -1) return -1
		if (bi !== -1) return 1
		return a.localeCompare(b)
	})

	const lines: string[] = [
		'# Le Truc Documentation',
		'> High-performance, signal-based web components.',
		'',
	]

	for (const [sectionName, pages] of sortedSections) {
		lines.push(`## ${sectionName}`)
		for (const page of pages) {
			lines.push(`- [${page.title}](./${page.relativePath})`)
		}
		lines.push('')
	}

	return `${lines.join('\n').trimEnd()}\n`
}

/* === Effect === */

export const llmsManifestEffect = (onRebuild?: () => void) => {
	let resolve: (() => void) | undefined
	const ready = new Promise<void>(res => {
		resolve = res
	})

	const cleanup = createEffect(() => {
		match([docsMarkdown.pageInfos], {
			ok: async ([pageInfos]): Promise<void> => {
				const firstRun = !!resolve
				try {
					await writeFileSafe(LLMS_TXT_FILE, generateLlmsTxt(pageInfos))
					console.log('📋 Generated llms.txt')
					if (!firstRun) onRebuild?.()
				} catch (error) {
					console.error('Failed to generate llms.txt:', error)
				} finally {
					resolve?.()
					resolve = undefined
				}
			},
			err: errors => {
				console.error('Error in llmsManifestEffect:', errors[0]!.message)
				resolve?.()
				resolve = undefined
			},
		})
	})

	return { cleanup, ready }
}
