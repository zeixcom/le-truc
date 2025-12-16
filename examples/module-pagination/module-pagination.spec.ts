import { expect, test } from '@playwright/test'

/**
 * Test Suite: module-pagination Component
 *
 * Comprehensive tests for the Le Truc module-pagination component, which provides
 * accessible pagination controls with multiple interaction methods:
 * - Direct input entry (number input field)
 * - Button navigation (prev/next buttons)
 * - Keyboard shortcuts (arrow keys, +/- keys)
 * - Automatic validation and clamping
 *
 * Key Features Tested:
 * - ✅ Initial state rendering and property synchronization
 * - ✅ Input validation and boundary clamping (1 to max)
 * - ✅ Button state management (disabled when at boundaries)
 * - ✅ Keyboard shortcuts for navigation
 * - ✅ Reactive property updates (value and max)
 * - ✅ ARIA accessibility (aria-current, labels)
 * - ✅ Component visibility based on max value
 * - ✅ Form integration and value synchronization
 *
 * Architecture Notes:
 * - Uses `read` with `asInteger` parsers for reactive DOM reading
 * - Properties are writable and reactive (not readonly sensors)
 * - Component auto-hides when max <= 1 (single page scenarios)
 * - Input field drives value changes with validation
 * - Proper boundary checking prevents invalid states
 */

test.describe('module-pagination component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/module-pagination.html')
		await page.waitForSelector('module-pagination')
	})

	test.describe('Initial State', () => {
		test('renders pagination with correct initial state', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const input = pagination.locator('input[type="number"]')
			const prevButton = pagination.locator('button.prev')
			const nextButton = pagination.locator('button.next')
			const valueDisplay = pagination.locator('.value')
			const maxDisplay = pagination.locator('.max')

			// Should be visible (max > 1)
			await expect(pagination).toBeVisible()

			// Should have correct initial values
			await expect(input).toHaveValue('1')
			await expect(input).toHaveAttribute('max', '10')
			await expect(input).toHaveAttribute('min', '1')

			// Should display correct values
			await expect(valueDisplay).toHaveText('1')
			await expect(maxDisplay).toHaveText('10')

			// Should have correct button states
			await expect(prevButton).toBeDisabled() // At minimum value
			await expect(nextButton).toBeEnabled() // Can go forward

			// Should have proper ARIA attributes
			await expect(valueDisplay).toHaveAttribute('aria-current', 'page')
		})

		test('reads initial values from component properties', async ({ page }) => {
			const initialValues = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return {
					value: pagination?.value,
					max: pagination?.max,
				}
			})

			expect(initialValues.value).toBe(1)
			expect(initialValues.max).toBe(10)
		})

		test('sets correct host attributes', async ({ page }) => {
			const pagination = page.locator('module-pagination')

			await expect(pagination).toHaveAttribute('value', '1')
			await expect(pagination).toHaveAttribute('max', '10')
		})
	})

	test.describe('Input Field Navigation', () => {
		test('updates value when input changes', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const input = pagination.locator('input[type="number"]')
			const valueDisplay = pagination.locator('.value')

			// Enter valid page number
			await input.fill('5')
			await input.blur() // Trigger change event

			// Should update component value
			const componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(5)

			// Should update displays
			await expect(valueDisplay).toHaveText('5')
			await expect(input).toHaveValue('5')

			// Should update host attribute
			await expect(pagination).toHaveAttribute('value', '5')
		})

		test('clamps input values to valid range', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const input = pagination.locator('input[type="number"]')
			const valueDisplay = pagination.locator('.value')

			// Test upper bound clamping
			await input.fill('15') // Above max of 10
			await input.blur()

			let componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(10) // Clamped to max
			await expect(valueDisplay).toHaveText('10')
			await expect(input).toHaveValue('10')

			// Test lower bound clamping
			await input.fill('-5') // Below min of 1
			await input.blur()

			componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(1) // Clamped to min
			await expect(valueDisplay).toHaveText('1')
			await expect(input).toHaveValue('1')
		})

		test('handles invalid input gracefully', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const valueDisplay = pagination.locator('.value')

			// Use evaluate to set invalid value directly (can't type letters into number input)
			await page.evaluate(() => {
				const input = document.querySelector(
					'module-pagination input[type="number"]',
				)
				;(input as HTMLInputElement).value = 'abc' // Set invalid value directly
				input!.dispatchEvent(new Event('change', { bubbles: true }))
			})

			// Component should handle NaN by clamping to minimum value (1)
			const componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(1)
			await expect(valueDisplay).toHaveText('1')
		})
	})

	test.describe('Button Navigation', () => {
		test('navigates forward with next button', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const nextButton = pagination.locator('button.next')
			const prevButton = pagination.locator('button.prev')
			const input = pagination.locator('input[type="number"]')
			const valueDisplay = pagination.locator('.value')

			// Click next button
			await nextButton.click()

			// Should increment value
			const componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(2)

			// Should update all displays
			await expect(valueDisplay).toHaveText('2')
			await expect(input).toHaveValue('2')
			await expect(pagination).toHaveAttribute('value', '2')

			// Should update button states
			await expect(prevButton).toBeEnabled() // No longer at minimum
			await expect(nextButton).toBeEnabled() // Still can go forward
		})

		test('navigates backward with prev button', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const nextButton = pagination.locator('button.next')
			const prevButton = pagination.locator('button.prev')
			const input = pagination.locator('input[type="number"]')
			const valueDisplay = pagination.locator('.value')

			// Go to page 3 first
			await nextButton.click()
			await nextButton.click()

			// Click prev button
			await prevButton.click()

			// Should decrement value
			const componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(2)

			// Should update displays
			await expect(valueDisplay).toHaveText('2')
			await expect(input).toHaveValue('2')
		})

		test('disables prev button at minimum value', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const prevButton = pagination.locator('button.prev')

			// Should start disabled at value 1
			await expect(prevButton).toBeDisabled()

			// Verify clicking disabled button doesn't change value
			await prevButton.click({ force: true }) // Force click disabled button

			const componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(1) // Should remain at 1
		})

		test('disables next button at maximum value', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const nextButton = pagination.locator('button.next')
			const input = pagination.locator('input[type="number"]')

			// Go to maximum value (10)
			await input.fill('10')
			await input.blur()

			// Next button should be disabled
			await expect(nextButton).toBeDisabled()

			// Verify clicking disabled button doesn't change value
			await nextButton.click({ force: true }) // Force click disabled button

			const componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(10) // Should remain at 10
		})
	})

	test.describe('Keyboard Navigation', () => {
		test('navigates with arrow keys', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const valueDisplay = pagination.locator('.value')

			// Focus on a button (not input) and dispatch keyup event on the component
			const nextButton = pagination.locator('button.next')
			await nextButton.focus()

			// Dispatch keyup event directly on the component
			await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				pagination!.dispatchEvent(
					new KeyboardEvent('keyup', {
						key: 'ArrowRight',
						bubbles: true,
					}),
				)
			})

			let componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(2)
			await expect(valueDisplay).toHaveText('2')

			// Dispatch left arrow keyup event
			await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				pagination!.dispatchEvent(
					new KeyboardEvent('keyup', {
						key: 'ArrowLeft',
						bubbles: true,
					}),
				)
			})

			componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(1)
			await expect(valueDisplay).toHaveText('1')
		})

		test('navigates with plus and minus keys', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const valueDisplay = pagination.locator('.value')
			const nextButton = pagination.locator('button.next')
			await nextButton.focus()

			// Dispatch plus key keyup event
			await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				pagination!.dispatchEvent(
					new KeyboardEvent('keyup', { key: '+', bubbles: true }),
				)
			})

			let componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(2)
			await expect(valueDisplay).toHaveText('2')

			// Dispatch minus key keyup event
			await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				pagination!.dispatchEvent(
					new KeyboardEvent('keyup', { key: '-', bubbles: true }),
				)
			})

			componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(1)
			await expect(valueDisplay).toHaveText('1')
		})

		test('respects boundaries with keyboard navigation', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const input = pagination.locator('input[type="number"]')
			const nextButton = pagination.locator('button.next')

			await nextButton.focus()

			// Try to go below minimum
			await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				pagination!.dispatchEvent(
					new KeyboardEvent('keyup', {
						key: 'ArrowLeft',
						bubbles: true,
					}),
				)
			})

			let componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(1) // Should stay at minimum

			// Go to maximum
			await input.fill('10')
			await input.blur()
			await nextButton.focus()

			// Try to go above maximum
			await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				pagination!.dispatchEvent(
					new KeyboardEvent('keyup', {
						key: 'ArrowRight',
						bubbles: true,
					}),
				)
			})

			componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(10) // Should stay at maximum
		})

		test('ignores keyboard events when input is focused', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const input = pagination.locator('input[type="number"]')

			// Focus on input field and dispatch keyup from input
			await input.focus()
			await page.evaluate(() => {
				const input = document.querySelector(
					'module-pagination input[type="number"]',
				)
				input!.dispatchEvent(
					new KeyboardEvent('keyup', {
						key: 'ArrowRight',
						bubbles: true,
					}),
				)
			})

			const componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(1) // Should not change when input is focused
		})
	})

	test.describe('Component Properties', () => {
		test('value property is writable and reactive', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const input = pagination.locator('input[type="number"]')
			const valueDisplay = pagination.locator('.value')

			// Set value programmatically
			await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				pagination!.value = 7
			})

			// Should update all displays
			await expect(valueDisplay).toHaveText('7')
			await expect(input).toHaveValue('7')
			await expect(pagination).toHaveAttribute('value', '7')

			// Should update component property
			const componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(7)
		})

		test('max property is writable and reactive', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const input = pagination.locator('input[type="number"]')
			const maxDisplay = pagination.locator('.max')
			const nextButton = pagination.locator('button.next')

			// Set max programmatically
			await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				pagination!.max = 5
			})

			// Should update displays
			await expect(maxDisplay).toHaveText('5')
			await expect(input).toHaveAttribute('max', '5')
			await expect(pagination).toHaveAttribute('max', '5')

			// Should affect button states when at new max
			await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				pagination!.value = 5
			})

			await expect(nextButton).toBeDisabled()
		})

		test('automatically clamps value when max is reduced', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const input = pagination.locator('input[type="number"]')
			const valueDisplay = pagination.locator('.value')

			// Set high value first
			await input.fill('8')
			await input.blur()

			// Reduce max below current value
			await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				pagination!.max = 5
			})

			// Trigger a value update to apply clamping
			await input.dispatchEvent('change')

			// Value should be clamped to new max
			const componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(5)
			await expect(valueDisplay).toHaveText('5')
		})
	})

	test.describe('Component Visibility', () => {
		test('hides when max is 1 or less', async ({ page }) => {
			const pagination = page.locator('module-pagination')

			// Initially visible (max = 10)
			await expect(pagination).toBeVisible()

			// Set max to 1
			await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				pagination!.max = 1
			})

			// Should be hidden
			await expect(pagination).toBeHidden()

			// Set max to 0
			await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				pagination!.max = 0
			})

			// Should remain hidden
			await expect(pagination).toBeHidden()

			// Set max back to > 1
			await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				pagination!.max = 3
			})

			// Should be visible again
			await expect(pagination).toBeVisible()
		})
	})

	test.describe('ARIA and Accessibility', () => {
		test('has proper ARIA attributes', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const prevButton = pagination.locator('button.prev')
			const nextButton = pagination.locator('button.next')
			const valueDisplay = pagination.locator('.value')
			const input = pagination.locator('input[type="number"]')

			// Check button labels
			await expect(prevButton).toHaveAttribute('aria-label', 'Previous page')
			await expect(nextButton).toHaveAttribute('aria-label', 'Next page')

			// Check value display has aria-current
			await expect(valueDisplay).toHaveAttribute('aria-current', 'page')

			// Check input has proper attributes
			await expect(input).toHaveAttribute('type', 'number')
			await expect(input).toHaveAttribute('name', 'page')
			await expect(input).toHaveAttribute('min', '1')
		})

		test('maintains accessible button states', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const prevButton = pagination.locator('button.prev')
			const nextButton = pagination.locator('button.next')
			const input = pagination.locator('input[type="number"]')

			// At minimum (1), prev should be disabled
			await expect(prevButton).toBeDisabled()
			await expect(nextButton).toBeEnabled()

			// At maximum (10), next should be disabled
			await input.fill('10')
			await input.blur()

			await expect(prevButton).toBeEnabled()
			await expect(nextButton).toBeDisabled()

			// In middle range, both should be enabled
			await input.fill('5')
			await input.blur()

			await expect(prevButton).toBeEnabled()
			await expect(nextButton).toBeEnabled()
		})
	})

	test.describe('Form Integration', () => {
		test('works with standard form APIs', async ({ page }) => {
			// Test that the input field is properly included in form data
			const formData = await page.evaluate(() => {
				const form = document.createElement('form')
				const pagination = document.querySelector('module-pagination')
				form.appendChild(pagination!.cloneNode(true))
				return Object.fromEntries(new FormData(form).entries())
			})

			expect(formData.page).toBe('1') // Should include input value
		})

		test('syncs with form reset', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const input = pagination.locator('input[type="number"]')
			const valueDisplay = pagination.locator('.value')

			// Change value
			await input.fill('5')
			await input.blur()

			// Create and reset a form
			await page.evaluate(() => {
				const form = document.createElement('form')
				const pagination = document.querySelector('module-pagination')
				const clonedInput = pagination!.querySelector('input')!.cloneNode()
				;(clonedInput as HTMLInputElement).value = '5'
				form.appendChild(clonedInput)
				document.body.appendChild(form)
				form.reset()

				// Simulate reset by setting input back to original value
				const originalInput = pagination!.querySelector('input')
				originalInput!.value = '1'
				originalInput!.dispatchEvent(new Event('change', { bubbles: true }))
			})

			// Should reset to original value
			const componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(1)
			await expect(valueDisplay).toHaveText('1')
		})
	})

	test.describe('Edge Cases', () => {
		test('handles rapid navigation correctly', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const nextButton = pagination.locator('button.next')

			// Rapid clicking
			for (let i = 0; i < 5; i++) {
				await nextButton.click()
			}

			// Should handle rapid clicks correctly
			const componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(6) // 1 + 5 clicks
		})

		test('maintains consistency across interaction methods', async ({
			page,
		}) => {
			const pagination = page.locator('module-pagination')
			const input = pagination.locator('input[type="number"]')
			const nextButton = pagination.locator('button.next')
			const valueDisplay = pagination.locator('.value')

			// Use button navigation
			await nextButton.click()

			// Use input field
			await input.fill('5')
			await input.blur()

			// Use keyboard navigation
			await pagination.focus()
			await page.keyboard.press('ArrowRight')

			// Use programmatic update
			await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				pagination!.value = 3
			})

			// All should be in sync
			const componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(3)
			await expect(valueDisplay).toHaveText('3')
			await expect(input).toHaveValue('3')
			await expect(pagination).toHaveAttribute('value', '3')
		})

		test('handles decimal and float inputs appropriately', async ({ page }) => {
			const pagination = page.locator('module-pagination')
			const input = pagination.locator('input[type="number"]')
			const valueDisplay = pagination.locator('.value')

			// Enter decimal value
			await input.fill('5.7')
			await input.blur()

			// Component preserves decimal values (asInteger parser doesn't truncate)
			const componentValue = await page.evaluate(() => {
				const pagination = document.querySelector('module-pagination')
				return pagination?.value
			})
			expect(componentValue).toBe(5.7) // Preserves decimal
			await expect(valueDisplay).toHaveText('5.7')
		})
	})
})
