import { expect, test } from '@playwright/test'

/*
 * Spec runs against the COMPILED component (LT-092 site cutover): the page
 * serves attribute-configured instances whose inner structure matches the
 * compiled template. Ported from the hand-written contract — the compiled
 * component reads value/min/max/step/bigStep from HOST attributes (not from
 * the inner input's attributes) and the hand-written twin's zero-state
 * affordance (.zero/.other spans, hidden input at 0, aria-label swapping)
 * was dropped in the migration (see form-spinbutton.tsrx): the input and
 * both buttons are always visible, and the buttons carry static aria-labels.
 */

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
		const input = spinbutton.locator('input')

		// Initial value should be 0 — visible, no zero-state UI anymore
		await expect(input).toHaveValue('0')
		await expect(input).toBeVisible()

		// Decrement button is disabled at min (0), increment enabled
		await expect(decrementButton).toBeVisible()
		await expect(decrementButton).toHaveAttribute('disabled')
		await expect(incrementButton).toBeVisible()
		await expect(incrementButton).not.toHaveAttribute('disabled')
	})

	test('increments value when clicking increment button', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		const input = spinbutton.locator('input')
		const decrementButton = spinbutton.locator('button.decrement')

		// Click increment button
		await incrementButton.click()

		// Value should be 1, decrement enabled
		await expect(input).toHaveValue('1')
		await expect(decrementButton).not.toHaveAttribute('disabled')

		// Click increment again
		await incrementButton.click()
		await expect(input).toHaveValue('2')
	})

	test('decrements value when clicking decrement button', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		const decrementButton = spinbutton.locator('button.decrement')
		const input = spinbutton.locator('input')

		// First increment to 2
		await incrementButton.click()
		await incrementButton.click()
		await expect(input).toHaveValue('2')

		// Then decrement
		await decrementButton.click()
		await expect(input).toHaveValue('1')

		// Decrement to 0 — decrement re-disables at min, input stays visible
		await decrementButton.click()
		await expect(input).toHaveValue('0')
		await expect(input).toBeVisible()
		await expect(decrementButton).toHaveAttribute('disabled')
	})

	test('respects max value constraint', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		const input = spinbutton.locator('input')

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
		const input = spinbutton.locator('input')

		// Focus a button (keyboard events are handled on the fieldset)
		await incrementButton.focus()

		// Test ArrowUp
		await page.keyboard.press('ArrowUp')
		await expect(input).toHaveValue('1')

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
		// The input is always interactive in the compiled component
		const spinbutton = page.locator('#interactive-input-test')
		const input = spinbutton.locator('input')

		// Focus the input directly
		await input.focus()

		// Test ArrowUp
		await page.keyboard.press('ArrowUp')
		await expect(input).toHaveValue('1')

		// Test ArrowDown
		await page.keyboard.press('ArrowDown')
		await expect(input).toHaveValue('0')

		// +/- are left to native text entry when the input has focus — unlike
		// on a button (see 'handles keyboard interactions on buttons'), they
		// must not be intercepted as step shortcuts, so `value` is untouched
		await page.keyboard.press('+')
		await page.keyboard.press('-')
		const valueProperty = await page.evaluate(
			() => (document.querySelector('#interactive-input-test') as any).value,
		)
		expect(valueProperty).toBe(0)
	})

	test('handles direct input value changes with validation', async ({
		page,
	}) => {
		const spinbutton = page.locator('#interactive-input-test')
		const input = spinbutton.locator('input')

		// Type a valid value
		await input.fill('3')
		await input.blur() // Trigger change event
		await expect(input).toHaveValue('3')

		// Try to input a value above max (should be clamped)
		await input.fill('15')
		await input.blur()
		await expect(input).toHaveValue('12') // Should be clamped to max

		// Try to input a negative value (should be clamped to 0)
		await input.fill('-5')
		await input.blur()
		await expect(input).toHaveValue('0')

		// Try to input a non-integer (should reset to previous valid value)
		await input.fill('2')
		await input.blur()
		await input.fill('2.5')
		await input.blur()
		await expect(input).toHaveValue('2') // Should reset to previous valid value
	})

	test('keyboard interactions respect constraints', async ({ page }) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		const input = spinbutton.locator('input')

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

		// Switch to decrement button to go down. Reaching max disabled the
		// focused increment button, dropping focus to <body> — refocus before
		// pressing keys so they reach the control's fieldset handler.
		const decrementButton = spinbutton.locator('button.decrement')
		await decrementButton.focus()
		await expect(decrementButton).toBeFocused()

		// Go down to 0 and try to go below
		for (let i = 0; i < 10; i++) {
			await page.keyboard.press('ArrowDown')
		}

		await expect(input).toHaveValue('0')
		await expect(decrementButton).toHaveAttribute('disabled')

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
		// Host attribute wins, the owned input's attribute is the fallback
		// (LT-112 restored the twin's precedence); the demo carries the data
		// on the input
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

	test('keeps static aria-labels on the step buttons', async ({ page }) => {
		// The zero-state aria-label swap was dropped with the zero-state UI —
		// both buttons carry their static aria-labels at every value
		const spinbutton = page.locator('form-spinbutton').first()
		const incrementButton = spinbutton.locator('button.increment')
		const decrementButton = spinbutton.locator('button.decrement')

		await expect(incrementButton).toHaveAttribute('aria-label', 'Increment')
		await expect(decrementButton).toHaveAttribute('aria-label', 'Decrement')

		await incrementButton.click()
		await expect(incrementButton).toHaveAttribute('aria-label', 'Increment')

		await decrementButton.click()
		await expect(incrementButton).toHaveAttribute('aria-label', 'Increment')
	})

	test('value property is mutable (controlled + uncontrolled)', async ({
		page,
	}) => {
		const spinbutton = page.locator('form-spinbutton').first()
		const input = spinbutton.locator('input')

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

		// Controlled path: programmatic assignment drives the exposed prop and
		// the input's value ATTRIBUTE. The live input text may not resync
		// after this point: stepUp/stepDown/onChange write input.value
		// directly (setting the native dirty-value flag), and the compiled
		// component mirrors host.value via bindAttribute — the documented
		// trade-off in form-spinbutton.tsrx ("this only matters for
		// host.value being set from OUTSIDE the component"). Consumers that
		// drive the value from outside read the prop, not the input text.
		await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			element.value = 5
		})
		await page.waitForTimeout(50)

		await expect(input).toHaveAttribute('value', '5')

		const valueAfterSet = await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			return element.value
		})
		expect(valueAfterSet).toBe(5)

		// Reset to 0 re-disables the decrement button
		await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			element.value = 0
		})
		await page.waitForTimeout(50)

		await expect(input).toHaveAttribute('value', '0')
		await expect(spinbutton.locator('button.decrement')).toHaveAttribute(
			'disabled',
		)

		const valueAfterReset = await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			return element.value
		})
		expect(valueAfterReset).toBe(0)
	})

	test('reads initial value from DOM content', async ({ page }) => {
		// The initial value harvests from the owned input's value attribute
		// (host attribute overrides — LT-112 restored the twin's precedence)
		const initialValueSpinbutton = page.locator('#initial-value-test')
		const input = initialValueSpinbutton.locator('input')
		const incrementButton = initialValueSpinbutton.locator('button.increment')
		const decrementButton = initialValueSpinbutton.locator('button.decrement')

		// Should read initial value from the host attribute
		await expect(input).toHaveValue('3')

		// UI reflects non-min state: decrement enabled
		await expect(decrementButton).not.toHaveAttribute('disabled')

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

	test('exposes min, stepDown() and stepUp() for generic reuse', async ({
		page,
	}) => {
		const minProperty = await page.evaluate(() => {
			const element = document.querySelector('form-spinbutton') as any
			return element.min
		})
		expect(minProperty).toBe(0)

		// stepUp()/stepDown() take a boolean: `true` steps by big-step
		// (default step*10) instead of step
		const valueAfterStepUp = await page.evaluate(() => {
			const element = document.querySelector('#generic-test') as any
			element.stepUp()
			element.stepUp(true)
			return element.value
		})
		expect(valueAfterStepUp).toBe(11)

		const valueAfterStepDown = await page.evaluate(() => {
			const element = document.querySelector('#generic-test') as any
			element.stepDown(true)
			return element.value
		})
		expect(valueAfterStepDown).toBe(1)

		// stepDown/stepUp clamp to min/max just like the buttons
		const clampedDown = await page.evaluate(() => {
			const element = document.querySelector('#generic-test') as any
			element.stepDown(true)
			return element.value
		})
		expect(clampedDown).toBe(0)
	})

	test('handles multiple instances independently', async ({ page }) => {
		const defaultSpinbutton = page.locator('form-spinbutton').first()
		const max5Spinbutton = page.locator('#max-5-test')
		const initialValueSpinbutton = page.locator('#initial-value-test')

		const defaultIncrement = defaultSpinbutton.locator('button.increment')
		const max5Increment = max5Spinbutton.locator('button.increment')
		const initialIncrement = initialValueSpinbutton.locator('button.increment')

		const defaultInput = defaultSpinbutton.locator('input')
		const max5Input = max5Spinbutton.locator('input')
		const initialInput = initialValueSpinbutton.locator('input')

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

	test('supports fractional step (float mode)', async ({ page }) => {
		const spinbutton = page.locator('#decimal-test')
		const incrementButton = spinbutton.locator('button.increment')
		const decrementButton = spinbutton.locator('button.decrement')
		const input = spinbutton.locator('input')

		// step="0.5" switches value/min/max parsing to floats
		await incrementButton.click()
		await expect(input).toHaveValue('0.5')

		await incrementButton.click()
		await expect(input).toHaveValue('1')

		await decrementButton.click()
		await decrementButton.click()
		await expect(input).toHaveValue('0')

		// Typing a value aligned to the step grid commits as typed
		await input.fill('2.5')
		await input.blur()
		await expect(input).toHaveValue('2.5')

		// A value off the step grid trips the native input's own
		// stepMismatch constraint — relayValidity picks that up, so it's
		// rejected and reverts rather than committing unaligned (the
		// input carries step="0.5" again — LT-112 restored the twin's
		// children-are-data contract)
		await input.fill('2.3')
		await input.blur()
		await expect(input).toHaveValue('2.5')

		// Clamped to max (5) when exceeding the bound
		await input.fill('9.9')
		await input.blur()
		await expect(input).toHaveValue('5')

		const valueProperty = await page.evaluate(
			() => (document.querySelector('#decimal-test') as any).value,
		)
		expect(valueProperty).toBe(5)
	})

	test('supports custom big-step for shift+Arrow', async ({ page }) => {
		const spinbutton = page.locator('#big-step-test')
		const incrementButton = spinbutton.locator('button.increment')
		const input = spinbutton.locator('input')

		await incrementButton.focus()
		await page.keyboard.press('ArrowUp')
		await expect(input).toHaveValue('1')

		// Shift+ArrowUp steps by the custom big-step (5) instead of the
		// default step*10 (10)
		await page.keyboard.press('Shift+ArrowUp')
		await expect(input).toHaveValue('6')

		await page.keyboard.press('Shift+ArrowDown')
		await expect(input).toHaveValue('1')

		// stepUp(true)/stepDown(true) drive the same big-step programmatically
		const valueAfterBigStepUp = await page.evaluate(() => {
			const element = document.querySelector('#big-step-test') as any
			element.stepUp(true)
			return element.value
		})
		expect(valueAfterBigStepUp).toBe(6)
	})

	test('supports negative min and typing a negative value directly', async ({
		page,
	}) => {
		const spinbutton = page.locator('#negative-min-test')
		const decrementButton = spinbutton.locator('button.decrement')
		const input = spinbutton.locator('input')

		// min is below 0 — decrement can go negative
		for (let i = 0; i < 3; i++) {
			await decrementButton.click()
		}
		await expect(input).toHaveValue('-3')

		// Typing "-" into the focused input must not be intercepted as a
		// decrement shortcut, so a negative value can be entered directly
		await input.fill('')
		await input.focus()
		await page.keyboard.type('-7')
		await input.blur()
		await expect(input).toHaveValue('-7')

		// Clamped to min (-10) when going below the bound
		await input.fill('-99')
		await input.blur()
		await expect(input).toHaveValue('-10')

		// +/- on a focused button still steps by 1 (unambiguous, no text cursor)
		const incrementButton = spinbutton.locator('button.increment')
		await incrementButton.focus()
		await page.keyboard.press('+')
		await expect(input).toHaveValue('-9')
		await page.keyboard.press('-')
		await expect(input).toHaveValue('-10')
	})
})
