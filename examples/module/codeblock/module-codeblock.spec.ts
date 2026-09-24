import { expect, test } from '@playwright/test'

test.describe('module-codeblock component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/module-codeblock')
		await page.waitForSelector('module-codeblock')
	})

	test('starts collapsed with the expand overlay shown', async ({ page }) => {
		const codeblock = page.locator('module-codeblock').first()

		await expect(codeblock).toHaveAttribute('collapsed', '')
		expect(await codeblock.evaluate(node => (node as any).collapsed)).toBe(true)
		await expect(codeblock.locator('button.overlay')).toBeVisible()
		await expect(codeblock.locator('basic-button.copy')).toBeHidden()
	})

	test('clicking the overlay expands the code block', async ({ page }) => {
		const codeblock = page.locator('module-codeblock').first()

		await codeblock.locator('button.overlay').click()

		await expect(codeblock).not.toHaveAttribute('collapsed')
		expect(await codeblock.evaluate(node => (node as any).collapsed)).toBe(
			false,
		)
		await expect(codeblock.locator('button.overlay')).toBeHidden()
		await expect(codeblock.locator('basic-button.copy')).toBeVisible()
	})

	test('reflects the collapsed property onto the attribute', async ({
		page,
	}) => {
		const codeblock = page.locator('module-codeblock').first()

		await codeblock.evaluate(node => {
			;(node as any).collapsed = false
		})
		await expect(codeblock).not.toHaveAttribute('collapsed')

		await codeblock.evaluate(node => {
			;(node as any).collapsed = true
		})
		await expect(codeblock).toHaveAttribute('collapsed', '')
	})

	test('only the overlay expands — not the composed copy button', async ({
		page,
	}) => {
		// Pins LT-096's selector fix: the overlay's query must not match the
		// composed basic-button's own <button>, which comes first in the DOM.
		const codeblock = page.locator('module-codeblock').first()

		await codeblock.locator('basic-button.copy button').dispatchEvent('click')
		await expect(codeblock).toHaveAttribute('collapsed', '')
	})

	test('clicking copy toggles the label and copies the code', async ({
		page,
	}) => {
		// Pins LT-096: the copy effect is a raw EffectDescriptor, which only
		// attaches when registered through an effect helper — called bare,
		// the click listener never existed and the label stayed "Copy".
		const codeblock = page.locator('module-codeblock').first()
		const copy = codeblock.locator('basic-button.copy')
		const button = copy.locator('button')
		const label = copy.locator('.label')

		// Replace the Clipboard API so the assertion does not depend on the
		// browser's clipboard permission model (WebKit has none to grant).
		await page.evaluate(() => {
			;(window as any).__copied = null
			Object.defineProperty(navigator, 'clipboard', {
				configurable: true,
				value: {
					writeText: async (text: string) => {
						;(window as any).__copied = text
					},
				},
			})
		})

		await codeblock.locator('button.overlay').click()
		await expect(label).toHaveText('Copy')

		await button.click()

		await expect(label).toHaveText('Copied!')
		await expect(button).toBeDisabled()
		const copied = await page.evaluate(() => (window as any).__copied)
		expect(copied).toBe(
			(await codeblock.locator('code').textContent())?.trim() ?? '',
		)
		// Restores after the success timeout.
		await expect(label).toHaveText('Copy', { timeout: 3000 })
		await expect(button).not.toBeDisabled()
	})

	test('shows the error message when the clipboard rejects', async ({
		page,
	}) => {
		const codeblock = page.locator('module-codeblock').first()
		const copy = codeblock.locator('basic-button.copy')
		const label = copy.locator('.label')

		await page.evaluate(() => {
			Object.defineProperty(navigator, 'clipboard', {
				configurable: true,
				value: {
					writeText: async () => {
						throw new Error('denied')
					},
				},
			})
		})

		await codeblock.locator('button.overlay').click()
		await copy.locator('button').click()

		await expect(label).toHaveText('Error trying to copy to clipboard!')
	})
})
