import { expect, test } from '@playwright/test'

// This test assumes the Bun server serves test pages at http://localhost:4173/test/{component}.html

test.describe('basic-hello component', () => {
	test('renders default greeting and updates output on input', async ({
		page,
	}) => {
		// Log browser console output for debugging
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:4173/test/basic-hello.html')

		// Wait for custom element to be upgraded
		await page.waitForSelector('basic-hello')

		// Check initial output
		const output = page.locator('basic-hello output')
		await expect(output).toHaveText('World')

		// Type a new name and dispatch input event
		const input = page.locator('basic-hello input[name="name"]')
		await input.fill('Esther')

		// Output should update reactively
		await expect(output).toHaveText('Esther')

		// Clear input and dispatch input event
		await input.fill('')
		await expect(output).toHaveText('World')
	})
})
