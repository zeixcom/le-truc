/**
 * Unit Tests for schema/section.markdoc.ts — Section Schema
 *
 * Tests for the section Markdoc schema transformation including
 * element name, class passthrough, and child rendering.
 */

import { describe, expect, test } from 'bun:test'
import Markdoc, { Node, Tag } from '@markdoc/markdoc'
import section from '../../schema/section.markdoc'

/* === Helpers === */

const config = { tags: { section } }

function transformSection(attrs: Record<string, unknown>, children: Node[] = []): Tag {
	const node = new Node('tag', attrs, children, 'section')
	return Markdoc.transform(node, config) as Tag
}

/* === §11.8 Section schema === */

describe('section schema', () => {
	test('renders "<section>" element', () => {
		const result = transformSection({})
		expect(result).toBeInstanceOf(Tag)
		expect(result.name).toBe('section')
	})

	test('passes class attribute through', () => {
		const result = transformSection({ class: 'breakout' })
		expect(result.attributes.class).toBe('breakout')
	})

	test('passes id attribute through', () => {
		const result = transformSection({ id: 'my-section' })
		expect(result.attributes.id).toBe('my-section')
	})

	test('renders children inside section', () => {
		const child = new Node('paragraph', {}, [
			new Node('text', { content: 'Section content' }),
		])
		const result = transformSection({}, [child])
		expect(result.children.length).toBeGreaterThan(0)
	})

	test('renders empty section with no children', () => {
		const result = transformSection({})
		expect(result).toBeInstanceOf(Tag)
		expect(result.name).toBe('section')
	})
})
