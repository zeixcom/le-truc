import { expect, type Locator, test } from '@playwright/test'

/**
 * Check the host's `:has(input:checked)` CSS hook — reads the native
 * checkbox's real `:checked` state directly, no JS state reflection
 * involved. Evaluated in the browser because Playwright's own selector
 * engine does not parse `:has()`.
 */
function isHostChecked(element: Locator): Promise<boolean> {
	return element.evaluate((el: Element) => el.matches(':has(input:checked)'))
}

test.describe('form-checkbox component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/form-checkbox')
		await page.waitForSelector('form-checkbox')
	})

	test('renders initial state correctly', async ({ page }) => {
		const checkboxComponent = page.locator('form-checkbox').first()
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')
		const label = checkboxComponent.locator('.label')

		// Should not be checked initially
		await expect(checkbox).not.toBeChecked()
		expect(await isHostChecked(checkboxComponent)).toBe(false)

		// Should display correct label text
		await expect(label).toHaveText('Checkbox')
	})

	test('toggles checked state when clicking checkbox', async ({ page }) => {
		const checkboxComponent = page.locator('form-checkbox').first()
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')

		// Initially unchecked
		await expect(checkbox).not.toBeChecked()
		expect(await isHostChecked(checkboxComponent)).toBe(false)

		// Click to check
		await checkbox.click()
		await expect(checkbox).toBeChecked()
		expect(await isHostChecked(checkboxComponent)).toBe(true)

		// Click to uncheck
		await checkbox.click()
		await expect(checkbox).not.toBeChecked()
		expect(await isHostChecked(checkboxComponent)).toBe(false)
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
		expect(await isHostChecked(checkboxComponent)).toBe(true)

		// Click checkbox to uncheck
		await checkbox.click()

		isChecked = await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			return element.checked
		})
		expect(isChecked).toBe(false)
		expect(await isHostChecked(checkboxComponent)).toBe(false)
	})

	test('updates label text when changed programmatically', async ({ page }) => {
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
		const label = todoCheckbox.locator('label')

		// Should display the label text from the DOM
		await expect(label).toHaveText('Task')
	})

	test('handles multiple checkboxes independently', async ({ page }) => {
		const firstCheckbox = page.locator('form-checkbox').first()
		const firstInput = firstCheckbox.locator('input[type="checkbox"]')
		const firstLabel = firstCheckbox.locator('label')

		const secondCheckbox = page.locator('form-checkbox.todo')
		const secondInput = secondCheckbox.locator('input[type="checkbox"]')
		const secondLabel = secondCheckbox.locator('label')

		// Verify different initial states
		await expect(firstLabel).toHaveText('Checkbox')
		await expect(secondLabel).toHaveText('Task')
		await expect(firstInput).not.toBeChecked()
		await expect(secondInput).not.toBeChecked()

		// Check first checkbox only
		await firstInput.click()
		await expect(firstInput).toBeChecked()
		expect(await isHostChecked(firstCheckbox)).toBe(true)
		await expect(secondInput).not.toBeChecked()
		expect(await isHostChecked(secondCheckbox)).toBe(false)

		// Check second checkbox using label click (for the visually hidden checkbox)
		await secondCheckbox.locator('label').click()
		await expect(firstInput).toBeChecked()
		expect(await isHostChecked(firstCheckbox)).toBe(true)
		await expect(secondInput).toBeChecked()
		expect(await isHostChecked(secondCheckbox)).toBe(true)

		// Uncheck first, keep second checked
		await firstInput.click()
		await expect(firstInput).not.toBeChecked()
		expect(await isHostChecked(firstCheckbox)).toBe(false)
		await expect(secondInput).toBeChecked()
		expect(await isHostChecked(secondCheckbox)).toBe(true)
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
		expect(await isHostChecked(checkboxComponent)).toBe(true)

		// Press space again to toggle back
		await checkbox.press('Space')
		await expect(checkbox).not.toBeChecked()
		expect(await isHostChecked(checkboxComponent)).toBe(false)
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
		expect(await isHostChecked(checkboxComponent)).toBe(true)

		// Click label again to uncheck
		await labelElement.click()
		await expect(checkbox).not.toBeChecked()
		expect(await isHostChecked(checkboxComponent)).toBe(false)
	})

	test('maintains state during label changes', async ({ page }) => {
		const checkboxComponent = page.locator('form-checkbox').first()
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')
		const label = checkboxComponent.locator('.label')

		// Check the checkbox
		await checkbox.click()
		await expect(checkbox).toBeChecked()
		expect(await isHostChecked(checkboxComponent)).toBe(true)

		// Modify label without affecting checked state
		await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			element.label = 'Modified Label'
		})

		// Checkbox should still be checked and label should be updated
		await expect(checkbox).toBeChecked()
		expect(await isHostChecked(checkboxComponent)).toBe(true)
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
		// Add a form wrapper. The host itself carries name="agree" (see
		// form-checkbox.html) and submits via ElementInternals
		// (formAssociatedCheckbox()) — the inner native checkbox is
		// presentational only, no name of its own.
		await page.evaluate(() => {
			const form = document.createElement('form')
			const checkbox = document.querySelector('form-checkbox')
			if (checkbox) {
				checkbox.parentNode?.insertBefore(form, checkbox)
				form.appendChild(checkbox)
			}
		})

		const checkbox = page
			.locator('form-checkbox input[type="checkbox"]')
			.first()

		// Unchecked submits nothing, matching native <input type="checkbox">
		let formData = await page.evaluate(() => {
			const form = document.querySelector('form')
			if (!form) return null
			return Object.fromEntries(new FormData(form).entries())
		})
		expect(formData).toEqual({})

		// Check the checkbox
		await checkbox.click()
		await expect(checkbox).toBeChecked()

		formData = await page.evaluate(() => {
			const form = document.querySelector('form')
			if (!form) return null
			return Object.fromEntries(new FormData(form).entries())
		})
		expect(formData).toEqual({ agree: 'on' })
	})

	test('submits the host value attribute instead of "on" when set', async ({
		page,
	}) => {
		// submitValue is read once at connect time, so the value attribute
		// must be present *before* the element connects — unlike the other
		// tests, this needs a fresh element rather than mutating the one
		// already on the page.
		await page.evaluate(() => {
			const form = document.createElement('form')
			const checkbox = document.createElement('form-checkbox') as any
			checkbox.setAttribute('value', 'yes-please')
			checkbox.setAttribute('name', 'test')
			checkbox.id = 'value-override-test'
			const input = document.createElement('input')
			input.type = 'checkbox'
			checkbox.append(input)
			form.append(checkbox)
			document.body.append(form)
		})

		await page.locator('#value-override-test input[type="checkbox"]').click()

		const formData = await page.evaluate(() => {
			const checkbox = document.getElementById('value-override-test')
			const form = checkbox?.closest('form')
			if (!form) return null
			return Object.fromEntries(new FormData(form).entries())
		})
		expect(formData).toEqual({ test: 'yes-please' })
	})

	test('restores the default checked state on form reset', async ({ page }) => {
		await page.evaluate(() => {
			const form = document.createElement('form')
			const checkbox = document.querySelector('form-checkbox')
			if (checkbox) {
				checkbox.parentNode?.insertBefore(form, checkbox)
				form.appendChild(checkbox)
			}
		})

		const checkboxComponent = page.locator('form-checkbox').first()
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')

		await checkbox.click()
		await expect(checkbox).toBeChecked()

		await page.evaluate(() => document.querySelector('form')?.reset())

		await expect(checkbox).not.toBeChecked()
		const checked = await checkboxComponent.evaluate(
			(node: any) => node.checked,
		)
		expect(checked).toBe(false)
	})

	test('a checked attribute on the host initialises checked to true', async ({
		page,
	}) => {
		// checked is read from <form-checkbox checked>, not the inner input.
		const checkboxComponent = page.locator('form-checkbox.toggle[checked]')
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')

		await expect(checkbox).toBeChecked()
		const checked = await checkboxComponent.evaluate(
			(node: any) => node.checked,
		)
		expect(checked).toBe(true)
	})

	test('restores a true default (host checked attribute) on form reset', async ({
		page,
	}) => {
		await page.evaluate(() => {
			const form = document.createElement('form')
			const checkbox = document.querySelector('form-checkbox.toggle[checked]')
			if (checkbox) {
				checkbox.parentNode?.insertBefore(form, checkbox)
				form.appendChild(checkbox)
			}
		})

		const checkboxComponent = page.locator('form-checkbox.toggle[checked]')
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')

		// The input is visually hidden — click the label, as other tests do.
		await checkboxComponent.locator('label').click()
		await expect(checkbox).not.toBeChecked()

		await page.evaluate(() => document.querySelector('form')?.reset())

		await expect(checkbox).toBeChecked()
		const checked = await checkboxComponent.evaluate(
			(node: any) => node.checked,
		)
		expect(checked).toBe(true)
	})

	test('disabling the host propagates to the native checkbox', async ({
		page,
	}) => {
		const checkboxComponent = page.locator('form-checkbox').first()
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')

		await checkboxComponent.evaluate((node: any) => {
			node.disabled = true
		})

		await expect(checkbox).toBeDisabled()
	})

	test('a disabled ancestor fieldset disables the native checkbox and syncs host.disabled', async ({
		page,
	}) => {
		const checkboxComponent = page.locator('form-checkbox').first()
		const checkbox = checkboxComponent.locator('input[type="checkbox"]')

		await page.evaluate(() => {
			const el = document.querySelector('form-checkbox')
			const fieldset = document.createElement('fieldset')
			fieldset.disabled = true
			el?.parentNode?.insertBefore(fieldset, el)
			fieldset.appendChild(el!)
		})

		const hostDisabled = await checkboxComponent.evaluate(
			(node: any) => node.disabled,
		)
		expect(hostDisabled).toBe(true)
		await expect(checkbox).toBeDisabled()
	})

	test('checked property is mutable (controlled + uncontrolled)', async ({
		page,
	}) => {
		const initialChecked = await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			return element.checked
		})
		expect(initialChecked).toBe(false)

		// Uncontrolled path: user interaction updates state
		const checkbox = page
			.locator('form-checkbox input[type="checkbox"]')
			.first()
		await checkbox.click()

		const checkedAfterClick = await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			return element.checked
		})
		expect(checkedAfterClick).toBe(true)

		// Controlled path: programmatic assignment drives the DOM
		await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			element.checked = false
		})

		await expect(checkbox).not.toBeChecked()

		const checkedAfterSet = await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			return element.checked
		})
		expect(checkedAfterSet).toBe(false)
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
		expect(await isHostChecked(checkboxComponent)).toBe(true)

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
		expect(await isHostChecked(checkboxComponent)).toBe(true)

		const finalCheckedState = await page.evaluate(() => {
			const element = document.querySelector('form-checkbox') as any
			return element.checked
		})
		expect(finalCheckedState).toBe(true)
	})
})
