/**
 * Unit Tests for effects/examples.ts — Example Fragment Generation
 */

import { describe, expect, test } from 'bun:test'
import { processExample } from '../../effects/examples'

describe('processExample', () => {
	test('generates highlighted codeblock wrapped in module-scrollarea', async () => {
		const markdown = `### Demo\n\n{{ content }}`
		const componentHtml = `<basic-button><button type="button">Hello</button></basic-button>`

		const result = await processExample('basic-button', markdown, componentHtml)

		expect(result).toContain('<module-codeblock')
		expect(result).toContain('<module-scrollarea orientation="horizontal">')
		expect(result).toContain('<pre class="shiki')
		expect(result).not.toContain('data-code=')
		expect(result).not.toStartWith('<article>')
	})

	test('injects decoded module-demo preview markup', async () => {
		const markdown = `{% demo %}\n{{ content }}\n{% /demo %}`
		const componentHtml =
			'<div class="demo-target">&lt;button&gt;Click&lt;/button&gt;</div>'

		const result = await processExample('demo-sample', markdown, componentHtml)

		expect(result).toContain('<module-demo')
		expect(result).toContain('<div class="preview">')
		expect(result).not.toContain('preview-html=')
	})

	test('resolves the shared form-associated.md partial into a details/summary block', async () => {
		const markdown = `### Demo\n\n{{ content }}\n\n{% partial file="form-associated.md" /%}`
		const componentHtml = `<form-textbox></form-textbox>`

		const result = await processExample('form-textbox', markdown, componentHtml)

		expect(result).toContain('<card-collapsible>')
		expect(result).toContain('<details>')
		expect(result).toContain('class="description">Participates in HTML forms')
		expect(result).toContain('checkValidity')
		expect(result).toContain('willValidate')
	})
})
