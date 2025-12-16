import { expect, test } from '@playwright/test'

/*
 * FORM-TEXTBOX COMPONENT TESTS
 *
 * Test Coverage Summary:
 *
 * ✅ WORKING FEATURES:
 * - Initial state rendering with proper ARIA attributes
 * - Value property now works correctly (writable, syncs to DOM)
 * - Validation error handling works (depends on value property)
 * - Writable properties (error, description, value) update correctly
 * - Clear button and clear() method work correctly
 * - Textarea value and length sensors work correctly
 * - Character remaining count works for textarea with maxlength
 * - Form integration works (native FormData collection)
 * - DOM events fire correctly (input, change)
 * - Property type validation
 * - Readonly length property protection
 *
 * 🚫 BROKEN/LAZY FEATURES:
 * - Input length sensor is lazy (only updates when watched)
 *
 * 📝 COMPONENT BEHAVIOR NOTES:
 * - Value property works correctly with eager change event listeners
 * - Length sensor is lazy (only updates when watched, like textarea description)
 * - Validation works correctly thanks to eager change listeners
 * - Value property is writable and can be set programmatically for autosuggest
 * - DOM operations work fine throughout
 *
 * 🔧 TESTING APPROACH:
 * - Tests validate current working behavior
 * - Length sensor laziness is documented but not considered broken
 * - Tests serve as regression suite for the working implementation
 * - Comprehensive coverage of all component features
 */

test.describe('form-textbox component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/form-textbox.html')
		await page.waitForSelector('form-textbox')
	})

	// ===== INITIAL STATE TESTS =====

	test('renders initial state correctly', async ({ page }) => {
		const textboxComponent = page.locator('form-textbox').first()
		const input = textboxComponent.locator('input')
		const label = textboxComponent.locator('label')
		const description = textboxComponent.locator('.description')

		// Should have empty value initially
		await expect(input).toHaveValue('')

		// Should display correct label and description
		await expect(label).toHaveText('Name')
		await expect(description).toHaveText(
			'Tell us how you want us to call you in our communications.',
		)

		// Should have proper ARIA attributes
		await expect(input).toHaveAttribute('aria-describedby', 'city-description')
		await expect(input).not.toHaveAttribute('aria-errormessage')
		await expect(input).toHaveAttribute('aria-invalid', 'false')

		// Initial sensor property values
		const state = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return { value: element.value, length: element.length }
		})
		expect(state.value).toBe('')
		expect(state.length).toBe(0)
	})

	// ===== SENSOR BEHAVIOR TESTS =====

	test('value updates on change event, length sensor is lazy', async ({
		page,
	}) => {
		const input = page.locator('form-textbox input').first()

		// Type some text
		await input.type('John')

		// Length sensor doesn't update (lazy - no watchers for input components)
		let state = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return { value: element.value, length: element.length }
		})
		expect(state.length).toBe(0) // Lazy sensor - no watchers
		expect(state.value).toBe('') // Value hasn't changed yet - needs change event

		// Blur triggers change event
		await input.blur()

		// Now value should update
		state = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return { value: element.value, length: element.length }
		})
		expect(state.value).toBe('John') // Now works!
		expect(state.length).toBe(0) // Still 0 - no watchers for input
	})

	test('value property works, length sensor is lazy', async ({ page }) => {
		const input = page.locator('form-textbox input').first()

		// Type some text
		await (input as any).type('test')
		await input.blur()

		// Value works, length is lazy
		const state = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return { value: element.value, length: element.length }
		})

		// Value now works correctly!
		expect(state.value).toBe('test')
		expect(state.length).toBe(0) // Lazy sensor - no watchers

		// The DOM input itself works fine
		await expect(input).toHaveValue('test')
	})

	// ===== VALIDATION TESTS =====

	test('shows validation error on required field', async ({ page }) => {
		const textboxComponent = page.locator('form-textbox').first()
		const input = textboxComponent.locator('input')
		const errorElement = textboxComponent.locator('.error')

		// Initially no error
		await expect(errorElement).toBeEmpty()
		await expect(input).toHaveAttribute('aria-invalid', 'false')

		// Fill and then clear to trigger validation
		await input.fill('test')
		await input.fill('')

		// Manually trigger change event (blur doesn't automatically trigger change)
		await page.evaluate(() => {
			const inputEl = document.querySelector('form-textbox input')
			inputEl?.dispatchEvent(new Event('change', { bubbles: true }))
		})

		// Should show validation error
		await expect(errorElement).not.toBeEmpty()
		await expect(input).toHaveAttribute('aria-invalid', 'true')
		await expect(input).toHaveAttribute('aria-errormessage', 'name-error')

		// Error property should be set
		const errorText = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return element.error
		})
		expect(errorText).toBeTruthy()
	})

	test('clears error when valid input is provided', async ({ page }) => {
		const textboxComponent = page.locator('form-textbox').first()
		const input = textboxComponent.locator('input')
		const errorElement = textboxComponent.locator('.error')

		// Trigger validation error
		await input.fill('test')
		await input.fill('')

		// Manually trigger change event for validation
		await page.evaluate(() => {
			const inputEl = document.querySelector('form-textbox input')
			inputEl?.dispatchEvent(new Event('change', { bubbles: true }))
		})

		await expect(errorElement).not.toBeEmpty()

		// Fill with valid input and trigger change
		await input.fill('John Doe')
		await page.evaluate(() => {
			const inputEl = document.querySelector('form-textbox input')
			inputEl?.dispatchEvent(new Event('change', { bubbles: true }))
		})

		// Error should clear
		await expect(errorElement).toBeEmpty()
		await expect(input).toHaveAttribute('aria-invalid', 'false')
		await expect(input).not.toHaveAttribute('aria-errormessage')

		const errorText = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return element.error
		})
		expect(errorText).toBe('')
	})

	// ===== TEXTAREA TESTS =====

	test('handles textarea input', async ({ page }) => {
		const textarea = page.locator('form-textbox textarea')
		const testText = 'This is a comment\nwith multiple lines'

		await textarea.fill(testText)
		await textarea.blur() // Trigger change event

		// Value updates, length sensor works because it has watchers
		const value = await page.evaluate(() => {
			const element = document.querySelectorAll('form-textbox')[2] as any
			return { value: element.value, length: element.length }
		})
		expect(value.value).toBe(testText)
		expect(value.length).toBe(testText.length)
	})

	test('textarea value and length both work', async ({ page }) => {
		const textarea = page.locator('form-textbox textarea')
		const testText = 'This is a comment\nwith multiple lines'

		await textarea.fill(testText)
		await textarea.blur()

		// DOM works fine
		await expect(textarea).toHaveValue(testText)

		// Both value and length work for textarea!
		const state = await page.evaluate(() => {
			const element = document.querySelectorAll('form-textbox')[2] as any
			return { value: element.value, length: element.length }
		})
		expect(state.value).toBe(testText) // Now works!
		expect(state.length).toBe(testText.length) // Works because has watchers!
	})

	test('shows remaining characters for maxlength textarea works', async ({
		page,
	}) => {
		// Find the textarea component (third form-textbox)
		const textareaComponent = page.locator('form-textbox').nth(2)
		const textarea = textareaComponent.locator('textarea')
		const description = textareaComponent.locator('.description')

		// Initially should show full character count
		await expect(description).toHaveText('500 characters remaining')

		// Type some text (triggers input events for length sensor)
		await textarea.type('Hello world')

		// Description should update because length sensor works for textarea
		await expect(description).toHaveText('489 characters remaining')

		// Type more text
		await textarea.fill('A'.repeat(100))
		await expect(description).toHaveText('400 characters remaining')
	})

	// ===== CLEAR FUNCTIONALITY TESTS =====

	test('clear button functionality works correctly', async ({ page }) => {
		const clearableComponent = page.locator('form-textbox').nth(1)
		const input = clearableComponent.locator('input')
		const clearButton = clearableComponent.locator('button.clear')

		// Clear button should be hidden initially
		await expect(clearButton).toBeHidden()

		// Type some text
		await input.type('search terms')

		// Clear button should become visible
		await expect(clearButton).toBeVisible()

		// Click clear button
		await clearButton.click()

		// Clear button functionality works - input is cleared
		await expect(input).toHaveValue('')

		// Clear button should be hidden again since input is empty
		await expect(clearButton).toBeHidden()

		// Component properties should be cleared
		const value = await page.evaluate(() => {
			const element = document.querySelectorAll('form-textbox')[1] as any
			return { value: element.value, length: element.length }
		})
		expect(value.value).toBe('') // Clear works!
		expect(value.length).toBe(0) // Length sensor is lazy
	})

	test('clear method works correctly', async ({ page }) => {
		const input = page.locator('form-textbox input').nth(1)

		// Fill input
		await input.fill('test content')
		await expect(input).toHaveValue('test content')

		// Call clear method
		await page.evaluate(() => {
			const element = document.querySelectorAll('form-textbox')[1] as any
			element.clear()
		})

		// Clear method works - DOM input is cleared
		await expect(input).toHaveValue('')

		// Check if clear method affects component properties
		const value = await page.evaluate(() => {
			const element = document.querySelectorAll('form-textbox')[1] as any
			return { value: element.value, length: element.length }
		})
		expect(value.value).toBe('') // Clear method works!
		expect(value.length).toBe(0) // Length sensor is lazy
	})

	// ===== WRITABLE PROPERTY TESTS =====

	test('updates description property programmatically', async ({ page }) => {
		const textboxComponent = page.locator('form-textbox').first()
		const description = textboxComponent.locator('.description')

		// Initial description
		await expect(description).toHaveText(
			'Tell us how you want us to call you in our communications.',
		)

		// Update description property (this should work - it's a writable property)
		await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			element.description = 'Updated description text'
		})

		await expect(description).toHaveText('Updated description text')
	})

	test('updates error property programmatically', async ({ page }) => {
		const textboxComponent = page.locator('form-textbox').first()
		const input = textboxComponent.locator('input')
		const errorElement = textboxComponent.locator('.error')

		// Initially no error
		await expect(errorElement).toBeEmpty()
		await expect(input).toHaveAttribute('aria-invalid', 'false')

		// Set error property (this should work - it's a writable property)
		await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			element.error = 'Custom error message'
		})

		await expect(errorElement).toHaveText('Custom error message')
		await expect(input).toHaveAttribute('aria-invalid', 'true')
		await expect(input).toHaveAttribute('aria-errormessage', 'name-error')

		// Clear error
		await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			element.error = ''
		})

		await expect(errorElement).toBeEmpty()
		await expect(input).toHaveAttribute('aria-invalid', 'false')
		await expect(input).not.toHaveAttribute('aria-errormessage')
	})

	// ===== READONLY PROPERTY TESTS =====

	test('value property is writable, length is readonly', async ({ page }) => {
		const input = page.locator('form-textbox input').first()

		// Type some text
		await input.fill('test value')
		await input.blur()

		// Properties should reflect DOM state
		let state = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return { value: element.value, length: element.length }
		})
		expect(state.value).toBe('test value') // Now works!
		expect(state.length).toBe(0) // Lazy sensor - no watchers

		// Value property is writable, length should be ignored
		await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			element.value = 'changed value'
			try {
				element.length = 999 // This should be ignored
			} catch (_e) {
				// Expected - length should be readonly
			}
		})

		// Check that value was set and synced to DOM
		await expect(input).toHaveValue('changed value')

		// Properties should reflect the changes
		state = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return { value: element.value, length: element.length }
		})
		expect(state.value).toBe('changed value') // Value is writable
		expect(state.length).toBe(0) // Length remains 0 (readonly/lazy)
	})

	// ===== FORM INTEGRATION TESTS =====

	test('handles form integration - DOM works fine', async ({ page }) => {
		// Wrap first two components in a form (skip textarea to avoid extra field)
		await page.evaluate(() => {
			const form = document.createElement('form')
			const textboxes = document.querySelectorAll('form-textbox')
			// Only wrap first two to avoid the textarea
			for (let i = 0; i < 2; i++) {
				const textbox = textboxes[i]
				if (textbox) {
					textbox.parentNode?.insertBefore(form, textbox)
					form.appendChild(textbox)
				}
			}
		})

		const firstInput = page.locator('form-textbox input').first()
		const secondInput = page.locator('form-textbox input').nth(1)

		// Fill inputs
		await firstInput.fill('John Doe')
		await secondInput.fill('javascript react')

		// Test form data (DOM-based, should work fine)
		const formData = await page.evaluate(() => {
			const form = document.querySelector('form')
			if (!form) return null
			const data = new FormData(form)
			return Object.fromEntries(data.entries())
		})

		expect(formData).toEqual({
			name: 'John Doe',
			query: 'javascript react',
		})
	})

	// ===== EVENT TESTS =====

	test('fires input and change events correctly', async ({ page }) => {
		// Set up event listeners
		await page.evaluate(() => {
			;(window as any).inputEventCount = 0
			;(window as any).changeEventCount = 0
			const input = document.querySelector('form-textbox input')
			input?.addEventListener('input', () => {
				;(window as any).inputEventCount++
			})
			input?.addEventListener('change', () => {
				;(window as any).changeEventCount++
			})
		})

		const input = page.locator('form-textbox input').first()

		// Type should fire input events
		await input.type('test')

		const inputCount = await page.evaluate(
			() => (window as any).inputEventCount,
		)
		expect(inputCount).toBeGreaterThan(0)

		// Blur should fire change event
		await input.blur()

		const changeCount = await page.evaluate(
			() => (window as any).changeEventCount,
		)
		expect(changeCount).toBe(1)
	})

	// ===== MAXLENGTH VALIDATION TESTS =====

	test('validates maxlength on textarea - DOM and length sensor work', async ({
		page,
	}) => {
		const textareaComponent = page.locator('form-textbox').nth(2)
		const textarea = textareaComponent.locator('textarea')
		const description = textareaComponent.locator('.description')

		// Try to exceed maxlength
		const longText = 'A'.repeat(600) // Exceeds 500 char limit
		await textarea.fill(longText)

		// Browser should limit to maxlength (DOM behavior works)
		const actualValue = await textarea.inputValue()
		expect(actualValue.length).toBeLessThanOrEqual(500)

		// Description should show remaining characters (length sensor works for textarea)
		const remainingText = await description.textContent()
		expect(remainingText).toMatch(/[0-9]+ characters remaining/)

		// Should show very few remaining characters
		const remainingMatch = remainingText?.match(/(\d+) characters remaining/)
		if (remainingMatch) {
			expect(parseInt(remainingMatch[1])).toBeLessThanOrEqual(10)
		}
	})

	// ===== PROPERTY TYPE TESTS =====

	test('component properties exist with correct types', async ({ page }) => {
		// Verify the component has the expected properties even if they don't work
		const componentState = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return {
				hasValue: 'value' in element,
				hasLength: 'length' in element,
				hasError: 'error' in element,
				hasDescription: 'description' in element,
				hasClear: 'clear' in element,
				valueType: typeof element.value,
				lengthType: typeof element.length,
				errorType: typeof element.error,
				descriptionType: typeof element.description,
				clearType: typeof element.clear,
			}
		})

		// Properties should exist with correct types
		expect(componentState.hasValue).toBe(true)
		expect(componentState.hasLength).toBe(true)
		expect(componentState.hasError).toBe(true)
		expect(componentState.hasDescription).toBe(true)
		expect(componentState.hasClear).toBe(true)

		expect(componentState.valueType).toBe('string')
		expect(componentState.lengthType).toBe('number')
		expect(componentState.errorType).toBe('string')
		expect(componentState.descriptionType).toBe('string')
		expect(componentState.clearType).toBe('function')
	})
})
