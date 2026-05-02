import { expect, test } from '@playwright/test'

/**
 * Test Suite: module-todo Component
 *
 * Comprehensive tests for the Le Truc module-todo component, which provides
 * a complete todo application interface with:
 * - Add todo items via form submission
 * - Mark items as completed/uncompleted with checkboxes
 * - Filter todos by status (all, active, completed)
 * - Clear completed items
 * - Dynamic count of active items
 *
 * Key Features Tested:
 * - ✅ Initial state rendering
 * - ✅ Add functionality via form submission
 * - ✅ Checkbox state management and reactivity
 * - ✅ Collection updates when items are checked/unchecked
 * - ✅ Filter functionality (all, active, completed)
 * - ✅ Clear completed functionality
 * - ✅ Count updates based on active items
 * - ✅ Component integration with dependencies
 *
 * Architecture Notes:
 * - Manages its own list state and DOM reconciliation internally
 * - Integrates with form-textbox for input handling
 * - Uses form-checkbox components for item state
 * - Implements collections to track active/completed items
 * - Uses form-radiogroup for filtering
 * - Uses basic-pluralize for count display
 *
 * Collections Reactivity:
 * - Collections properly update when checkbox state changes
 * - Count display and clear completed functionality work correctly
 */

test.describe('module-todo component', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/module-todo')
		await page.waitForSelector('module-todo')
	})

	test.describe('Initial State', () => {
		test('renders with correct empty state', async ({ page }) => {
			const todo = page.locator('module-todo')
			const textbox = todo.locator('form-textbox')
			const submitButton = todo.locator('basic-button.submit button')
			const list = todo.locator('[data-container]')
			const count = todo.locator('basic-pluralize')
			const filter = todo.locator('form-radiogroup')
			const clearButton = todo.locator('basic-button.clear-completed')

			// Should have empty input and disabled submit button
			await expect(textbox.locator('input')).toHaveValue('')
			await expect(submitButton).toBeDisabled()

			// Should have empty list
			await expect(list.locator('li')).toHaveCount(0)

			// Should show "all done" message
			await expect(count.locator('.none')).toBeVisible()
			await expect(count.locator('.some')).not.toBeVisible()

			// Should have "All" filter selected by default
			await expect(filter.locator('input[value="all"]')).toBeChecked()

			// Should have disabled clear completed button with no badge
			await expect(clearButton.locator('button')).toBeDisabled()
			await expect(clearButton.locator('.badge')).toHaveText('')
		})
	})

	test.describe('Add Functionality', () => {
		test('enables submit button when input has text', async ({ page }) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('basic-button.submit button')

			// Initially disabled
			await expect(submitButton).toBeDisabled()

			// Type text - should enable button
			await textboxInput.fill('Buy groceries')
			await expect(submitButton).not.toBeDisabled()

			// Clear text - should disable again
			await textboxInput.fill('')
			await expect(submitButton).toBeDisabled()
		})

		test('adds todo item via form submission', async ({ page }) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('basic-button.submit button')
			const list = todo.locator('[data-container]')

			// Add first todo
			await textboxInput.fill('Buy groceries')
			await submitButton.click()

			// Should have one item
			const items = list.locator('li')
			await expect(items).toHaveCount(1)

			// Should contain the text and have an unchecked checkbox
			const firstItem = items.first()
			await expect(firstItem).toContainText('Buy groceries')

			const checkbox = firstItem.locator('form-checkbox input')
			await expect(checkbox).not.toBeChecked()

			// Input should be cleared and submit button disabled
			await expect(textboxInput).toHaveValue('')
			await expect(submitButton).toBeDisabled()
		})

		test('adds multiple todo items', async ({ page }) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('basic-button.submit button')
			const list = todo.locator('[data-container]')

			const todoTexts = ['Buy groceries', 'Walk the dog', 'Finish project']

			// Add multiple todos
			for (const todoText of todoTexts) {
				await textboxInput.fill(todoText)
				await submitButton.click()
			}

			// Should have all items
			const items = list.locator('li')
			await expect(items).toHaveCount(3)

			// Check each item content
			for (let i = 0; i < todoTexts.length; i++) {
				await expect(items.nth(i)).toContainText(todoTexts[i]!)
				await expect(
					items.nth(i).locator('form-checkbox input'),
				).not.toBeChecked()
			}
		})
	})

	test.describe('Checkbox Functionality', () => {
		test('can check and uncheck todo items', async ({ page }) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('basic-button.submit button')
			const list = todo.locator('[data-container]')

			// Add a todo
			await textboxInput.fill('Test task')
			await submitButton.click()

			const item = list.locator('li').first()
			const checkbox = item.locator('form-checkbox input')
			const checkboxLabel = item.locator('form-checkbox label')

			// Initially unchecked
			await expect(checkbox).not.toBeChecked()

			// Check the item by clicking the label (checkbox input is visually hidden)
			await checkboxLabel.click()
			await expect(checkbox).toBeChecked()

			// Uncheck the item
			await checkboxLabel.click()
			await expect(checkbox).not.toBeChecked()
		})

		test('checkbox state affects form-checkbox attributes', async ({
			page,
		}) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('basic-button.submit button')
			const list = todo.locator('[data-container]')

			// Add a todo
			await textboxInput.fill('Test task')
			await submitButton.click()

			const item = list.locator('li').first()
			const formCheckbox = item.locator('form-checkbox')
			const checkboxLabel = item.locator('form-checkbox label')

			// Initially should not have checked attribute
			await expect(formCheckbox).not.toHaveAttribute('checked')

			// Check the item by clicking the label
			await checkboxLabel.click()

			// Wait for attribute to update
			await expect(formCheckbox).toHaveAttribute('checked')

			// Uncheck the item
			await checkboxLabel.click()

			// Should not have checked attribute
			await expect(formCheckbox).not.toHaveAttribute('checked')
		})
	})

	test.describe('Collections and Count Updates', () => {
		test('count updates when todos are added', async ({ page }) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('basic-button.submit button')
			const count = todo.locator('basic-pluralize')

			// Initially should show "all done"
			await expect(count.locator('.none')).toBeVisible()
			await expect(count.locator('.some')).not.toBeVisible()

			// Add first todo
			await textboxInput.fill('Task 1')
			await submitButton.click()

			// Should show count with singular "task"
			await expect(count.locator('.none')).not.toBeVisible()
			await expect(count.locator('.some')).toBeVisible()
			await expect(count.locator('.count')).toHaveText('1')
			await expect(count.locator('.one')).toBeVisible()
			await expect(count.locator('.other')).not.toBeVisible()

			// Add second todo
			await textboxInput.fill('Task 2')
			await submitButton.click()

			// Should show count with plural "tasks"
			await expect(count.locator('.count')).toHaveText('2')
			await expect(count.locator('.one')).not.toBeVisible()
			await expect(count.locator('.other')).toBeVisible()
		})

		test('count updates when todos are completed', async ({ page }) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('basic-button.submit button')
			const list = todo.locator('[data-container]')
			const count = todo.locator('basic-pluralize')

			// Add two todos
			await textboxInput.fill('Task 1')
			await submitButton.click()
			await textboxInput.fill('Task 2')
			await submitButton.click()

			// Initially should show 2 tasks
			await expect(count.locator('.count')).toHaveText('2')
			await expect(count.locator('.other')).toBeVisible()

			// Complete first task
			const firstCheckboxLabel = list
				.locator('li')
				.first()
				.locator('form-checkbox label')
			await firstCheckboxLabel.click()

			// Should show 1 task remaining
			await expect(count.locator('.count')).toHaveText('1')
			await expect(count.locator('.one')).toBeVisible()
			await expect(count.locator('.other')).not.toBeVisible()

			// Complete second task
			const secondCheckboxLabel = list
				.locator('li')
				.nth(1)
				.locator('form-checkbox label')
			await secondCheckboxLabel.click()

			// Should show "all done"
			await expect(count.locator('.none')).toBeVisible()
			await expect(count.locator('.some')).not.toBeVisible()
		})

		test('count updates when completed todos are unchecked', async ({
			page,
		}) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('basic-button.submit button')
			const list = todo.locator('[data-container]')
			const count = todo.locator('basic-pluralize')

			// Add and complete a todo
			await textboxInput.fill('Task 1')
			await submitButton.click()

			const checkboxLabel = list
				.locator('li')
				.first()
				.locator('form-checkbox label')
			await checkboxLabel.click()

			// Should show "all done"
			await expect(count.locator('.none')).toBeVisible()

			// Uncheck the task
			await checkboxLabel.click()

			// Should show 1 task again
			await expect(count.locator('.none')).not.toBeVisible()
			await expect(count.locator('.some')).toBeVisible()
			await expect(count.locator('.count')).toHaveText('1')
		})
	})

	test.describe('Clear Completed Functionality', () => {
		test('clear completed button updates when items are completed', async ({
			page,
		}) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('basic-button.submit button')
			const list = todo.locator('[data-container]')
			const clearButton = todo.locator('basic-button.clear-completed')

			// Initially disabled with no badge
			await expect(clearButton.locator('button')).toBeDisabled()
			await expect(clearButton.locator('.badge')).toHaveText('')

			// Add two todos
			await textboxInput.fill('Task 1')
			await submitButton.click()
			await textboxInput.fill('Task 2')
			await submitButton.click()

			// Still should be disabled
			await expect(clearButton.locator('button')).toBeDisabled()

			// Complete first task
			const firstCheckboxLabel = list
				.locator('li')
				.first()
				.locator('form-checkbox label')
			await firstCheckboxLabel.click()

			// Should be enabled with badge showing 1
			await expect(clearButton.locator('button')).not.toBeDisabled()
			await expect(clearButton.locator('.badge')).toHaveText('1')

			// Complete second task
			const secondCheckboxLabel = list
				.locator('li')
				.nth(1)
				.locator('form-checkbox label')
			await secondCheckboxLabel.click()

			// Should show badge with 2
			await expect(clearButton.locator('.badge')).toHaveText('2')
		})

		test('clear completed removes completed items', async ({ page }) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('basic-button.submit button')
			const list = todo.locator('[data-container]')
			const clearButton = todo.locator('basic-button.clear-completed button')

			// Add three todos
			const todoTexts = ['Task 1', 'Task 2', 'Task 3']
			for (const todoText of todoTexts) {
				await textboxInput.fill(todoText)
				await submitButton.click()
			}

			// Should have 3 items
			await expect(list.locator('li')).toHaveCount(3)

			// Complete first and third tasks
			await list.locator('li').first().locator('form-checkbox label').click()
			await list.locator('li').nth(2).locator('form-checkbox label').click()

			// Click clear completed
			await clearButton.click()

			// Should have only 1 item remaining (Task 2)
			await expect(list.locator('li')).toHaveCount(1)
			await expect(list.locator('li').first()).toContainText('Task 2')
		})
	})

	test.describe('Filter Functionality', () => {
		test('filter changes affect list display', async ({ page }) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('basic-button.submit button')
			const list = todo.locator('[data-container]')
			const filter = todo.locator('form-radiogroup')

			// Add and complete some todos
			await textboxInput.fill('Active Task')
			await submitButton.click()
			await textboxInput.fill('Completed Task')
			await submitButton.click()

			// Complete second task
			const secondCheckboxLabel = list
				.locator('li')
				.nth(1)
				.locator('form-checkbox label')
			await secondCheckboxLabel.click()

			// Initially on "All" - should show both
			await expect(list.locator('li')).toHaveCount(2)

			// Switch to "Active" filter
			await filter.locator('label').filter({ hasText: 'Active' }).click()
			await expect(todo).toHaveAttribute('filter', 'active')

			// Switch to "Completed" filter
			await filter.locator('label').filter({ hasText: 'Completed' }).click()
			await expect(todo).toHaveAttribute('filter', 'completed')

			// Switch back to "All"
			await filter.locator('label').filter({ hasText: 'All' }).click()
			await expect(todo).toHaveAttribute('filter', 'all')
		})
	})

	test.describe('Component Integration', () => {
		test('integrates correctly with all sub-components', async ({ page }) => {
			const todo = page.locator('module-todo')

			// Check all required sub-components exist
			await expect(todo.locator('form-textbox')).toBeAttached()
			await expect(todo.locator('basic-button.submit')).toBeAttached()
			await expect(todo.locator('[data-container]')).toBeAttached()
			await expect(todo.locator('template')).toBeAttached()
			await expect(todo.locator('basic-pluralize')).toBeAttached()
			await expect(todo.locator('form-radiogroup')).toBeAttached()
			await expect(todo.locator('basic-button.clear-completed')).toBeAttached()
		})

		test('form prevents default submission', async ({ page }) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')

			// Submit via Enter key
			await textboxInput.fill('Test task')
			await textboxInput.press('Enter')

			// Should add item without page reload
			await expect(todo.locator('[data-container] li')).toHaveCount(1)
		})
	})

	test.describe('Integration Validation', () => {
		test('collections update correctly when checkbox state changes', async ({
			page,
		}) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('basic-button.submit button')
			const count = todo.locator('basic-pluralize')

			// Add two todos
			await textboxInput.fill('Task 1')
			await submitButton.click()
			await textboxInput.fill('Task 2')
			await submitButton.click()

			// Initially should show 2 active tasks
			await expect(count.locator('.count')).toHaveText('2')

			// Check first item
			const firstCheckboxLabel = todo
				.locator('[data-container] li')
				.first()
				.locator('form-checkbox label')
			await firstCheckboxLabel.click()

			// Count should update to 1 active task
			await expect(count.locator('.count')).toHaveText('1')
		})
	})

	test.describe('Edge Cases', () => {
		test('handles empty input gracefully', async ({ page }) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('basic-button.submit button')
			const list = todo.locator('[data-container]')

			// Try to submit empty input (button should be disabled)
			await expect(submitButton).toBeDisabled()

			// Try submitting just whitespace
			await textboxInput.fill('   ')
			await textboxInput.press('Enter')

			// Should not add any items
			await expect(list.locator('li')).toHaveCount(0)
		})

		test('handles rapid checkbox toggles', async ({ page }) => {
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('basic-button.submit button')
			const count = todo.locator('basic-pluralize')

			// Add a todo
			await textboxInput.fill('Test task')
			await submitButton.click()

			const checkbox = todo
				.locator('[data-container] li')
				.first()
				.locator('form-checkbox input')
			const checkboxLabel = todo
				.locator('[data-container] li')
				.first()
				.locator('form-checkbox label')

			// Rapidly toggle checkbox (5 clicks = checked, since it starts unchecked)
			for (let i = 0; i < 5; i++) {
				await checkboxLabel.click()
				await page.waitForTimeout(50) // Longer wait for stability
			}

			// Should end up checked after 5 clicks (starting from unchecked)
			await expect(checkbox).toBeChecked()
			// Count should show "all done" since the only task is completed
			await expect(count.locator('.none')).toBeVisible()
		})
	})

	test.describe('Bug Fixes', () => {
		// ── Isolation tests ────────────────────────────────────────────────────
		// Each test targets one specific link in the reactivity chain so that
		// failures point at the exact broken behaviour.

		test('B1 baseline: checking the only item decreases active count', async ({
			page,
		}) => {
			// Verifies the full chain for a single item:
			// label click → checkbox.change → slot setter → list.completed.set
			// → completedCount memo → activeCount → pass(count) → basic-pluralize
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('.submit button')
			const count = todo.locator('basic-pluralize')

			await textboxInput.fill('only task')
			await submitButton.click()
			await expect(count.locator('.count')).toHaveText('1')

			await todo
				.locator('li[data-key]')
				.first()
				.locator('form-checkbox label')
				.click()
			await expect(count.locator('.none')).toBeVisible()
		})

		test('B2: checking the SECOND item (after two are added) decreases count', async ({
			page,
		}) => {
			// The second item is added after each() already ran once for the first.
			// If each() re-run does not wire the new item, clicking its label will
			// not update list state and count stays at 2.
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('.submit button')
			const items = todo.locator('li[data-key]')
			const count = todo.locator('basic-pluralize')

			await textboxInput.fill('first task')
			await submitButton.click()
			await textboxInput.fill('second task')
			await submitButton.click()
			await expect(items).toHaveCount(2)
			await expect(count.locator('.count')).toHaveText('2')

			await items.nth(1).locator('form-checkbox label').click()
			await expect(count.locator('.count')).toHaveText('1')
		})

		test('B3: checking the FIRST item still works after a second item is added', async ({
			page,
		}) => {
			// When a second item is added, each() re-runs. If the re-run breaks
			// previously-wired slots for existing items, count stays at 2.
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('.submit button')
			const items = todo.locator('li[data-key]')
			const count = todo.locator('basic-pluralize')

			await textboxInput.fill('first task')
			await submitButton.click()
			await textboxInput.fill('second task')
			await submitButton.click()
			await expect(items).toHaveCount(2)
			await expect(count.locator('.count')).toHaveText('2')

			await items.nth(0).locator('form-checkbox label').click()
			await expect(count.locator('.count')).toHaveText('1')
		})

		test('B4: form-checkbox gets checked attribute when item is marked complete', async ({
			page,
		}) => {
			// Verifies the watch('checked', ...) effect inside form-checkbox runs
			// after pass() wires the slot — i.e. the child component's inner effects work.
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('.submit button')
			const items = todo.locator('li[data-key]')

			await textboxInput.fill('first task')
			await submitButton.click()
			await textboxInput.fill('second task')
			await submitButton.click()
			await expect(items).toHaveCount(2)

			// Check item 2 — verifies both the setter (updates list) and the getter
			// (watch inside form-checkbox sets the attribute).
			await items.nth(1).locator('form-checkbox label').click()
			await expect(items.nth(1).locator('form-checkbox')).toHaveAttribute(
				'checked',
			)
			await expect(items.nth(0).locator('form-checkbox')).not.toHaveAttribute(
				'checked',
			)
		})

		test('B5: state is isolated — checking item 1 does not affect item 2', async ({
			page,
		}) => {
			// Verifies that pass() wires DIFFERENT signals to DIFFERENT elements.
			// If both checkboxes share the same slot backing, checking one would
			// check both.
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('.submit button')
			const items = todo.locator('li[data-key]')
			const count = todo.locator('basic-pluralize')

			await textboxInput.fill('first task')
			await submitButton.click()
			await textboxInput.fill('second task')
			await submitButton.click()
			await expect(items).toHaveCount(2)

			await items.nth(0).locator('form-checkbox label').click()
			await expect(count.locator('.count')).toHaveText('1')
			await expect(items.nth(0).locator('form-checkbox')).toHaveAttribute(
				'checked',
			)
			await expect(items.nth(1).locator('form-checkbox')).not.toHaveAttribute(
				'checked',
			)
		})

		test('B6: inplace-edit value is isolated per item', async ({ page }) => {
			// Verifies that pass() for form-inplace-edit wires the correct label
			// signal for each item. If signals are crossed, editing one item's label
			// would change the other's display.
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('.submit button')
			const items = todo.locator('li[data-key]')

			await textboxInput.fill('alpha')
			await submitButton.click()
			await textboxInput.fill('beta')
			await submitButton.click()
			await expect(items).toHaveCount(2)

			await expect(items.nth(0).locator('form-inplace-edit .text')).toHaveText(
				'alpha',
			)
			await expect(items.nth(1).locator('form-inplace-edit .text')).toHaveText(
				'beta',
			)
		})

		test('B7: after reorder each() re-run fixes any broken wiring', async ({
			page,
		}) => {
			// Reproduces the partial-recovery symptom: if checkboxes don't work
			// before a reorder but do after, it shows each() re-run repairs slots.
			// Fails before-reorder assertions demonstrate the bug; pass-after shows recovery.
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('.submit button')
			const items = todo.locator('li[data-key]')
			const count = todo.locator('basic-pluralize')

			await textboxInput.fill('first task')
			await submitButton.click()
			await textboxInput.fill('second task')
			await submitButton.click()
			await expect(items).toHaveCount(2)
			await expect(count.locator('.count')).toHaveText('2')

			// Check second item BEFORE any reorder — should work
			await items.nth(1).locator('form-checkbox label').click()
			await expect(count.locator('.count')).toHaveText('1')

			// Reorder: move second item to top
			const reorderBtn = items.nth(1).locator('button.reorder')
			await reorderBtn.click()
			await page.keyboard.press('ArrowUp')
			await page.waitForTimeout(100)

			// After reorder, the item that was second is now first; it should still be checked
			await expect(count.locator('.count')).toHaveText('1')
			await expect(items.nth(0).locator('form-checkbox')).toHaveAttribute(
				'checked',
			)
		})

		test('B9: inplace-edit opens after reorder', async ({ page }) => {
			// Reproduces: after moving an item via keyboard reorder, dblclick on its
			// label should still open the inplace editor. Without the fix, the dblclick
			// listener is lost on disconnect/reconnect, so only the two click events fire
			// (toggling the linked checkbox twice, net no-op) and the editor stays closed.
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('.submit button')
			const items = todo.locator('li[data-key]')

			for (const label of ['task A', 'task B', 'task C']) {
				await textboxInput.fill(label)
				await submitButton.click()
			}
			await expect(items).toHaveCount(3)

			// Verify dblclick works before any reorder
			const thirdEdit = items.nth(2).locator('form-inplace-edit')
			await thirdEdit.locator('.text').dblclick()
			await expect(thirdEdit).toHaveAttribute('editing')
			await page.keyboard.press('Escape')
			await expect(thirdEdit).not.toHaveAttribute('editing')

			// Move the third item to first position via keyboard (2× ArrowUp)
			const reorderBtn = items.nth(2).locator('button.reorder')
			await reorderBtn.click()
			await page.keyboard.press('ArrowUp')
			await page.waitForTimeout(50)
			await page.keyboard.press('ArrowUp')
			await page.waitForTimeout(100)

			// Confirm the moved item is now first
			const firstEdit = items.nth(0).locator('form-inplace-edit')
			await expect(firstEdit.locator('.text')).toHaveText('task C')

			// dblclick should open the editor on the moved item too
			await firstEdit.locator('.text').dblclick()
			await expect(firstEdit).toHaveAttribute('editing')
		})

		test('B8: three items — all checkboxes wire up independently', async ({
			page,
		}) => {
			// Stress-tests that each() correctly wires N items as the list grows.
			const todo = page.locator('module-todo')
			const textboxInput = todo.locator('form-textbox input')
			const submitButton = todo.locator('.submit button')
			const items = todo.locator('li[data-key]')
			const count = todo.locator('basic-pluralize')

			for (const label of ['task A', 'task B', 'task C']) {
				await textboxInput.fill(label)
				await submitButton.click()
			}
			await expect(items).toHaveCount(3)
			await expect(count.locator('.count')).toHaveText('3')

			await items.nth(2).locator('form-checkbox label').click()
			await expect(count.locator('.count')).toHaveText('2')

			await items.nth(0).locator('form-checkbox label').click()
			await expect(count.locator('.count')).toHaveText('1')

			await items.nth(1).locator('form-checkbox label').click()
			await expect(count.locator('.none')).toBeVisible()
		})
	})
})
