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

	test('reactive computation updates immediately', async ({ page }) => {
		const catalog = page.locator('#default-test')
		const badge = catalog.locator('basic-button .badge')

		const product1Increment = catalog
			.locator('form-spinbutton')
			.nth(0)
			.locator('button.increment')

		// Multiple rapid clicks should update total immediately
		await product1Increment.click()
		await expect(badge).toHaveText('1')

		await product1Increment.click()
		await expect(badge).toHaveText('2')

		await product1Increment.click()
		await expect(badge).toHaveText('3')
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
			const spinbuttons = document.querySelectorAll('#default-test form-spinbutton')
			return Array.from(spinbuttons).map((sb: any) => sb.value)
		})

		expect(componentValues).toEqual([1, 2, 3])

		// Total should be sum of all values
		const badge = catalog.locator('basic-button .badge')
		await expect(badge).toHaveText('6')
	})

	test('button disabled state changes correctly', async ({ page }) => {
		const catalog = page.locator('#default-test')
		const button = catalog.locator('basic-button button')

		const product1Increment = catalog
			.locator('form-spinbutton')
			.nth(0)
			.locator('button.increment')
		const product1Decrement = catalog
			.locator('form-spinbutton')
			.nth(0)
			.locator('button.decrement')

		// Initially disabled
		await expect(button).toBeDisabled()

		// Add item - becomes enabled
		await product1Increment.click()
		await expect(button).not.toBeDisabled()

		// Remove item - becomes disabled again
		await product1Decrement.click()
		await expect(button).toBeDisabled()

		// Add multiple items
		await product1Increment.click()
		await product1Increment.click()
		await expect(button).not.toBeDisabled()

		// Remove one - still enabled
		await product1Decrement.click()
		await expect(button).not.toBeDisabled()

		// Remove last - disabled
		await product1Decrement.click()
		await expect(button).toBeDisabled()
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
		await increments[0].click() // Product 1: 1, Total: 1
		await expect(badge).toHaveText('1')

		await increments[1].click() // Product 2: 1, Total: 2
		await increments[1].click() // Product 2: 2, Total: 3
		await expect(badge).toHaveText('3')

		await increments[2].click() // Product 3: 1, Total: 4
		await increments[0].click() // Product 1: 2, Total: 5
		await expect(badge).toHaveText('5')

		// Now some decrements
		await decrements[1].click() // Product 2: 1, Total: 4
		await expect(badge).toHaveText('4')

		await decrements[0].click() // Product 1: 1, Total: 3
		await decrements[0].click() // Product 1: 0, Total: 2
		await expect(badge).toHaveText('2')

		// Still enabled because other products have items
		await expect(button).not.toBeDisabled()

		// Remove remaining items
		await decrements[1].click() // Product 2: 0, Total: 1
		await decrements[2].click() // Product 3: 0, Total: 0
		await expect(badge).toHaveText('')
		await expect(button).toBeDisabled()
	})

	test('badge text is always string representation of total', async ({
		page,
	}) => {
		const catalog = page.locator('#default-test')
		const badge = catalog.locator('basic-button .badge')

		const product1Increment = catalog
			.locator('form-spinbutton')
			.nth(0)
			.locator('button.increment')

		// Test various totals are properly stringified
		for (let i = 1; i <= 5; i++) {
			await product1Increment.click()
			await expect(badge).toHaveText(String(i))
		}
	})

	test('component coordination works with keyboard interactions', async ({
		page,
	}) => {
		const catalog = page.locator('#default-test')
		const badge = catalog.locator('basic-button .badge')

		// Use keyboard on first product
		const product1Increment = catalog
			.locator('form-spinbutton')
			.nth(0)
			.locator('button.increment')

		await product1Increment.focus()
		await page.keyboard.press('ArrowUp')
		await expect(badge).toHaveText('1')

		await page.keyboard.press('ArrowUp')
		await expect(badge).toHaveText('2')

		await page.keyboard.press('ArrowDown')
		await expect(badge).toHaveText('1')
	})

	test('all spinbuttons contribute to total calculation', async ({ page }) => {
		const catalog = page.locator('#default-test')
		const badge = catalog.locator('basic-button .badge')

		// Verify all 3 spinbuttons are found and contribute
		const spinbuttonCount = await catalog.locator('form-spinbutton').count()
		expect(spinbuttonCount).toBe(3)

		// Add 1 to each spinbutton
		for (let i = 0; i < 3; i++) {
			const increment = catalog
				.locator('form-spinbutton')
				.nth(i)
				.locator('button.increment')
			await increment.click()
		}

		// Total should be 3
		await expect(badge).toHaveText('3')

		// Verify each spinbutton has value 1
		const values = await page.evaluate(() => {
			const spinbuttons = document.querySelectorAll('#default-test form-spinbutton')
			return Array.from(spinbuttons).map((sb: any) => sb.value)
		})
		expect(values).toEqual([1, 1, 1])
	})

	test('component has no public properties exposed', async ({ page }) => {
		// Verify the component doesn't expose any public interface
		const hasPublicProps = await page.evaluate(() => {
			const catalog = document.querySelector('#default-test') as any
			// Try to access common property names, should all be undefined or internal
			const props = ['total', 'disabled', 'badge', 'value', 'count', 'items']
			return props.some(prop => catalog[prop] !== undefined)
		})

		// Component should not expose public properties
		expect(hasPublicProps).toBe(false)
	})
})

// ===== PASS() OBJECT.DEFINEPROPERTY FALLBACK (Path B) =====
// pass() has two code paths:
// - Path A: Slot-backed — replaces the child's internal signal (tested via form-combobox → form-listbox)
// - Path B: Object.defineProperty — used when the target is NOT a Le Truc component (no Slots)
//
// The vanilla-button in the #vanilla-test fixture is a plain HTMLElement CE with no Le Truc
// internals. pass({ disabled, badge }) exercises the Object.defineProperty path: it installs
// getters on the target that return the parent's reactive values. On parent disconnect,
// the original property descriptor is restored.

test.describe('pass() Object.defineProperty fallback (vanilla CE target)', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			if (msg.type() === 'error') {
				console.log(`[browser] error: ${msg.text()}`)
			}
		})

		await page.goto('http://localhost:3000/test/module-catalog')
		await page.waitForSelector('module-catalog')
	})

	test('vanilla-button.disabled reflects reactive value (true when total=0)', async ({
		page,
	}) => {
		// No items added yet — total = 0, disabled should be true
		const disabled = await page.evaluate(() => {
			return (
				document.querySelector('#vanilla-test vanilla-button') as any
			)?.disabled
		})
		expect(disabled).toBe(true)
	})

	test('vanilla-button.disabled becomes false when items are added', async ({
		page,
	}) => {
		const vanillaIncrement = page
			.locator('#vanilla-test form-spinbutton')
			.locator('button.increment')

		await vanillaIncrement.click()

		const disabled = await page.evaluate(() => {
			return (
				document.querySelector('#vanilla-test vanilla-button') as any
			)?.disabled
		})
		expect(disabled).toBe(false)
	})

	test('vanilla-button.badge reflects total count as string', async ({
		page,
	}) => {
		const vanillaIncrement = page
			.locator('#vanilla-test form-spinbutton')
			.locator('button.increment')

		// Add 3 items
		await vanillaIncrement.click()
		await vanillaIncrement.click()
		await vanillaIncrement.click()

		const badge = await page.evaluate(() => {
			return (
				document.querySelector('#vanilla-test vanilla-button') as any
			)?.badge
		})
		expect(badge).toBe('3')
	})

	test('vanilla-button.badge is empty string when total=0', async ({ page }) => {
		const badge = await page.evaluate(() => {
			return (
				document.querySelector('#vanilla-test vanilla-button') as any
			)?.badge
		})
		expect(badge).toBe('')
	})

	test('restores original property descriptor on parent disconnect', async ({
		page,
	}) => {
		// Confirm binding is active — disabled reflects reactive (true, total=0)
		// Then remove parent — pass() cleanup restores original descriptor (false)
		const result = await page.evaluate(async () => {
			const vb = document.querySelector(
				'#vanilla-test vanilla-button',
			) as any
			if (!vb) return { found: false, disabledBefore: null, disabledAfter: null }

			const disabledBefore = vb.disabled

			// Disconnect parent — pass() cleanup runs → original value descriptor restored
			document.querySelector('#vanilla-test')?.remove()
			await new Promise(r => setTimeout(r, 50))

			// After disconnect, vanilla-button.disabled should revert to its own initial value (false)
			const disabledAfter = vb.disabled

			return { found: true, disabledBefore, disabledAfter }
		})

		expect(result.found).toBe(true)
		expect(result.disabledBefore).toBe(true)
		expect(result.disabledAfter).toBe(false)
	})

	test('reactive updates propagate from spinbutton to vanilla-button', async ({
		page,
	}) => {
		const vanillaIncrement = page
			.locator('#vanilla-test form-spinbutton')
			.locator('button.increment')
		const vanillaDecrement = page
			.locator('#vanilla-test form-spinbutton')
			.locator('button.decrement')

		// Start: disabled=true, badge=''
		let state = await page.evaluate(() => {
			const el = document.querySelector('#vanilla-test vanilla-button') as any
			return { disabled: el?.disabled, badge: el?.badge }
		})
		expect(state.disabled).toBe(true)
		expect(state.badge).toBe('')

		// Add 2 items
		await vanillaIncrement.click()
		await vanillaIncrement.click()

		state = await page.evaluate(() => {
			const el = document.querySelector('#vanilla-test vanilla-button') as any
			return { disabled: el?.disabled, badge: el?.badge }
		})
		expect(state.disabled).toBe(false)
		expect(state.badge).toBe('2')

		// Remove 2 items (back to 0)
		await vanillaDecrement.click()
		await vanillaDecrement.click()

		state = await page.evaluate(() => {
			const el = document.querySelector('#vanilla-test vanilla-button') as any
			return { disabled: el?.disabled, badge: el?.badge }
		})
		expect(state.disabled).toBe(true)
		expect(state.badge).toBe('')
	})
})
