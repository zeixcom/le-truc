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

	test('supports initial attributes', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-button.html')

		// Create element with initial attributes
		await page.evaluate(() => {
			const element = document.createElement('basic-button') as any
			element.setAttribute('disabled', 'true')
			element.setAttribute('label', 'Delete Item')
			element.setAttribute('badge', '99')
			element.innerHTML = `
				<button type="button">
					<span class="label">Default Label</span>
					<span class="badge">0</span>
				</button>
			`
			document.body.appendChild(element)
		})

		await page.waitForSelector('basic-button')

		const newButton = page.locator('basic-button').last()
		const button = newButton.locator('button')
		const labelSpan = newButton.locator('.label')
		const badgeSpan = newButton.locator('.badge')

		// Should reflect initial attributes
		await expect(button).toBeDisabled()
		await expect(labelSpan).toHaveText('Delete Item')
		await expect(badgeSpan).toHaveText('99')
	})

	test('updates via property changes', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-button.html')
		await page.waitForSelector('basic-button')

		const basicButton = page.locator('basic-button')
		const button = basicButton.locator('button')
		const labelSpan = basicButton.locator('.label')
		const badgeSpan = basicButton.locator('.badge')

		// Change properties directly
		await basicButton.evaluate(node => {
			;(node as any).disabled = true
			;(node as any).label = 'Property Label'
			;(node as any).badge = 'NEW'
		})

		await expect(button).toBeDisabled()
		await expect(labelSpan).toHaveText('Property Label')
		await expect(badgeSpan).toHaveText('NEW')

		// Change back via properties
		await basicButton.evaluate(node => {
			;(node as any).disabled = false
		})

		await expect(button).not.toBeDisabled()
	})

	test('handles missing optional elements gracefully', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-button.html')

		// Create button without label/badge spans
		await page.evaluate(() => {
			const element = document.createElement('basic-button') as any
			element.setAttribute('label', 'No Spans')
			element.setAttribute('badge', 'Missing')
			element.innerHTML = `<button type="button">Just Button Text</button>`
			document.body.appendChild(element)
		})

		await page.waitForSelector('basic-button')

		const newButton = page.locator('basic-button').last()
		const button = newButton.locator('button')

		// Should not crash and button should work
		await expect(button).not.toBeDisabled()
		await expect(button).toHaveText('Just Button Text')

		// Test that disabled still works
		await newButton.evaluate(node => {
			node.setAttribute('disabled', 'true')
		})
		await expect(button).toBeDisabled()
	})

	test('falls back to button text when no label span', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-button.html')

		// Create button that should use button text as label fallback
		await page.evaluate(() => {
			const element = document.createElement('basic-button') as any
			element.innerHTML = `<button type="button">Button Text Only</button>`
			document.body.appendChild(element)
		})

		await page.waitForSelector('basic-button')

		const newButton = page.locator('basic-button').last()

		// Check that label property reflects button text
		const labelValue = await newButton.evaluate(node => (node as any).label)
		expect(labelValue).toBe('Button Text Only')

		// Update label attribute - should not affect button text since no .label span
		await newButton.evaluate(node => {
			node.setAttribute('label', 'New Label')
		})

		const button = newButton.locator('button')
		await expect(button).toHaveText('Button Text Only') // Button text unchanged
	})

	test('handles boolean disabled attribute variations', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-button.html')

		const basicButton = page.locator('basic-button')
		const button = basicButton.locator('button')

		// Test various boolean attribute formats
		await basicButton.evaluate(node => {
			node.setAttribute('disabled', '')
		})
		await expect(button).toBeDisabled()

		await basicButton.evaluate(node => {
			node.setAttribute('disabled', 'false')
		})
		await expect(button).not.toBeDisabled()

		await basicButton.evaluate(node => {
			node.setAttribute('disabled', 'disabled')
		})
		await expect(button).toBeDisabled()

		// Note: "0" is truthy in asBoolean parser, so it enables disabled
		await basicButton.evaluate(node => {
			node.setAttribute('disabled', '0')
		})
		await expect(button).toBeDisabled()

		// Remove attribute to disable
		await basicButton.evaluate(node => {
			node.removeAttribute('disabled')
		})
		await expect(button).not.toBeDisabled()
	})
})
