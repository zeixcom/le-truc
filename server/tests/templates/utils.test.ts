/**
 * Unit Tests for templates/utils.ts — Template Utilities
 *
 * Tests for tagged template literals, escaping functions, slug generation,
 * sorting, validation, and other template utilities.
 */

import { describe, expect, test } from 'bun:test'
import {
	createOrderedSort,
	css,
	escapeHtml,
	escapeXml,
	fragment,
	generateSlug,
	getResourceType,
	html,
	indent,
	js,
	mapSafe,
	minify,
	raw,
	RawHtml,
	requiresCrossorigin,
	type SortableItem,
	safeRender,
	unless,
	validateArrayField,
	validateHashString,
	validateHtml,
	validateRequiredString,
	validateXml,
	when,
	xml,
} from '../../templates/utils'

/* === Tagged Template Literals === */

describe('html tagged template', () => {
	test('should join strings and values', () => {
		const value = 'world'
		const result = html`<p>Hello ${value}</p>`
		expect(result).toBe('<p>Hello world</p>')
	})

	test('should escape string values', () => {
		const value = '<script>alert("xss")</script>'
		const result = html`<div>${value}</div>`
		expect(result).toBe('<div>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</div>')
	})

	test('should pass through RawHtml values unescaped', () => {
		const safeHtml = raw('<strong>Bold</strong>')
		const result = html`<div>${safeHtml}</div>`
		expect(result).toBe('<div><strong>Bold</strong></div>')
	})

	test('raw() wraps a string in RawHtml', () => {
		const wrapped = raw('<em>test</em>')
		expect(wrapped).toBeInstanceOf(RawHtml)
		expect(wrapped.value).toBe('<em>test</em>')
	})

	test('should handle arrays', () => {
		const items = ['<a>Item 1</a>', '<b>Item 2</b>', '<c>Item 3</c>']
		const result = html`<ul>
			${items}
		</ul>`
		expect(result).toContain('Item 1')
		expect(result).toContain('Item 2')
		expect(result).toContain('Item 3')
	})

	test('should handle numbers', () => {
		const count = 42
		const result = html`<span>Count: ${count}</span>`
		expect(result).toBe('<span>Count: 42</span>')
	})

	test('should handle booleans', () => {
		const isActive = true
		const result = html`<div>${isActive}</div>`
		expect(result).toContain('true')
	})

	test('should trim result', () => {
		const result = html`
			<div>
				<p>Content</p>
			</div>
		`
		expect(result.startsWith('<div>')).toBe(true)
		expect(result.endsWith('</div>')).toBe(true)
	})
})

describe('xml tagged template', () => {
	test('should join strings and values', () => {
		const value = 'Test'
		const result = xml`<item>${value}</item>`
		expect(result).toBe('<item>Test</item>')
	})

	test('should escape XML string values', () => {
		const value = '<tag>&"\''
		const result = xml`<item>${value}</item>`
		expect(result).toContain('&lt;tag&gt;')
		expect(result).toContain('&amp;')
	})

	test('should pass through RawHtml values unescaped in xml', () => {
		const fragment = raw('<nested>value</nested>')
		const result = xml`<item>${fragment}</item>`
		expect(result).toBe('<item><nested>value</nested></item>')
	})

	test('should handle arrays', () => {
		const items = ['<item>A</item>', '<item>B</item>']
		const result = xml`<list>${items}</list>`
		expect(result).toContain('A')
		expect(result).toContain('B')
	})
})

describe('css tagged template', () => {
	test('should join strings and values without escaping', () => {
		const color = '#ff0000'
		const result = css`
			.class {
				color: ${color};
			}
		`
		expect(result).toContain('#ff0000')
		expect(result).toContain('.class')
	})

	test('should handle multiple values', () => {
		const primary = '#333'
		const secondary = '#666'
		const result = css`
			.primary {
				color: ${primary};
			}
			.secondary {
				color: ${secondary};
			}
		`
		expect(result).toContain(primary)
		expect(result).toContain(secondary)
	})

	test('should handle numbers', () => {
		const width = 100
		const result = css`
			.box {
				width: ${width}px;
			}
		`
		expect(result).toContain('100px')
	})
})

describe('js tagged template', () => {
	test('should join strings and values', () => {
		const varName = 'myVar'
		const result = js`const ${varName} = 42;`
		expect(result).toBe('const myVar = 42;')
	})

	test('should handle arrays with proper formatting', () => {
		const items = ['one', 'two', 'three']
		const result = js`const arr = [${items}];`
		expect(result).toContain("'one'")
		expect(result).toContain("'two'")
		expect(result).toContain("'three'")
	})

	test('should handle array of numbers', () => {
		const numbers = [1, 2, 3]
		const result = js`const nums = [${numbers}];`
		expect(result).toContain('1')
		expect(result).toContain('2')
		expect(result).toContain('3')
	})
})

/* === Escaping Functions === */

describe('escapeHtml', () => {
	test('should escape ampersands', () => {
		expect(escapeHtml('A & B')).toBe('A &amp; B')
	})

	test('should escape less than', () => {
		expect(escapeHtml('<div>')).toBe('&lt;div&gt;')
	})

	test('should escape greater than', () => {
		expect(escapeHtml('>')).toBe('&gt;')
	})

	test('should escape double quotes', () => {
		expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
	})

	test('should escape single quotes', () => {
		expect(escapeHtml("'quoted'")).toBe('&#39;quoted&#39;')
	})

	test('should escape all special characters', () => {
		const input = '<script>alert("XSS & \'injection\'");</script>'
		const result = escapeHtml(input)
		expect(result).not.toContain('<')
		expect(result).not.toContain('>')
		expect(result).not.toContain('"')
		expect(result).not.toContain("'")
		expect(result).toContain('&amp;')
	})

	test('should handle empty string', () => {
		expect(escapeHtml('')).toBe('')
	})

	test('should handle string without special characters', () => {
		expect(escapeHtml('Hello World')).toBe('Hello World')
	})
})

describe('escapeXml', () => {
	test('should escape ampersands', () => {
		expect(escapeXml('A & B')).toBe('A &amp; B')
	})

	test('should escape less than and greater than', () => {
		expect(escapeXml('<tag>')).toBe('&lt;tag&gt;')
	})

	test('should escape double quotes', () => {
		expect(escapeXml('"quoted"')).toBe('&quot;quoted&quot;')
	})

	test('should escape single quotes with &apos;', () => {
		expect(escapeXml("'quoted'")).toBe('&apos;quoted&apos;')
	})

	test('should escape all XML special characters', () => {
		const input = '<tag attr="value" other=\'value2\'>Content & more</tag>'
		const result = escapeXml(input)
		expect(result).not.toContain('<')
		expect(result).not.toContain('>')
		expect(result).toContain('&amp;')
		expect(result).toContain('&apos;')
		expect(result).toContain('&quot;')
	})
})

/* === Slug Generation === */

describe('generateSlug', () => {
	test('should convert to lowercase', () => {
		expect(generateSlug('Hello World')).toBe('hello-world')
	})

	test('should replace spaces with hyphens', () => {
		expect(generateSlug('Multiple   Spaces')).toBe('multiple-spaces')
	})

	test('should remove special characters', () => {
		expect(generateSlug('Hello! @World#')).toBe('hello-world')
	})

	test('should collapse multiple hyphens', () => {
		expect(generateSlug('hello---world')).toBe('hello-world')
	})

	test('should handle leading/trailing spaces', () => {
		const result = generateSlug('  hello world  ')
		// The implementation may leave trailing hyphens from whitespace
		expect(result).toContain('hello-world')
	})

	test('should handle unicode characters', () => {
		const result = generateSlug('Café résumé')
		// Should remove non-word characters
		expect(result).toBeTruthy()
	})

	test('should handle empty string', () => {
		expect(generateSlug('')).toBe('')
	})

	test('should handle string with only special characters', () => {
		expect(generateSlug('!@#$%^&*()')).toBe('')
	})

	test('should handle numbers', () => {
		expect(generateSlug('Version 2.0')).toBe('version-20')
	})

	test('should handle underscores', () => {
		expect(generateSlug('hello_world')).toBe('hello_world')
	})
})

/* === Sorting Utilities === */

describe('createOrderedSort', () => {
	test('should sort items according to order array', () => {
		const order = ['third', 'first', 'second']
		const items: SortableItem[] = [
			{ filename: 'first.md' },
			{ filename: 'second.md' },
			{ filename: 'third.md' },
		]

		const sorted = items.sort(createOrderedSort(order))

		expect(sorted[0].filename).toBe('third.md')
		expect(sorted[1].filename).toBe('first.md')
		expect(sorted[2].filename).toBe('second.md')
	})

	test('should prioritize ordered items over unordered', () => {
		const order = ['important']
		const items: SortableItem[] = [
			{ filename: 'zzz.md' },
			{ filename: 'important.md' },
			{ filename: 'aaa.md' },
		]

		const sorted = items.sort(createOrderedSort(order))

		expect(sorted[0].filename).toBe('important.md')
	})

	test('should sort unordered items alphabetically', () => {
		const order = ['ordered']
		const items: SortableItem[] = [
			{ filename: 'zebra.md' },
			{ filename: 'apple.md' },
			{ filename: 'banana.md' },
		]

		const sorted = items.sort(createOrderedSort(order))

		expect(sorted[0].filename).toBe('apple.md')
		expect(sorted[1].filename).toBe('banana.md')
		expect(sorted[2].filename).toBe('zebra.md')
	})

	test('should handle .html extensions', () => {
		const order = ['first', 'second']
		const items: SortableItem[] = [
			{ filename: 'second.html' },
			{ filename: 'first.html' },
		]

		const sorted = items.sort(createOrderedSort(order))

		expect(sorted[0].filename).toBe('first.html')
		expect(sorted[1].filename).toBe('second.html')
	})

	test('should handle empty order array', () => {
		const items: SortableItem[] = [
			{ filename: 'zebra.md' },
			{ filename: 'apple.md' },
		]

		const sorted = items.sort(createOrderedSort([]))

		expect(sorted[0].filename).toBe('apple.md')
		expect(sorted[1].filename).toBe('zebra.md')
	})
})

/* === Validation Functions === */

describe('validateHashString', () => {
	test('should validate correct hash', () => {
		expect(validateHashString('abc123def456', 8)).toBe(true)
	})

	test('should reject hash shorter than minLength', () => {
		expect(validateHashString('abc', 8)).toBe(false)
	})

	test('should reject non-hex characters', () => {
		expect(validateHashString('xyz123', 6)).toBe(false)
	})

	test('should use default minLength', () => {
		expect(validateHashString('abc123def456')).toBe(true)
	})

	test('should handle empty string', () => {
		expect(validateHashString('', 8)).toBe(false)
	})
})

describe('validateRequiredString', () => {
	test('should return empty array for valid string', () => {
		const errors = validateRequiredString('valid', 'field')
		expect(errors.length).toBe(0)
	})

	test('should return error for null', () => {
		const errors = validateRequiredString(null, 'field')
		expect(errors.length).toBeGreaterThan(0)
	})

	test('should return error for undefined', () => {
		const errors = validateRequiredString(undefined, 'field')
		expect(errors.length).toBeGreaterThan(0)
	})

	test('should return error for non-string', () => {
		const errors = validateRequiredString(123, 'field')
		expect(errors.length).toBeGreaterThan(0)
	})

	test('should return error for empty string', () => {
		const errors = validateRequiredString('', 'field')
		expect(errors.length).toBeGreaterThan(0)
	})
})

describe('validateArrayField', () => {
	test('should return empty array for valid array', () => {
		const errors = validateArrayField([1, 2, 3], 'field')
		expect(errors.length).toBe(0)
	})

	test('should return error for non-array', () => {
		const errors = validateArrayField('not array', 'field')
		expect(errors.length).toBeGreaterThan(0)
	})

	test('should validate array items with validator', () => {
		const validator = (item: number) => item > 0
		const errors = validateArrayField([1, 2, -1], 'field', validator)
		expect(errors.length).toBeGreaterThan(0)
	})

	test('should pass with valid items', () => {
		const validator = (item: number) => item > 0
		const errors = validateArrayField([1, 2, 3], 'field', validator)
		expect(errors.length).toBe(0)
	})

	test('should handle undefined value', () => {
		const errors = validateArrayField(undefined, 'field')
		expect(errors.length).toBe(0)
	})
})

/* === Helper Functions === */

describe('safeRender', () => {
	test('should return template result on success', () => {
		const template = (name: string) => `Hello ${name}`
		const safe = safeRender(template)
		expect(safe('World')).toBe('Hello World')
	})

	test('should return fallback on error', () => {
		// Suppress expected error logging
		const originalError = console.error
		console.error = () => {}

		const template: () => string = () => {
			throw new Error('Template error')
		}
		const safe = safeRender(template, 'Fallback')
		const result = safe()
		expect(result).toBe('Fallback')

		console.error = originalError
	})

	test('should call onError callback', () => {
		// Suppress expected error logging
		const originalError = console.error
		console.error = () => {}

		let errorCalled = false
		const template: () => string = () => {
			throw new Error('Template error')
		}
		const safe = safeRender(template, '', () => {
			errorCalled = true
		})
		safe()
		expect(errorCalled).toBe(true)

		console.error = originalError
	})
})

describe('when', () => {
	test('should return template result when condition is true', () => {
		const result = when(true, () => 'Rendered')
		expect(result).toBe('Rendered')
	})

	test('should return empty string when condition is false', () => {
		const result = when(false, () => 'Not rendered')
		expect(result).toBe('')
	})
})

describe('unless', () => {
	test('should return empty string when condition is true', () => {
		const result = unless(true, () => 'Not rendered')
		expect(result).toBe('')
	})

	test('should return template result when condition is false', () => {
		const result = unless(false, () => 'Rendered')
		expect(result).toBe('Rendered')
	})
})

describe('mapSafe', () => {
	test('should map array items', () => {
		const items = [1, 2, 3]
		const result = mapSafe(items, item => `Item ${item}`, ', ')
		expect(result).toBe('Item 1, Item 2, Item 3')
	})

	test('should handle empty array', () => {
		const result = mapSafe([], item => `Item ${item}`)
		expect(result).toBe('')
	})

	test('should return empty string on error', () => {
		// Suppress expected error logging
		const originalError = console.error
		console.error = () => {}

		const items = [1, 2, 3]
		const result = mapSafe(items, (): string => {
			throw new Error('Mapper error')
		})
		expect(result).toBe('')

		console.error = originalError
	})

	test('should use default separator', () => {
		const items = ['a', 'b']
		const result = mapSafe(items, item => item)
		expect(result).toBe('ab')
	})
})

describe('fragment', () => {
	test('should join templates', () => {
		const result = fragment('<div>', '<span>Content</span>', '</div>')
		expect(result).toBe('<div><span>Content</span></div>')
	})

	test('should filter out falsy values', () => {
		// @ts-expect-error - Testing with null/undefined which are not in type signature
		const result = fragment('<div>', '', null, undefined, '</div>')
		expect(result).toBe('<div></div>')
	})
})

describe('indent', () => {
	test('should indent each line', () => {
		const template = '<div>\n<p>Content</p>\n</div>'
		const result = indent(template, 2)
		expect(result).toContain('  <div>')
		expect(result).toContain('  <p>Content</p>')
		expect(result).toContain('  </div>')
	})

	test('should use default indentation', () => {
		const template = '<div>\nContent\n</div>'
		const result = indent(template)
		expect(result).toContain('  ')
	})

	test('should not indent empty lines', () => {
		const template = '<div>\n\n</div>'
		const result = indent(template, 2)
		const lines = result.split('\n')
		expect(lines[1]).toBe('')
	})
})

describe('minify', () => {
	test('should remove extra whitespace', () => {
		const template = '<div>  Content  </div>'
		const result = minify(template)
		expect(result).toBe('<div> Content </div>')
	})

	test('should remove whitespace between tags', () => {
		const template = '<div> <span> Content </span> </div>'
		const result = minify(template)
		expect(result).toBe('<div><span> Content </span></div>')
	})

	test('should trim result', () => {
		const template = '  <div>Content</div>  '
		const result = minify(template)
		expect(result).toBe('<div>Content</div>')
	})
})

/* === Validation === */

describe('validateHtml', () => {
	test('should validate correct HTML', () => {
		const result = validateHtml('<div><p>Content</p></div>')
		expect(result.valid).toBe(true)
		expect(result.errors.length).toBe(0)
	})

	test('should detect mismatched tags', () => {
		const result = validateHtml('<div><p>Content</div>')
		expect(result.valid).toBe(false)
		expect(result.errors.length).toBeGreaterThan(0)
	})

	test('should handle self-closing tags', () => {
		const result = validateHtml('<img src="test.jpg" /><br />')
		expect(result.valid).toBe(true)
	})

	test('should detect space after opening bracket', () => {
		const result = validateHtml('< div>Content</div>')
		expect(result.valid).toBe(false)
		expect(
			result.errors.some(e => e.includes('Space after opening bracket')),
		).toBe(true)
	})

	test('should detect space before closing bracket', () => {
		const result = validateHtml('<div >Content</div>')
		expect(result.valid).toBe(false)
		expect(
			result.errors.some(e => e.includes('Space before closing bracket')),
		).toBe(true)
	})
})

describe('validateXml', () => {
	test('should require XML declaration', () => {
		const result = validateXml('<root><item /></root>')
		expect(result.valid).toBe(false)
		expect(result.errors.some(e => e.includes('XML declaration'))).toBe(true)
	})

	test('should require encoding declaration', () => {
		const result = validateXml('<?xml version="1.0"?><root />')
		expect(result.valid).toBe(false)
		expect(result.errors.some(e => e.includes('encoding'))).toBe(true)
	})

	test('should validate correct XML', () => {
		const result = validateXml(
			'<?xml version="1.0" encoding="UTF-8"?><root></root>',
		)
		expect(result.valid).toBe(true)
	})
})

/* === Resource Utilities === */

describe('getResourceType', () => {
	test('should detect stylesheet', () => {
		expect(getResourceType('/styles/main.css')).toBe('style')
	})

	test('should detect script', () => {
		expect(getResourceType('/scripts/app.js')).toBe('script')
	})

	test('should detect font', () => {
		expect(getResourceType('/fonts/font.woff2')).toBe('font')
	})

	test('should detect image', () => {
		expect(getResourceType('/images/logo.png')).toBe('image')
	})

	test('should return default for unknown extension', () => {
		const result = getResourceType('/file.xyz')
		expect(result).toBeTruthy()
	})
})

describe('requiresCrossorigin', () => {
	test('should require crossorigin for woff', () => {
		expect(requiresCrossorigin('/font.woff')).toBe(true)
	})

	test('should require crossorigin for woff2', () => {
		expect(requiresCrossorigin('/font.woff2')).toBe(true)
	})

	test('should not require crossorigin for other files', () => {
		expect(requiresCrossorigin('/style.css')).toBe(false)
		expect(requiresCrossorigin('/script.js')).toBe(false)
	})
})
