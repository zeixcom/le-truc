/**
 * Unit Tests for schema/listnav.markdoc.ts — List Navigation Schema
 *
 * Tests for the listnav Markdoc schema transformation including
 * grouped navigation, form-listbox rendering, ARIA attributes,
 * and module-lazyload integration.
 */

import { describe, expect, test } from 'bun:test'
import Markdoc, { Node } from '@markdoc/markdoc'
import listnav from '../../schema/listnav.markdoc'

/* === Full Pipeline Helper === */

/**
 * Parse a Markdoc document containing a listnav tag and return
 * the rendered HTML string for assertion.
 */
const renderListnav = (markdown: string): string => {
	const ast = Markdoc.parse(markdown)
	const config = { tags: { listnav } }
	const transformed = Markdoc.transform(ast, config)
	return Markdoc.renderers.html(transformed)
}

/* === Validation Tests === */

describe('listnav schema - validation', () => {
	test('rejects node with no list children', async () => {
		const node = new Node('tag', { tag: 'listnav' }, [])
		const errors = await listnav.validate!(node, {} as any)
		expect(errors.length).toBeGreaterThan(0)
		expect(errors[0].id).toBe('listnav-no-list')
	})

	test('rejects empty list', async () => {
		const emptyList = new Node('list', { ordered: false }, [])
		Object.defineProperty(emptyList, 'type', {
			value: 'list',
			writable: true,
		})
		const node = new Node('tag', { tag: 'listnav' }, [emptyList])

		const errors = await listnav.validate!(node, {} as any)
		const emptyError = errors.find(e => e.id === 'listnav-empty-list')
		expect(emptyError).toBeDefined()
	})
})

/* === Full Pipeline Rendering Tests === */

describe('listnav schema - rendered output', () => {
	test('renders module-listnav wrapper', () => {
		const html = renderListnav(`{% listnav %}
- [Home](/index.html)
- [About](/about.html)
{% /listnav %}`)

		expect(html).toContain('<module-listnav>')
		expect(html).toContain('</module-listnav>')
	})

	test('renders form-listbox with role="listbox"', () => {
		const html = renderListnav(`{% listnav %}
- [Home](/index.html)
{% /listnav %}`)

		expect(html).toContain('<form-listbox')
		expect(html).toContain('role="listbox"')
	})

	test('renders option buttons from link items', () => {
		const html = renderListnav(`{% listnav %}
- [Home](/index.html)
- [About](/about.html)
{% /listnav %}`)

		expect(html).toContain('role="option"')
		expect(html).toContain('value="/index.html"')
		expect(html).toContain('value="/about.html"')
		expect(html).toContain('>Home</button>')
		expect(html).toContain('>About</button>')
	})

	test('first option has aria-selected="true"', () => {
		const html = renderListnav(`{% listnav %}
- [First](/first.html)
- [Second](/second.html)
{% /listnav %}`)

		// First option should be selected
		const firstOptionMatch = html.match(
			/<button[^>]*value="\/first\.html"[^>]*>/,
		)
		expect(firstOptionMatch).not.toBeNull()
		expect(firstOptionMatch![0]).toContain('aria-selected="true"')
	})

	test('non-first options have tabindex="-1"', () => {
		const html = renderListnav(`{% listnav %}
- [First](/first.html)
- [Second](/second.html)
{% /listnav %}`)

		const secondOptionMatch = html.match(
			/<button[^>]*value="\/second\.html"[^>]*>/,
		)
		expect(secondOptionMatch).not.toBeNull()
		expect(secondOptionMatch![0]).toContain('tabindex="-1"')
	})

	test('renders grouped items with role="group"', () => {
		const html = renderListnav(`{% listnav %}
- Functions
  - [defineComponent](/api/functions/defineComponent.html)
  - [on](/api/functions/on.html)
- Classes
  - [ContextRequestEvent](/api/classes/ContextRequestEvent.html)
{% /listnav %}`)

		expect(html).toContain('role="group"')
		// Should have group labels
		expect(html).toContain('Functions')
		expect(html).toContain('Classes')
	})

	test('renders visually-hidden heading with title', () => {
		const html = renderListnav(`{% listnav title="Symbols" %}
- [Home](/index.html)
{% /listnav %}`)

		expect(html).toContain('class="visually-hidden"')
		expect(html).toContain('Symbols')
	})

	test('uses default title "Navigation" when not specified', () => {
		const html = renderListnav(`{% listnav %}
- [Home](/index.html)
{% /listnav %}`)

		expect(html).toContain('Navigation')
	})

	test('includes module-lazyload content area', () => {
		const html = renderListnav(`{% listnav %}
- [Home](/index.html)
{% /listnav %}`)

		expect(html).toContain('<module-lazyload>')
		expect(html).toContain('</module-lazyload>')
	})

	test('includes loading indicator', () => {
		const html = renderListnav(`{% listnav %}
- [Home](/index.html)
{% /listnav %}`)

		expect(html).toContain('role="status"')
		expect(html).toContain('Loading...')
	})

	test('includes error container', () => {
		const html = renderListnav(`{% listnav %}
- [Home](/index.html)
{% /listnav %}`)

		expect(html).toContain('role="alert"')
		expect(html).toContain('aria-live="assertive"')
	})

	test('includes filter input', () => {
		const html = renderListnav(`{% listnav %}
- [Home](/index.html)
{% /listnav %}`)

		expect(html).toContain('class="filter"')
		expect(html).toContain('placeholder="Filter"')
		expect(html).toContain('autocomplete="off"')
	})

	test('includes clear button for filter', () => {
		const html = renderListnav(`{% listnav %}
- [Home](/index.html)
{% /listnav %}`)

		expect(html).toContain('class="clear"')
		expect(html).toContain('aria-label="Clear filter"')
	})

	test('sets form-listbox value to first item src', () => {
		const html = renderListnav(`{% listnav %}
- [First](/first.html)
- [Second](/second.html)
{% /listnav %}`)

		const listboxMatch = html.match(/<form-listbox[^>]*>/)
		expect(listboxMatch).not.toBeNull()
		expect(listboxMatch![0]).toContain('value="/first.html"')
	})

	test('renders API-style grouped navigation correctly', () => {
		const html = renderListnav(`{% listnav title="Symbols" %}
- Classes
  - [ContextRequestEvent](/api/classes/ContextRequestEvent.html)
  - [DependencyTimeoutError](/api/classes/DependencyTimeoutError.html)
- Functions
  - [defineComponent](/api/functions/defineComponent.html)
  - [on](/api/functions/on.html)
  - [setText](/api/functions/setText.html)
{% /listnav %}`)

		// Should have 2 groups
		const groupCount = (html.match(/role="group"/g) || []).length
		expect(groupCount).toBe(2)

		// Should have 5 option buttons total
		const optionCount = (html.match(/role="option"/g) || []).length
		expect(optionCount).toBe(5)

		// First option in first group should be selected
		expect(html).toContain('aria-selected="true"')

		// All entries present
		expect(html).toContain('ContextRequestEvent')
		expect(html).toContain('DependencyTimeoutError')
		expect(html).toContain('defineComponent')
		expect(html).toContain('on</button>')
		expect(html).toContain('setText')
	})
})
