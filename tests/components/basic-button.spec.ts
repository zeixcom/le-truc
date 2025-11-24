import { expect, test } from '@playwright/test'

test.describe('basic-button component', () => {
	test('renders default state and updates dynamically', async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:4173/test/basic-button.html')

		await page.waitForSelector('basic-button')

		const basicButton = page.locator('basic-button')
		const button = page.locator('basic-button button')
		const labelSpan = page.locator('basic-button .label')
		const badgeSpan = page.locator('basic-button .badge')

		// Check initial state
		await expect(button).not.toBeDisabled()
		await expect(labelSpan).toHaveText('🛒 Shopping Cart')
		await expect(badgeSpan).toHaveText('5')

		// Update disabled status
		await basicButton.evaluate(node =>
			node.setAttribute('disabled', 'true'),
		)
		await expect(button).toBeDisabled()

		await basicButton.evaluate(node => node.removeAttribute('disabled'))
		await expect(button).not.toBeDisabled()

		// Update label
		await basicButton.evaluate(node =>
			node.setAttribute('label', 'Wishlist'),
		)
		await expect(labelSpan).toHaveText('Wishlist')

		// Update badge
		await basicButton.evaluate(node => node.setAttribute('badge', '10'))
		await expect(badgeSpan).toHaveText('10')

		// Update all
		await basicButton.evaluate(node => {
			node.setAttribute('disabled', 'true')
			node.setAttribute('label', 'Back to Store')
			node.setAttribute('badge', '0')
		})
		await expect(button).toBeDisabled()
		await expect(labelSpan).toHaveText('Back to Store')
		await expect(badgeSpan).toHaveText('0')
	})
})
