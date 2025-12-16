import { expect, test } from '@playwright/test'

test.describe('form-spinbutton component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/form-spinbutton.html')
		await page.waitForSelector('form-spinbutton')
	})

	test('renders initial state correctly', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		const decrementButton = spinbutton.locator('button.decrement')
		const input = spinbutton.locator('input.value')
		const zeroElement = spinbutton.locator('.zero')
		const otherElement = spinbutton.locator('.other')

		// Initial value should be 0
		await expect(input).toHaveValue('0')
		await expect(input).toBeHidden()

		// Decrement button should be hidden when value is 0
		await expect(decrementButton).toBeHidden()

		// Increment button should be enabled and visible
		await expect(incrementButton).toBeVisible()
		await expect(incrementButton).not.toHaveAttribute('disabled')

		// Zero element should be visible, other element hidden
		await expect(zeroElement).toBeVisible()
		await expect(zeroElement).toHaveText('Add to Cart')
		await expect(otherElement).toBeHidden()
	})

	test('increments value when clicking increment button', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		const input = spinbutton.locator('input.value')
		const decrementButton = spinbutton.locator('button.decrement')
		const zeroElement = spinbutton.locator('.zero')
		const otherElement = spinbutton.locator('.other')

		// Click increment button
		await incrementButton.click()

		// Value should be 1 and visible
		await expect(input).toHaveValue('1')
		await expect(input).toBeVisible()

		// Decrement button should now be visible
		await expect(decrementButton).toBeVisible()

		// Zero element should be hidden, other element visible
		await expect(zeroElement).toBeHidden()
		await expect(otherElement).toBeVisible()

		// Click increment again
		await incrementButton.click()
		await expect(input).toHaveValue('2')
	})

	test('decrements value when clicking decrement button', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		const decrementButton = spinbutton.locator('button.decrement')
		const input = spinbutton.locator('input.value')
		const zeroElement = spinbutton.locator('.zero')
		const otherElement = spinbutton.locator('.other')

		// First increment to 2
		await incrementButton.click()
		await incrementButton.click()
		await expect(input).toHaveValue('2')

		// Then decrement
		await decrementButton.click()
		await expect(input).toHaveValue('1')
		await expect(decrementButton).toBeVisible()
		await expect(otherElement).toBeVisible()

		// Decrement to 0
		await decrementButton.click()
		await expect(input).toHaveValue('0')
		await expect(input).toBeHidden()
		await expect(decrementButton).toBeHidden()
		await expect(zeroElement).toBeVisible()
		await expect(otherElement).toBeHidden()
	})

	test('respects max value constraint', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		const input = spinbutton.locator('input.value')

		// Click increment 10 times to reach max (10)
		for (let i = 0; i < 10; i++) {
			await incrementButton.click()
		}

		await expect(input).toHaveValue('10')
		await expect(incrementButton).toHaveAttribute('disabled')

		// Button should be disabled at max, value should stay at 10
		await expect(input).toHaveValue('10')
		await expect(incrementButton).toHaveAttribute('disabled')
	})

	test('handles keyboard interactions on buttons', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		const input = spinbutton.locator('input.value')

		// Focus a button (keyboard events are handled on controls collection)
		await incrementButton.focus()

		// Test ArrowUp
		await page.keyboard.press('ArrowUp')
		await expect(input).toHaveValue('1')
		await expect(input).toBeVisible()

		// Test ArrowUp again
		await page.keyboard.press('ArrowUp')
		await expect(input).toHaveValue('2')

		// Test ArrowDown
		await page.keyboard.press('ArrowDown')
		await expect(input).toHaveValue('1')

		// Test + key
		await page.keyboard.press('+')
		await expect(input).toHaveValue('2')

		// Test - key
		await page.keyboard.press('-')
		await expect(input).toHaveValue('1')
	})

	test('handles keyboard interactions on input when enabled', async ({
		page,
	}) => {
		// Use the interactive-input-test which has an input that's not disabled
		const spinbutton = page.locator('#interactive-input-test')
		const input = spinbutton.locator('input.value')
		const incrementButton = spinbutton.locator('button.increment')

		// First make input visible by incrementing
		await incrementButton.click()
		await expect(input).toBeVisible()

		// Focus the input directly
		await input.focus()

		// Test ArrowUp
		await page.keyboard.press('ArrowUp')
		await expect(input).toHaveValue('2')

		// Test ArrowDown
		await page.keyboard.press('ArrowDown')
		await expect(input).toHaveValue('1')

		// Test + key
		await page.keyboard.press('+')
		await expect(input).toHaveValue('2')

		// Test - key
		await page.keyboard.press('-')
		await expect(input).toHaveValue('1')
	})

	test('handles direct input value changes with validation', async ({
		page,
	}) => {
		// Use the interactive-input-test which has an input that's not disabled
		const spinbutton = page.locator('#interactive-input-test')
		const input = spinbutton.locator('input.value')
		const incrementButton = spinbutton.locator('button.increment')

		// First make input visible by incrementing
		await incrementButton.click()
		await expect(input).toBeVisible()

		// Clear and type a valid value
		await input.fill('3')
		await input.blur() // Trigger change event
		await expect(input).toHaveValue('3')

		// Try to input a value above max (should be clamped)
		await input.fill('15')
		await input.blur()
		await expect(input).toHaveValue('12') // Should be clamped to max

		// Try to input a negative value (should be clamped to 0, which hides input)
		await input.fill('-5')
		await input.blur()
		await expect(input).toHaveValue('0')
		await expect(input).toBeHidden()

		// Make input visible again for next test
		await incrementButton.click()
		await incrementButton.click()
		await expect(input).toBeVisible()
		await expect(input).toHaveValue('2')

		// Try to input a non-integer (should reset to previous valid value)
		await input.fill('2.5')
		await input.blur()
		await expect(input).toHaveValue('2') // Should reset to previous valid value
	})

	test('keyboard interactions respect constraints', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		const input = spinbutton.locator('input.value')

		await incrementButton.focus()

		// Go to max value using keyboard
		for (let i = 0; i < 10; i++) {
			await page.keyboard.press('ArrowUp')
		}

		await expect(input).toHaveValue('10')
		await expect(incrementButton).toHaveAttribute('disabled')

		// Try to go past max
		await page.keyboard.press('ArrowUp')
		await expect(input).toHaveValue('10')

		// Switch to decrement button to go down
		const decrementButton = spinbutton.locator('button.decrement')
		await decrementButton.focus()

		// Go down to 0 and try to go below
		for (let i = 0; i < 10; i++) {
			await page.keyboard.press('ArrowDown')
		}

		await expect(input).toHaveValue('0')
		await expect(input).toBeHidden()

		// Try to go below 0
		await page.keyboard.press('ArrowDown')
		await expect(input).toHaveValue('0')
	})

	test('keyboard events are prevented from propagating', async ({ page }) => {
		// Set up event listener on document to detect if events bubble up
		await page.evaluate(() => {
			;(window as any).documentKeydownCount = 0
			document.addEventListener('keydown', e => {
				if (['ArrowUp', 'ArrowDown', '+', '-'].includes(e.key)) {
					;(window as any).documentKeydownCount++
				}
			})
		})

		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		await incrementButton.focus()

		// Press handled keys
		await page.keyboard.press('ArrowUp')
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('+')
		await page.keyboard.press('-')

		// Check that events were prevented from reaching document
		const documentKeydownCount = await page.evaluate(
			() => (window as any).documentKeydownCount,
		)
		expect(documentKeydownCount).toBe(0)

		// Test that other keys still propagate
		await page.keyboard.press('Escape')
		await page.keyboard.press('Tab')

		// These should have propagated (but we don't count them in our listener)
	})

	test('syncs value property with DOM interactions', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')

		// Initial value should be 0
		let valueProperty = await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			return element.value
		})
		expect(valueProperty).toBe(0)

		// Click increment button
		await incrementButton.click()

		valueProperty = await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			return element.value
		})
		expect(valueProperty).toBe(1)

		// Use keyboard to increment
		await incrementButton.focus()
		await page.keyboard.press('ArrowUp')

		valueProperty = await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			return element.value
		})
		expect(valueProperty).toBe(2)
	})

	test('reads max value from input max attribute', async ({ page }) => {
		// Check that max property reads from input.max
		const maxProperty = await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			return element.max
		})
		expect(maxProperty).toBe(10)

		// Test with another component that has different max
		const max5Property = await page.evaluate(() => {
			const element = document.querySelector('#max-5-test') as any
			return element.max
		})
		expect(max5Property).toBe(5)
	})

	test('handles aria-label updates correctly', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')

		// When value is 0, aria-label should use zero element text
		let ariaLabel = await incrementButton.getAttribute('aria-label')
		expect(ariaLabel).toBe('Add to Cart')

		// When value is > 0, should use original aria-label
		await incrementButton.click()
		ariaLabel = await incrementButton.getAttribute('aria-label')
		expect(ariaLabel).toBe('Increment')

		// When back to 0, should use zero element text again
		const decrementButton = spinbutton.locator('button.decrement')
		await decrementButton.click()
		ariaLabel = await incrementButton.getAttribute('aria-label')
		expect(ariaLabel).toBe('Add to Cart')
	})

	test('value property is readonly (sensor-based)', async ({ page }) => {
		// Test that the value property reflects DOM state but can't be controlled externally
		const initialValue = await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			return element.value
		})
		expect(initialValue).toBe(0)

		// Click the increment button
		const incrementButton = page
			.locator('form-spinbutton button.increment')
			.first()
		await incrementButton.click()

		// Property should now reflect the updated state
		const valueAfterClick = await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			return element.value
		})
		expect(valueAfterClick).toBe(1)

		// Verify that trying to set the value property directly doesn't work
		// (since it's a readonly sensor)
		await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			try {
				element.value = 5
			} catch (_e) {
				// Expected - property might be readonly
			}
		})

		// Value should still be 1 (not changed to 5)
		const input = page.locator('form-spinbutton input.value').first()
		await expect(input).toHaveValue('1')

		// The property should still reflect the DOM state
		const valueAfterAttemptedChange = await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			return element.value
		})
		expect(valueAfterAttemptedChange).toBe(1)
	})

	test('handles rapid button clicks correctly', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		const decrementButton = spinbutton.locator('button.decrement')
		const input = spinbutton.locator('input.value')

		// Rapid increment clicks
		await incrementButton.click()
		await incrementButton.click()
		await incrementButton.click()
		await expect(input).toHaveValue('3')

		// Rapid decrement clicks
		await decrementButton.click()
		await decrementButton.click()
		await expect(input).toHaveValue('1')

		// Mix of rapid clicks
		await incrementButton.click()
		await decrementButton.click()
		await incrementButton.click()
		await expect(input).toHaveValue('2')
	})

	test('maintains UI state consistency during value changes', async ({
		page,
	}) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		const decrementButton = spinbutton.locator('button.decrement')
		const input = spinbutton.locator('input.value')
		const zeroElement = spinbutton.locator('.zero')
		const otherElement = spinbutton.locator('.other')

		// Test transition from 0 to 1
		await incrementButton.click()
		await expect(input).toBeVisible()
		await expect(decrementButton).toBeVisible()
		await expect(zeroElement).toBeHidden()
		await expect(otherElement).toBeVisible()

		// Test transition from 1 to 0
		await decrementButton.click()
		await expect(input).toBeHidden()
		await expect(decrementButton).toBeHidden()
		await expect(zeroElement).toBeVisible()
		await expect(otherElement).toBeHidden()

		// Test reaching max value
		for (let i = 0; i < 10; i++) {
			await incrementButton.click()
		}
		await expect(incrementButton).toHaveAttribute('disabled')
		await expect(input).toHaveValue('10')
		await expect(decrementButton).toBeVisible()
	})

	test('handles focus and keyboard navigation', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		const input = spinbutton.locator('input.value')

		// Button should be focusable
		await incrementButton.focus()
		await expect(incrementButton).toBeFocused()

		// Test that we can use keyboard while focused
		await page.keyboard.press('ArrowUp')
		await expect(input).toHaveValue('1')

		// Test refocusing the button and using keyboard again
		await incrementButton.focus()
		await expect(incrementButton).toBeFocused()

		// Should still be able to use keyboard after refocus
		await page.keyboard.press('ArrowUp')
		await expect(input).toHaveValue('2')
	})

	test('reads initial value from DOM content', async ({ page }) => {
		// Test component that has initial value set in DOM
		const initialValueSpinbutton = page.locator('#initial-value-test')
		const input = initialValueSpinbutton.locator('input.value')
		const incrementButton = initialValueSpinbutton.locator('button.increment')
		const decrementButton = initialValueSpinbutton.locator('button.decrement')
		const otherElement = initialValueSpinbutton.locator('.other')

		// Should read initial value from DOM
		await expect(input).toHaveValue('3')
		await expect(input).toBeVisible()

		// UI should reflect non-zero state
		await expect(decrementButton).toBeVisible()
		await expect(otherElement).toBeVisible()

		// Verify the component property matches
		const valueProperty = await page.evaluate(() => {
			const element = document.querySelector('#initial-value-test') as any
			return element.value
		})
		expect(valueProperty).toBe(3)

		// Should be able to increment from initial value
		await incrementButton.click()
		await expect(input).toHaveValue('4')
	})

	test('handles different max values correctly', async ({ page }) => {
		const max5Spinbutton = page.locator('#max-5-test')
		const incrementButton = max5Spinbutton.locator('button.increment')
		const input = max5Spinbutton.locator('input.value')

		// Increment to max (5)
		for (let i = 0; i < 5; i++) {
			await incrementButton.click()
		}

		await expect(input).toHaveValue('5')
		await expect(incrementButton).toHaveAttribute('disabled')

		// Should be disabled at max value
		await expect(incrementButton).toHaveAttribute('disabled')
		await expect(input).toHaveValue('5')
	})

	test('handles component without zero element', async ({ page }) => {
		const noZeroSpinbutton = page.locator('#no-zero-test')
		const incrementButton = noZeroSpinbutton.locator('button.increment')
		const zeroElement = noZeroSpinbutton.locator('.zero')

		// Should not have zero element
		await expect(zeroElement).toHaveCount(0)

		// Aria-label should fallback to original when no zero element exists
		let ariaLabel = await incrementButton.getAttribute('aria-label')
		expect(ariaLabel).toBe('Increment')

		// After incrementing, should still use original aria-label
		await incrementButton.click()
		ariaLabel = await incrementButton.getAttribute('aria-label')
		expect(ariaLabel).toBe('Increment')
	})

	test('handles multiple instances independently', async ({ page }) => {
		const defaultSpinbutton = page.locator('form-spinbutton').first()
		const max5Spinbutton = page.locator('#max-5-test')
		const initialValueSpinbutton = page.locator('#initial-value-test')

		const defaultIncrement = defaultSpinbutton.locator('button.increment')
		const max5Increment = max5Spinbutton.locator('button.increment')
		const initialIncrement = initialValueSpinbutton.locator('button.increment')

		const defaultInput = defaultSpinbutton.locator('input.value')
		const max5Input = max5Spinbutton.locator('input.value')
		const initialInput = initialValueSpinbutton.locator('input.value')

		// Verify initial states are different
		await expect(defaultInput).toHaveValue('0')
		await expect(max5Input).toHaveValue('0')
		await expect(initialInput).toHaveValue('3')

		// Interact with each independently
		await defaultIncrement.click()
		await expect(defaultInput).toHaveValue('1')
		await expect(max5Input).toHaveValue('0')
		await expect(initialInput).toHaveValue('3')

		await max5Increment.click()
		await max5Increment.click()
		await expect(defaultInput).toHaveValue('1')
		await expect(max5Input).toHaveValue('2')
		await expect(initialInput).toHaveValue('3')

		await initialIncrement.click()
		await expect(defaultInput).toHaveValue('1')
		await expect(max5Input).toHaveValue('2')
		await expect(initialInput).toHaveValue('4')

		// Test different max constraints
		// Default max is 10, max5 is 5
		for (let i = 0; i < 3; i++) {
			await max5Increment.click()
		}
		// max5 should be at max (5) and disabled
		await expect(max5Input).toHaveValue('5')
		await expect(max5Increment).toHaveAttribute('disabled')

		// Default should still be able to increment
		await expect(defaultIncrement).not.toHaveAttribute('disabled')
		await defaultIncrement.click()
		await expect(defaultInput).toHaveValue('2')
	})

	test('keyboard navigation works across multiple instances', async ({
		page,
	}) => {
		const defaultSpinbutton = page.locator('form-spinbutton').first()
		const max5Spinbutton = page.locator('#max-5-test')

		const defaultIncrement = defaultSpinbutton.locator('button.increment')
		const max5Increment = max5Spinbutton.locator('button.increment')

		const defaultInput = defaultSpinbutton.locator('input.value')
		const max5Input = max5Spinbutton.locator('input.value')

		// Focus first instance and use keyboard
		await defaultIncrement.focus()
		await page.keyboard.press('ArrowUp')
		await expect(defaultInput).toHaveValue('1')
		await expect(max5Input).toHaveValue('0')

		// Focus second instance and use keyboard
		await max5Increment.focus()
		await page.keyboard.press('ArrowUp')
		await page.keyboard.press('ArrowUp')
		await expect(defaultInput).toHaveValue('1')
		await expect(max5Input).toHaveValue('2')
	})

	test('form integration works correctly', async ({ page }) => {
		// Create a form wrapper around the interactive input test component
		await page.evaluate(() => {
			const form = document.createElement('form')
			form.id = 'test-form'
			const spinbutton = document.querySelector('#interactive-input-test')
			if (spinbutton?.parentNode) {
				spinbutton.parentNode.insertBefore(form, spinbutton)
				form.appendChild(spinbutton)
			}
		})

		const incrementButton = page.locator(
			'#interactive-input-test button.increment',
		)

		// Increment the value
		await incrementButton.click()
		await incrementButton.click()

		// Test form data includes the input value
		const formData = await page.evaluate(() => {
			const form = document.querySelector('#test-form') as HTMLFormElement
			if (!form) return null
			const data = new FormData(form)
			return Object.fromEntries(data.entries())
		})

		expect(formData).toEqual({ interactive: '2' })
	})

	test('input shows proper max attribute synchronization', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const input = spinbutton.locator('input.value')

		// Check initial max attribute
		await expect(input).toHaveAttribute('max', '10')

		// Test different components have different max values
		const max5Input = page.locator('#max-5-test input.value')
		await expect(max5Input).toHaveAttribute('max', '5')

		const initialTestInput = page.locator('#initial-value-test input.value')
		await expect(initialTestInput).toHaveAttribute('max', '15')
	})

	test('handles enabled input field interactions', async ({ page }) => {
		// Test with interactive-input-test which has an enabled input
		const spinbutton = page.locator('#interactive-input-test')
		const input = spinbutton.locator('input.value')
		const incrementButton = spinbutton.locator('button.increment')

		// Initially hidden because value is 0
		await expect(input).toBeHidden()

		// Click increment to make input visible
		await incrementButton.click()
		await expect(input).toBeVisible()
		await expect(input).toHaveValue('1')

		// Now we can interact with the input directly
		await input.focus()
		await input.fill('4')

		// After blur, the value should be updated
		await input.blur()
		await expect(input).toHaveValue('4')

		// Component property should reflect the change
		const valueProperty = await page.evaluate(() => {
			const element = document.querySelector('#interactive-input-test') as any
			return element.value
		})
		expect(valueProperty).toBe(4)
	})
})
