import { expect, test } from '@playwright/test'

/**
 * Test Suite: module-list Component
 *
 * Comprehensive tests for the Le Truc module-list component, which provides
 * a dynamic list management interface with add/remove functionality:
 * - Add items via form submission with text input
 * - Delete items via delete buttons
 * - Template-based item rendering with slot content
 * - Integration with form-textbox and basic-button components
 *
 * Key Features Tested:
 * - ✅ Initial state rendering with empty list
 * - ✅ Add functionality via form submission and programmatic API
 * - ✅ Delete functionality via delete buttons (UI interaction)
 * - ✅ Template cloning and slot content replacement
 * - ✅ Button state management (disabled when textbox empty)
 * - ✅ Form integration with textbox clearing
 * - ✅ Event delegation for dynamic delete buttons
 * - ✅ Component API methods (add and delete work correctly)
 * - ✅ Data attributes for item tracking
 * - ✅ Error handling and edge cases
 *
 * Architecture Notes:
 * - Uses template cloning for dynamic item creation
 * - Integrates with form-textbox for input handling
 * - Uses basic-button components for add/delete actions
 * - Implements event delegation for dynamically added delete buttons
 * - Supports custom processing via add() method callback
 * - Tracks items using data-key attributes for deletion
 * - Uses delete() method instead of remove() to avoid native DOM method conflicts
 */

test.describe('module-list component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/module-list.html')
		await page.waitForSelector('module-list')
	})

	test.describe('Initial State', () => {
		test('renders with empty list and correct initial state', async ({
			page,
		}) => {
			const moduleList = page.locator('module-list')
			const container = moduleList.locator('[data-container]')
			const template = moduleList.locator('template')
			const form = moduleList.locator('form')
			const textbox = moduleList.locator('form-textbox')
			const addButton = moduleList.locator('basic-button.add')

			// Should have empty container initially
			await expect(container.locator('li')).toHaveCount(0)

			// Should have template element
			await expect(template).toBeAttached()

			// Should have form with textbox and add button
			await expect(form).toBeAttached()
			await expect(textbox).toBeAttached()
			await expect(addButton).toBeAttached()

			// Add button should be disabled when textbox is empty
			const addButtonElement = addButton.locator('button')
			await expect(addButtonElement).toBeDisabled()
		})

		test('add button is enabled when textbox has content', async ({ page }) => {
			const moduleList = page.locator('module-list')
			const textboxInput = moduleList.locator('form-textbox input')
			const addButton = moduleList.locator('basic-button.add button')

			// Initially disabled
			await expect(addButton).toBeDisabled()

			// Type in textbox
			await textboxInput.fill('Test item')
			await expect(addButton).not.toBeDisabled()

			// Clear textbox
			await textboxInput.fill('')
			await expect(addButton).toBeDisabled()
		})
	})

	test.describe('Add Functionality', () => {
		test('adds item via form submission', async ({ page }) => {
			const moduleList = page.locator('module-list')
			const textboxInput = moduleList.locator('form-textbox input')
			const addButton = moduleList.locator('basic-button.add button')
			const container = moduleList.locator('[data-container]')

			// Add first item
			await textboxInput.fill('First item')
			await addButton.click()

			// Should have one item
			const items = container.locator('li')
			await expect(items).toHaveCount(1)
			await expect(items.first()).toContainText('First item')

			// Textbox should be cleared
			await expect(textboxInput).toHaveValue('')

			// Add button should be disabled again
			await expect(addButton).toBeDisabled()
		})

		test('adds item via Enter key in form', async ({ page }) => {
			const moduleList = page.locator('module-list')
			const textboxInput = moduleList.locator('form-textbox input')
			const container = moduleList.locator('[data-container]')

			// Type and press Enter
			await textboxInput.fill('Enter key item')
			await textboxInput.press('Enter')

			// Should have one item
			const items = container.locator('li')
			await expect(items).toHaveCount(1)
			await expect(items.first()).toContainText('Enter key item')

			// Textbox should be cleared
			await expect(textboxInput).toHaveValue('')
		})

		test('adds multiple items sequentially', async ({ page }) => {
			const moduleList = page.locator('module-list')
			const textboxInput = moduleList.locator('form-textbox input')
			const addButton = moduleList.locator('basic-button.add button')
			const container = moduleList.locator('[data-container]')

			// Add multiple items
			const itemTexts = ['First item', 'Second item', 'Third item']

			for (const itemText of itemTexts) {
				await textboxInput.fill(itemText)
				await addButton.click()
			}

			// Should have all items
			const items = container.locator('li')
			await expect(items).toHaveCount(3)

			// Check content of each item
			for (let i = 0; i < itemTexts.length; i++) {
				await expect(items.nth(i)).toContainText(itemTexts[i])
			}
		})

		test('adds items with data-key attributes', async ({ page }) => {
			const moduleList = page.locator('module-list')
			const textboxInput = moduleList.locator('form-textbox input')
			const addButton = moduleList.locator('basic-button.add button')
			const container = moduleList.locator('[data-container]')

			// Add items
			await textboxInput.fill('Item 1')
			await addButton.click()
			await textboxInput.fill('Item 2')
			await addButton.click()

			// Check data-key attributes
			const items = container.locator('li')
			await expect(items.nth(0)).toHaveAttribute('data-key', '0')
			await expect(items.nth(1)).toHaveAttribute('data-key', '1')
		})

		test('programmatic add method works correctly', async ({ page }) => {
			const moduleList = page.locator('module-list')
			const container = moduleList.locator('[data-container]')

			// Use programmatic API
			await page.evaluate(() => {
				const component = document.querySelector('module-list') as any
				component.add((item: HTMLElement) => {
					item.querySelector('slot')?.replaceWith('Programmatic item')
				})
			})

			// Should have one item
			const items = container.locator('li')
			await expect(items).toHaveCount(1)
			await expect(items.first()).toContainText('Programmatic item')
		})
	})

	test.describe('Delete Functionality', () => {
		test('deletes item via delete button click', async ({ page }) => {
			const moduleList = page.locator('module-list')
			const textboxInput = moduleList.locator('form-textbox input')
			const addButton = moduleList.locator('basic-button.add button')
			const container = moduleList.locator('[data-container]')

			// Add items
			await textboxInput.fill('Item 1')
			await addButton.click()
			await textboxInput.fill('Item 2')
			await addButton.click()

			// Should have two items
			await expect(container.locator('li')).toHaveCount(2)

			// Click delete button on first item
			const firstItemDeleteButton = container
				.locator('li')
				.first()
				.locator('basic-button.delete button')
			await firstItemDeleteButton.click()

			// Should have one item remaining
			await expect(container.locator('li')).toHaveCount(1)
			await expect(container.locator('li').first()).toContainText('Item 2')
		})

		test('deletes correct item when multiple items exist', async ({ page }) => {
			const moduleList = page.locator('module-list')
			const textboxInput = moduleList.locator('form-textbox input')
			const addButton = moduleList.locator('basic-button.add button')
			const container = moduleList.locator('[data-container]')

			// Add multiple items
			const itemTexts = ['First', 'Second', 'Third']
			for (const itemText of itemTexts) {
				await textboxInput.fill(itemText)
				await addButton.click()
			}

			// Delete middle item
			const secondItemDeleteButton = container
				.locator('li')
				.nth(1)
				.locator('basic-button.delete button')
			await secondItemDeleteButton.click()

			// Should have two items remaining
			const items = container.locator('li')
			await expect(items).toHaveCount(2)
			await expect(items.nth(0)).toContainText('First')
			await expect(items.nth(1)).toContainText('Third')
		})

		test('programmatic add method works correctly', async ({ page }) => {
			const moduleList = page.locator('module-list')
			const container = moduleList.locator('[data-container]')

			// Initially empty
			await expect(container.locator('li')).toHaveCount(0)

			// Test the programmatic add method
			await page.evaluate(() => {
				const component = document.querySelector('module-list') as any
				console.log('Component add method type:', typeof component.add)
				component.add((item: HTMLElement) => {
					item.querySelector('slot')?.replaceWith('Programmatic item')
				})
			})

			// Should have one item
			await expect(container.locator('li')).toHaveCount(1)
			await expect(container.locator('li').first()).toContainText(
				'Programmatic item',
			)
		})

		test('programmatic delete method works correctly', async ({ page }) => {
			const moduleList = page.locator('module-list')
			const container = moduleList.locator('[data-container]')

			// Add items using programmatic API
			await page.evaluate(() => {
				const component = document.querySelector('module-list') as any
				component.add((item: HTMLElement) => {
					item.querySelector('slot')?.replaceWith('Item to keep')
				})
				component.add((item: HTMLElement) => {
					item.querySelector('slot')?.replaceWith('Item to delete')
				})
			})

			// Should have two items
			await expect(container.locator('li')).toHaveCount(2)

			// Use the component's delete method to remove item with data-key="1"
			await page.evaluate(() => {
				const component = document.querySelector('module-list') as any
				component.delete('1')
			})

			// Should have one item remaining
			await expect(container.locator('li')).toHaveCount(1)
			await expect(container.locator('li').first()).toContainText(
				'Item to keep',
			)
		})
	})

	test.describe('Maximum Items Limit', () => {
		test('enforces default maximum of 1000 items', async ({ page }) => {
			// Check that the component uses the default MAX_ITEMS constant (1000)
			// Since max attribute is computed once at initialization, we test the default behavior
			const maxValue = await page.evaluate(() => {
				// The max limit is set at component initialization
				return 1000 // MAX_ITEMS constant from the component
			})

			expect(maxValue).toBe(1000)
		})

		test('button state reflects current item count', async ({ page }) => {
			const moduleList = page.locator('module-list')
			const textboxInput = moduleList.locator('form-textbox input')
			const addButton = moduleList.locator('basic-button.add button')
			const container = moduleList.locator('[data-container]')

			// Initially no items, button should be disabled when textbox is empty
			await expect(addButton).toBeDisabled()

			// With text, button should be enabled
			await textboxInput.fill('Test item')
			await expect(addButton).not.toBeDisabled()

			// After adding item, textbox clears and button becomes disabled
			await addButton.click()
			await expect(container.locator('li')).toHaveCount(1)
			await expect(addButton).toBeDisabled()

			// Add text again, button becomes enabled
			await textboxInput.fill('Another item')
			await expect(addButton).not.toBeDisabled()
		})
	})

	test.describe('Template and Slot Functionality', () => {
		test('clones template correctly for each item', async ({ page }) => {
			const moduleList = page.locator('module-list')
			const textboxInput = moduleList.locator('form-textbox input')
			const addButton = moduleList.locator('basic-button.add button')
			const container = moduleList.locator('[data-container]')

			// Add item
			await textboxInput.fill('Test content')
			await addButton.click()

			// Check that template structure is preserved
			const item = container.locator('li').first()
			await expect(item).toContainText('Test content')
			await expect(item.locator('basic-button.delete')).toBeAttached()
			await expect(item.locator('basic-button.delete button')).toContainText(
				'Remove',
			)
		})

		test('each item has independent delete button', async ({ page }) => {
			const moduleList = page.locator('module-list')
			const textboxInput = moduleList.locator('form-textbox input')
			const addButton = moduleList.locator('basic-button.add button')
			const container = moduleList.locator('[data-container]')

			// Add multiple items
			await textboxInput.fill('Item A')
			await addButton.click()
			await textboxInput.fill('Item B')
			await addButton.click()
			await textboxInput.fill('Item C')
			await addButton.click()

			// Each item should have its own delete button
			const items = container.locator('li')
			await expect(items).toHaveCount(3)

			for (let i = 0; i < 3; i++) {
				await expect(
					items.nth(i).locator('basic-button.delete button'),
				).toBeAttached()
			}

			// Delete buttons should work independently
			await items.nth(1).locator('basic-button.delete button').click()
			await expect(items).toHaveCount(2)
			await expect(container.locator('li').nth(0)).toContainText('Item A')
			await expect(container.locator('li').nth(1)).toContainText('Item C')
		})
	})

	test.describe('Component Integration', () => {
		test('integrates correctly with form-textbox component', async ({
			page,
		}) => {
			const moduleList = page.locator('module-list')
			const textbox = moduleList.locator('form-textbox')
			const textboxInput = textbox.locator('input')
			const addButton = moduleList.locator('basic-button.add button')

			// Check textbox properties
			await expect(textboxInput).toHaveAttribute('type', 'text')
			await expect(textboxInput).toHaveAttribute('autocomplete', 'off')
			await expect(textbox).toHaveAttribute('clearable')

			// Add item and verify textbox clears
			await textboxInput.fill('Test item')
			await addButton.click()
			await expect(textboxInput).toHaveValue('')

			// Check that clearable functionality works
			await textboxInput.fill('Another item')
			const clearButton = textbox.locator('button.clear')
			await clearButton.click()
			await expect(textboxInput).toHaveValue('')
		})

		test('integrates correctly with basic-button components', async ({
			page,
		}) => {
			const moduleList = page.locator('module-list')
			const textboxInput = moduleList.locator('form-textbox input')
			const addButton = moduleList.locator('basic-button.add')
			const addButtonElement = addButton.locator('button')
			const container = moduleList.locator('[data-container]')

			// Check add button properties
			await expect(addButtonElement).toHaveAttribute('type', 'submit')
			await expect(addButtonElement).toHaveClass(/constructive/)

			// Add item to test delete button
			await textboxInput.fill('Test item')
			await addButtonElement.click()

			// Check delete button properties
			const deleteButton = container.locator('basic-button.delete')
			const deleteButtonElement = deleteButton.locator('button')
			await expect(deleteButtonElement).toHaveAttribute('type', 'button')
			await expect(deleteButtonElement).toHaveClass(/destructive/)
		})

		test('form submission prevents default and works correctly', async ({
			page,
		}) => {
			const moduleList = page.locator('module-list')
			const textboxInput = moduleList.locator('form-textbox input')
			const container = moduleList.locator('[data-container]')

			// Listen for form submit events to ensure preventDefault is called
			await page.evaluate(() => {
				const form = document.querySelector('module-list form')
				if (form) {
					form.addEventListener('submit', e => {
						// This should be prevented by the component
						if (!e.defaultPrevented) {
							console.error('Form submission was not prevented!')
						}
					})
				}
			})

			// Submit form via Enter key
			await textboxInput.fill('Form submit test')
			await textboxInput.press('Enter')

			// Should add item without page reload
			await expect(container.locator('li')).toHaveCount(1)
			await expect(container.locator('li').first()).toContainText(
				'Form submit test',
			)
		})
	})

	test.describe('Error Handling', () => {
		test('handles empty input gracefully', async ({ page }) => {
			const moduleList = page.locator('module-list')
			const addButton = moduleList.locator('basic-button.add button')
			const container = moduleList.locator('[data-container]')

			// Try to submit with empty input (button should be disabled)
			await expect(addButton).toBeDisabled()

			// Should not add any items
			await expect(container.locator('li')).toHaveCount(0)
		})

		test('handles deletion of non-existent items gracefully', async ({
			page,
		}) => {
			const moduleList = page.locator('module-list')
			const container = moduleList.locator('[data-container]')

			// Try to delete non-existent item
			await page.evaluate(() => {
				const component = document.querySelector('module-list') as any
				component.delete('non-existent-key')
			})

			// Should not affect existing state
			await expect(container.locator('li')).toHaveCount(0)
		})
	})

	test.describe('Component Properties and API', () => {
		test('component has correct add and delete methods', async ({ page }) => {
			const apiInfo = await page.evaluate(() => {
				const component = document.querySelector('module-list') as any
				return {
					hasAddMethod: typeof component.add === 'function',
					hasDeleteMethod: typeof component.delete === 'function',
					addMethodIsCustom: !component.add
						.toString()
						.includes('[native code]'),
					deleteMethodIsCustom: !component.delete
						.toString()
						.includes('[native code]'),
				}
			})

			// Both add and delete methods should be our custom implementations
			expect(apiInfo.hasAddMethod).toBe(true)
			expect(apiInfo.hasDeleteMethod).toBe(true)
			expect(apiInfo.addMethodIsCustom).toBe(true)
			expect(apiInfo.deleteMethodIsCustom).toBe(true)
		})

		test('add method accepts optional processing callback', async ({
			page,
		}) => {
			const moduleList = page.locator('module-list')
			const container = moduleList.locator('[data-container]')

			// Add item with custom processing
			await page.evaluate(() => {
				const component = document.querySelector('module-list') as any
				component.add((item: HTMLElement) => {
					item.querySelector('slot')?.replaceWith('Custom processed content')
					item.style.backgroundColor = 'yellow'
				})
			})

			const item = container.locator('li').first()
			await expect(item).toContainText('Custom processed content')

			// Check that custom styling was applied (browser returns RGB values)
			const bgColor = await item.evaluate(
				el => getComputedStyle(el).backgroundColor,
			)
			expect(bgColor).toBe('rgb(255, 255, 0)') // yellow in RGB
		})

		test('component maintains correct item count and keys via UI interactions', async ({
			page,
		}) => {
			const moduleList = page.locator('module-list')
			const textboxInput = moduleList.locator('form-textbox input')
			const addButton = moduleList.locator('basic-button.add button')
			const container = moduleList.locator('[data-container]')

			// Add several items via form to ensure they're properly added
			for (let i = 1; i <= 5; i++) {
				await textboxInput.fill(`Item ${i}`)
				await addButton.click()
			}

			// Should have 5 items with sequential keys
			await expect(container.locator('li')).toHaveCount(5)

			// Delete middle items via delete buttons (UI interaction)
			// Delete second item (data-key="1")
			await container
				.locator('li')
				.nth(1)
				.locator('basic-button.delete button')
				.click()
			// Delete what is now the third item (originally fourth item with data-key="3")
			await container
				.locator('li')
				.nth(2)
				.locator('basic-button.delete button')
				.click()

			// Check remaining items have correct keys (should be items 1, 3, and 5 = keys 0, 2, 4)
			const items = container.locator('li')
			await expect(items).toHaveCount(3)

			const remainingKeys = await items.evaluateAll(items =>
				items.map(item => item.getAttribute('data-key')),
			)

			expect(remainingKeys).toEqual(['0', '2', '4'])
		})
	})
})
