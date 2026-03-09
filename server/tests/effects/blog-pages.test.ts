/**
 * Unit Tests for blog helper functions in effects/pages.ts
 *
 * Covers:
 * - getBlogVariables: reading-time computation, tag HTML rendering
 * - generateBlogExcerpts: card output, ordering, empty state, < 3 posts
 * - computeBlogPrevNext: prev/next links, boundary conditions
 */

import { describe, expect, test } from 'bun:test'
import {
	computeBlogPrevNext,
	generateBlogExcerpts,
	getBlogVariables,
} from '../../effects/pages'
import type { ProcessedMarkdownFile } from '../../file-signals'

/* === Fixtures === */

function makePost(
	overrides: Partial<ProcessedMarkdownFile> & {
		slug: string
		date?: string | undefined
		tags?: string[]
		author?: string
		'author-avatar'?: string
		description?: string
		title?: string
		htmlContent?: string
		draft?: boolean
	},
): ProcessedMarkdownFile {
	const slug = overrides.slug
	const date = overrides.date ?? '2026-01-01'
	const title = overrides.title ?? `Post ${slug}`

	return {
		path: `/pages/blog/${slug}.md`,
		filename: `${slug}.md`,
		content: '',
		hash: '000',
		lastModified: 0,
		size: 0,
		exists: true,
		metadata: {
			layout: 'blog',
			date,
			author: overrides.author,
			'author-avatar': overrides['author-avatar'],
			description: overrides.description,
			tags: overrides.tags,
			draft: overrides.draft,
		},
		processedContent: '',
		htmlContent: overrides.htmlContent ?? `<p>${title} content</p>`,
		section: 'blog',
		depth: 1,
		relativePath: `blog/${slug}.md`,
		basePath: '../',
		title,
		...overrides,
	} as ProcessedMarkdownFile
}

/* === getBlogVariables === */

describe('getBlogVariables', () => {
	test('computes reading time of 1 for very short content', () => {
		const post = makePost({ slug: 'short', htmlContent: '<p>Hello world.</p>' })
		const vars = getBlogVariables(post)
		expect(vars['reading-time']).toBe('1')
	})

	test('computes reading time proportional to word count (200 wpm)', () => {
		// 400 words → 2 min
		const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ')
		const post = makePost({ slug: 'long', htmlContent: `<p>${words}</p>` })
		const vars = getBlogVariables(post)
		expect(vars['reading-time']).toBe('2')
	})

	test('strips HTML tags before counting words', () => {
		// Tags should not count as words
		const post = makePost({
			slug: 'html',
			htmlContent:
				'<h1>Title</h1><p>One two three.</p><pre><code>foo bar</code></pre>',
		})
		const vars = getBlogVariables(post)
		// 5 words → 1 min
		expect(vars['reading-time']).toBe('1')
	})

	test('reading time is at least 1 even for empty content', () => {
		const post = makePost({ slug: 'empty', htmlContent: '' })
		const vars = getBlogVariables(post)
		expect(vars['reading-time']).toBe('1')
	})

	test('returns published-date from metadata', () => {
		const post = makePost({ slug: 'dated', date: '2026-03-09' })
		const vars = getBlogVariables(post)
		expect(vars['published-date']).toBe('2026-03-09')
	})

	test('returns empty published-date when metadata.date is missing', () => {
		const post = makePost({ slug: 'no-date' })
		post.metadata.date = ''
		const vars = getBlogVariables(post)
		expect(vars['published-date']).toBe('')
	})

	test('renders tags as <span class="tag"> elements', () => {
		const post = makePost({ slug: 'tagged', tags: ['release', 'feature'] })
		const vars = getBlogVariables(post)
		expect(vars['blog-tags']).toContain('<span class="tag">release</span>')
		expect(vars['blog-tags']).toContain('<span class="tag">feature</span>')
	})

	test('HTML-escapes tag content', () => {
		const post = makePost({ slug: 'xss', tags: ['<script>alert(1)</script>'] })
		const vars = getBlogVariables(post)
		expect(vars['blog-tags']).not.toContain('<script>')
		expect(vars['blog-tags']).toContain('&lt;script&gt;')
	})

	test('returns empty blog-tags string when no tags', () => {
		const post = makePost({ slug: 'no-tags' })
		const vars = getBlogVariables(post)
		expect(vars['blog-tags']).toBe('')
	})
})

/* === generateBlogExcerpts === */

describe('generateBlogExcerpts', () => {
	test('returns fallback message for empty post list', () => {
		const result = generateBlogExcerpts([])
		expect(result).toContain('No blog posts yet')
	})

	test('generates a card-blogpost element for each post', () => {
		const posts = [
			makePost({ slug: 'post-a', date: '2026-03-01' }),
			makePost({ slug: 'post-b', date: '2026-02-01' }),
		]
		const result = generateBlogExcerpts(posts)
		const cardCount = (result.match(/<card-blogpost>/g) ?? []).length
		expect(cardCount).toBe(2)
	})

	test('renders at most 3 cards even when more posts are given', () => {
		const posts = [
			makePost({ slug: 'p1', date: '2026-04-01' }),
			makePost({ slug: 'p2', date: '2026-03-01' }),
			makePost({ slug: 'p3', date: '2026-02-01' }),
			makePost({ slug: 'p4', date: '2026-01-01' }),
		]
		const result = generateBlogExcerpts(posts)
		const cardCount = (result.match(/<card-blogpost>/g) ?? []).length
		expect(cardCount).toBe(3)
		// p4 should not appear (4th post in date-desc order)
		expect(result).not.toContain('/blog/p4')
	})

	test('preserves input order (caller is responsible for sorting)', () => {
		const posts = [
			makePost({ slug: 'newest', date: '2026-03-01', title: 'Newest' }),
			makePost({ slug: 'oldest', date: '2026-01-01', title: 'Oldest' }),
		]
		const result = generateBlogExcerpts(posts)
		const newestIndex = result.indexOf('/blog/newest')
		const oldestIndex = result.indexOf('/blog/oldest')
		expect(newestIndex).toBeLessThan(oldestIndex)
	})

	test('includes slug-based URL in card link', () => {
		const post = makePost({ slug: '2026-03-09-hello', date: '2026-03-09' })
		const result = generateBlogExcerpts([post])
		expect(result).toContain('href="/blog/2026-03-09-hello"')
	})

	test('includes card-blogmeta with time and author span', () => {
		const post = makePost({
			slug: 'meta-test',
			date: '2026-03-09',
			author: 'Alice',
		})
		const result = generateBlogExcerpts([post])
		expect(result).toContain('<time datetime="2026-03-09">')
		expect(result).toContain('<span>Alice</span>')
	})

	test('includes avatar img with derived path when author-avatar not set', () => {
		const post = makePost({
			slug: 'with-avatar',
			date: '2026-03-09',
			author: 'Alice Brunner',
		})
		const result = generateBlogExcerpts([post])
		expect(result).toContain('src="./assets/img/avatar/alice-brunner.jpg"')
	})

	test('includes avatar img with explicit path when author-avatar is set', () => {
		const post = makePost({
			slug: 'explicit-avatar',
			date: '2026-03-09',
			author: 'Bob',
			'author-avatar': '/img/bob.jpg',
		})
		const result = generateBlogExcerpts([post])
		expect(result).toContain('src="/img/bob.jpg"')
	})

	test('omits avatar attribute when not set', () => {
		const post = makePost({
			slug: 'no-avatar',
			date: '2026-03-09',
			author: 'Eve',
		})
		const result = generateBlogExcerpts([post])
		expect(result).not.toContain('avatar=')
	})

	test('includes description paragraph when present', () => {
		const post = makePost({
			slug: 'with-desc',
			date: '2026-03-09',
			description: 'A short summary.',
		})
		const result = generateBlogExcerpts([post])
		expect(result).toContain('<p>A short summary.</p>')
	})

	test('HTML-escapes title, description, and author', () => {
		const post = makePost({
			slug: 'escape-test',
			date: '2026-03-09',
			title: '<b>Bold</b>',
			description: '"Quoted" & <em>em</em>',
			author: "O'Reilly",
		})
		const result = generateBlogExcerpts([post])
		expect(result).not.toContain('<b>Bold</b>')
		expect(result).toContain('&lt;b&gt;')
	})
})

/* === computeBlogPrevNext === */

describe('computeBlogPrevNext', () => {
	// sortedPosts is date-desc: index 0 = newest, last = oldest
	// "prev" = older = index i+1, "next" = newer = index i-1

	const posts = [
		makePost({ slug: 'march', date: '2026-03-01', title: 'March Post' }),
		makePost({ slug: 'feb', date: '2026-02-01', title: 'Feb Post' }),
		makePost({ slug: 'jan', date: '2026-01-01', title: 'Jan Post' }),
	]

	test('produces an entry for each post', () => {
		const map = computeBlogPrevNext(posts)
		expect(map.size).toBe(3)
	})

	test('newest post has no next-post (it is already the latest)', () => {
		const map = computeBlogPrevNext(posts)
		const newest = map.get(posts[0]!.path)!
		expect(newest['next-post']).toBe('')
		expect(newest['next-post-title']).toBe('')
	})

	test('newest post has prev-post pointing to the second post', () => {
		const map = computeBlogPrevNext(posts)
		const newest = map.get(posts[0]!.path)!
		expect(newest['prev-post']).toBe('/blog/feb')
		expect(newest['prev-post-title']).toBe('Feb Post')
	})

	test('middle post has both prev and next', () => {
		const map = computeBlogPrevNext(posts)
		const middle = map.get(posts[1]!.path)!
		expect(middle['prev-post']).toBe('/blog/jan')
		expect(middle['next-post']).toBe('/blog/march')
	})

	test('oldest post has no prev-post (it is already the earliest)', () => {
		const map = computeBlogPrevNext(posts)
		const oldest = map.get(posts[2]!.path)!
		expect(oldest['prev-post']).toBe('')
		expect(oldest['prev-post-title']).toBe('')
	})

	test('oldest post has next-post pointing to the middle post', () => {
		const map = computeBlogPrevNext(posts)
		const oldest = map.get(posts[2]!.path)!
		expect(oldest['next-post']).toBe('/blog/feb')
		expect(oldest['next-post-title']).toBe('Feb Post')
	})

	test('single post has no prev or next', () => {
		const solo = makePost({ slug: 'only', date: '2026-01-01' })
		const map = computeBlogPrevNext([solo])
		const entry = map.get(solo.path)!
		expect(entry['prev-post']).toBe('')
		expect(entry['next-post']).toBe('')
	})

	test('empty list produces an empty map', () => {
		const map = computeBlogPrevNext([])
		expect(map.size).toBe(0)
	})

	test('URLs use /blog/<slug> format stripping blog/ prefix and .md', () => {
		const map = computeBlogPrevNext(posts)
		const newest = map.get(posts[0]!.path)!
		expect(newest['prev-post']).toMatch(/^\/blog\/[^/]+$/)
		expect(newest['prev-post']).not.toContain('.md')
		expect(newest['prev-post']).not.toContain('blog/blog/')
	})
})
