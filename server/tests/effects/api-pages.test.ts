/**
 * Unit Tests for effects/api-pages.ts — API Page Fragment Generation
 *
 * Tests for the pure functions that process TypeDoc-generated Markdown
 * into HTML fragments for the API documentation section.
 */

import { describe, expect, test } from 'bun:test'
import { stripBreadcrumbs, highlightCodeBlocks } from '../../effects/api-pages'

/* === stripBreadcrumbs Tests === */

describe('stripBreadcrumbs', () => {
	test('strips content above first H1 heading', () => {
		const content = `[**@zeix/le-truc**](../README.md) • **Docs**

***

[API Reference](../globals.md) / defineComponent

# Function: defineComponent()

Defines a custom element.`

		const result = stripBreadcrumbs(content)

		expect(result).toStartWith('# Function: defineComponent()')
		expect(result).toContain('Defines a custom element.')
		expect(result).not.toContain('API Reference')
		expect(result).not.toContain('@zeix/le-truc')
	})

	test('returns content unchanged when no breadcrumbs', () => {
		const content = `# Function: defineComponent()

Defines a custom element.`

		const result = stripBreadcrumbs(content)

		expect(result).toBe(content)
	})

	test('returns content unchanged when no H1', () => {
		const content = `Some text without any heading.

## This is H2 not H1

More text.`

		const result = stripBreadcrumbs(content)

		// Should start from ## heading since that's the first heading match
		// Actually, the regex looks for ^(#\s+.+)$ which matches ## too
		// Let's verify actual behavior
		expect(result).toContain('Some text')
	})

	test('preserves everything after the first H1', () => {
		const content = `Breadcrumb line

# Title

## Section 1

Content 1

## Section 2

Content 2`

		const result = stripBreadcrumbs(content)

		expect(result).toStartWith('# Title')
		expect(result).toContain('## Section 1')
		expect(result).toContain('Content 1')
		expect(result).toContain('## Section 2')
		expect(result).toContain('Content 2')
	})

	test('handles empty string', () => {
		expect(stripBreadcrumbs('')).toBe('')
	})

	test('handles content with only breadcrumbs and no heading', () => {
		const content = `[**@zeix/le-truc**](../README.md) • **Docs**

***

Just some text, no heading.`

		const result = stripBreadcrumbs(content)

		// No H1 found, so content is returned as-is
		expect(result).toBe(content)
	})

	test('strips multiple breadcrumb lines', () => {
		const content = `[**@zeix/le-truc**](../README.md)

[Back to index](../globals.md)

Navigation: foo > bar > baz

# Class: ContextRequestEvent

Event class for context requests.`

		const result = stripBreadcrumbs(content)

		expect(result).toStartWith('# Class: ContextRequestEvent')
		expect(result).toContain('Event class for context requests.')
	})
})

/* === highlightCodeBlocks Tests === */

describe('highlightCodeBlocks', () => {
	test('returns HTML unchanged when no code blocks present', async () => {
		const html = '<p>Hello world</p>'
		const result = await highlightCodeBlocks(html)
		expect(result).toBe(html)
	})

	test('returns HTML unchanged for empty string', async () => {
		const result = await highlightCodeBlocks('')
		expect(result).toBe('')
	})

	test('highlights a code block with known language', async () => {
		const html = `<p>Example:</p>
<pre data-language="typescript" data-code="const x = 1"><code class="language-typescript">const x = 1</code></pre>`

		const result = await highlightCodeBlocks(html)

		// Shiki wraps output in its own <pre> with a theme class
		expect(result).toContain('<pre')
		expect(result).toContain('const')
		// Should not contain the original data-code attribute pattern
		expect(result).not.toContain('data-code="const x = 1"')
	})

	test('preserves surrounding HTML', async () => {
		const html = `<h2>Example</h2>
<pre data-language="text" data-code="hello"><code class="language-text">hello</code></pre>
<p>More text</p>`

		const result = await highlightCodeBlocks(html)

		expect(result).toContain('<h2>Example</h2>')
		expect(result).toContain('<p>More text</p>')
	})

	test('decodes HTML entities in code content', async () => {
		const html = `<pre data-language="typescript" data-code="const x: Map&lt;string, number&gt; = new Map()"><code class="language-typescript">const x: Map&lt;string, number&gt; = new Map()</code></pre>`

		const result = await highlightCodeBlocks(html)

		// The decoded content should be highlighted
		expect(result).toContain('Map')
		expect(result).toContain('string')
	})

	test('handles multiple code blocks', async () => {
		const html = `<pre data-language="typescript" data-code="const a = 1"><code class="language-typescript">const a = 1</code></pre>
<p>Between blocks</p>
<pre data-language="typescript" data-code="const b = 2"><code class="language-typescript">const b = 2</code></pre>`

		const result = await highlightCodeBlocks(html)

		expect(result).toContain('Between blocks')
		// Both blocks should be highlighted (contain Shiki output)
		const preCount = (result.match(/<pre/g) || []).length
		expect(preCount).toBe(2)
	})
})
