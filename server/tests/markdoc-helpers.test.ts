/**
 * Unit Tests for markdoc-helpers.ts — Markdoc Utilities
 *
 * Tests for node utilities, ID/slug generation, tag helpers,
 * and HTML template helpers.
 */

import { describe, expect, test } from 'bun:test'
import { Node, Tag } from '@markdoc/markdoc'
import {
	createAccessibleHeading,
	createNavigationButton,
	createTabButton,
	createVisuallyHiddenHeading,
	extractNavigationItem,
	extractTextFromNode,
	generateId,
	generateSlug,
	rawText,
	splitContentBySeparator,
} from '../markdoc-helpers'

/* === Node Utilities === */

describe('extractTextFromNode', () => {
	test('should extract text from text node', () => {
		const node = new Node('text', { content: 'Hello World' })
		expect(extractTextFromNode(node)).toBe('Hello World')
	})

	test('should extract text from nested nodes', () => {
		const textNode1 = new Node('text', { content: 'Hello ' })
		const textNode2 = new Node('text', { content: 'World' })
		const parentNode = new Node('paragraph', {}, [textNode1, textNode2])

		expect(extractTextFromNode(parentNode)).toBe('Hello World')
	})

	test('should skip list nodes when skipLists is true', () => {
		const textNode = new Node('text', { content: 'List item' })
		const listNode = new Node('list', {}, [textNode])
		const textNode2 = new Node('text', { content: 'Other text' })
		const parentNode = new Node('paragraph', {}, [listNode, textNode2])

		expect(extractTextFromNode(parentNode, true)).toBe('Other text')
	})

	test('should include list nodes when skipLists is false', () => {
		const textNode = new Node('text', { content: 'List item' })
		const listNode = new Node('list', {}, [textNode])

		expect(extractTextFromNode(listNode, false)).toBe('List item')
	})

	test('should handle empty node', () => {
		const node = new Node('paragraph', {}, [])
		expect(extractTextFromNode(node)).toBe('')
	})

	test('should handle deeply nested structure', () => {
		const text1 = new Node('text', { content: 'Level 1 ' })
		const text2 = new Node('text', { content: 'Level 2 ' })
		const text3 = new Node('text', { content: 'Level 3' })

		const level2 = new Node('em', {}, [text2, text3])
		const level1 = new Node('strong', {}, [text1, level2])

		expect(extractTextFromNode(level1)).toBe('Level 1 Level 2 Level 3')
	})
})

describe('splitContentBySeparator', () => {
	test('should split by horizontal rule', () => {
		const node1 = new Node('paragraph', { content: 'Section 1' })
		const hr = new Node('hr', {})
		const node2 = new Node('paragraph', { content: 'Section 2' })

		const sections = splitContentBySeparator([node1, hr, node2])

		expect(sections.length).toBe(2)
		expect(sections[0]).toContain(node1)
		expect(sections[1]).toContain(node2)
	})

	test('should handle multiple separators', () => {
		const node1 = new Node('paragraph', {})
		const hr1 = new Node('hr', {})
		const node2 = new Node('paragraph', {})
		const hr2 = new Node('hr', {})
		const node3 = new Node('paragraph', {})

		const sections = splitContentBySeparator([node1, hr1, node2, hr2, node3])

		expect(sections.length).toBe(3)
	})

	test('should handle no separators', () => {
		const node1 = new Node('paragraph', {})
		const node2 = new Node('paragraph', {})

		const sections = splitContentBySeparator([node1, node2])

		expect(sections.length).toBe(1)
		expect(sections[0].length).toBe(2)
	})

	test('should ignore leading separator', () => {
		const hr = new Node('hr', {})
		const node1 = new Node('paragraph', {})

		const sections = splitContentBySeparator([hr, node1])

		expect(sections.length).toBe(1)
		expect(sections[0]).toContain(node1)
	})

	test('should ignore trailing separator', () => {
		const node1 = new Node('paragraph', {})
		const hr = new Node('hr', {})

		const sections = splitContentBySeparator([node1, hr])

		expect(sections.length).toBe(1)
		expect(sections[0]).toContain(node1)
	})

	test('should use custom separator type', () => {
		const node1 = new Node('paragraph', {})
		// @ts-expect-error - Testing with custom node type not in Markdoc's NodeType
		const separator = new Node('divider', {})
		const node2 = new Node('paragraph', {})

		const sections = splitContentBySeparator(
			[node1, separator, node2],
			'divider',
		)

		expect(sections.length).toBe(2)
	})
})

/* === ID / Slug Generation === */

describe('generateId', () => {
	test('should generate id from text', () => {
		const id = generateId('Hello World')
		expect(id).toBe('hello-world')
	})

	test('should remove special characters', () => {
		const id = generateId('Hello! @World#')
		expect(id).toBe('hello-world')
	})

	test('should decode HTML entities', () => {
		const id = generateId('Quote &quot;text&quot;')
		expect(id).toContain('quote')
	})

	test('should handle multiple spaces', () => {
		const id = generateId('Multiple   Spaces')
		expect(id).toBe('multiple-spaces')
	})

	test('should generate random id for empty string', () => {
		const id = generateId('')
		expect(id).toBeTruthy()
		expect(id.length).toBeGreaterThan(0)
	})

	test('should generate random id when no argument', () => {
		const id1 = generateId()
		const id2 = generateId()
		expect(id1).toBeTruthy()
		expect(id2).toBeTruthy()
		expect(id1).not.toBe(id2)
	})

	test('should trim leading and trailing hyphens', () => {
		const id = generateId('---hello---')
		expect(id).toBe('hello')
	})

	test('should collapse multiple hyphens', () => {
		const id = generateId('hello---world')
		expect(id).toBe('hello-world')
	})
})

describe('generateSlug', () => {
	test('should generate slug from text', () => {
		const slug = generateSlug('Hello World')
		expect(slug).toBe('hello-world')
	})

	test('should decode HTML entities', () => {
		const slug = generateSlug('Quote &quot;text&quot; &amp; more')
		expect(slug).toBeTruthy()
	})

	test('should handle special characters', () => {
		const slug = generateSlug('Special! @Characters#')
		expect(slug).toBeTruthy()
	})

	test('should handle unicode', () => {
		const slug = generateSlug('Café résumé')
		expect(slug).toBeTruthy()
	})
})

/* === Navigation Helpers === */

describe('extractNavigationItem', () => {
	test('should extract label and href from link node', () => {
		const textNode = new Node('text', { content: 'Home' })
		const linkNode = new Node('link', { href: '/home' }, [textNode])
		const item = new Node('item', {}, [linkNode])

		const result = extractNavigationItem(item)

		expect(result).not.toBeNull()
		expect(result?.label).toBe('Home')
		expect(result?.src).toBe('/home')
	})

	test('should find nested link node', () => {
		const textNode = new Node('text', { content: 'About' })
		const linkNode = new Node('link', { href: '/about' }, [textNode])
		const strongNode = new Node('strong', {}, [linkNode])
		const item = new Node('item', {}, [strongNode])

		const result = extractNavigationItem(item)

		expect(result).not.toBeNull()
		expect(result?.label).toBe('About')
		expect(result?.src).toBe('/about')
	})

	test('should return null if no link found', () => {
		const textNode = new Node('text', { content: 'Plain text' })
		const item = new Node('item', {}, [textNode])

		const result = extractNavigationItem(item)

		expect(result).toBeNull()
	})

	test('should handle missing href attribute', () => {
		const textNode = new Node('text', { content: 'Link' })
		const linkNode = new Node('link', {}, [textNode])
		const item = new Node('item', {}, [linkNode])

		const result = extractNavigationItem(item)

		expect(result).not.toBeNull()
		expect(result?.src).toBe('')
	})
})

/* === Tag Helpers === */

describe('createNavigationButton', () => {
	test('should create previous button with default label', () => {
		const button = createNavigationButton('prev')

		expect(button.name).toBe('button')
		expect(button.attributes.type).toBe('button')
		expect(button.attributes.class).toBe('prev')
		expect(button.attributes['aria-label']).toBe('Previous')
	})

	test('should create next button with default label', () => {
		const button = createNavigationButton('next')

		expect(button.name).toBe('button')
		expect(button.attributes.class).toBe('next')
		expect(button.attributes['aria-label']).toBe('Next')
	})

	test('should create button with custom label', () => {
		const button = createNavigationButton('prev', 'Go Back')

		expect(button.children).toContain('Go Back')
	})
})

describe('createTabButton', () => {
	test('should create tab button with required attributes', () => {
		const button = createTabButton({
			id: 'tab-1',
			label: 'Tab 1',
			controls: 'panel-1',
		})

		expect(button.name).toBe('button')
		expect(button.attributes.role).toBe('tab')
		expect(button.attributes.id).toBe('tab-1')
		expect(button.attributes['aria-controls']).toBe('panel-1')
		expect(button.attributes['aria-label']).toBe('Tab 1')
	})

	test('should create selected tab', () => {
		const button = createTabButton({
			id: 'tab-1',
			label: 'Tab 1',
			controls: 'panel-1',
			selected: true,
		})

		expect(button.attributes['aria-selected']).toBe('true')
		expect(button.attributes.tabindex).toBe('0')
	})

	test('should create unselected tab', () => {
		const button = createTabButton({
			id: 'tab-1',
			label: 'Tab 1',
			controls: 'panel-1',
			selected: false,
		})

		expect(button.attributes['aria-selected']).toBe('false')
		expect(button.attributes.tabindex).toBe('-1')
	})

	test('should set data-index attribute', () => {
		const button = createTabButton({
			id: 'tab-2',
			label: 'Tab 2',
			controls: 'panel-2',
			index: 2,
		})

		expect(button.attributes['data-index']).toBe('2')
	})
})

describe('createAccessibleHeading', () => {
	test('should create heading with anchor', () => {
		const heading = createAccessibleHeading(2, 'Hello World')

		expect(heading.name).toBe('h2')
		expect(heading.attributes.id).toBe('hello-world')
		expect(heading.children.length).toBeGreaterThan(0)
	})

	test('should create anchor with correct href', () => {
		const heading = createAccessibleHeading(3, 'Test Heading')
		const anchor = heading.children[0] as Tag

		expect(anchor.name).toBe('a')
		expect(anchor.attributes.href).toBe('#test-heading')
		expect(anchor.attributes.class).toBe('anchor')
	})

	test('should include title and permalink spans', () => {
		const heading = createAccessibleHeading(2, 'Title')
		const anchor = heading.children[0] as Tag

		expect(anchor.children.length).toBe(2)
	})

	test('should support custom attributes', () => {
		const heading = createAccessibleHeading(2, 'Test', { class: 'custom' })

		expect(heading.attributes.class).toBe('custom')
	})
})

describe('createVisuallyHiddenHeading', () => {
	test('should create h2 with visually-hidden class', () => {
		const heading = createVisuallyHiddenHeading('Hidden Heading')

		expect(heading.name).toBe('h2')
		expect(heading.attributes.class).toBe('visually-hidden')
		expect(heading.children).toContain('Hidden Heading')
	})
})

/* === Raw Text Marker === */

describe('rawText', () => {
	test('should create raw text marker', () => {
		const marker = rawText('test content')

		expect(marker.__rawText).toBe(true)
		expect(marker.content).toBe('test content')
	})

	test('should preserve content exactly', () => {
		const content = '<script>alert("test")</script>'
		const marker = rawText(content)

		expect(marker.content).toBe(content)
	})
})
