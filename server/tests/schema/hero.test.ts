/**
 * Unit Tests for schema/hero.markdoc.ts — Hero Schema
 *
 * Tests for the hero Markdoc schema transformation including
 * element name, title extraction, hero-layout structure, and TOC placeholder.
 */

import { describe, expect, test } from 'bun:test'
import { Node, Tag } from '@markdoc/markdoc'
import hero from '../../schema/hero.markdoc'

/* === §11.4 Hero schema === */

describe('hero schema', () => {
	test('renders "section-hero" element', () => {
		const node = new Node('tag', {}, [])
		const result = hero.transform!(node, {}) as Tag
		expect(result).toBeInstanceOf(Tag)
		expect(result.name).toBe('section-hero')
	})

	test('extracts H1 as title child', () => {
		const h1 = new Node('heading', { level: 1 }, [
			new Node('text', { content: 'My Title' }),
		])
		const node = new Node('tag', {}, [h1])
		const result = hero.transform!(node, {}) as Tag
		// First child should be the transformed h1
		const titleChild = result.children[0] as Tag
		expect(titleChild).toBeInstanceOf(Tag)
		expect(titleChild.name).toBe('h1')
	})

	test('creates hero-layout div with lead and toc-placeholder when paragraph present', () => {
		const h1 = new Node('heading', { level: 1 }, [
			new Node('text', { content: 'Title' }),
		])
		const para = new Node('paragraph', {}, [
			new Node('text', { content: 'Lead paragraph.' }),
		])
		const node = new Node('tag', {}, [h1, para])
		const result = hero.transform!(node, {}) as Tag

		// Should have h1 + layout div
		expect(result.children.length).toBe(2)
		const layoutDiv = result.children[1] as Tag
		expect(layoutDiv).toBeInstanceOf(Tag)
		expect(layoutDiv.attributes.class).toBe('hero-layout')

		// layout div children: lead + toc-placeholder
		expect(layoutDiv.children.length).toBe(2)
		const leadDiv = layoutDiv.children[0] as Tag
		expect(leadDiv.attributes.class).toBe('lead')
		const tocDiv = layoutDiv.children[1] as Tag
		expect(tocDiv.attributes.class).toBe('toc-placeholder')
	})

	test('handles hero with only title — still has toc-placeholder', () => {
		const h1 = new Node('heading', { level: 1 }, [
			new Node('text', { content: 'Just a Title' }),
		])
		const node = new Node('tag', {}, [h1])
		const result = hero.transform!(node, {}) as Tag

		// h1 + toc-placeholder directly (no layout wrapper)
		expect(result.children.length).toBe(2)
		const tocDiv = result.children[1] as Tag
		expect(tocDiv.attributes.class).toBe('toc-placeholder')
		expect(tocDiv.attributes['data-toc']).toBe('true')
	})

	test('renders empty hero with just toc-placeholder', () => {
		const node = new Node('tag', {}, [])
		const result = hero.transform!(node, {}) as Tag
		// Should still have a toc-placeholder
		const last = result.children[result.children.length - 1] as Tag
		expect(last).toBeInstanceOf(Tag)
		expect(last.attributes.class).toBe('toc-placeholder')
	})
})
