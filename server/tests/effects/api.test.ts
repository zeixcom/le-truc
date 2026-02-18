/**
 * Unit Tests for effects/api.ts — API Documentation Generation
 *
 * Tests for the pure functions that parse TypeDoc globals.md output
 * and generate a listnav-compatible Markdown index page.
 */

import { describe, expect, test } from 'bun:test'
import {
	type ApiCategory,
	computeSourcesHash,
	generateApiIndexMarkdown,
	parseGlobals,
} from '../../effects/api'

/* === parseGlobals Tests === */

describe('parseGlobals', () => {
	test('parses a single category with entries', () => {
		const content = `# API Reference

## Functions

- [defineComponent](functions/defineComponent.md)
- [on](functions/on.md)
- [setText](functions/setText.md)
`
		const result = parseGlobals(content)

		expect(result).toHaveLength(1)
		expect(result[0].name).toBe('Functions')
		expect(result[0].slug).toBe('functions')
		expect(result[0].entries).toHaveLength(3)
		expect(result[0].entries[0]).toEqual({
			name: 'defineComponent',
			slug: 'defineComponent',
		})
	})

	test('parses multiple categories', () => {
		const content = `# API Reference

## Classes

- [ContextRequestEvent](classes/ContextRequestEvent.md)
- [DependencyTimeoutError](classes/DependencyTimeoutError.md)

## Functions

- [defineComponent](functions/defineComponent.md)

## Type Aliases

- [Component](type-aliases/Component.md)
- [Effect](type-aliases/Effect.md)

## Variables

- [CONTEXT_REQUEST](variables/CONTEXT_REQUEST.md)
`
		const result = parseGlobals(content)

		expect(result).toHaveLength(4)
		expect(result[0].name).toBe('Classes')
		expect(result[0].entries).toHaveLength(2)
		expect(result[1].name).toBe('Functions')
		expect(result[1].entries).toHaveLength(1)
		expect(result[2].name).toBe('Type Aliases')
		expect(result[2].slug).toBe('type-aliases')
		expect(result[2].entries).toHaveLength(2)
		expect(result[3].name).toBe('Variables')
		expect(result[3].entries).toHaveLength(1)
	})

	test('filters out empty categories', () => {
		const content = `## Empty Category

## Functions

- [defineComponent](functions/defineComponent.md)
`
		const result = parseGlobals(content)

		expect(result).toHaveLength(1)
		expect(result[0].name).toBe('Functions')
	})

	test('returns empty array for content with no categories', () => {
		const content = `# API Reference

Some introductory text without any headings.
`
		const result = parseGlobals(content)

		expect(result).toHaveLength(0)
	})

	test('returns empty array for empty string', () => {
		expect(parseGlobals('')).toHaveLength(0)
	})

	test('extracts slug from link path, not display name', () => {
		const content = `## Type Aliases

- [ComponentProp](type-aliases/ComponentProp.md)
`
		const result = parseGlobals(content)

		expect(result[0].entries[0].name).toBe('ComponentProp')
		expect(result[0].entries[0].slug).toBe('ComponentProp')
	})

	test('ignores lines that are not headings or list entries', () => {
		const content = `## Functions

Some paragraph text that should be ignored.

- [defineComponent](functions/defineComponent.md)

Another paragraph.

- [on](functions/on.md)
`
		const result = parseGlobals(content)

		expect(result[0].entries).toHaveLength(2)
	})

	test('handles entries with special characters in names', () => {
		const content = `## Type Aliases

- [ElementFromKey](type-aliases/ElementFromKey.md)
- [UI](type-aliases/UI.md)
`
		const result = parseGlobals(content)

		expect(result[0].entries[0].name).toBe('ElementFromKey')
		expect(result[0].entries[1].name).toBe('UI')
	})
})

/* === generateApiIndexMarkdown Tests === */

describe('generateApiIndexMarkdown', () => {
	const sampleCategories: ApiCategory[] = [
		{
			name: 'Classes',
			slug: 'classes',
			entries: [
				{ name: 'ContextRequestEvent', slug: 'ContextRequestEvent' },
				{ name: 'DependencyTimeoutError', slug: 'DependencyTimeoutError' },
			],
		},
		{
			name: 'Functions',
			slug: 'functions',
			entries: [{ name: 'defineComponent', slug: 'defineComponent' }],
		},
	]

	test('generates valid frontmatter', () => {
		const result = generateApiIndexMarkdown(sampleCategories)

		expect(result).toContain("title: 'API'")
		expect(result).toContain("emoji: '📖'")
		expect(result).toContain("layout: 'page'")
		expect(result).toStartWith('---\n')
	})

	test('includes hero section', () => {
		const result = generateApiIndexMarkdown(sampleCategories)

		expect(result).toContain('{% hero %}')
		expect(result).toContain('{% /hero %}')
		expect(result).toContain('# 📖 API Reference')
	})

	test('includes listnav tag', () => {
		const result = generateApiIndexMarkdown(sampleCategories)

		expect(result).toContain('{% listnav title="Symbols" %}')
		expect(result).toContain('{% /listnav %}')
	})

	test('generates grouped list items with correct links', () => {
		const result = generateApiIndexMarkdown(sampleCategories)

		expect(result).toContain('- Classes')
		expect(result).toContain(
			'  - [ContextRequestEvent](/api/classes/ContextRequestEvent.html)',
		)
		expect(result).toContain(
			'  - [DependencyTimeoutError](/api/classes/DependencyTimeoutError.html)',
		)
		expect(result).toContain('- Functions')
		expect(result).toContain(
			'  - [defineComponent](/api/functions/defineComponent.html)',
		)
	})

	test('handles empty categories array', () => {
		const result = generateApiIndexMarkdown([])

		expect(result).toContain('{% listnav title="Symbols" %}')
		expect(result).toContain('{% /listnav %}')
		// Should still be valid markdown, just with no list items
		expect(result).toContain("title: 'API'")
	})

	test('generates correct link paths for type-aliases', () => {
		const categories: ApiCategory[] = [
			{
				name: 'Type Aliases',
				slug: 'type-aliases',
				entries: [{ name: 'Component', slug: 'Component' }],
			},
		]
		const result = generateApiIndexMarkdown(categories)

		expect(result).toContain(
			'  - [Component](/api/type-aliases/Component.html)',
		)
	})
})

/* === computeSourcesHash Tests === */

describe('computeSourcesHash', () => {
	test('returns a consistent hash for the same inputs', () => {
		const sources = [
			{ hash: 'abc123', path: 'src/a.ts' },
			{ hash: 'def456', path: 'src/b.ts' },
		]
		const hash1 = computeSourcesHash(sources)
		const hash2 = computeSourcesHash(sources)

		expect(hash1).toBe(hash2)
	})

	test('returns the same hash regardless of input order', () => {
		const sources1 = [
			{ hash: 'abc123', path: 'src/a.ts' },
			{ hash: 'def456', path: 'src/b.ts' },
		]
		const sources2 = [
			{ hash: 'def456', path: 'src/b.ts' },
			{ hash: 'abc123', path: 'src/a.ts' },
		]

		expect(computeSourcesHash(sources1)).toBe(computeSourcesHash(sources2))
	})

	test('returns a different hash when sources change', () => {
		const before = [
			{ hash: 'abc123', path: 'src/a.ts' },
			{ hash: 'def456', path: 'src/b.ts' },
		]
		const after = [
			{ hash: 'abc123', path: 'src/a.ts' },
			{ hash: 'changed', path: 'src/b.ts' },
		]

		expect(computeSourcesHash(before)).not.toBe(computeSourcesHash(after))
	})

	test('returns a different hash when a file is added', () => {
		const before = [{ hash: 'abc123', path: 'src/a.ts' }]
		const after = [
			{ hash: 'abc123', path: 'src/a.ts' },
			{ hash: 'def456', path: 'src/b.ts' },
		]

		expect(computeSourcesHash(before)).not.toBe(computeSourcesHash(after))
	})

	test('handles empty sources array', () => {
		const hash = computeSourcesHash([])

		expect(typeof hash).toBe('string')
		expect(hash.length).toBeGreaterThan(0)
	})

	test('handles single source', () => {
		const hash = computeSourcesHash([{ hash: 'abc123', path: 'src/a.ts' }])

		expect(typeof hash).toBe('string')
		expect(hash.length).toBeGreaterThan(0)
	})
})
