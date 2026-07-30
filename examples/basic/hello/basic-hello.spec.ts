import { expect, test } from '@playwright/test'

test.describe('basic-hello component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/basic-hello')
		await page.waitForSelector('basic-hello')
	})

	test('renders default greeting and updates output on input', async ({
		page,
	}) => {
		// Use the default (first) basic-hello element
		const el = page.locator('basic-hello').first()
		const output = el.locator('output')
		const input = el.locator('input[name="subject"]')

		// Check initial state
		await expect(output).toHaveText('World')
		await expect(input).toHaveValue('')

		// Type a new name and verify reactive update
		await input.fill('Esther')
		await expect(output).toHaveText('Esther')

		// Clear input and verify fallback to default
		await input.fill('')
		await expect(output).toHaveText('World')
	})

	test('updates when name property changes programmatically', async ({
		page,
	}) => {
		const el = page.locator('basic-hello').first()
		const output = el.locator('output')

		// Change name property directly
		await el.evaluate(node => {
			;(node as any).subject = 'Bob'
		})

		await expect(output).toHaveText('Bob')
	})

	test('preserves input value when switching between programmatic and user input', async ({
		page,
	}) => {
		const el = page.locator('basic-hello').first()
		const input = el.locator('input')
		const output = el.locator('output')

		// User types something
		await input.fill('David')
		await expect(output).toHaveText('David')
		await expect(input).toHaveValue('David')

		// Programmatic change
		await el.evaluate(node => {
			;(node as any).subject = 'Eve'
		})
		await expect(output).toHaveText('Eve')

		// Input field should not be affected by programmatic changes
		await expect(input).toHaveValue('David')

		// User continues typing
		await input.fill('Frank')
		await expect(output).toHaveText('Frank')
	})

	test('handles special characters and unicode', async ({ page }) => {
		const el = page.locator('basic-hello').first()
		const input = el.locator('input')
		const output = el.locator('output')

		// Test special characters
		await input.fill('José María')
		await expect(output).toHaveText('José María')

		// Test unicode emoji
		await input.fill('🎉 Alice 🚀')
		await expect(output).toHaveText('🎉 Alice 🚀')

		// Test HTML-sensitive characters
		await input.fill('<script>alert("test")</script>')
		await expect(output).toHaveText('<script>alert("test")</script>')
	})
})
