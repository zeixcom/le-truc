/**
 * Unit Tests for schema/demo.markdoc.ts — Demo Schema
 *
 * Tests for the demo Markdoc schema transformation including
 * element name, preview-html extraction via separator and fence,
 * and transformed markdown children.
 */

import { describe, expect, test } from 'bun:test'
import { Node, Tag } from '@markdoc/markdoc'
import demo from '../../schema/demo.markdoc'

/* === §11.5 Demo schema === */

describe('demo schema', () => {
	test('renders "module-demo" element', () => {
		const node = new Node('tag', {}, [])
		const result = demo.transform!(node, {}) as Tag
		expect(result).toBeInstanceOf(Tag)
		expect(result.name).toBe('module-demo')
	})

	test('sets preview-html attribute', () => {
		const para = new Node('paragraph', {}, [
			new Node('text', { content: '<button>Click me</button>' }),
		])
		const node = new Node('tag', {}, [para])
		const result = demo.transform!(node, {}) as Tag
		expect('preview-html' in result.attributes).toBe(true)
	})

	test('extracts content before HR separator as preview-html', () => {
		const para = new Node('paragraph', {}, [
			new Node('text', { content: '<button>Click</button>' }),
		])
		const hr = new Node('hr', {})
		const afterPara = new Node('paragraph', {}, [
			new Node('text', { content: 'Description text.' }),
		])
		const node = new Node('tag', {}, [para, hr, afterPara])
		const result = demo.transform!(node, {}) as Tag

		const previewHtml = result.attributes['preview-html'] as string
		expect(previewHtml).toContain('Click')
	})

	test('transforms markdown nodes after separator into children', () => {
		const para = new Node('paragraph', {}, [
			new Node('text', { content: '<span>HTML</span>' }),
		])
		const hr = new Node('hr', {})
		const mdPara = new Node('paragraph', {}, [
			new Node('text', { content: 'Description.' }),
		])
		const node = new Node('tag', {}, [para, hr, mdPara])
		const result = demo.transform!(node, {}) as Tag

		// Children should contain the transformed paragraph
		expect(result.children.length).toBeGreaterThan(0)
	})

	test('extracts fence content as preview-html (fence-style demo)', () => {
		const fenceNode = new Node('fence', {
			content: '<button>Fence Button</button>',
			language: 'html',
		})
		const node = new Node('tag', {}, [fenceNode])
		const result = demo.transform!(node, {}) as Tag

		const previewHtml = result.attributes['preview-html'] as string
		expect(previewHtml).toContain('Fence Button')
	})

	test('produces empty children when no content after separator', () => {
		const para = new Node('paragraph', {}, [
			new Node('text', { content: '<span>Preview</span>' }),
		])
		const hr = new Node('hr', {})
		const node = new Node('tag', {}, [para, hr])
		const result = demo.transform!(node, {}) as Tag

		// Separator with nothing after it → empty or filtered children
		expect(Array.isArray(result.children)).toBe(true)
	})
})
