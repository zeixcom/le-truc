/**
 * Unit Tests for chapter helpers in effects/pages.ts
 *
 * Covers getChapterVars: chapter membership, prev/next resolution,
 * missing siblings, and non-chapter pages.
 */

import { describe, expect, test } from 'bun:test'
import { getChapterVars } from '../../effects/pages'
import type { ProcessedMarkdownFile } from '../../file-signals'

/* === Fixtures === */

function makePage(
	slug: string,
	overrides: Partial<ProcessedMarkdownFile> = {},
): ProcessedMarkdownFile {
	return {
		path: `/pages/${slug}.md`,
		filename: `${slug}.md`,
		content: '',
		hash: '000',
		lastModified: 0,
		size: 0,
		exists: true,
		metadata: {},
		processedContent: '',
		htmlContent: '',
		section: '',
		depth: 0,
		relativePath: `${slug}.md`,
		basePath: './',
		title: slug,
		...overrides,
	} as ProcessedMarkdownFile
}

const bySlug = (slugs: string[]) =>
	new Map(slugs.map(slug => [slug, makePage(slug, { title: `Page ${slug}` })]))

/* === getChapterVars === */

describe('getChapterVars', () => {
	test('returns {} for a page outside every chapter', () => {
		expect(getChapterVars(makePage('about'), bySlug(['about']))).toEqual({})
	})

	test('returns {} for sectioned pages (blog, api)', () => {
		const post = makePage('some-post', { section: 'blog' })
		expect(getChapterVars(post, bySlug([]))).toEqual({})
	})

	test('computes prev/next links from sibling titles', () => {
		const map = bySlug([
			'components',
			'props',
			'effects',
			'styling',
			'accessibility',
			'extensions',
		])
		const vars = getChapterVars(makePage('props'), map)
		expect(vars['chapter-nav']).toContain('Building Components')
		expect(vars['chapter-nav']).toContain('Part 2 of 6')
		expect(vars['chapter-nav']).toContain('href="components.html"')
		expect(vars['chapter-nav']).toContain('Page components')
		expect(vars['chapter-nav']).toContain('href="effects.html"')
	})

	test('first chapter page has no prev link', () => {
		const map = bySlug(['components', 'props'])
		const vars = getChapterVars(makePage('components'), map)
		expect(vars['chapter-nav']).not.toContain('rel="prev"')
		expect(vars['chapter-nav']).toContain('rel="next"')
	})

	test('missing sibling is skipped; stepper collapses when no links remain', () => {
		// Only 'components' exists; props is absent from the build
		const map = bySlug(['components'])
		const vars = getChapterVars(makePage('components'), map)
		expect(vars['chapter-nav']).toBe('')
	})
})
