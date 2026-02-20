/**
 * Unit Tests for templates/fragments.ts — Fragment Templates
 */

import { describe, expect, test } from 'bun:test'
import { tabPanel, tabGroup, type PanelType } from '../../templates/fragments'

describe('tabPanel', () => {
	test('wraps panel content with module-scrollarea for horizontal overflow', () => {
		const panel: PanelType = {
			type: 'ts',
			label: 'TypeScript',
			filePath: 'examples/widget/widget.ts',
			content: '<pre class="shiki"><code>export const x = 1</code></pre>',
			selected: true,
		}

		const result = tabPanel({ name: 'widget', panel })

		expect(result).toContain('<module-scrollarea orientation="horizontal">')
		expect(result).toContain('<pre class="shiki"><code>export const x = 1</code></pre>')
	})
})

describe('tabGroup', () => {
	test('renders module-tabgroup with tab panels', () => {
		const panels: PanelType[] = [
			{
				type: 'html',
				label: 'HTML',
				filePath: 'examples/widget/widget.html',
				content: '<pre class="shiki"><code>&lt;div&gt;Widget&lt;/div&gt;</code></pre>',
				selected: true,
			},
		]

		const result = tabGroup('widget', panels)

		expect(result).toContain('<module-tabgroup>')
		expect(result).toContain('role="tabpanel"')
		expect(result).toContain('<module-scrollarea orientation="horizontal">')
	})
})
