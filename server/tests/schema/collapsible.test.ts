/**
 * Unit Tests for schema/collapsible.markdoc.ts — Collapsible Schema
 *
 * Tests for the collapsible Markdoc schema transformation: progressive
 * disclosure rendered via the `<card-collapsible>` example component, which
 * wraps a native `<details>`/`<summary>` element.
 */

import { describe, expect, test } from 'bun:test'
import Markdoc, { Node, Tag } from '@markdoc/markdoc'
import collapsible from '../../schema/collapsible.markdoc'

/* === Helpers === */

const config = { tags: { collapsible } }

function transformCollapsible(
	attrs: Record<string, unknown>,
	children: Node[] = [],
): Tag {
	const node = new Node('tag', attrs, children, 'collapsible')
	return Markdoc.transform(node, config) as Tag
}

/* === Collapsible schema === */

describe('collapsible schema', () => {
	test('renders "card-collapsible" element', () => {
		const result = transformCollapsible({ title: 'More info' })
		expect(result).toBeInstanceOf(Tag)
		expect(result.name).toBe('card-collapsible')
	})

	test('renders a native details/summary structure inside card-collapsible', () => {
		const result = transformCollapsible({ title: 'More info' })
		const details = result.children[0] as Tag
		expect(details).toBeInstanceOf(Tag)
		expect(details.name).toBe('details')

		const summary = details.children[0] as Tag
		expect(summary).toBeInstanceOf(Tag)
		expect(summary.name).toBe('summary')
	})

	test('renders the title inside a summary > span.description', () => {
		const result = transformCollapsible({ title: 'More info' })
		const details = result.children[0] as Tag
		const summary = details.children[0] as Tag
		const description = summary.children[0] as Tag
		expect(description).toBeInstanceOf(Tag)
		expect(description.name).toBe('span')
		expect(description.attributes.class).toBe('description')
		expect(description.children[0]).toBe('More info')
	})

	test('renders transformed children inside a div.content sibling of summary', () => {
		const child = new Node('paragraph', {}, [
			new Node('text', { content: 'Hidden content' }),
		])
		const result = transformCollapsible({ title: 'More info' }, [child])
		const details = result.children[0] as Tag
		const content = details.children[1] as Tag
		expect(content).toBeInstanceOf(Tag)
		expect(content.name).toBe('div')
		expect(content.attributes.class).toBe('content')
		expect(content.children.length).toBeGreaterThan(0)
		const paragraph = content.children[0] as Tag
		expect(paragraph).toBeInstanceOf(Tag)
		expect(paragraph.name).toBe('p')
	})

	test('requires a title attribute', () => {
		const node = new Node('tag', {}, [], 'collapsible')
		const errors = Markdoc.validate(node, config)
		expect(errors.length).toBeGreaterThan(0)
	})

	test('allows a table as a direct child without validation errors', () => {
		const table = new Node('table', {}, [], 'table')
		const node = new Node('tag', { title: 'More info' }, [table], 'collapsible')
		const errors = Markdoc.validate(node, config)
		expect(errors).toEqual([])
	})
})
