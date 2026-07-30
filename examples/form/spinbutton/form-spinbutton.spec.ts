import { expect, test } from '@playwright/test'

test.describe('form-spinbutton component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/form-spinbutton')
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

	test('value property is mutable (controlled + uncontrolled)', async ({
		page,
	}) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const input = spinbutton.locator('input.value')

		const initialValue = await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			return element.value
		})
		expect(initialValue).toBe(0)

		// Uncontrolled path: user interaction updates value
		const incrementButton = spinbutton.locator('button.increment')
		await incrementButton.click()

		const valueAfterClick = await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			return element.value
		})
		expect(valueAfterClick).toBe(1)

		// Controlled path: programmatic assignment drives the DOM
		await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			element.value = 5
		})

		await expect(input).toHaveValue('5')
		await expect(input).toBeVisible()

		const valueAfterSet = await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			return element.value
		})
		expect(valueAfterSet).toBe(5)

		// Reset to 0 via programmatic assignment hides input and decrement
		await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			element.value = 0
		})

		await expect(input).toBeHidden()

		const valueAfterReset = await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			return element.value
		})
		expect(valueAfterReset).toBe(0)
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

	test('form integration works correctly', async ({ page }) => {
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

	test('form reset restores zero value', async ({ page }) => {
		const incrementButton = page.locator(
			'#interactive-input-test button.increment',
		)

		// Increment the value
		await incrementButton.click()
		await incrementButton.click()

		// Verify value is non-zero
		const valueBefore = await page.evaluate(() => {
			return (document.querySelector('#interactive-input-test') as any).value
		})
		expect(valueBefore).toBe(2)

		// Reset the form
		await page.evaluate(() => {
			;(document.querySelector('#test-form') as HTMLFormElement)?.reset()
		})
		await page.waitForTimeout(100)

		// Value should be reset to 0
		const valueAfter = await page.evaluate(() => {
			return (document.querySelector('#interactive-input-test') as any).value
		})
		expect(valueAfter).toBe(0)
	})
})
