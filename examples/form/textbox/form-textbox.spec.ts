import { expect, test } from '@playwright/test'

/*
 * FORM-TEXTBOX COMPONENT TESTS
 *
 * Test Coverage Summary:
 *
 * FEATURES COVERED:
 * - Initial state rendering with proper ARIA attributes
 * - Value updates on change event; length updates on input event
 * - Validation error handling (native validity)
 * - Writable properties (description, value) update correctly; validity via setCustomValidity
 * - Clear button and clear() method
 * - Textarea value and length
 * - Character remaining count for textarea with maxlength
 * - Form integration (native FormData collection)
 * - DOM events (input, change)
 * - Property type validation
 * - Readonly length property protection
 */

test.describe('form-textbox component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/form-textbox')
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

		// Should have proper ARIA attributes — the compiled template's
		// describedBy lists the description id first, then the error id
		// (this instance is required, hence validatable)
		await expect(input).toHaveAttribute(
			'aria-describedby',
			'name-description name-error',
		)
		// No aria-invalid / aria-errormessage on host — native :invalid replaces them
		await expect(textboxComponent).not.toHaveAttribute('aria-invalid')
		await expect(textboxComponent).not.toHaveAttribute('aria-errormessage')

		// Initial sensor property values
		const state = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return { value: element.value, length: element.length }
		})
		expect(state.value).toBe('')
		expect(state.length).toBe(0)
	})

	// ===== SENSOR BEHAVIOR TESTS =====

	test('value updates on change event, length updates on input event', async ({
		page,
	}) => {
		const input = page.locator('form-textbox input').first()

		// Type some text - fires input events per keystroke
		await input.type('John')

		// The compiled component commits BOTH length and value eagerly on
		// the input event (the hand-written twin deferred value to change)
		let state = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return { value: element.value, length: element.length }
		})
		expect(state.length).toBe(4)
		expect(state.value).toBe('John')

		// Blur fires change — validity is (re-)asserted there
		await input.blur()

		state = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return { value: element.value, length: element.length }
		})
		expect(state.value).toBe('John')
		expect(state.length).toBe(4)
	})

	// ===== VALIDATION TESTS =====

	test('shows validation error on required field', async ({ page }) => {
		const textboxComponent = page.locator('form-textbox').first()
		const input = textboxComponent.locator('input')
		const errorElement = textboxComponent.locator('.error')

		// Initially no error
		await expect(errorElement).toBeEmpty()

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

		// Validity should reflect invalid state
		const errorText = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return {
				validationMessage: element.validationMessage,
				valid: element.validity.valid,
			}
		})
		expect(errorText.validationMessage).toBeTruthy()
		expect(errorText.valid).toBe(false)
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

		const errorText = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return {
				validationMessage: element.validationMessage,
				valid: element.validity.valid,
			}
		})
		expect(errorText.validationMessage).toBe('')
		expect(errorText.valid).toBe(true)
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

		// Initial description — the writable prop's seed was harvested from
		// the owned paragraph's data-remaining attribute (children-are-data)
		await expect(description).toHaveText(
			'Tell us how you want us to call you in our communications.',
		)

		// LT-113: description is a writable prop again — a programmatic write
		// updates the rendered paragraph (module-coloreditor composes this way)
		await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			element.description = 'Updated description text'
		})

		await expect(description).toHaveText('Updated description text')
		const propValue = await page.evaluate(
			() => (document.querySelector('form-textbox') as any).description,
		)
		expect(propValue).toBe('Updated description text')
	})

	test('description write participates in the remaining-count derivation', async ({
		page,
	}) => {
		// The maxlength instance: the prop holds the TEMPLATE string, the
		// paragraph shows the substituted count — writing a new {n} template
		// through the public prop re-derives the display
		const textareaComponent = page.locator('form-textbox').nth(2)
		const description = textareaComponent.locator('.description')

		await expect(description).toHaveText('500 characters remaining')

		await textareaComponent.evaluate(() => {
			const element = document.querySelectorAll('form-textbox')[2] as any
			element.description = 'up to {n} characters left'
		})
		await expect(description).toHaveText('up to 500 characters left')

		// And typing shrinks the derived count live
		await textareaComponent.locator('textarea').fill('Hello world')
		await expect(description).toHaveText('up to 489 characters left')
	})

	test('updates validity programmatically via setCustomValidity', async ({
		page,
	}) => {
		// Initially valid
		let state = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return {
				validationMessage: element.validationMessage,
				valid: element.validity.valid,
			}
		})
		expect(state.validationMessage).toBe('')
		expect(state.valid).toBe(true)

		// Set validity via setCustomValidity (native API parity)
		await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			element.setCustomValidity('Custom error message')
		})

		state = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return {
				validationMessage: element.validationMessage,
				valid: element.validity.valid,
			}
		})
		expect(state.validationMessage).toBe('Custom error message')
		expect(state.valid).toBe(false)

		// Clear validity
		await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			element.setCustomValidity('')
		})

		state = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return {
				validationMessage: element.validationMessage,
				valid: element.validity.valid,
			}
		})
		expect(state.validationMessage).toBe('')
		expect(state.valid).toBe(true)
	})

	// ===== READONLY PROPERTY TESTS =====

	test('value property is writable, length is readonly', async ({ page }) => {
		const input = page.locator('form-textbox input').first()

		// Fill fires an input event, then blur fires a change event
		await input.fill('test value')
		await input.blur()

		// Properties should reflect DOM state
		let state = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return { value: element.value, length: element.length }
		})
		expect(state.value).toBe('test value')
		expect(state.length).toBe(10)

		// Value property is writable; assigning length should be silently ignored
		await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			element.value = 'changed value'
			try {
				element.length = 999 // should be ignored — length is readonly
			} catch (_e) {
				// Expected - length should be readonly
			}
		})

		// Check that value was set and synced to DOM
		await expect(input).toHaveValue('changed value')

		// length is not updated by JS assignment — no input event fired
		state = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return { value: element.value, length: element.length }
		})
		expect(state.value).toBe('changed value')
		expect(state.length).toBe(10) // unchanged — no input event since fill
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

		// Fill inputs and blur to trigger change events
		await firstInput.fill('John Doe')
		await firstInput.blur()
		await secondInput.fill('javascript react')
		await secondInput.blur()

		// Test form data — values submitted via ElementInternals setFormValue
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

	test('form reset restores empty value and clears error', async ({ page }) => {
		// Wrap the first textbox in a form
		await page.evaluate(() => {
			const form = document.createElement('form')
			const textbox = document.querySelector('form-textbox')
			if (!textbox) return
			textbox.parentNode?.insertBefore(form, textbox)
			form.appendChild(textbox)
		})

		const textboxComponent = page.locator('form-textbox').first()
		const input = textboxComponent.locator('input')

		// Type a value
		await input.fill('John Doe')
		await input.blur()

		// Reset the form
		await page.evaluate(() => {
			document.querySelector('form')?.reset()
		})
		await page.waitForTimeout(100)

		// Value should be reset
		const value = await page.evaluate(() => {
			return (document.querySelector('form-textbox') as any).value
		})
		expect(value).toBe('')

		// Validity should be cleared
		const error = await page.evaluate(() => {
			const element = document.querySelector('form-textbox') as any
			return {
				validationMessage: element.validationMessage,
				valid: element.validity.valid,
			}
		})
		expect(error.validationMessage).toBe('')
		expect(error.valid).toBe(true)
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
})
