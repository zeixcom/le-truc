/**
 * Unit Tests for effects/llms-manifest.ts — llms.txt Generation
 */

import { describe, expect, test } from 'bun:test'
import { generateLlmsTxt } from '../../effects/llms-manifest'
import type { PageInfo } from '../../file-signals'

/* === Helpers === */

function makePageInfo(
	overrides: Partial<PageInfo> & { relativePath: string },
): PageInfo {
	const { relativePath, ...rest } = overrides
	return {
		title: rest.title ?? relativePath.replace(/\.md$/, ''),
		emoji: rest.emoji ?? '📄',
		description: rest.description ?? '',
		url: relativePath.replace('.md', '.html'),
		filename: relativePath.split('/').at(-1) ?? relativePath,
		relativePath,
		lastModified: 0,
		section:
			rest.section ??
			(relativePath.includes('/') ? relativePath.split('/')[0] : undefined),
		...rest,
	}
}

const corePages: PageInfo[] = [
	makePageInfo({ relativePath: 'index.md', title: 'Introduction' }),
	makePageInfo({
		relativePath: 'getting-started.md',
		title: 'Getting Started',
	}),
	makePageInfo({ relativePath: 'components.md', title: 'Components' }),
	makePageInfo({ relativePath: 'data-flow.md', title: 'Data Flow' }),
]

const blogPages: PageInfo[] = [
	makePageInfo({
		relativePath: 'blog/2026-01-01-post-a.md',
		title: 'Post A',
		section: 'blog',
	}),
	makePageInfo({
		relativePath: 'blog/2026-02-01-post-b.md',
		title: 'Post B',
		section: 'blog',
	}),
]

const apiPages: PageInfo[] = [
	makePageInfo({
		relativePath: 'api/define-component.md',
		title: 'defineComponent',
		section: 'api',
	}),
]

/* === Header and structure === */

describe('generateLlmsTxt — header', () => {
	test('starts with correct h1', () => {
		const result = generateLlmsTxt(corePages)
		expect(result).toStartWith('# Le Truc Documentation\n')
	})

	test('includes tagline as blockquote', () => {
		const result = generateLlmsTxt(corePages)
		expect(result).toContain('> High-performance, signal-based web components.')
	})

	test('ends with a newline', () => {
		const result = generateLlmsTxt(corePages)
		expect(result).toEndWith('\n')
	})

	test('returns valid content for empty page list', () => {
		const result = generateLlmsTxt([])
		expect(result).toStartWith('# Le Truc Documentation')
		expect(result).not.toContain('## ')
	})
})

/* === Grouping === */

describe('generateLlmsTxt — section grouping', () => {
	test('top-level pages go into Core Reference', () => {
		const result = generateLlmsTxt(corePages)
		expect(result).toContain('## Core Reference')
		expect(result).toContain('[Introduction](./index.md)')
	})

	test('blog/ pages go into Blog', () => {
		const result = generateLlmsTxt(blogPages)
		expect(result).toContain('## Blog')
		expect(result).toContain('[Post A](./blog/2026-01-01-post-a.md)')
	})

	test('api/ pages go into API Reference', () => {
		const result = generateLlmsTxt(apiPages)
		expect(result).toContain('## API Reference')
		expect(result).toContain('[defineComponent](./api/define-component.md)')
	})

	test('unknown section is capitalized', () => {
		const page = makePageInfo({
			relativePath: 'guides/quick.md',
			title: 'Quick',
			section: 'guides',
		})
		const result = generateLlmsTxt([page])
		expect(result).toContain('## Guides')
	})

	test('mixed pages produce multiple sections', () => {
		const result = generateLlmsTxt([...corePages, ...blogPages, ...apiPages])
		expect(result).toContain('## Core Reference')
		expect(result).toContain('## Blog')
		expect(result).toContain('## API Reference')
	})
})

/* === Section ordering === */

describe('generateLlmsTxt — section order', () => {
	test('Core Reference appears before Blog', () => {
		const result = generateLlmsTxt([...corePages, ...blogPages])
		expect(result.indexOf('## Core Reference')).toBeLessThan(
			result.indexOf('## Blog'),
		)
	})

	test('API Reference appears before Blog', () => {
		const result = generateLlmsTxt([...apiPages, ...blogPages])
		expect(result.indexOf('## API Reference')).toBeLessThan(
			result.indexOf('## Blog'),
		)
	})

	test('Core Reference appears before API Reference', () => {
		const result = generateLlmsTxt([...corePages, ...apiPages])
		expect(result.indexOf('## Core Reference')).toBeLessThan(
			result.indexOf('## API Reference'),
		)
	})
})

/* === Page ordering within sections === */

describe('generateLlmsTxt — page ordering', () => {
	test('respects PAGE_ORDER for top-level pages', () => {
		const pages = [
			makePageInfo({ relativePath: 'components.md', title: 'Components' }),
			makePageInfo({
				relativePath: 'getting-started.md',
				title: 'Getting Started',
			}),
			makePageInfo({ relativePath: 'index.md', title: 'Introduction' }),
		]
		const result = generateLlmsTxt(pages)
		const introIdx = result.indexOf('[Introduction]')
		const gettingStartedIdx = result.indexOf('[Getting Started]')
		const componentsIdx = result.indexOf('[Components]')
		expect(introIdx).toBeLessThan(gettingStartedIdx)
		expect(gettingStartedIdx).toBeLessThan(componentsIdx)
	})

	test('sorts alphabetically within section for pages not in PAGE_ORDER', () => {
		const pages = [
			makePageInfo({
				relativePath: 'blog/z-post.md',
				title: 'Z Post',
				section: 'blog',
			}),
			makePageInfo({
				relativePath: 'blog/a-post.md',
				title: 'A Post',
				section: 'blog',
			}),
		]
		const result = generateLlmsTxt(pages)
		expect(result.indexOf('[A Post]')).toBeLessThan(result.indexOf('[Z Post]'))
	})
})

/* === Link format === */

describe('generateLlmsTxt — link format', () => {
	test('uses relative ./ paths', () => {
		const result = generateLlmsTxt(corePages)
		expect(result).toContain('./index.md')
		expect(result).not.toContain('/docs/')
	})

	test('preserves nested paths', () => {
		const result = generateLlmsTxt(blogPages)
		expect(result).toContain('./blog/2026-01-01-post-a.md')
	})

	test('link format is "- [Title](./path.md)"', () => {
		const pages = [
			makePageInfo({ relativePath: 'index.md', title: 'Introduction' }),
		]
		const result = generateLlmsTxt(pages)
		expect(result).toContain('- [Introduction](./index.md)')
	})

	test('all pages are listed', () => {
		const all = [...corePages, ...blogPages, ...apiPages]
		const result = generateLlmsTxt(all)
		for (const page of all) {
			expect(result).toContain(`./${page.relativePath}`)
		}
	})
})
