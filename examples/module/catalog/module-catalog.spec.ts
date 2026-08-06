import { expect, test } from '@playwright/test'

test.describe('module-catalog component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/module-catalog')
		await page.waitForSelector('module-catalog')
	})

	test('renders initial state correctly', async ({ page }) => {
		const catalog = page.locator('#default-test')
		const button = catalog.locator('basic-button button')
		const badge = catalog.locator('basic-button .badge')
		const spinbuttons = catalog.locator('form-spinbutton')

		// Should have 3 spinbutton components
		await expect(spinbuttons).toHaveCount(3)

		// Button should be disabled initially (no items in cart)
		await expect(button).toHaveAttribute('disabled')
		await expect(button).toBeDisabled()

		// Badge should be empty initially
		await expect(badge).toHaveText('')

		// All spinbuttons should start at 0
		const inputs = catalog.locator('form-spinbutton input.value')
		await expect(inputs.nth(0)).toHaveValue('0')
		await expect(inputs.nth(1)).toHaveValue('0')
		await expect(inputs.nth(2)).toHaveValue('0')
	})

	test('calculates total and enables button when items are added', async ({
		page,
	}) => {
		const catalog = page.locator('#default-test')
		const button = catalog.locator('basic-button button')
		const badge = catalog.locator('basic-button .badge')

		// Add 2 of Product 1
		const product1Increment = catalog
			.locator('form-spinbutton')
			.nth(0)
			.locator('button.increment')
		await product1Increment.click()
		await product1Increment.click()

		// Button should be enabled and show total
		await expect(button).not.toHaveAttribute('disabled')
		await expect(button).not.toBeDisabled()
		await expect(badge).toHaveText('2')

		// Add 3 of Product 2
		const product2Increment = catalog
			.locator('form-spinbutton')
			.nth(1)
			.locator('button.increment')
		await product2Increment.click()
		await product2Increment.click()
		await product2Increment.click()

		// Total should be updated
		await expect(badge).toHaveText('5')
		await expect(button).not.toBeDisabled()

		// Add 1 of Product 3
		const product3Increment = catalog
			.locator('form-spinbutton')
			.nth(2)
			.locator('button.increment')
		await product3Increment.click()

		// Total should be 6
		await expect(badge).toHaveText('6')
		await expect(button).not.toBeDisabled()
	})

	test('updates total when items are decremented', async ({ page }) => {
		const catalog = page.locator('#default-test')
		const button = catalog.locator('basic-button button')
		const badge = catalog.locator('basic-button .badge')

		// First add some items
		const product1Increment = catalog
			.locator('form-spinbutton')
			.nth(0)
			.locator('button.increment')
		const product2Increment = catalog
			.locator('form-spinbutton')
			.nth(1)
			.locator('button.increment')

		await product1Increment.click()
		await product1Increment.click()
		await product1Increment.click() // 3 items
		await product2Increment.click()
		await product2Increment.click() // 2 items

		await expect(badge).toHaveText('5')

		// Now decrement Product 1
		const product1Decrement = catalog
			.locator('form-spinbutton')
			.nth(0)
			.locator('button.decrement')
		await product1Decrement.click()

		// Total should be updated
		await expect(badge).toHaveText('4')
		await expect(button).not.toBeDisabled()

		// Decrement Product 2 to 0
		const product2Decrement = catalog
			.locator('form-spinbutton')
			.nth(1)
			.locator('button.decrement')
		await product2Decrement.click()
		await product2Decrement.click()

		// Total should be 2 (only Product 1 remaining)
		await expect(badge).toHaveText('2')
		await expect(button).not.toBeDisabled()

		// Decrement Product 1 to 0
		await product1Decrement.click()
		await product1Decrement.click()

		// Button should be disabled again, badge empty
		await expect(button).toHaveAttribute('disabled')
		await expect(button).toBeDisabled()
		await expect(badge).toHaveText('')
	})

	test('handles reaching maximum values for individual products', async ({
		page,
	}) => {
		const catalog = page.locator('#default-test')
		const badge = catalog.locator('basic-button .badge')

		// Product 1 max is 10, Product 2 max is 5, Product 3 max is 20
		const product1Increment = catalog
			.locator('form-spinbutton')
			.nth(0)
			.locator('button.increment')
		const product2Increment = catalog
			.locator('form-spinbutton')
			.nth(1)
			.locator('button.increment')

		// Max out Product 1 (10 items)
		for (let i = 0; i < 10; i++) {
			await product1Increment.click()
		}

		// Max out Product 2 (5 items)
		for (let i = 0; i < 5; i++) {
			await product2Increment.click()
		}

		// Total should be 15
		await expect(badge).toHaveText('15')

		// Increment buttons should be disabled at max
		await expect(product1Increment).toHaveAttribute('disabled')
		await expect(product2Increment).toHaveAttribute('disabled')
	})

	test('total reflects component property values', async ({ page }) => {
		const catalog = page.locator('#default-test')

		// Add items to different products
		const product1Increment = catalog
			.locator('form-spinbutton')
			.nth(0)
			.locator('button.increment')
		const product2Increment = catalog
			.locator('form-spinbutton')
			.nth(1)
			.locator('button.increment')
		const product3Increment = catalog
			.locator('form-spinbutton')
			.nth(2)
			.locator('button.increment')

		await product1Increment.click() // 1
		await product2Increment.click()
		await product2Increment.click() // 2
		await product3Increment.click()
		await product3Increment.click()
		await product3Increment.click() // 3

		// Verify component properties match expected values
		const componentValues = await page.evaluate(() => {
			const spinbuttons = document.querySelectorAll(
				'#default-test form-spinbutton',
			)
			return Array.from(spinbuttons).map((sb: any) => sb.value)
		})

		expect(componentValues).toEqual([1, 2, 3])

		// Total should be sum of all values
		const badge = catalog.locator('basic-button .badge')
		await expect(badge).toHaveText('6')
	})

	test('handles mixed interactions across all products', async ({ page }) => {
		const catalog = page.locator('#default-test')
		const badge = catalog.locator('basic-button .badge')
		const button = catalog.locator('basic-button button')

		// Get all increment buttons
		const increments = [
			catalog.locator('form-spinbutton').nth(0).locator('button.increment'),
			catalog.locator('form-spinbutton').nth(1).locator('button.increment'),
			catalog.locator('form-spinbutton').nth(2).locator('button.increment'),
		]

		// Get all decrement buttons
		const decrements = [
			catalog.locator('form-spinbutton').nth(0).locator('button.decrement'),
			catalog.locator('form-spinbutton').nth(1).locator('button.decrement'),
			catalog.locator('form-spinbutton').nth(2).locator('button.decrement'),
		]

		// Complex interaction pattern
		await increments[0]!.click() // Product 1: 1, Total: 1
		await expect(badge).toHaveText('1')

		await increments[1]!.click() // Product 2: 1, Total: 2
		await increments[1]!.click() // Product 2: 2, Total: 3
		await expect(badge).toHaveText('3')

		await increments[2]!.click() // Product 3: 1, Total: 4
		await increments[0]!.click() // Product 1: 2, Total: 5
		await expect(badge).toHaveText('5')

		// Now some decrements
		await decrements[1]!.click() // Product 2: 1, Total: 4
		await expect(badge).toHaveText('4')

		await decrements[0]!.click() // Product 1: 1, Total: 3
		await decrements[0]!.click() // Product 1: 0, Total: 2
		await expect(badge).toHaveText('2')

		// Still enabled because other products have items
		await expect(button).not.toBeDisabled()

		// Remove remaining items
		await decrements[1]!.click() // Product 2: 0, Total: 1
		await decrements[2]!.click() // Product 3: 0, Total: 0
		await expect(badge).toHaveText('')
		await expect(button).toBeDisabled()
	})

	test('composes rangeOverflow and customError on cart click (ADR 0020)', async ({
		page,
	}) => {
		const catalog = page.locator('#default-test')
		const button = catalog.locator('basic-button button')
		const spinbuttons = catalog.locator('form-spinbutton')

		// Product 1: stays fully available — no customError expected.
		await spinbuttons.nth(0).locator('button.increment').click()

		// Product 2: max 5 on load, mocked backend reduces it to 2.
		const product2Increment = spinbuttons.nth(1).locator('button.increment')
		await product2Increment.click()
		await product2Increment.click()
		await product2Increment.click() // value: 3, above the post-check max of 2

		// Product 3: mocked backend reports it sold out (max: 0).
		await spinbuttons.nth(2).locator('button.increment').click() // value: 1

		await button.click()

		// Wait for the mocked round trip (300ms) to resolve for all three.
		await expect(spinbuttons.nth(2).locator('.error')).toHaveText(
			'No longer available',
		)

		const states = await page.evaluate(() => {
			const els = document.querySelectorAll(
				'#default-test form-spinbutton',
			) as NodeListOf<any>
			return Array.from(els).map(el => ({
				max: el.max,
				rangeOverflow: el.validity.rangeOverflow,
				customError: el.validity.customError,
				message: el.validationMessage,
			}))
		})
		const state1 = states[0]!
		const state2 = states[1]!
		const state3 = states[2]!

		// Product 1: unaffected — no overflow, no custom error.
		expect(state1).toEqual({
			max: 10,
			rangeOverflow: false,
			customError: false,
			message: '',
		})

		// Product 2: value (3) now exceeds the reduced max (2) — both the
		// internally-derived rangeOverflow and the externally-set customError
		// are true at once, on the same `internals`, neither clobbering the
		// other.
		expect(state2.max).toBe(2)
		expect(state2.rangeOverflow).toBe(true)
		expect(state2.customError).toBe(true)
		expect(state2.message).toBe('Only 2 left in stock')

		// Product 3: sold out — max 0, value (1) overflows, customError set.
		expect(state3.max).toBe(0)
		expect(state3.rangeOverflow).toBe(true)
		expect(state3.customError).toBe(true)
		expect(state3.message).toBe('No longer available')

		await expect(spinbuttons.nth(1).locator('.error')).toHaveText(
			'Only 2 left in stock',
		)
	})

	test('a sold-out item (max: 0) becomes disabled — fieldset cascades to its controls', async ({
		page,
	}) => {
		const catalog = page.locator('#default-test')
		const button = catalog.locator('basic-button button')
		const spinbuttons = catalog.locator('form-spinbutton')
		const product3 = spinbuttons.nth(2)

		await product3.locator('button.increment').click() // value: 1
		await button.click()
		await expect(product3.locator('.error')).toHaveText('No longer available')

		// `<fieldset disabled>` itself doesn't match Playwright's toBeDisabled()
		// (nor CSS :disabled) — only its descendants do, which is what actually
		// matters for interactivity.
		await expect(product3.locator('fieldset')).toHaveAttribute('disabled', '')
		await expect(product3.locator('button.increment')).toBeDisabled()
		await expect(product3.locator('button.decrement')).toBeDisabled()

		// Native fieldset-disabled cascade blocks the click from having any
		// effect — the button never even dispatches a click event.
		await product3.locator('button.increment').click({ force: true })
		const value = await product3.evaluate((el: any) => el.value)
		expect(value).toBe(1)
	})

	test('a later value change wipes the previously server-set customError', async ({
		page,
	}) => {
		const catalog = page.locator('#default-test')
		const button = catalog.locator('basic-button button')
		const spinbuttons = catalog.locator('form-spinbutton')
		// Product 2 (reduced to max: 2, not sold out) stays interactive after
		// the check — unlike Product 3 (max: 0), whose fieldset is now
		// genuinely disabled and can't be interacted with at all.
		const product2 = spinbuttons.nth(1)
		const product2Increment = product2.locator('button.increment')

		await product2Increment.click()
		await product2Increment.click()
		await product2Increment.click() // value: 3
		await button.click()
		await expect(product2.locator('.error')).toHaveText('Only 2 left in stock')

		// User interacts with the control again — the spinbutton's own
		// rangeOverflow/rangeUnderflow watch reruns and, by design, replaces
		// (does not merge with) the stale server-reported customError.
		await product2.locator('button.decrement').click() // value: 2

		const state = await product2.evaluate((el: any) => ({
			rangeOverflow: el.validity.rangeOverflow,
			customError: el.validity.customError,
			message: el.validationMessage,
		}))
		expect(state).toEqual({
			rangeOverflow: false,
			customError: false,
			message: '',
		})
	})
})
