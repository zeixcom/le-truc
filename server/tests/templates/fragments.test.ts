/**
 * Unit Tests for templates/fragments.ts — Fragment Templates
 *
 * Tests for tabButton, tabPanel, tabList, tabGroup, and validatePanels.
 */

import { describe, expect, test } from 'bun:test'
import {
	tabButton,
	tabPanel,
	tabGroup,
	validatePanels,
	type PanelType,
} from '../../templates/fragments'

/* === Helpers === */

function mockPanel(overrides: Partial<PanelType> = {}): PanelType {
	return {
		type: 'html',
		label: 'HTML',
		filePath: 'examples/widget/widget.html',
		content: '<pre>code</pre>',
		selected: true,
		...overrides,
	}
}

/* === §6.1 tabButton === */

describe('tabButton', () => {
	test('renders role="tab"', () => {
		const result = tabButton({ name: 'widget', panel: mockPanel() })
		expect(result).toContain('role="tab"')
	})

	test('sets correct aria-controls', () => {
		const result = tabButton({ name: 'widget', panel: mockPanel({ type: 'ts' }) })
		expect(result).toContain('aria-controls="panel_widget_ts"')
	})

	test('sets aria-selected="true" for selected panel', () => {
		const result = tabButton({ name: 'widget', panel: mockPanel({ selected: true }) })
		expect(result).toContain('aria-selected="true"')
	})

	test('sets aria-selected="false" for unselected panel', () => {
		const result = tabButton({ name: 'widget', panel: mockPanel({ selected: false }) })
		expect(result).toContain('aria-selected="false"')
	})

	test('sets tabindex="-1" for unselected panel', () => {
		const result = tabButton({ name: 'widget', panel: mockPanel({ selected: false }) })
		expect(result).toContain('tabindex="-1"')
	})

	test('sets tabindex="0" for selected panel', () => {
		const result = tabButton({ name: 'widget', panel: mockPanel({ selected: true }) })
		expect(result).toContain('tabindex="0"')
	})

	test('includes panel label text', () => {
		const result = tabButton({ name: 'widget', panel: mockPanel({ label: 'TypeScript' }) })
		expect(result).toContain('TypeScript')
	})
})

/* === §6.4 tabPanel === */

describe('tabPanel', () => {
	test('renders role="tabpanel"', () => {
		const result = tabPanel({ name: 'widget', panel: mockPanel() })
		expect(result).toContain('role="tabpanel"')
	})

	test('wraps panel content with module-scrollarea for horizontal overflow', () => {
		const panel = mockPanel({
			type: 'ts',
			content: '<pre class="shiki"><code>export const x = 1</code></pre>',
		})
		const result = tabPanel({ name: 'widget', panel })
		expect(result).toContain('<module-scrollarea orientation="horizontal">')
		expect(result).toContain('<pre class="shiki"><code>export const x = 1</code></pre>')
	})

	test('adds hidden attribute for non-selected panel', () => {
		const result = tabPanel({ name: 'widget', panel: mockPanel({ selected: false }) })
		expect(result).toContain('hidden')
	})

	test('does not add hidden attribute for selected panel', () => {
		const result = tabPanel({ name: 'widget', panel: mockPanel({ selected: true }) })
		// hidden should NOT appear as an attribute on the panel div
		expect(result).not.toMatch(/\shidden(\s|>)/)
	})

	test('sets correct id on panel div', () => {
		const result = tabPanel({ name: 'widget', panel: mockPanel({ type: 'css' }) })
		expect(result).toContain('id="panel_widget_css"')
	})
})

/* === §6.6 tabGroup === */

describe('tabGroup', () => {
	test('renders module-tabgroup wrapper', () => {
		const result = tabGroup('widget', [mockPanel()])
		expect(result).toContain('<module-tabgroup>')
		expect(result).toContain('</module-tabgroup>')
	})

	test('wraps tab buttons in role="tablist"', () => {
		const result = tabGroup('widget', [mockPanel()])
		expect(result).toContain('role="tablist"')
	})

	test('renders tabpanel divs inside tabgroup', () => {
		const result = tabGroup('widget', [mockPanel()])
		expect(result).toContain('role="tabpanel"')
	})

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

	test('renders one tabpanel per panel', () => {
		const panels = [
			mockPanel({ type: 'html', selected: true }),
			mockPanel({ type: 'css', label: 'CSS', filePath: 'w.css', selected: false }),
		]
		const result = tabGroup('widget', panels)
		const count = (result.match(/role="tabpanel"/g) || []).length
		expect(count).toBe(2)
	})

	test('returns fallback message for empty panels array', () => {
		const result = tabGroup('widget', [])
		expect(result).toContain('No component files available')
	})
})

/* === §6.8 validatePanels === */

describe('validatePanels', () => {
	test('accepts valid single-panel input', () => {
		const result = validatePanels([mockPanel()])
		expect(result.valid).toBe(true)
		expect(result.errors).toHaveLength(0)
	})

	test('rejects empty array with "No panels provided"', () => {
		const result = validatePanels([])
		expect(result.valid).toBe(false)
		expect(result.errors.some(e => e.includes('No panels provided'))).toBe(true)
	})

	test('rejects multiple selected panels', () => {
		const panels = [
			mockPanel({ type: 'html', selected: true }),
			mockPanel({ type: 'css', label: 'CSS', filePath: 'w.css', selected: true }),
		]
		const result = validatePanels(panels)
		expect(result.valid).toBe(false)
		expect(result.errors.some(e => e.includes('Multiple panels are selected'))).toBe(true)
	})

	test('rejects duplicate panel types', () => {
		const panels = [
			mockPanel({ type: 'html', selected: true }),
			mockPanel({ type: 'html', label: 'HTML2', filePath: 'w2.html', selected: false }),
		]
		const result = validatePanels(panels)
		expect(result.valid).toBe(false)
		expect(result.errors.some(e => e.includes('Duplicate panel type'))).toBe(true)
	})
})
