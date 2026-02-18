/**
 * Unit Tests for schema/heading.markdoc.ts — Heading Schema
 *
 * Tests for the heading Markdoc schema transformation including
 * accessible heading generation, anchor links, and slug generation.
 */

import { describe, test, expect } from 'bun:test'
import { Node, Tag } from '@markdoc/markdoc'
import heading from '../../schema/heading.markdoc'

/* === Core Transformation Tests === */

describe('heading schema - basic transformation', () => {
	test('should transform heading node to accessible heading', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Hello World' })],
		)

		const result = heading.transform!(node, {})

		expect(result).toBeInstanceOf(Tag)
	})

	test('should create heading with correct level', () => {
		const levels = [1, 2, 3, 4, 5, 6]

		for (const level of levels) {
			const node = new Node(
				'heading',
				{
					level,
				},
				[new Node('text', { content: 'Test' })],
			)

			const result = heading.transform!(node, {}) as Tag

			expect(result.name).toBe(`h${level}`)
		}
	})

	test('should handle empty heading', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[],
		)

		const result = heading.transform!(node, {}) as Tag

		expect(result).toBeInstanceOf(Tag)
		expect(result.name).toBe('h2')
	})

	test('should handle heading with multiple text nodes', () => {
		const node = new Node(
			'heading',
			{
				level: 3,
			},
			[
				new Node('text', { content: 'Part One ' }),
				new Node('text', { content: 'Part Two' }),
			],
		)

		const result = heading.transform!(node, {}) as Tag

		expect(result).toBeInstanceOf(Tag)
		expect(result.name).toBe('h3')
	})
})

/* === ID Generation Tests === */

describe('heading schema - ID generation', () => {
	test('should generate slug-based ID', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Hello World' })],
		)

		const result = heading.transform!(node, {}) as Tag

		expect(result.attributes.id).toBe('hello-world')
	})

	test('should handle special characters in heading', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Hello! @World#' })],
		)

		const result = heading.transform!(node, {}) as Tag

		expect(result.attributes.id).toBe('hello-world')
	})

	test('should handle multiple spaces', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Multiple   Spaces' })],
		)

		const result = heading.transform!(node, {}) as Tag

		expect(result.attributes.id).toBe('multiple-spaces')
	})

	test('should lowercase heading text for ID', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'UPPERCASE Heading' })],
		)

		const result = heading.transform!(node, {}) as Tag

		expect(result.attributes.id).toBe('uppercase-heading')
	})

	test('should handle heading with numbers', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Version 2.0 Release' })],
		)

		const result = heading.transform!(node, {}) as Tag

		expect(result.attributes.id).toBeTruthy()
		expect(result.attributes.id).toMatch(/version/)
	})
})

/* === Anchor Link Tests === */

describe('heading schema - anchor link', () => {
	test('should include anchor link', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Test Heading' })],
		)

		const result = heading.transform!(node, {}) as Tag
		const anchor = result.children[0] as Tag

		expect(anchor).toBeInstanceOf(Tag)
		expect(anchor.name).toBe('a')
	})

	test('should set anchor href to heading ID', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'My Heading' })],
		)

		const result = heading.transform!(node, {}) as Tag
		const anchor = result.children[0] as Tag

		expect(anchor.attributes.href).toBe('#my-heading')
	})

	test('should set anchor name attribute', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Test' })],
		)

		const result = heading.transform!(node, {}) as Tag
		const anchor = result.children[0] as Tag

		expect(anchor.attributes.name).toBe('test')
	})

	test('should set anchor class', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Test' })],
		)

		const result = heading.transform!(node, {}) as Tag
		const anchor = result.children[0] as Tag

		expect(anchor.attributes.class).toBe('anchor')
	})
})

/* === Title and Permalink Spans Tests === */

describe('heading schema - title and permalink spans', () => {
	test('should include title span', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'My Title' })],
		)

		const result = heading.transform!(node, {}) as Tag
		const anchor = result.children[0] as Tag
		const titleSpan = anchor.children[0] as Tag

		expect(titleSpan).toBeInstanceOf(Tag)
		expect(titleSpan.name).toBe('span')
		expect(titleSpan.attributes.class).toBe('title')
	})

	test('should include heading text in title span', () => {
		const headingText = 'Important Section'
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: headingText })],
		)

		const result = heading.transform!(node, {}) as Tag
		const anchor = result.children[0] as Tag
		const titleSpan = anchor.children[0] as Tag

		expect(titleSpan.children[0]).toBe(headingText)
	})

	test('should include permalink span', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Test' })],
		)

		const result = heading.transform!(node, {}) as Tag
		const anchor = result.children[0] as Tag
		const permalinkSpan = anchor.children[1] as Tag

		expect(permalinkSpan).toBeInstanceOf(Tag)
		expect(permalinkSpan.name).toBe('span')
		expect(permalinkSpan.attributes.class).toBe('permalink')
	})

	test('should include hash symbol in permalink span', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Test' })],
		)

		const result = heading.transform!(node, {}) as Tag
		const anchor = result.children[0] as Tag
		const permalinkSpan = anchor.children[1] as Tag

		expect(permalinkSpan.children[0]).toBe('#')
	})

	test('should have both title and permalink spans', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Test' })],
		)

		const result = heading.transform!(node, {}) as Tag
		const anchor = result.children[0] as Tag

		expect(anchor.children.length).toBe(2)
	})
})

/* === Text Extraction Tests === */

describe('heading schema - text extraction', () => {
	test('should extract text from simple node', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Simple Text' })],
		)

		const result = heading.transform!(node, {}) as Tag
		const anchor = result.children[0] as Tag
		const titleSpan = anchor.children[0] as Tag

		expect(titleSpan.children[0]).toBe('Simple Text')
	})

	test('should concatenate multiple text nodes', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[
				new Node('text', { content: 'First ' }),
				new Node('text', { content: 'Second' }),
			],
		)

		const result = heading.transform!(node, {}) as Tag
		const anchor = result.children[0] as Tag
		const titleSpan = anchor.children[0] as Tag

		expect(titleSpan.children[0]).toBe('First Second')
	})

	test('should handle nested formatting nodes', () => {
		const strongNode = new Node('strong', {}, [
			new Node('text', { content: 'Bold Text' }),
		])
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Normal ' }), strongNode],
		)

		const result = heading.transform!(node, {}) as Tag

		expect(result).toBeInstanceOf(Tag)
	})

	test('should handle empty text', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: '' })],
		)

		const result = heading.transform!(node, {}) as Tag

		expect(result).toBeInstanceOf(Tag)
	})
})

/* === Integration Tests === */

describe('heading schema - integration', () => {
	test('should create complete accessible heading structure', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Getting Started' })],
		)

		const result = heading.transform!(node, {}) as Tag

		// Check heading element
		expect(result.name).toBe('h2')
		expect(result.attributes.id).toBe('getting-started')

		// Check anchor
		const anchor = result.children[0] as Tag
		expect(anchor.name).toBe('a')
		expect(anchor.attributes.href).toBe('#getting-started')
		expect(anchor.attributes.name).toBe('getting-started')
		expect(anchor.attributes.class).toBe('anchor')

		// Check spans
		expect(anchor.children.length).toBe(2)
	})

	test('should work for all heading levels', () => {
		for (let level = 1; level <= 6; level++) {
			const node = new Node(
				'heading',
				{
					level,
				},
				[new Node('text', { content: `Level ${level}` })],
			)

			const result = heading.transform!(node, {}) as Tag

			expect(result.name).toBe(`h${level}`)
			expect(result.attributes.id).toBeTruthy()

			const anchor = result.children[0] as Tag
			expect(anchor.name).toBe('a')
		}
	})

	test('should handle complex heading text', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'How to Use the API (v2.0)' })],
		)

		const result = heading.transform!(node, {}) as Tag
		const anchor = result.children[0] as Tag
		const titleSpan = anchor.children[0] as Tag

		expect(result.attributes.id).toBeTruthy()
		expect(titleSpan.children[0]).toBe('How to Use the API (v2.0)')
	})

	test('should handle unicode characters', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'Émojis 🚀 and Unicode' })],
		)

		const result = heading.transform!(node, {}) as Tag

		expect(result).toBeInstanceOf(Tag)
		expect(result.attributes.id).toBeTruthy()
	})
})

/* === Edge Cases === */

describe('heading schema - edge cases', () => {
	test('should handle heading with only whitespace', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: '   ' })],
		)

		const result = heading.transform!(node, {}) as Tag

		expect(result).toBeInstanceOf(Tag)
	})

	test('should handle very long heading text', () => {
		const longText =
			'This is a very long heading that contains many words and should still work correctly'
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: longText })],
		)

		const result = heading.transform!(node, {}) as Tag
		const anchor = result.children[0] as Tag
		const titleSpan = anchor.children[0] as Tag

		expect(result.attributes.id).toBeTruthy()
		expect(titleSpan.children[0]).toBe(longText)
	})

	test('should handle heading with HTML entities', () => {
		const node = new Node(
			'heading',
			{
				level: 2,
			},
			[new Node('text', { content: 'A & B' })],
		)

		const result = heading.transform!(node, {}) as Tag

		expect(result).toBeInstanceOf(Tag)
	})
})
