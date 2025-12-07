import { expect, test } from '@playwright/test'

test.describe('basic-button component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:4173/test/basic-button.html')
		await page.waitForSelector('basic-button')
	})

	test('renders default state and updates dynamically', async ({ page }) => {
		// Use the default (first) basic-button element
		const defaultElement = page.locator('basic-button').first()
		const button = defaultElement.locator('button')
		const labelSpan = defaultElement.locator('.label')
		const badgeSpan = defaultElement.locator('.badge')

		// Check initial state
		await expect(button).not.toBeDisabled()
		await expect(labelSpan).toHaveText('🛒 Shopping Cart')
		await expect(badgeSpan).toHaveText('5')

		// Update disabled status
		await defaultElement.evaluate(node => node.setAttribute('disabled', 'true'))
		await expect(button).toBeDisabled()

		await defaultElement.evaluate(node => node.removeAttribute('disabled'))
		await expect(button).not.toBeDisabled()

		// Update label
		await defaultElement.evaluate(node =>
			node.setAttribute('label', 'Wishlist'),
		)
		await expect(labelSpan).toHaveText('Wishlist')

		// Update badge
		await defaultElement.evaluate(node => node.setAttribute('badge', '10'))
		await expect(badgeSpan).toHaveText('10')

		// Update all
		await defaultElement.evaluate(node => {
			node.setAttribute('disabled', 'true')
			node.setAttribute('label', 'Back to Store')
			node.setAttribute('badge', '0')
		})
		await expect(button).toBeDisabled()
		await expect(labelSpan).toHaveText('Back to Store')
		await expect(badgeSpan).toHaveText('0')
	})

	test('supports initial attributes', async ({ page }) => {
		// Use the existing initial attributes test element from HTML
		const initialElement = page.locator('#initial-attrs-test')
		const button = initialElement.locator('button')
		const labelSpan = initialElement.locator('.label')
		const badgeSpan = initialElement.locator('.badge')

		// Should reflect initial attributes
		await expect(button).toBeDisabled()
		await expect(labelSpan).toHaveText('Delete Item')
		await expect(badgeSpan).toHaveText('99')
	})

	test('updates via property changes', async ({ page }) => {
		// Use the existing property test element from HTML
		const propertyElement = page.locator('#property-test')
		const button = propertyElement.locator('button')
		const labelSpan = propertyElement.locator('.label')
		const badgeSpan = propertyElement.locator('.badge')

		// Change properties directly
		await propertyElement.evaluate(node => {
			;(node as any).disabled = true
			;(node as any).label = 'Property Label'
			;(node as any).badge = 'NEW'
		})

		await expect(button).toBeDisabled()
		await expect(labelSpan).toHaveText('Property Label')
		await expect(badgeSpan).toHaveText('NEW')

		// Change back via properties
		await propertyElement.evaluate(node => {
			;(node as any).disabled = false
		})

		await expect(button).not.toBeDisabled()
	})

	test('handles missing optional elements gracefully', async ({ page }) => {
		// Use the existing missing elements test element from HTML
		const missingElement = page.locator('#missing-elements-test')
		const button = missingElement.locator('button')

		// Should not crash and button should work
		await expect(button).not.toBeDisabled()
		await expect(button).toHaveText('Just Button Text')

		// Test that disabled still works
		await missingElement.evaluate(node => {
			node.setAttribute('disabled', 'true')
		})
		await expect(button).toBeDisabled()
	})

	test('falls back to button text when no label span', async ({ page }) => {
		// Use the existing text fallback test element from HTML
		const fallbackElement = page.locator('#text-fallback-test')
		const button = fallbackElement.locator('button')

		// Check that label property reflects button text
		const labelValue = await fallbackElement.evaluate(
			node => (node as any).label,
		)
		expect(labelValue).toBe('Button Text Only')

		// Update label attribute - should not affect button text since no .label span
		await fallbackElement.evaluate(node => {
			node.setAttribute('label', 'New Label')
		})

		await expect(button).toHaveText('Button Text Only') // Button text unchanged
	})

	test('handles boolean disabled attribute variations', async ({ page }) => {
		// Use the existing boolean test element from HTML
		const booleanElement = page.locator('#boolean-test')
		const button = booleanElement.locator('button')

		// Test various boolean attribute formats
		await booleanElement.evaluate(node => {
			node.setAttribute('disabled', '')
		})
		await expect(button).toBeDisabled()

		await booleanElement.evaluate(node => {
			node.setAttribute('disabled', 'false')
		})
		await expect(button).not.toBeDisabled()

		await booleanElement.evaluate(node => {
			node.setAttribute('disabled', 'disabled')
		})
		await expect(button).toBeDisabled()

		// Note: "0" is truthy in asBoolean parser, so it enables disabled
		await booleanElement.evaluate(node => {
			node.setAttribute('disabled', '0')
		})
		await expect(button).toBeDisabled()

		// Remove attribute to disable
		await booleanElement.evaluate(node => {
			node.removeAttribute('disabled')
		})
		await expect(button).not.toBeDisabled()
	})
})
