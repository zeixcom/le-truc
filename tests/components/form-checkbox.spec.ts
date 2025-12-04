import { expect, test } from '@playwright/test'

test.describe('form-checkbox component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:4173/test/form-checkbox.html')
		await page.waitForSelector('form-checkbox')
	})

	test('renders initial state correctly', async ({ page }) => {
		const checkboxComponent = page.locator('form-checkbox').first()
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')
		const label = checkboxComponent.locator('.label')

		// Should not be checked initially
		await expect(checkbox).not.toBeChecked()
		await expect(checkboxComponent).not.toHaveAttribute('checked')

		// Should display correct label text
		await expect(label).toHaveText('Checkbox')
	})

	test('toggles checked state when clicking checkbox', async ({ page }) => {
		const checkboxComponent = page.locator('form-checkbox').first()
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')

		// Initially unchecked
		await expect(checkbox).not.toBeChecked()
		await expect(checkboxComponent).not.toHaveAttribute('checked')

		// Click to check
		await checkbox.click()
		await expect(checkbox).toBeChecked()
		await expect(checkboxComponent).toHaveAttribute('checked')

		// Click to uncheck
		await checkbox.click()
		await expect(checkbox).not.toBeChecked()
		await expect(checkboxComponent).not.toHaveAttribute('checked')
	})

	test('syncs checked property with checkbox clicks', async ({ page }) => {
		const checkboxComponent = page.locator('form-checkbox').first()
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')

		// Initially false
		let isChecked = await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			return element.checked
		})
		expect(isChecked).toBe(false)

		// Click checkbox to check
		await checkbox.click()

		isChecked = await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			return element.checked
		})
		expect(isChecked).toBe(true)
		await expect(checkboxComponent).toHaveAttribute('checked')

		// Click checkbox to uncheck
		await checkbox.click()

		isChecked = await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			return element.checked
		})
		expect(isChecked).toBe(false)
		await expect(checkboxComponent).not.toHaveAttribute('checked')
	})

	test('updates label text when changed programmatically', async ({
		page,
	}) => {
		const checkboxComponent = page.locator('form-checkbox').first()
		const label = checkboxComponent.locator('.label')

		// Initial label
		await expect(label).toHaveText('Checkbox')

		// Update label property
		await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			element.label = 'Updated Label'
		})

		await expect(label).toHaveText('Updated Label')
	})

	test('reads initial label from DOM content', async ({ page }) => {
		const todoCheckbox = page.locator('form-checkbox.todo')
		const label = todoCheckbox.locator('.label')

		// Should display the label text from the DOM
		await expect(label).toHaveText('Task')
	})

	test('handles multiple checkboxes independently', async ({ page }) => {
		const firstCheckbox = page.locator('form-checkbox').first()
		const firstInput = firstCheckbox.locator('input[type="checkbox"]')
		const firstLabel = firstCheckbox.locator('.label')

		const secondCheckbox = page.locator('form-checkbox.todo')
		const secondInput = secondCheckbox.locator('input[type="checkbox"]')
		const secondLabel = secondCheckbox.locator('.label')

		// Verify different initial states
		await expect(firstLabel).toHaveText('Checkbox')
		await expect(secondLabel).toHaveText('Task')
		await expect(firstInput).not.toBeChecked()
		await expect(secondInput).not.toBeChecked()

		// Check first checkbox only
		await firstInput.click()
		await expect(firstInput).toBeChecked()
		await expect(firstCheckbox).toHaveAttribute('checked')
		await expect(secondInput).not.toBeChecked()
		await expect(secondCheckbox).not.toHaveAttribute('checked')

		// Check second checkbox using label click (for the visually hidden checkbox)
		await secondCheckbox.locator('label').click()
		await expect(firstInput).toBeChecked()
		await expect(firstCheckbox).toHaveAttribute('checked')
		await expect(secondInput).toBeChecked()
		await expect(secondCheckbox).toHaveAttribute('checked')

		// Uncheck first, keep second checked
		await firstInput.click()
		await expect(firstInput).not.toBeChecked()
		await expect(firstCheckbox).not.toHaveAttribute('checked')
		await expect(secondInput).toBeChecked()
		await expect(secondCheckbox).toHaveAttribute('checked')
	})

	test('handles keyboard interaction (space key)', async ({ page }) => {
		const checkboxComponent = page.locator('form-checkbox').first()
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')

		// Focus the checkbox
		await checkbox.focus()
		await expect(checkbox).toBeFocused()

		// Initially unchecked
		await expect(checkbox).not.toBeChecked()

		// Press space to toggle
		await checkbox.press('Space')
		await expect(checkbox).toBeChecked()
		await expect(checkboxComponent).toHaveAttribute('checked')

		// Press space again to toggle back
		await checkbox.press('Space')
		await expect(checkbox).not.toBeChecked()
		await expect(checkboxComponent).not.toHaveAttribute('checked')
	})

	test('handles clicking on label to toggle checkbox', async ({ page }) => {
		const checkboxComponent = page.locator('form-checkbox').first()
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')
		const labelElement = checkboxComponent.locator('label')

		// Initially unchecked
		await expect(checkbox).not.toBeChecked()

		// Click on label should toggle checkbox
		await labelElement.click()
		await expect(checkbox).toBeChecked()
		await expect(checkboxComponent).toHaveAttribute('checked')

		// Click label again to uncheck
		await labelElement.click()
		await expect(checkbox).not.toBeChecked()
		await expect(checkboxComponent).not.toHaveAttribute('checked')
	})

	test('maintains state during label changes', async ({ page }) => {
		const checkboxComponent = page.locator('form-checkbox').first()
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')
		const label = checkboxComponent.locator('.label')

		// Check the checkbox
		await checkbox.click()
		await expect(checkbox).toBeChecked()
		await expect(checkboxComponent).toHaveAttribute('checked')

		// Modify label without affecting checked state
		await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			element.label = 'Modified Label'
		})

		// Checkbox should still be checked and label should be updated
		await expect(checkbox).toBeChecked()
		await expect(checkboxComponent).toHaveAttribute('checked')
		await expect(label).toHaveText('Modified Label')
	})

	test('fires change events on checkbox interaction', async ({ page }) => {
		// Set up event listener
		await page.evaluate(() => {
			;(window as any).changeEventCount = 0
			const checkbox = document.querySelector(
				'form-checkbox input[type="checkbox"]',
			)
			checkbox?.addEventListener('change', () => {
				;(window as any).changeEventCount++
			})
		})

		const checkbox = page
			.locator('form-checkbox input[type="checkbox"]')
			.first()

		// Click should fire change event
		await checkbox.click()

		let changeEventCount = await page.evaluate(
			() => (window as any).changeEventCount,
		)
		expect(changeEventCount).toBe(1)

		// Click again should fire another change event
		await checkbox.click()

		changeEventCount = await page.evaluate(
			() => (window as any).changeEventCount,
		)
		expect(changeEventCount).toBe(2)
	})

	test('handles form integration', async ({ page }) => {
		// Add a form wrapper and test form data
		await page.evaluate(() => {
			const form = document.createElement('form')
			const checkbox = document.querySelector('form-checkbox')
			if (checkbox) {
				checkbox.parentNode?.insertBefore(form, checkbox)
				form.appendChild(checkbox)
				// Give the checkbox input a name for form submission
				const input = checkbox.querySelector(
					'input[type="checkbox"]',
				) as HTMLInputElement
				if (input) input.name = 'testCheckbox'
			}
		})

		const checkbox = page
			.locator('form-checkbox input[type="checkbox"]')
			.first()

		// Check the checkbox
		await checkbox.click()
		await expect(checkbox).toBeChecked()

		// Test form data includes the checkbox
		const formData = await page.evaluate(() => {
			const form = document.querySelector('form')
			if (!form) return null
			const data = new FormData(form)
			return Object.fromEntries(data.entries())
		})

		expect(formData).toEqual({ testCheckbox: 'on' })
	})

	test('checked property is readonly (sensor-based)', async ({ page }) => {
		// Test that the checked property reflects DOM state but doesn't control it
		const initialChecked = await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			return element.checked
		})
		expect(initialChecked).toBe(false)

		// Click the actual checkbox
		const checkbox = page
			.locator('form-checkbox input[type="checkbox"]')
			.first()
		await checkbox.click()

		// Property should now reflect the checked state
		const checkedAfterClick = await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			return element.checked
		})
		expect(checkedAfterClick).toBe(true)

		// Verify that trying to set the checked property doesn't change the checkbox
		// (since it's a readonly sensor)
		await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			try {
				element.checked = false
			} catch (_e) {
				// Expected - property might be readonly
			}
		})

		// Checkbox should still be checked
		await expect(checkbox).toBeChecked()

		// The property should still reflect true because it reads from DOM
		const checkedAfterAttemptedChange = await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			return element.checked
		})
		expect(checkedAfterAttemptedChange).toBe(true)
	})

	test('sensor updates when checkbox state changes programmatically', async ({
		page,
	}) => {
		const checkboxComponent = page.locator('form-checkbox').first()
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')

		// Change the checkbox state directly via DOM
		await page.evaluate(() => {
			const input = document.querySelector(
				'form-checkbox input[type="checkbox"]',
			) as HTMLInputElement
			input.checked = true
			input.dispatchEvent(new Event('change', { bubbles: true }))
		})

		// Component should reflect the change
		await expect(checkbox).toBeChecked()
		await expect(checkboxComponent).toHaveAttribute('checked')

		const checkedProperty = await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			return element.checked
		})
		expect(checkedProperty).toBe(true)
	})

	test('handles rapid checkbox state changes', async ({ page }) => {
		const checkboxComponent = page.locator('form-checkbox').first()
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')

		// Rapid clicks
		await checkbox.click()
		await checkbox.click()
		await checkbox.click()

		// Should end up checked
		await expect(checkbox).toBeChecked()
		await expect(checkboxComponent).toHaveAttribute('checked')

		const finalCheckedState = await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			return element.checked
		})
		expect(finalCheckedState).toBe(true)
	})
})
