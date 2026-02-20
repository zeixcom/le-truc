/**
 * Unit Tests for schema/sources.markdoc.ts — Sources Schema
 *
 * Tests for the sources Markdoc schema transformation, including
 * legacy path normalization for lazy-loaded source fragments.
 */

import { describe, expect, test } from 'bun:test'
import { Node, Tag } from '@markdoc/markdoc'
import sources from '../../schema/sources.markdoc'

describe('sources schema - path normalization', () => {
	test('normalizes ../sources path to ./sources', () => {
		const node = new Node('tag', {
			tag: 'sources',
			title: 'Source code',
			src: '../sources/basic-counter.html',
		})

		const result = sources.transform!(node, {}) as Tag
		expect(result.name).toBe('details')
		expect(result.attributes.src).toBe('./sources/basic-counter.html')

		const lazyload = result.children.find(
			child => child instanceof Tag && child.name === 'module-lazyload',
		) as Tag
		expect(lazyload).toBeDefined()
		expect(lazyload.attributes.src).toBe('./sources/basic-counter.html')
	})

	test('keeps already-correct ./sources path unchanged', () => {
		const node = new Node('tag', {
			tag: 'sources',
			title: 'Source code',
			src: './sources/form-spinbutton.html',
		})

		const result = sources.transform!(node, {}) as Tag
		expect(result.attributes.src).toBe('./sources/form-spinbutton.html')

		const lazyload = result.children.find(
			child => child instanceof Tag && child.name === 'module-lazyload',
		) as Tag
		expect(lazyload.attributes.src).toBe('./sources/form-spinbutton.html')
	})
})
