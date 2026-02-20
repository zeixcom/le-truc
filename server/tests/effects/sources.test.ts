/**
 * Unit Tests for effects/sources.ts — Source Fragment Panel Generation
 */

import { describe, expect, test } from 'bun:test'
import { generatePanels } from '../../effects/sources'
import type { FileInfo } from '../../file-signals'

const createFile = (path: string, content: string): FileInfo => ({
	path,
	filename: path.split('/').pop() || '',
	content,
	hash: 'test-hash',
	lastModified: 0,
	size: content.length,
	exists: true,
})

describe('generatePanels', () => {
	test('returns html panel when only html source is provided', async () => {
		const html = createFile('examples/widget/widget.html', '<div>Widget</div>')
		const panels = await generatePanels(html)

		expect(panels).toHaveLength(1)
		expect(panels[0].type).toBe('html')
		expect(panels[0].selected).toBe(true)
		expect(panels[0].content).toContain('<pre class="shiki')
	})

	test('selects the last panel by default when html, css, and ts are provided', async () => {
		const html = createFile('examples/widget/widget.html', '<div>Widget</div>')
		const css = createFile('examples/widget/widget.css', '.widget { color: red; }')
		const ts = createFile('examples/widget/widget.ts', 'export const x = 1')

		const panels = await generatePanels(html, css, ts)

		expect(panels).toHaveLength(3)
		expect(panels.map(panel => panel.type)).toEqual(['html', 'css', 'ts'])
		expect(panels[0].selected).toBe(false)
		expect(panels[1].selected).toBe(false)
		expect(panels[2].selected).toBe(true)
	})
})
