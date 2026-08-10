import { LLMS_FULL_TXT_FILE, ROOT } from '../config'
import { docsMarkdown } from '../file-signals'
import { writeFileSafe } from '../io'
import { createBuildEffect } from './build-effect'
import { stripMarkdocTags } from './md-mirror'

/* === Types === */

/**
 * A page eligible for inclusion in llms-full.txt.
 * `relativePath` is relative to `docs-src/pages`; `content` is the raw
 * markdown with frontmatter already stripped (as produced by `processed`).
 */
export type PageContent = {
	relativePath: string
	content: string
}

/* === Generation Helpers === */

/**
 * Narrative pages included in llms-full.txt, in fixed canonical order.
 * `slug` matches the page's filename without extension; `title` is the
 * section H1 emitted in the output.
 */
const CURATED_PAGES = [
	{ slug: 'index', title: 'Introduction' },
	{ slug: 'getting-started', title: 'Getting Started' },
	{ slug: 'components', title: 'Components' },
	{ slug: 'styling', title: 'Styling' },
	{ slug: 'data-flow', title: 'Data Flow' },
] as const

/**
 * Standalone markdown documents (read from the repo root) included as
 * trailing sections. `path` is absolute-relative to ROOT; `title` is the
 * section H1 emitted in the output. Content is plain Markdown and passes
 * through unchanged.
 */
const STANDALONE_DOCS = [
	{ filename: 'README.md', title: 'Le Truc' },
	{ filename: 'ARCHITECTURE.md', title: 'Architecture' },
	{ filename: 'AGENTS.md', title: 'Agent Context — Le Truc' },
] as const

const SECTION_SEPARATOR = '\n---\n\n'

/**
 * Remove self-closing Markdoc tags (e.g. `{% sources src="..." /%}`).
 *
 * `stripMarkdocTags()` handles open/close pairs, but not arbitrary
 * self-closing tags. Self-closing tags like `{% sources %}` load
 * their content at runtime via `module-lazyload` and carry no inline text,
 * so dropping them entirely is correct for a concatenated text file.
 */
const stripSelfClosingTags = (content: string): string =>
	content.replace(/\{%[^%]*\/%\}/g, '')

/**
 * Format a single section: an H1 title followed by the body content.
 *
 * If the body itself starts with an H1 that duplicates the title (with or
 * without a leading emoji, e.g. `# 📖 Introduction` for title "Introduction"),
 * that leading H1 is dropped so each section has exactly one title.
 */
const formatSection = (title: string, body: string): string => {
	let trimmed = body.trim()
	const match = trimmed.match(/^#\s+(.+?)\s*$/m)
	if (match) {
		const heading = (match[1] ?? '')
			.replace(/^(?:\p{Emoji}\uFE0F?|\s)+/u, '')
			.trim()
		if (heading === title) {
			trimmed = trimmed.slice(match[0].length).trim()
		}
	}
	return `# ${title}\n\n${trimmed}\n`
}

/** Extract the slug (filename without extension) from a relative path. */
const pathToSlug = (relativePath: string): string =>
	relativePath.replace(/\.md$/, '').split('/')[0] ?? ''

/**
 * Generate the full llms-full.txt content.
 *
 * Pure function: takes already-stripped page content and standalone-doc
 * content as input, returns the concatenated string. No I/O, no config
 * reads — unit-testable in isolation.
 *
 * Narrative pages have their Markdoc tags stripped by the caller (the
 * effect); standalone docs pass through verbatim.
 */
export const generateLlmsFullTxt = (params: {
	pages: PageContent[]
	readme: string
	architecture: string
	agents: string
}): string => {
	const { pages, readme, architecture, agents } = params

	// Index pages by slug for O(1) lookup against the curated order
	const pagesBySlug = new Map<string, PageContent>()
	for (const page of pages) pagesBySlug.set(pathToSlug(page.relativePath), page)

	const standaloneContent: Record<string, string> = {
		README: readme,
		ARCHITECTURE: architecture,
		AGENTS: agents,
	}

	const sections: string[] = [
		[
			'# Le Truc — Full Documentation',
			'> Type-safe reactive Web Components — HTML-first, backend-agnostic.',
			'>',
			'> Auto-generated authoritative reference for AI tools. Concatenates the',
			'> README, core narrative pages, architecture notes, and agent context',
			'> (including surprising behaviors and gotchas).',
		].join('\n'),
	]

	// README first
	sections.push(
		formatSection(STANDALONE_DOCS[0]!.title, standaloneContent['README']!),
	)

	// Curated narrative pages in fixed order
	for (const { slug, title } of CURATED_PAGES) {
		const page = pagesBySlug.get(slug)
		if (!page) continue
		const clean = stripSelfClosingTags(stripMarkdocTags(page.content))
		sections.push(formatSection(title, clean))
	}

	// Trailing standalone docs
	sections.push(
		formatSection(
			STANDALONE_DOCS[1]!.title,
			standaloneContent['ARCHITECTURE']!,
		),
	)
	sections.push(
		formatSection(STANDALONE_DOCS[2]!.title, standaloneContent['AGENTS']!),
	)

	return `${sections.join(SECTION_SEPARATOR)}\n`
}

/* === Effect === */

export const llmsFullManifestEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'llms-full.txt',
		[docsMarkdown.processed],
		async ([processedFiles]) => {
			// Collect curated page content
			const pages: PageContent[] = []
			for (const [, file] of processedFiles) {
				const slug = file.filename.replace(/\.md$/, '').split('/')[0] ?? ''
				if (!slug) continue
				// Keep only top-level narrative pages; `processedFiles`
				// only contains docs-src/pages/**, so section depth is
				// derived from the path.
				if (file.path.includes('/blog/')) continue
				pages.push({ relativePath: file.filename, content: file.content })
			}

			// Read standalone docs from the repo root. Promise.all() over an
			// explicit tuple (rather than .map() over STANDALONE_DOCS, which
			// degrades to string[]) keeps each element typed as `string`
			// under noUncheckedIndexedAccess.
			const [readme, architecture, agents] = await Promise.all([
				Bun.file(`${ROOT}/${STANDALONE_DOCS[0].filename}`).text(),
				Bun.file(`${ROOT}/${STANDALONE_DOCS[1].filename}`).text(),
				Bun.file(`${ROOT}/${STANDALONE_DOCS[2].filename}`).text(),
			])

			await writeFileSafe(
				LLMS_FULL_TXT_FILE,
				generateLlmsFullTxt({ pages, readme, architecture, agents }),
			)
			console.log('📚 Generated llms-full.txt')
		},
		onRebuild,
	)
