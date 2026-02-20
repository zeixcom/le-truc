/**
 * Unit Tests for schema/table.markdoc.ts — Table Schema
 *
 * Tests that Markdoc `{% table %}` output is wrapped in a horizontal
 * `module-scrollarea` while preserving native table structure/content.
 */

import { describe, expect, test } from 'bun:test'
import Markdoc from '@markdoc/markdoc'
import table from '../../schema/table.markdoc'

const renderTable = (markdown: string): string => {
	const ast = Markdoc.parse(markdown)
	const transformed = Markdoc.transform(ast, { tags: { table } })
	return Markdoc.renderers.html(transformed)
}

describe('table schema', () => {
	test('wraps table in module-scrollarea', () => {
		const html = renderTable(`{% table %}
* Name
* Description
---
* \`foo\`
* A value
{% /table %}`)

		expect(html).toContain('<module-scrollarea orientation="horizontal">')
		expect(html).toContain('<table>')
		expect(html).toContain('</table>')
		expect(html).toContain('</module-scrollarea>')
	})

	test('preserves header and body cells', () => {
		const html = renderTable(`{% table %}
* Name
* Type
* Default
---
* \`value\`
* \`number\`
* \`0\`
{% /table %}`)

		expect(html).toContain('<thead>')
		expect(html).toContain('<tbody>')
		expect(html).toContain('<th>Name</th>')
		expect(html).toContain('<th>Type</th>')
		expect(html).toContain('<th>Default</th>')
		expect(html).toContain('<td><code>value</code></td>')
		expect(html).toContain('<td><code>number</code></td>')
		expect(html).toContain('<td><code>0</code></td>')
	})
})
