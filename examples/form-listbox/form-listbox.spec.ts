import { expect, test } from '@playwright/test'

/*
 * FORM-LISTBOX COMPONENT TESTS
 *
 * Test Coverage:
 *
 * Basic features (inline options):
 * - Initial state rendering with proper ARIA attributes
 * - Option selection updates value, hidden input, and aria-selected
 * - Changing selection updates all option states
 * - Component value property reflects selection
 *
 * Filter functionality (grouped options):
 * - Filter input shows/hides options by text match
 * - Clear button resets filter and shows all options
 * - Selecting an option in filtered list works
 *
 * Remote options (src attribute):
 * - Loads options from JSON endpoint
 * - Selection works on remote-loaded options
 *
 * innerHTML mutation resilience:
 * - Setting innerHTML on option buttons (e.g. for filter highlights)
 *   must NOT break reactivity of selection or filtering
 */

test.describe('form-listbox component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			if (msg.type() === 'error') {
				console.log(`[browser] ${msg.type()}: ${msg.text()}`)
			}
		})

		await page.goto('http://localhost:3000/test/form-listbox')
		await page.waitForSelector('form-listbox')
	})

	// ===== INLINE OPTIONS (colors listbox, no src) =====

	test('renders inline options correctly', async ({ page }) => {
		const listbox = page.locator('#colors [role="listbox"]')
		const options = listbox.locator('button[role="option"]')

		await expect(options).toHaveCount(5)
		await expect(options.first()).toHaveText('Red')
		await expect(options.last()).toHaveText('Purple')

		// No option should be selected initially (value is '')
		const selectedCount = await options.evaluateAll(
			els =>
				els.filter(el => el.getAttribute('aria-selected') === 'true').length,
		)
		expect(selectedCount).toBe(0)
	})

	test('clicking an option selects it', async ({ page }) => {
		const greenOption = page.locator(
			'#colors button[role="option"][value="green"]',
		)
		const redOption = page.locator('#colors button[role="option"][value="red"]')

		await greenOption.click()

		await expect(greenOption).toHaveAttribute('aria-selected', 'true')
		await expect(greenOption).toHaveAttribute('tabindex', '0')
		await expect(redOption).toHaveAttribute('aria-selected', 'false')
		await expect(redOption).toHaveAttribute('tabindex', '-1')

		// Component value should update
		const value = await page.evaluate(() => {
			const el = document.getElementById('colors') as any
			return el.value
		})
		expect(value).toBe('green')

		// Hidden input should sync
		const inputValue = await page
			.locator('#colors input[type="hidden"]')
			.inputValue()
		expect(inputValue).toBe('green')
	})

	test('clicking another option changes selection', async ({ page }) => {
		const greenOption = page.locator(
			'#colors button[role="option"][value="green"]',
		)
		const blueOption = page.locator(
			'#colors button[role="option"][value="blue"]',
		)

		await greenOption.click()
		await expect(greenOption).toHaveAttribute('aria-selected', 'true')

		await blueOption.click()
		await expect(blueOption).toHaveAttribute('aria-selected', 'true')
		await expect(greenOption).toHaveAttribute('aria-selected', 'false')

		const value = await page.evaluate(() => {
			const el = document.getElementById('colors') as any
			return el.value
		})
		expect(value).toBe('blue')
	})

	test('value property is writable', async ({ page }) => {
		const purpleOption = page.locator(
			'#colors button[role="option"][value="purple"]',
		)

		await page.evaluate(() => {
			const el = document.getElementById('colors') as any
			el.value = 'purple'
		})

		await expect(purpleOption).toHaveAttribute('aria-selected', 'true')
		await expect(purpleOption).toHaveAttribute('tabindex', '0')

		const inputValue = await page
			.locator('#colors input[type="hidden"]')
			.inputValue()
		expect(inputValue).toBe('purple')
	})

	// ===== FILTER FUNCTIONALITY (fruits listbox with groups) =====

	test('filter shows/hides options', async ({ page }) => {
		const filterInput = page.locator('#fruits input.filter')

		// All 6 options visible initially
		for (const option of await page
			.locator('#fruits button[role="option"]')
			.all()) {
			await expect(option).not.toHaveAttribute('hidden', '')
		}

		await filterInput.fill('berry')
		await page.waitForTimeout(100)

		const visibleOptions = page.locator(
			'#fruits button[role="option"]:not([hidden])',
		)
		await expect(visibleOptions).toHaveCount(3) // Strawberry, Blueberry, Raspberry
	})

	test('filter then select works', async ({ page }) => {
		const filterInput = page.locator('#fruits input.filter')

		await filterInput.fill('lemon')
		await page.waitForTimeout(100)

		const lemonOption = page.locator(
			'#fruits button[role="option"][value="lemon"]',
		)
		await lemonOption.click()

		await expect(lemonOption).toHaveAttribute('aria-selected', 'true')

		const value = await page.evaluate(() => {
			const el = document.getElementById('fruits') as any
			return el.value
		})
		expect(value).toBe('lemon')
	})

	test('clear button resets filter', async ({ page }) => {
		const filterInput = page.locator('#fruits input.filter')
		const clearButton = page.locator('#fruits button.clear')

		await filterInput.fill('lemon')
		await page.waitForTimeout(100)
		await expect(clearButton).toBeVisible()

		await clearButton.click()

		// Clear button hides after click (filter signal is '')
		await expect(clearButton).toBeHidden()

		// All options should be visible again
		const visibleOptions = page.locator(
			'#fruits button[role="option"]:not([hidden])',
		)
		await expect(visibleOptions).toHaveCount(6)
	})

	// ===== REMOTE SRC (timezone listbox) =====

	test('loads remote options from src', async ({ page }) => {
		await page.waitForSelector('#timezone button[role="option"]', {
			timeout: 5000,
		})

		const options = page.locator('#timezone button[role="option"]')
		const count = await options.count()
		expect(count).toBeGreaterThan(0)
	})

	test('selecting remote option updates value', async ({ page }) => {
		await page.waitForSelector('#timezone button[role="option"]', {
			timeout: 5000,
		})

		const firstOption = page.locator('#timezone button[role="option"]').first()
		const optionValue = await firstOption.getAttribute('value')

		await firstOption.click()
		await expect(firstOption).toHaveAttribute('aria-selected', 'true')

		const value = await page.evaluate(() => {
			const el = document.getElementById('timezone') as any
			return el.value
		})
		expect(value).toBe(optionValue)
	})

	// ===== innerHTML MUTATION RESILIENCE =====
	// Setting innerHTML on option buttons (e.g. for filter text highlighting
	// with <mark>) must not break reactive effects on those elements.

	test('selection reactivity survives innerHTML on option buttons', async ({
		page,
	}) => {
		const greenOption = page.locator(
			'#colors button[role="option"][value="green"]',
		)
		const blueOption = page.locator(
			'#colors button[role="option"][value="blue"]',
		)
		const redOption = page.locator('#colors button[role="option"][value="red"]')

		// Establish baseline
		await greenOption.click()
		await expect(greenOption).toHaveAttribute('aria-selected', 'true')

		// Set innerHTML on all option buttons (simulating filter highlight)
		await page.evaluate(() => {
			const escapeHTML = (text: string) =>
				text
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#39;')

			const options = document.querySelectorAll('#colors button[role="option"]')
			for (const option of options) {
				const text = option.textContent?.trim() ?? ''
				const firstChar = escapeHTML(text.charAt(0))
				const rest = escapeHTML(text.slice(1))
				option.innerHTML = `<mark>${firstChar}</mark>${rest}`
			}
		})
		await page.waitForTimeout(200)

		// Selection should still change after innerHTML mutation
		await blueOption.click()
		await expect(blueOption).toHaveAttribute('aria-selected', 'true')
		await expect(greenOption).toHaveAttribute('aria-selected', 'false')

		// And again
		await redOption.click()
		await expect(redOption).toHaveAttribute('aria-selected', 'true')
		await expect(blueOption).toHaveAttribute('aria-selected', 'false')

		const value = await page.evaluate(() => {
			const el = document.getElementById('colors') as any
			return el.value
		})
		expect(value).toBe('red')
	})

	test('filter reactivity survives innerHTML on option buttons', async ({
		page,
	}) => {
		const filterInput = page.locator('#fruits input.filter')

		// Set innerHTML on all fruit option buttons (simulating highlight)
		await page.evaluate(() => {
			const escapeHTML = (text: string) =>
				text
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#39;')

			const options = document.querySelectorAll('#fruits button[role="option"]')
			for (const option of options) {
				const text = option.textContent?.trim() ?? ''
				option.innerHTML = escapeHTML(text)
			}
		})
		await page.waitForTimeout(200)

		// Filtering should still work
		await filterInput.fill('orange')
		await page.waitForTimeout(200)

		const visibleOptions = page.locator(
			'#fruits button[role="option"]:not([hidden])',
		)
		await expect(visibleOptions).toHaveCount(1)
		await expect(visibleOptions.first()).toHaveText('Orange')
	})

	test('selection after scheduled innerHTML (simulating dangerouslySetInnerHTML)', async ({
		page,
	}) => {
		const greenOption = page.locator(
			'#colors button[role="option"][value="green"]',
		)
		const blueOption = page.locator(
			'#colors button[role="option"][value="blue"]',
		)

		await greenOption.click()
		await expect(greenOption).toHaveAttribute('aria-selected', 'true')

		// Set innerHTML via requestAnimationFrame (same timing as schedule())
		await page.evaluate(() => {
			const escapeHTML = (text: string) =>
				text
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;')
					.replace(/"/g, '&quot;')
					.replace(/'/g, '&#39;')

			const options = document.querySelectorAll('#colors button[role="option"]')
			requestAnimationFrame(() => {
				for (const option of options) {
					const text = option.textContent?.trim() ?? ''
					const firstChar = escapeHTML(text.charAt(0))
					const rest = escapeHTML(text.slice(1))
					option.innerHTML = `<mark>${firstChar}</mark>${rest}`
				}
			})
		})
		await page.waitForTimeout(300)

		await blueOption.click()
		await expect(blueOption).toHaveAttribute('aria-selected', 'true')
		await expect(greenOption).toHaveAttribute('aria-selected', 'false')
	})

	test('repeated innerHTML mutations do not break reactivity', async ({
		page,
	}) => {
		const options = ['red', 'green', 'blue', 'yellow', 'purple']

		for (const optionValue of options) {
			const optionLocator = page.locator(
				`#colors button[role="option"][value="${optionValue}"]`,
			)

			await optionLocator.click()
			await expect(optionLocator).toHaveAttribute('aria-selected', 'true')

			// Set innerHTML on all buttons after each selection
			await page.evaluate(() => {
				const escapeHTML = (text: string) =>
					text
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;')
						.replace(/"/g, '&quot;')
						.replace(/'/g, '&#39;')

				const btns = document.querySelectorAll('#colors button[role="option"]')
				for (const btn of btns) {
					const text = btn.textContent?.trim() ?? ''
					btn.innerHTML = escapeHTML(text)
				}
			})
			await page.waitForTimeout(100)

			// Selection should persist after innerHTML
			await expect(optionLocator).toHaveAttribute('aria-selected', 'true')

			const value = await page.evaluate(() => {
				const el = document.getElementById('colors') as any
				return el.value
			})
			expect(value).toBe(optionValue)
		}
	})
})
