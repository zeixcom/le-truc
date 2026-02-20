/**
 * Unit Tests for schema/fence.markdoc.ts — Code Fence Schema
 *
 * Tests for the code fence Markdoc schema transformation including
 * syntax highlighting, copy button, collapse functionality, and metadata.
 */

import { describe, expect, test } from 'bun:test'
import { Node, Tag } from '@markdoc/markdoc'
import fence from '../../schema/fence.markdoc'

/* === Core Transformation Tests === */

describe('fence schema - basic transformation', () => {
	test('should transform fence node to module-codeblock', () => {
		const node = new Node('fence', {
			content: 'console.log("Hello")',
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag

		expect(result).toBeInstanceOf(Tag)
		expect(result.name).toBe('module-codeblock')
	})

	test('should include language attribute', () => {
		const node = new Node('fence', {
			content: 'const x = 1',
			language: 'typescript',
		})

		const result = fence.transform!(node, {}) as Tag

		expect(result.attributes.language).toBe('typescript')
	})

	test('should handle missing language', () => {
		const node = new Node('fence', {
			content: 'plain text',
		})

		const result = fence.transform!(node, {}) as Tag

		expect(result.attributes.language).toBe('text')
	})

	test('should handle empty content', () => {
		const node = new Node('fence', {
			content: '',
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag

		expect(result).toBeInstanceOf(Tag)
	})
})

/* === Filename Parsing Tests === */

describe('fence schema - filename parsing', () => {
	test('should parse filename from language string', () => {
		const node = new Node('fence', {
			content: 'code',
			language: 'typescript#example.ts',
		})

		const result = fence.transform!(node, {}) as Tag
		const metaSection = result.children.find(
			child => child instanceof Tag && child.name === 'p',
		) as Tag

		expect(metaSection).toBeDefined()
		const fileSpan = metaSection.children.find(
			child => child instanceof Tag && child.attributes.class === 'file',
		)
		expect(fileSpan).toBeDefined()
	})

	test('should extract language when filename present', () => {
		const node = new Node('fence', {
			content: 'code',
			language: 'javascript#app.js',
		})

		const result = fence.transform!(node, {}) as Tag

		expect(result.attributes.language).toBe('javascript')
	})

	test('should handle language without filename', () => {
		const node = new Node('fence', {
			content: 'code',
			language: 'python',
		})

		const result = fence.transform!(node, {}) as Tag
		const metaSection = result.children.find(
			child => child instanceof Tag && child.name === 'p',
		) as Tag

		const fileSpan = metaSection.children.find(
			child => child instanceof Tag && child.attributes.class === 'file',
		)
		expect(fileSpan).toBeUndefined()
	})

	test('should handle complex filename with path', () => {
		const node = new Node('fence', {
			content: 'code',
			language: 'typescript#src/components/Button.tsx',
		})

		const result = fence.transform!(node, {}) as Tag
		const metaSection = result.children.find(
			child => child instanceof Tag && child.name === 'p',
		) as Tag

		const fileSpan = metaSection.children.find(
			child => child instanceof Tag && child.attributes.class === 'file',
		) as Tag

		expect(fileSpan.children[0]).toBe('src/components/Button.tsx')
	})
})

/* === Collapse Functionality Tests === */

describe('fence schema - collapse functionality', () => {
	test('should add collapsed attribute for long code (>10 lines)', () => {
		const longCode = Array(15).fill('line').join('\n')
		const node = new Node('fence', {
			content: longCode,
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag

		expect(result.attributes.collapsed).toBe('')
	})

	test('should not add collapsed attribute for short code (<=10 lines)', () => {
		const shortCode = Array(5).fill('line').join('\n')
		const node = new Node('fence', {
			content: shortCode,
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag

		expect(result.attributes.collapsed).toBeUndefined()
	})

	test('should include expand button for collapsed code', () => {
		const longCode = Array(15).fill('line').join('\n')
		const node = new Node('fence', {
			content: longCode,
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag
		const expandButton = result.children.find(
			child =>
				child instanceof Tag
				&& child.name === 'button'
				&& child.attributes.class === 'overlay',
		)

		expect(expandButton).toBeDefined()
	})

	test('should not include expand button for short code', () => {
		const shortCode = 'console.log("test")'
		const node = new Node('fence', {
			content: shortCode,
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag
		const expandButton = result.children.find(
			child =>
				child instanceof Tag
				&& child.name === 'button'
				&& child.attributes.class === 'overlay',
		)

		expect(expandButton).toBeUndefined()
	})

	test('should set aria-expanded to false on expand button', () => {
		const longCode = Array(15).fill('line').join('\n')
		const node = new Node('fence', {
			content: longCode,
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag
		const expandButton = result.children.find(
			child =>
				child instanceof Tag
				&& child.name === 'button'
				&& child.attributes.class === 'overlay',
		) as Tag

		expect(expandButton.attributes['aria-expanded']).toBe('false')
	})
})

/* === Meta Section Tests === */

describe('fence schema - meta section', () => {
	test('should create meta section with language', () => {
		const node = new Node('fence', {
			content: 'code',
			language: 'typescript',
		})

		const result = fence.transform!(node, {}) as Tag
		const metaSection = result.children.find(
			child => child instanceof Tag && child.name === 'p',
		) as Tag

		expect(metaSection).toBeDefined()
		expect(metaSection.attributes.class).toBe('meta')
	})

	test('should include language span in meta section', () => {
		const node = new Node('fence', {
			content: 'code',
			language: 'rust',
		})

		const result = fence.transform!(node, {}) as Tag
		const metaSection = result.children.find(
			child => child instanceof Tag && child.name === 'p',
		) as Tag

		const languageSpan = metaSection.children.find(
			child => child instanceof Tag && child.attributes.class === 'language',
		) as Tag

		expect(languageSpan).toBeDefined()
		expect(languageSpan.children[0]).toBe('rust')
	})

	test('should include both filename and language in meta section', () => {
		const node = new Node('fence', {
			content: 'code',
			language: 'python#script.py',
		})

		const result = fence.transform!(node, {}) as Tag
		const metaSection = result.children.find(
			child => child instanceof Tag && child.name === 'p',
		) as Tag

		expect(metaSection.children.length).toBe(2)
	})
})

/* === Code Placeholder Tests === */

describe('fence schema - code placeholder', () => {
	test('should create module-scrollarea wrapper and pre data attributes', () => {
		const code = 'const x = 1'
		const node = new Node('fence', {
			content: code,
			language: 'typescript',
		})

		const result = fence.transform!(node, {}) as Tag
		const scrollArea = result.children.find(
			child => child instanceof Tag && child.name === 'module-scrollarea',
		) as Tag
		const preElement = scrollArea.children[0] as Tag

		expect(scrollArea).toBeDefined()
		expect(scrollArea.attributes.orientation).toBe('horizontal')
		expect(preElement).toBeDefined()
		expect(preElement.attributes['data-language']).toBe('typescript')
		expect(preElement.attributes['data-code']).toBe(code)
	})

	test('should create code element with language class', () => {
		const node = new Node('fence', {
			content: 'code',
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag
		const scrollArea = result.children.find(
			child => child instanceof Tag && child.name === 'module-scrollarea',
		) as Tag
		const preElement = scrollArea.children[0] as Tag

		const codeElement = preElement.children[0] as Tag

		expect(codeElement.name).toBe('code')
		expect(codeElement.attributes.class).toBe('language-javascript')
	})

	test('should include code content in code element', () => {
		const code = 'function test() { return true; }'
		const node = new Node('fence', {
			content: code,
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag
		const scrollArea = result.children.find(
			child => child instanceof Tag && child.name === 'module-scrollarea',
		) as Tag
		const preElement = scrollArea.children[0] as Tag

		const codeElement = preElement.children[0] as Tag

		expect(codeElement.children[0]).toBe(code)
	})
})

/* === Copy Button Tests === */

describe('fence schema - copy button', () => {
	test('should create copy button', () => {
		const node = new Node('fence', {
			content: 'code',
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag
		const copyButton = result.children.find(
			child => child instanceof Tag && child.name === 'basic-button',
		)

		expect(copyButton).toBeDefined()
	})

	test('should set copy success message', () => {
		const node = new Node('fence', {
			content: 'code',
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag
		const copyButton = result.children.find(
			child => child instanceof Tag && child.name === 'basic-button',
		) as Tag

		expect(copyButton.attributes['copy-success']).toBe('Copied!')
	})

	test('should set copy error message', () => {
		const node = new Node('fence', {
			content: 'code',
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag
		const copyButton = result.children.find(
			child => child instanceof Tag && child.name === 'basic-button',
		) as Tag

		expect(copyButton.attributes['copy-error']).toBe(
			'Error trying to copy to clipboard!',
		)
	})

	test('should have button child with correct attributes', () => {
		const node = new Node('fence', {
			content: 'code',
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag
		const basicButton = result.children.find(
			child => child instanceof Tag && child.name === 'basic-button',
		) as Tag

		const button = basicButton.children[0] as Tag

		expect(button.name).toBe('button')
		expect(button.attributes.type).toBe('button')
		expect(button.attributes.class).toContain('secondary')
		expect(button.attributes.class).toContain('small')
	})

	test('should have label span in copy button', () => {
		const node = new Node('fence', {
			content: 'code',
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag
		const basicButton = result.children.find(
			child => child instanceof Tag && child.name === 'basic-button',
		) as Tag

		const button = basicButton.children[0] as Tag
		const label = button.children[0] as Tag

		expect(label.name).toBe('span')
		expect(label.attributes.class).toBe('label')
		expect(label.children[0]).toBe('Copy')
	})
})

/* === Integration Tests === */

describe('fence schema - integration', () => {
	test('should create complete structure for simple code', () => {
		const node = new Node('fence', {
			content: 'console.log("hello")',
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag

		// Should have meta, pre, and copy button
		expect(result.children.length).toBeGreaterThanOrEqual(3)
	})

	test('should create complete structure for long code with filename', () => {
		const longCode = Array(15).fill('line of code').join('\n')
		const node = new Node('fence', {
			content: longCode,
			language: 'typescript#example.ts',
		})

		const result = fence.transform!(node, {}) as Tag

		// Should have meta, pre, copy button, and expand button
		expect(result.children.length).toBe(4)
	})

	test('should set copy messages on module-codeblock', () => {
		const node = new Node('fence', {
			content: 'code',
			language: 'javascript',
		})

		const result = fence.transform!(node, {}) as Tag

		expect(result.attributes['copy-success']).toBe('Copied!')
		expect(result.attributes['copy-error']).toBe(
			'Error trying to copy to clipboard!',
		)
	})

	test('should handle various language types', () => {
		const languages = [
			'javascript',
			'typescript',
			'python',
			'rust',
			'go',
			'html',
			'css',
			'json',
			'markdown',
		]

		for (const lang of languages) {
			const node = new Node('fence', {
				content: 'code',
				language: lang,
			})

			const result = fence.transform!(node, {}) as Tag

			expect(result.attributes.language).toBe(lang)
		}
	})
})
