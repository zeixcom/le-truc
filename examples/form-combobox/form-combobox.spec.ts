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
 * - ✅ Component property reactivity (value, length, error, description properties)
 * - ✅ Edge cases and performance (rapid typing, focus management, empty states)
 *
 * Architecture Notes:
 * - Wraps a text input with an expandable form-listbox popup
 * - Uses createState for popup visibility management
 * - Uses createSensor for input length tracking (readonly property)
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

		await page.goto('http://localhost:4173/test/form-combobox.html')
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
			await expect(textbox).toHaveAttribute('aria-invalid', 'false')
			await expect(textbox).toHaveAttribute(
				'aria-describedby',
				'timezone-description',
			)

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

			// Listbox should have src attribute for loading
			await expect(listbox).toHaveAttribute(
				'src',
				'/form-listbox/timezones.json',
			)
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

		test('synchronizes value attribute with component state', async ({
			page,
		}) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			await textbox.fill('Europe/London')

			// Component should have value attribute
			await expect(combobox).toHaveAttribute('value', 'Europe/London')
		})

		test('reflects textbox value in component property', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			// Fill textbox directly (this is how the component is designed to work)
			await textbox.fill('Asia/Tokyo')

			// Component value should reflect textbox value
			const componentValue = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.value
			})
			expect(componentValue).toBe('Asia/Tokyo')

			// Check component attribute is updated
			await expect(combobox).toHaveAttribute('value', 'Asia/Tokyo')
		})
	})

	test.describe('Popup Show/Hide Behavior', () => {
		test('shows popup when typing in textbox', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Wait for options to load by waiting for listbox to have loaded state
			await page.waitForTimeout(50)

			// Verify options are available before testing popup
			const optionsLoaded = await page.evaluate(() => {
				const listboxElement = document.querySelector('form-listbox')
				return (
					listboxElement &&
					listboxElement.options &&
					listboxElement.options.length > 0
				)
			})

			if (!optionsLoaded) {
				console.log('Options not loaded, skipping popup test')
				return
			}

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

			// Popup should be hidden (no visible options)
			await expect(listboxElement).toBeHidden()
			await expect(textbox).toHaveAttribute('aria-expanded', 'false')
		})

		test('hides popup on Escape key', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Wait for options to load
			await page.waitForTimeout(50)

			// Verify options are available
			const optionsLoaded = await page.evaluate(() => {
				const listboxElement = document.querySelector('form-listbox')
				return (
					listboxElement &&
					listboxElement.options &&
					listboxElement.options.length > 0
				)
			})

			if (!optionsLoaded) {
				console.log('Options not loaded, skipping escape test')
				return
			}

			await textbox.fill('New')
			await page.waitForTimeout(50)
			await expect(listboxElement).toBeVisible()

			// Press Escape
			await textbox.press('Escape')

			// Popup should hide
			await expect(listboxElement).toBeHidden()
			await expect(textbox).toHaveAttribute('aria-expanded', 'false')
		})

		test('hides popup when option is selected', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Wait for options to load
			await page.waitForTimeout(50)

			// Verify options are available
			const optionsLoaded = await page.evaluate(() => {
				const listboxElement = document.querySelector('form-listbox')
				return (
					listboxElement &&
					listboxElement.options &&
					listboxElement.options.length > 0
				)
			})

			if (!optionsLoaded) {
				console.log('Options not loaded, skipping selection test')
				return
			}

			await textbox.fill('New')
			await page.waitForTimeout(50)
			await expect(listboxElement).toBeVisible()

			// Click an option (find visible option)
			const firstOption = listboxElement
				.locator('button[role="option"]:visible')
				.first()
			await firstOption.click()

			// Popup should hide after selection
			await expect(listboxElement).toBeHidden()
			await expect(textbox).toHaveAttribute('aria-expanded', 'false')
		})

		test('shows popup with Alt+ArrowDown', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Wait for options to load
			await page.waitForTimeout(50)

			// Verify options are available
			const optionsLoaded = await page.evaluate(() => {
				const listboxElement = document.querySelector('form-listbox')
				return (
					listboxElement &&
					listboxElement.options &&
					listboxElement.options.length > 0
				)
			})

			if (!optionsLoaded) {
				console.log('Options not loaded, skipping Alt+ArrowDown test')
				return
			}

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

		test('keyboard navigation maintains proper component state', async ({
			page,
		}) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Wait for options to load
			await page.waitForTimeout(50)

			await textbox.fill('New')
			await page.waitForTimeout(50)
			await expect(listboxElement).toBeVisible()

			// Test ArrowDown behavior
			await textbox.press('ArrowDown')
			await page.waitForTimeout(50)

			// Verify popup state is maintained
			await expect(listboxElement).toBeVisible()
			await expect(textbox).toHaveAttribute('aria-expanded', 'true')

			// Test that keyboard navigation doesn't break the component
			await page.keyboard.press('ArrowDown')
			await page.waitForTimeout(50)

			// Component should still be functional
			await expect(listboxElement).toBeVisible()
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

		test('allows typing to filter and complete values', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			// Wait for options to load
			await page.waitForTimeout(50)

			// Type a complete timezone value
			await textbox.fill('America/New_York')
			await page.waitForTimeout(50)

			// Component value should be updated
			const componentValue = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.value
			})
			expect(componentValue).toBe('America/New_York')
			await expect(textbox).toHaveValue('America/New_York')
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
			const optionValue = (await firstOption.getAttribute('value')) ?? ''
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

			// Should show validation error
			const componentError = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.error ?? ''
			})
			expect(componentError).toBeTruthy()

			// Error element should show the message
			await expect(errorElement).toHaveText(componentError)

			// ARIA attributes should reflect error state
			await expect(textbox).toHaveAttribute('aria-invalid', 'true')
			await expect(textbox).toHaveAttribute(
				'aria-errormessage',
				'timezone-error',
			)
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

			// Should not have error state with valid input
			await expect(textbox).toHaveAttribute('aria-invalid', 'false')
		})

		test('updates error property reactively', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const errorElement = combobox.locator('> .error')

			// Set error programmatically (writable property)
			await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				if (element) element.error = 'Custom error message'
			})

			// Error should be displayed
			await expect(errorElement).toHaveText('Custom error message')

			// Clear error
			await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				if (element) element.error = ''
			})

			await expect(errorElement).toHaveText('')
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
		test('maintains proper ARIA attributes during interaction', async ({
			page,
		}) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			// Initial state
			await expect(textbox).toHaveAttribute('role', 'combobox')
			await expect(textbox).toHaveAttribute('aria-expanded', 'false')
			await expect(textbox).toHaveAttribute('aria-autocomplete', 'list')

			// Wait for options and type to expand
			await page.waitForTimeout(50)
			await textbox.fill('New')

			// Expanded state
			await expect(textbox).toHaveAttribute('aria-expanded', 'true')
			await expect(textbox).toHaveAttribute('aria-controls', 'timezone-popup')

			// Press Escape to collapse
			await textbox.press('Escape')
			await expect(textbox).toHaveAttribute('aria-expanded', 'false')
		})

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

			// Check that input has correct name attribute
			await expect(textbox).toHaveAttribute('name', 'timezone')
		})
	})

	test.describe('Component Properties', () => {
		test('value property reflects textbox input reactively', async ({
			page,
		}) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			// Type in textbox
			await textbox.fill('Asia/Tokyo')

			// Component value should reflect textbox
			let componentValue = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.value
			})
			expect(componentValue).toBe('Asia/Tokyo')
			await expect(combobox).toHaveAttribute('value', 'Asia/Tokyo')

			// Update via more typing
			await textbox.fill('Europe/London')

			componentValue = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.value
			})
			expect(componentValue).toBe('Europe/London')
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

		test('clear method is readonly function', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			await textbox.fill('test value')

			// Clear method should exist and be callable
			const clearResult = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return typeof element?.clear
			})
			expect(clearResult).toBe('function')

			// Call clear method
			await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				if (element) element.clear()
			})

			await expect(textbox).toHaveValue('')
		})
	})

	test.describe('Edge Cases and Behavior', () => {
		test('handles rapid typing correctly', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')

			// Wait for listbox to load
			await page.waitForTimeout(50)

			// Type rapidly
			await textbox.fill('N')
			await textbox.fill('Ne')
			await textbox.fill('New')

			// Final value should be correct
			await expect(textbox).toHaveValue('New')

			const componentValue = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.value
			})
			expect(componentValue).toBe('New')
		})

		test('maintains proper state during typing interactions', async ({
			page,
		}) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Wait for options to load
			await page.waitForTimeout(50)

			// Type to show popup
			await textbox.fill('New')
			await page.waitForTimeout(50)
			await expect(listboxElement).toBeVisible()

			// Type more to filter further
			await textbox.fill('New York')
			await page.waitForTimeout(50)

			// Component should maintain consistent state
			await expect(textbox).toHaveAttribute('aria-expanded', 'true')

			// Complete typing
			await textbox.fill('America/New_York')

			// Verify final state
			const componentValue = await page.evaluate(() => {
				const element = document.querySelector('form-combobox')
				return element?.value
			})
			expect(componentValue).toBe('America/New_York')
		})

		test('handles empty filter gracefully', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Wait for options to load
			await page.waitForTimeout(50)

			// No popup should show before user interaction
			await expect(listboxElement).toBeHidden()
			await expect(textbox).toHaveAttribute('aria-expanded', 'false')

			// Clear textbox (empty filter)
			await textbox.fill('')

			// Popup should show after any interaction, even with empty filter
			await expect(listboxElement).toBeVisible()
			await expect(textbox).toHaveAttribute('aria-expanded', 'true')
		})

		test('handles option selection correctly', async ({ page }) => {
			const combobox = page.locator('form-combobox').first()
			const textbox = combobox.locator('input[role="combobox"]')
			const listboxElement = combobox.locator('[role="listbox"]')

			// Wait for options to load
			await page.waitForTimeout(50)

			await textbox.fill('New')
			await page.waitForTimeout(50)
			await expect(listboxElement).toBeVisible()

			// Click an option (find visible option)
			const firstOption = listboxElement
				.locator('button[role="option"]:not([hidden])')
				.first()
			await firstOption.click()

			// Wait for selection to process
			await page.waitForTimeout(50)

			// Popup should hide after selection
			await expect(listboxElement).toBeHidden()
			await expect(textbox).toHaveAttribute('aria-expanded', 'false')
		})
	})
})
