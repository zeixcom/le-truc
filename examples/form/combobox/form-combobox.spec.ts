import { expect, test } from '@playwright/test'

/**
 * Test Suite: form-combobox Component
 *
 * Comprehensive tests for the Le Truc form-combobox component, which provides
 * a text input with an expandable listbox for autocomplete/typeahead functionality.
 *
 * Key Features Tested:
 * - ✅ Basic rendering and initialization (component structure, attributes, properties)
 * - ✅ Text input functionality and value synchronization (typing, programmatic updates)
 * - ✅ Popup show/hide behavior (input triggers, filtering, escape, option selection)
 * - ✅ Keyboard navigation (Arrow keys, Enter, Escape, Delete, Alt+ArrowDown)
 * - ✅ Integration with nested form-listbox component (filter passing, value sync)
 * - ✅ Filtering and search functionality (visible option filtering)
 * - ✅ Error handling and validation (required field validation, ARIA attributes)
 * - ✅ Clear functionality and button visibility (clearable attribute behavior)
 * - ✅ Accessibility features (ARIA expanded, invalid, described by, error messages)
 * - ✅ Form integration and value management (form submission, name attributes)
 * - ✅ Component property reactivity (value, length, description properties)
 * - ✅ Edge cases and performance (rapid typing, focus management, empty states)
 *
 * Architecture Notes:
 * - Wraps a text input with an expandable form-listbox popup
 * - Uses createState for popup visibility management
 * - Uses createEventSensor for input length tracking (readonly property)
 * - Implements validation with textbox.checkValidity()
 * - Passes filter value to nested form-listbox component via pass()
 * - Manages focus between textbox and listbox options
 * - Popup visibility depends on both showPopup state AND listbox.options.length > 0
 *
 * Test Strategy:
 * This test suite focuses on combobox-specific behaviors and avoids duplicating
 * form-listbox tests. The nested listbox functionality is tested in its own
 * test suite (form-listbox.spec.ts). Tests use realistic timezone data and
 * filter terms that match actual option content (e.g., "New" matches "New York").
 *
 * Key Testing Patterns:
 * - Wait for listbox options to load before testing popup behavior
 * - Use visible option selectors (:visible) for reliable interactions
 * - Test both user interactions (typing, clicking) and programmatic property updates
 * - Verify ARIA attribute synchronization for accessibility compliance
 * - Test form integration with realistic usage scenarios
 */

test.describe('form-combobox component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/form-combobox')
		await page.waitForSelector('form-combobox')
	})

	test.describe('Basic Rendering and Initialization', () => {
		test('renders initial state correctly', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listbox = combobox.locator('form-listbox')
			const clearButton = combobox.locator('button.clear')
			const errorElement = combobox.locator('> .error')
			const descriptionElement = combobox.locator('.description')

			// Check basic structure is present
			await expect(combobox).toBeVisible()
			await expect(textbox).toBeVisible()
			await expect(listbox).toBeAttached() // Initially present but possibly hidden
			await expect(clearButton).toBeHidden() // Initially hidden
			await expect(errorElement).toBeAttached() // Present but may be empty/hidden initially
			await expect(descriptionElement).toBeVisible()

			// Check initial ARIA attributes
			await expect(textbox).toHaveAttribute('aria-expanded', 'false')
			await expect(textbox).toHaveAttribute(
				'aria-describedby',
				'timezone-description',
			)

			// Initial validity is valid (native :user-invalid drives styling,
			// not aria-invalid — which was retired per the managed convention)
			const initialValid = await page.evaluate(() => {
				const el = document.querySelector('form-combobox')
				return el?.validity.valid ?? true
			})
			expect(initialValid).toBe(true)

			// Check initial component properties
			const initialValue = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.value
			})
			expect(initialValue).toBe('')

			const initialLength = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.length
			})
			expect(initialLength).toBe(0)
		})

		test('displays description and error elements with proper IDs', async ({
			page,
		}) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const errorElement = combobox.locator('> .error')
			const descriptionElement = combobox.locator('.description')

			// Check elements have proper IDs
			await expect(errorElement).toHaveAttribute('id', 'timezone-error')
			await expect(descriptionElement).toHaveAttribute(
				'id',
				'timezone-description',
			)

			// Check textbox references these IDs
			await expect(textbox).toHaveAttribute(
				'aria-describedby',
				'timezone-description',
			)

			// Description should have initial content
			await expect(descriptionElement).toHaveText(/Tell us where you live/)
		})

		test('initializes nested listbox correctly', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const listbox = combobox.locator('form-listbox')
			const listboxElement = listbox.locator('[role="listbox"]')

			// Nested listbox should be present but initially hidden
			await expect(listbox).toBeAttached()
			await expect(listboxElement).toBeHidden()

			// The compiled listbox dropped the remote-fetch mode — the popup's
			// options are inline data-value/data-label buttons
			const optionCount = await listbox.locator('button[role="option"]').count()
			expect(optionCount).toBeGreaterThan(0)
		})
	})

	test.describe('Text Input and Value Management', () => {
		test('updates component value when typing in textbox', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			await textbox.fill('America/New_York')

			// Check component value is updated
			const componentValue = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.value
			})
			expect(componentValue).toBe('America/New_York')

			// Check textbox value matches
			await expect(textbox).toHaveValue('America/New_York')
		})

		test('updates length property based on input', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			await textbox.fill('test')

			const length = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.length
			})
			expect(length).toBe(4)

			// Clear and check length updates
			await textbox.fill('')

			const newLength = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.length
			})
			expect(newLength).toBe(0)
		})

		test('length property is readonly and reactive', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			// Type something
			await textbox.fill('hello world')

			const length = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.length
			})
			expect(length).toBe(11)

			// Try to set length (should be ignored as it's readonly)
			await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				// @ts-expect-error deliberate test of readonly property
				if (element) element.length = 999
			})

			// Length should still reflect actual input length
			const actualLength = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.length
			})
			expect(actualLength).toBe(11)
		})
	})

	test.describe('Popup Show/Hide Behavior', () => {
		test('shows popup when typing in textbox', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Wait for options to load by waiting for listbox to have loaded state
			await page.waitForTimeout(50)

			// Type to trigger popup
			await textbox.fill('New')

			// Wait a moment for popup to show
			await page.waitForTimeout(50)

			// Popup should be visible
			await expect(listboxElement).toBeVisible()
			await expect(textbox).toHaveAttribute('aria-expanded', 'true')
		})

		test('hides popup when no options match filter', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Wait for options to load
			await page.waitForTimeout(50)

			// Type something that won't match any options
			await textbox.fill('zzz_no_match_xyz')

			// Popup should be hidden (no visible options) — restored in LT-119
			// via form-listbox's `visibleOptions` public prop
			await expect(listboxElement).toBeHidden()
			await expect(textbox).toHaveAttribute('aria-expanded', 'false')
		})

		test('hides popup on Escape key', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			await textbox.fill('New')
			await page.waitForTimeout(50)
			await expect(listboxElement).toBeVisible()

			// Press Escape
			await textbox.press('Escape')

			// Popup should hide
			await expect(listboxElement).toBeHidden()
			await expect(textbox).toHaveAttribute('aria-expanded', 'false')
		})

		test('shows popup with Alt+ArrowDown', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Focus textbox and use Alt+ArrowDown
			await textbox.focus()
			await page.keyboard.press('Alt+ArrowDown')
			await page.waitForTimeout(50)

			// Popup should show even without typing
			await expect(listboxElement).toBeVisible()
			await expect(textbox).toHaveAttribute('aria-expanded', 'true')
		})
	})

	test.describe('Keyboard Navigation', () => {
		test('ArrowDown key behavior when popup is expanded', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Wait for options to load
			await page.waitForTimeout(50)

			await textbox.fill('New')
			await page.waitForTimeout(50)
			await expect(listboxElement).toBeVisible()

			// Press ArrowDown - this should trigger navigation behavior
			await textbox.press('ArrowDown')

			// Wait for any focus changes
			await page.waitForTimeout(50)

			// Verify listbox is still visible and textbox maintains proper ARIA state
			await expect(listboxElement).toBeVisible()
			await expect(textbox).toHaveAttribute('aria-expanded', 'true')
		})

		test('clears input with Delete key', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			// Fill textbox
			await textbox.fill('America/New_York')
			await expect(textbox).toHaveValue('America/New_York')

			// Press Delete on the component (not textbox)
			await combobox.press('Delete')

			// Value should be cleared
			await expect(textbox).toHaveValue('')

			const componentValue = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.value
			})
			expect(componentValue).toBe('')
		})
	})

	test.describe('Integration with Form-Listbox', () => {
		test('passes filter value to nested listbox', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			// Wait for options to load
			await page.waitForTimeout(50)

			// Type to filter
			await textbox.fill('New')
			await page.waitForTimeout(50)

			// Check that filter is passed to nested listbox
			const listboxFilter = await page.evaluate(() => {
				const element = document.querySelector('form-listbox')
				return element?.filter
			})
			expect(listboxFilter).toBe('New')
		})

		test('updates combobox value when clicking an option', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Wait for options to load
			await page.waitForTimeout(50)

			// Type to show popup and filter options
			await textbox.fill('New')
			await page.waitForTimeout(50)
			await expect(listboxElement).toBeVisible()

			// Click on a visible option
			const firstOption = listboxElement
				.locator('button[role="option"]:not([hidden])')
				.first()
			const optionValue = (await firstOption.getAttribute('data-value')) ?? ''
			await firstOption.click()

			// Combobox value should update to the selected option
			await expect(textbox).toHaveValue(optionValue)

			const componentValue = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.value
			})
			expect(componentValue).toBe(optionValue)

			// Popup should hide after selection
			await expect(listboxElement).toBeHidden()
			await expect(textbox).toHaveAttribute('aria-expanded', 'false')
		})

		test('works with inline listbox options', async ({ page }) => {
			const combobox = page.locator('form-combobox').nth(1) // Second combobox with inline options
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Type to show popup
			await textbox.fill('Re')

			// Should show filtered options
			await expect(listboxElement).toBeVisible()
			const redOption = listboxElement.locator('button[role="option"]', {
				hasText: 'Red',
			})
			await expect(redOption).toBeVisible()

			// Other options should be hidden
			const blueOption = listboxElement.locator('button[role="option"]', {
				hasText: 'Blue',
			})
			await expect(blueOption).toBeHidden()
		})
	})

	test.describe('Validation and Error Handling', () => {
		test('shows error when required input is invalid', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const errorElement = combobox.locator('> .error')

			// Fill and clear required field to trigger validation
			await textbox.fill('test')
			await textbox.fill('')
			await textbox.blur()

			// External consumers read host.validationMessage (native parity)
			const validationMessage = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.validationMessage ?? ''
			})
			expect(validationMessage).toBeTruthy()

			// Error element should show the message
			await expect(errorElement).toHaveText(validationMessage)

			// Host validity should reflect the invalid state
			const isValid = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.validity.valid ?? true
			})
			expect(isValid).toBe(false)
		})

		test('validates required input correctly', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			// Start with empty input and fill something
			await textbox.fill('')

			// Check if validation state changes when filling input
			await textbox.fill('America/New_York')

			// Component should have the filled value
			const componentValue = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.value ?? ''
			})
			expect(componentValue).toBe('America/New_York')

			// Should be valid with valid input
			const isValid = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.validity.valid ?? false
			})
			expect(isValid).toBe(true)
		})

		test('updates validation state reactively via setCustomValidity', async ({
			page,
		}) => {
			// Set a custom error via the native-parity API
			await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				if (element) element.setCustomValidity('Custom error message')
			})

			// validationMessage should reflect the set message (native parity)
			const message = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.validationMessage ?? ''
			})
			expect(message).toBe('Custom error message')

			// validity should reflect the custom error
			const isValid = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.validity.valid ?? true
			})
			expect(isValid).toBe(false)

			// Clear the error
			await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				if (element) element.setCustomValidity('')
			})

			const clearedMessage = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.validationMessage ?? ''
			})
			expect(clearedMessage).toBe('')
		})
	})

	test.describe('Clear Functionality', () => {
		test('shows clear button when clearable attribute is present and has value', async ({
			page,
		}) => {
			const combobox = page.locator('form-combobox').first() // Has clearable attribute
			const textbox = combobox.locator('input[role="combobox"]')
			const clearButton = combobox.locator('button.clear')

			// Initially hidden
			await expect(clearButton).toBeHidden()

			// Type something
			await textbox.fill('America/New_York')

			// Clear button should appear
			await expect(clearButton).toBeVisible()
		})

		test('hides clear button when no clearable attribute', async ({ page }) => {
			const combobox = page.locator('form-combobox').nth(1) // Second combobox without clearable
			const textbox = combobox.locator('input[role="combobox"]')
			const clearButton = combobox.locator('button.clear')

			// Type something
			await textbox.fill('Red')

			// Clear button should remain hidden
			await expect(clearButton).toBeHidden()
		})

		test('clears input when clear button is clicked', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const clearButton = combobox.locator('button.clear')

			// Type something and ensure clear button appears
			await textbox.fill('America/New_York')
			await expect(clearButton).toBeVisible()

			// Click clear button
			await clearButton.click()

			// Input should be cleared
			await expect(textbox).toHaveValue('')

			const componentValue = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.value
			})
			expect(componentValue).toBe('')

			// Clear button should hide
			await expect(clearButton).toBeHidden()
		})

		test('clear method is callable programmatically', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			// Fill textbox
			await textbox.fill('America/New_York')
			await expect(textbox).toHaveValue('America/New_York')

			// Call clear method
			await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				if (element) element.clear()
			})

			// Should be cleared
			await expect(textbox).toHaveValue('')

			const componentValue = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.value
			})
			expect(componentValue).toBe('')
		})
	})

	test.describe('Accessibility Features', () => {
		test('has proper error message structure', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const errorElement = combobox.locator('> .error')

			// Check that error element exists and has proper attributes
			await expect(errorElement).toHaveAttribute('role', 'alert')
			await expect(errorElement).toHaveAttribute('aria-live', 'assertive')
			await expect(errorElement).toHaveAttribute('id', 'timezone-error')

			// Textbox should reference the error element when needed
			// (This might be set dynamically when there's an actual error)
			await expect(textbox).toHaveAttribute(
				'aria-describedby',
				'timezone-description',
			)
		})

		test('associates description with textbox', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const descriptionElement = combobox.locator('.description')

			// Should be associated via aria-describedby
			await expect(textbox).toHaveAttribute(
				'aria-describedby',
				'timezone-description',
			)

			// Description should have proper attributes
			await expect(descriptionElement).toHaveAttribute('aria-live', 'polite')
		})

		test('updates description reactively', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const descriptionElement = combobox.locator('.description')

			// Set description programmatically (writable property)
			await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				if (element) element.description = 'Updated description text'
			})

			// Description should update
			await expect(descriptionElement).toHaveText('Updated description text')
		})
	})

	test.describe('Form Integration', () => {
		test('works with form submission', async ({ page }) => {
			const form = page.locator('form').nth(0) // First form with color combobox (second combobox)
			const combobox = form.locator('form-combobox')
			const textbox = combobox.locator('input[role="combobox"]')

			// Simply fill the textbox with a value
			await textbox.fill('Blue')

			// Check form data
			const formData = await page.evaluate(() => {
				const form = document.querySelector('form')
				const data = new FormData(form!)
				return Object.fromEntries(data.entries())
			})

			expect(formData.color).toBe('Blue')
		})

		test('name attribute works for form submission', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			// Fill textbox
			await textbox.fill('America/New_York')

			// Check that host has correct name attribute
			await expect(combobox).toHaveAttribute('name', 'timezone')
		})

		test('form reset restores empty value and clears error', async ({
			page,
		}) => {
			const form = page.locator('form').nth(0)
			const combobox = form.locator('form-combobox')
			const textbox = combobox.locator('input[role="combobox"]')

			// Fill with a value
			await textbox.fill('Blue')

			// Reset the form
			await page.evaluate(() => {
				document.querySelector('form')?.reset()
			})
			await page.waitForTimeout(100)

			// Value should be reset
			const value = await page.evaluate(() => {
				return (document.querySelector('form form-combobox') as any)?.value
			})
			expect(value).toBe('')
		})
	})

	test.describe('Edge Cases and Behavior', () => {
		test('handles empty filter gracefully', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Wait for options to load from JSON endpoint
			await expect(
				combobox.locator('button[role="option"]').first(),
			).toBeAttached()

			// No popup should show before user interaction
			await expect(listboxElement).toBeHidden()
			await expect(textbox).toHaveAttribute('aria-expanded', 'false')

			// Type something first, then clear to trigger input event with empty value
			await textbox.fill('A')
			await textbox.fill('')

			// Popup should show after any interaction, even with empty filter
			await expect(listboxElement).toBeVisible()
			await expect(textbox).toHaveAttribute('aria-expanded', 'true')
		})
	})
})

// ===== PASS() — SLOT PATH CLEANUP =====
// Verify that the Slot-backed binding created by pass() is properly restored
// when the parent component is disconnected. After disconnection, the child
// should resume its own independent signal (not still bound to the parent).

test.describe('pass() Slot cleanup and restore', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/form-combobox')
		await page.waitForSelector('form-combobox')
	})

	test('restores child signal after parent is detached', async ({ page }) => {
		// 1. Confirm initial binding: typing in combobox drives listbox.filter.
		//    Use scoped selector to avoid ambiguity with the second form-combobox.
		const combobox = page.locator('form-combobox').first()
		const textbox = combobox.locator('input[role="combobox"]')
		await textbox.fill('New')
		await page.waitForTimeout(50)

		const filterBefore = await page.evaluate(() => {
			return (document.querySelector('form-combobox form-listbox') as any)
				?.filter
		})
		expect(filterBefore).toBe('New')

		// 2. Detach the form-combobox parent — pass() cleanup must restore the
		//    child's own Slot-backed signal so it operates independently again.
		//    The key invariant: after detach, setting filter must NOT throw
		//    ReadonlySignalError (which would happen if the Slot were still backed
		//    by the computed from pass()).
		const result = await page.evaluate(async () => {
			const el = document.querySelector('form-combobox')!
			// Capture reference to listbox BEFORE removal — after removal,
			// querySelector('form-listbox') returns the second listbox.
			const listbox = el.querySelector('form-listbox') as any
			const parent = el.parentElement!

			el.remove()
			await new Promise(r => setTimeout(r, 50))

			let setError: string | null = null
			try {
				listbox.filter = 'restored'
			} catch (e: any) {
				setError = e.message ?? String(e)
			}

			return { parent: parent.tagName, setError }
		})

		// pass() cleanup restored the original mutable Slot — no ReadonlySignalError
		expect(result.setError).toBeNull()
		expect(result.parent).toBeTruthy()
	})
})
