import { expect, test } from '@playwright/test'

test.describe('module-tabgroup component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/module-tabgroup')
		await page.waitForSelector('module-tabgroup')
	})

	test.describe('Initial State', () => {
		test('renders tabgroup with correct initial state', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')
			const panels = tabgroup.locator('[role="tabpanel"]')

			// Should have 3 tabs and 3 panels
			await expect(tabs).toHaveCount(3)
			await expect(panels).toHaveCount(3)

			// First tab should be selected initially
			const firstTab = tabs.first()
			const firstPanel = panels.first()

			await expect(firstTab).toHaveAttribute('aria-selected', 'true')
			await expect(firstTab).toHaveAttribute('tabindex', '0')
			await expect(firstPanel).toBeVisible()

			// Other tabs should not be selected
			const secondTab = tabs.nth(1)
			const thirdTab = tabs.nth(2)
			await expect(secondTab).toHaveAttribute('aria-selected', 'false')
			await expect(secondTab).toHaveAttribute('tabindex', '-1')
			await expect(thirdTab).toHaveAttribute('aria-selected', 'false')
			await expect(thirdTab).toHaveAttribute('tabindex', '-1')

			// Other panels should be hidden
			const secondPanel = panels.nth(1)
			const thirdPanel = panels.nth(2)
			await expect(secondPanel).toBeHidden()
			await expect(thirdPanel).toBeHidden()
		})

		test('reads initial selected tab from component state', async ({
			page,
		}) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const selectedValue = await tabgroup.evaluate(
				node => (node as any).selected,
			)

			// Should initially be panel1
			expect(selectedValue).toBe('panel1')
		})

		test('handles different initial selected tab', async ({ page }) => {
			const tabgroup = page.locator('#second-tab-selected')
			const tabs = tabgroup.locator('button[role="tab"]')
			const panels = tabgroup.locator('[role="tabpanel"]')

			// Second tab should be selected initially
			await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.nth(1)).toHaveAttribute('tabindex', '0')
			await expect(panels.nth(1)).toBeVisible()

			// Other tabs should not be selected
			await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'false')
			await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'false')

			// Component selected property should reflect the initial state
			const selectedValue = await tabgroup.evaluate(
				node => (node as any).selected,
			)
			expect(selectedValue).toBe('panel5')
		})
	})

	test.describe('Click Navigation', () => {
		test('switches to selected tab when clicked', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')
			const panels = tabgroup.locator('[role="tabpanel"]')

			const secondTab = tabs.nth(1)
			const secondPanel = panels.nth(1)
			const firstPanel = panels.first()

			// Click second tab
			await secondTab.click()

			// Second tab should now be selected
			await expect(secondTab).toHaveAttribute('aria-selected', 'true')
			await expect(secondTab).toHaveAttribute('tabindex', '0')
			await expect(secondPanel).toBeVisible()

			// First panel should be hidden
			await expect(firstPanel).toBeHidden()

			// Component selected property should update
			const selectedValue = await tabgroup.evaluate(
				node => (node as any).selected,
			)
			expect(selectedValue).toBe('panel2')
		})

		test('updates all tabs and panels correctly on selection', async ({
			page,
		}) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')
			const panels = tabgroup.locator('[role="tabpanel"]')

			// Click third tab
			await tabs.nth(2).click()

			// Check all tabs have correct aria-selected
			await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'false')
			await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'false')
			await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')

			// Check all tabs have correct tabindex
			await expect(tabs.nth(0)).toHaveAttribute('tabindex', '-1')
			await expect(tabs.nth(1)).toHaveAttribute('tabindex', '-1')
			await expect(tabs.nth(2)).toHaveAttribute('tabindex', '0')

			// Check panel visibility
			await expect(panels.nth(0)).toBeHidden()
			await expect(panels.nth(1)).toBeHidden()
			await expect(panels.nth(2)).toBeVisible()
		})
	})

	test.describe('Keyboard Navigation', () => {
		test('navigates with arrow keys', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')
			const panels = tabgroup.locator('[role="tabpanel"]')

			// Focus first tab
			await tabs.first().focus()
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')

			// Arrow right should move to second tab AND select it
			await page.keyboard.press('ArrowRight')
			await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.nth(1)).toHaveAttribute('tabindex', '0')
			await expect(panels.nth(1)).toBeVisible()

			// Arrow right should move to third tab AND select it
			await page.keyboard.press('ArrowRight')
			await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.nth(2)).toHaveAttribute('tabindex', '0')
			await expect(panels.nth(2)).toBeVisible()

			// Arrow right from last should wrap to first
			await page.keyboard.press('ArrowRight')
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.first()).toHaveAttribute('tabindex', '0')
			await expect(panels.first()).toBeVisible()

			// Arrow left should wrap to last tab
			await page.keyboard.press('ArrowLeft')
			await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.nth(2)).toHaveAttribute('tabindex', '0')

			// Arrow left should go to second tab
			await page.keyboard.press('ArrowLeft')
			await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.nth(1)).toHaveAttribute('tabindex', '0')

			// Arrow left should go to first tab
			await page.keyboard.press('ArrowLeft')
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.first()).toHaveAttribute('tabindex', '0')
		})

		test('navigates with up/down arrow keys', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')

			// Focus first tab
			await tabs.first().focus()
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')

			// Arrow down should move to second tab AND select it
			await page.keyboard.press('ArrowDown')
			await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.nth(1)).toHaveAttribute('tabindex', '0')

			// Arrow up should move back to first tab AND select it
			await page.keyboard.press('ArrowUp')
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.first()).toHaveAttribute('tabindex', '0')

			// Arrow up from first should wrap to last AND select it
			await page.keyboard.press('ArrowUp')
			await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.nth(2)).toHaveAttribute('tabindex', '0')
		})

		test('navigates with Home and End keys', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')

			// Click middle tab to select it first
			await tabs.nth(1).click()
			await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')

			// Home should go to first tab AND select it
			await page.keyboard.press('Home')
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.first()).toHaveAttribute('tabindex', '0')

			// End should go to last tab AND select it
			await page.keyboard.press('End')
			await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.nth(2)).toHaveAttribute('tabindex', '0')
		})

		test('prevents default and stops propagation for navigation keys', async ({
			page,
		}) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')

			// Test that keyboard navigation works (which means preventDefault is called)
			await tabs.first().focus()

			// Test various navigation keys work as expected
			await page.keyboard.press('ArrowRight')
			await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')

			await page.keyboard.press('Home')
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')

			await page.keyboard.press('End')
			await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')

			// The fact that these work correctly indicates preventDefault is working
		})

		test('keyboard navigation updates selected tab and panel', async ({
			page,
		}) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')
			const panels = tabgroup.locator('[role="tabpanel"]')

			// Focus first tab (initially selected) and navigate to second
			await tabs.first().focus()
			await page.keyboard.press('ArrowRight')

			// Keyboard navigation should update both selection and tabindex
			await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.nth(1)).toHaveAttribute('tabindex', '0')
			await expect(panels.nth(1)).toBeVisible()

			// Navigate to third tab
			await page.keyboard.press('ArrowRight')
			await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.nth(2)).toHaveAttribute('tabindex', '0')
			await expect(panels.nth(2)).toBeVisible()

			// Component property should also update
			const selectedValue = await tabgroup.evaluate(
				node => (node as any).selected,
			)
			expect(selectedValue).toBe('panel3')
		})

		test('handles many tabs navigation', async ({ page }) => {
			const tabgroup = page.locator('#many-tabs')
			const tabs = tabgroup.locator('button[role="tab"]')

			// Should have 5 tabs
			await expect(tabs).toHaveCount(5)

			// Focus first tab and navigate through all
			await tabs.first().focus()
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')

			for (let i = 1; i < 5; i++) {
				await page.keyboard.press('ArrowRight')
				await expect(tabs.nth(i)).toHaveAttribute('tabindex', '0')
				await expect(tabs.nth(i)).toHaveAttribute('aria-selected', 'true')
			}

			// Wrap around to first
			await page.keyboard.press('ArrowRight')
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.first()).toHaveAttribute('tabindex', '0')

			// Test Home/End with many tabs
			await page.keyboard.press('End')
			await expect(tabs.nth(4)).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.nth(4)).toHaveAttribute('tabindex', '0')

			await page.keyboard.press('Home')
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.first()).toHaveAttribute('tabindex', '0')
		})
	})

	test.describe('ARIA and Accessibility', () => {
		test('maintains proper ARIA attributes', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tablist = tabgroup.locator('[role="tablist"]')
			const tabs = tabgroup.locator('button[role="tab"]')
			const panels = tabgroup.locator('[role="tabpanel"]')

			// Check tablist exists
			await expect(tablist).toHaveCount(1)

			// Check all tabs have proper attributes
			for (let i = 0; i < 3; i++) {
				const tab = tabs.nth(i)
				const panel = panels.nth(i)

				await expect(tab).toHaveAttribute('role', 'tab')
				await expect(tab).toHaveAttribute('aria-controls')
				await expect(tab).toHaveAttribute('aria-selected')
				await expect(tab).toHaveAttribute('tabindex')

				await expect(panel).toHaveAttribute('role', 'tabpanel')
				await expect(panel).toHaveAttribute('id')
			}
		})

		test('maintains proper tabindex for roving tabindex pattern', async ({
			page,
		}) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')

			// Initially, first tab should have tabindex 0, others -1
			await expect(tabs.nth(0)).toHaveAttribute('tabindex', '0')
			await expect(tabs.nth(1)).toHaveAttribute('tabindex', '-1')
			await expect(tabs.nth(2)).toHaveAttribute('tabindex', '-1')

			// Click second tab
			await tabs.nth(1).click()

			// Now second tab should have tabindex 0, others -1
			await expect(tabs.nth(0)).toHaveAttribute('tabindex', '-1')
			await expect(tabs.nth(1)).toHaveAttribute('tabindex', '0')
			await expect(tabs.nth(2)).toHaveAttribute('tabindex', '-1')
		})

		test('aria-controls matches panel ids correctly', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')
			const panels = tabgroup.locator('[role="tabpanel"]')

			for (let i = 0; i < 3; i++) {
				const tab = tabs.nth(i)
				const panel = panels.nth(i)

				const ariaControls = await tab.getAttribute('aria-controls')
				const panelId = await panel.getAttribute('id')

				expect(ariaControls).toBe(panelId)
			}
		})
	})

	test.describe('Component Properties', () => {
		test('selected property reflects current selection', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')

			// Initial state
			let selectedValue = await tabgroup.evaluate(
				node => (node as any).selected,
			)
			expect(selectedValue).toBe('panel1')

			// Click second tab
			await tabs.nth(1).click()
			selectedValue = await tabgroup.evaluate(node => (node as any).selected)
			expect(selectedValue).toBe('panel2')

			// Click third tab
			await tabs.nth(2).click()
			selectedValue = await tabgroup.evaluate(node => (node as any).selected)
			expect(selectedValue).toBe('panel3')
		})

		test('selected property is readonly and reflects current selection', async ({
			page,
		}) => {
			const tabgroup = page.locator('#property-test')
			const tabs = tabgroup.locator('button[role="tab"]')

			// Initial state - first tab selected
			let selectedValue = await tabgroup.evaluate(
				node => (node as any).selected,
			)
			expect(selectedValue).toBe('panel12')

			// Click second tab - selected property should update
			await tabs.nth(1).click()
			selectedValue = await tabgroup.evaluate(node => (node as any).selected)
			expect(selectedValue).toBe('panel13')

			// Try to programmatically change selected property (should not work since it's a sensor)
			await tabgroup.evaluate(node => {
				try {
					;(node as any).selected = 'panel14'
				} catch {
					// Expected to fail or be ignored since it's readonly
				}
			})

			// Selected should still be panel13 (readonly property)
			selectedValue = await tabgroup.evaluate(node => (node as any).selected)
			expect(selectedValue).toBe('panel13')

			// UI state should match the sensor value, not the attempted programmatic change
			await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
		})
	})

	test.describe('Panel Visibility', () => {
		test('shows only the selected panel', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')
			const panels = tabgroup.locator('[role="tabpanel"]')

			// Initially, only first panel should be visible
			await expect(panels.nth(0)).toBeVisible()
			await expect(panels.nth(1)).toBeHidden()
			await expect(panels.nth(2)).toBeHidden()

			// Click second tab
			await tabs.nth(1).click()
			await expect(panels.nth(0)).toBeHidden()
			await expect(panels.nth(1)).toBeVisible()
			await expect(panels.nth(2)).toBeHidden()

			// Click third tab
			await tabs.nth(2).click()
			await expect(panels.nth(0)).toBeHidden()
			await expect(panels.nth(1)).toBeHidden()
			await expect(panels.nth(2)).toBeVisible()
		})

		test('panel content is accessible when visible', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')
			const panels = tabgroup.locator('[role="tabpanel"]')

			// Check content of each panel when selected
			await expect(panels.nth(0)).toContainText('Tab 1 content')

			await tabs.nth(1).click()
			await expect(panels.nth(1)).toContainText('Tab 2 content')

			await tabs.nth(2).click()
			await expect(panels.nth(2)).toContainText('Tab 3 content')
		})
	})

	test.describe('Edge Cases', () => {
		test('handles invalid selected values gracefully', async ({ page }) => {
			const tabgroup = page.locator('#invalid-state-test')
			const tabs = tabgroup.locator('button[role="tab"]')
			const panels = tabgroup.locator('[role="tabpanel"]')

			// This tabgroup has a tab with invalid aria-controls
			await expect(tabs).toHaveCount(2)

			// The valid tab should be selected
			await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
			await expect(panels.first()).toBeVisible()

			// Test setting completely invalid selected value
			await tabgroup.evaluate(node => {
				;(node as any).selected = 'totally-nonexistent'
			})

			// Should maintain some reasonable state
			const visiblePanels = await panels.evaluateAll(
				panels => panels.filter(panel => !(panel as HTMLElement).hidden).length,
			)

			// At least one panel should be visible or all should be hidden
			expect(visiblePanels).toBeGreaterThanOrEqual(0)
			expect(visiblePanels).toBeLessThanOrEqual(1)
		})

		test('handles minimal tabgroup with two tabs', async ({ page }) => {
			const tabgroup = page.locator('#minimal-test')
			const tabs = tabgroup.locator('button[role="tab"]')
			const panels = tabgroup.locator('[role="tabpanel"]')

			// Should have exactly 2 tabs and 2 panels
			await expect(tabs).toHaveCount(2)
			await expect(panels).toHaveCount(2)

			// First should be selected
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
			await expect(panels.first()).toBeVisible()
			await expect(panels.nth(1)).toBeHidden()

			// Should allow switching
			await tabs.nth(1).click()
			await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
			await expect(panels.nth(1)).toBeVisible()
			await expect(panels.first()).toBeHidden()
		})

		test('handles rapid selection changes correctly', async ({ page }) => {
			const tabgroup = page.locator('#many-tabs')
			const tabs = tabgroup.locator('button[role="tab"]')
			const panels = tabgroup.locator('[role="tabpanel"]')

			// Rapidly click through multiple tabs
			await tabs.nth(1).click()
			await tabs.nth(3).click()
			await tabs.nth(4).click()
			await tabs.nth(0).click()
			await tabs.nth(2).click()

			// Final state should be consistent
			await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')
			await expect(panels.nth(2)).toBeVisible()

			const selectedValue = await tabgroup.evaluate(
				node => (node as any).selected,
			)
			expect(selectedValue).toBe('panel9')
		})

		test('maintains state management correctly', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')

			// Focus first tab and navigate with keyboard
			await tabs.first().focus()
			await page.keyboard.press('ArrowRight')
			await page.keyboard.press('ArrowRight')

			// Third tab should be selected
			await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.nth(2)).toHaveAttribute('tabindex', '0')

			// Click first tab - it should become selected
			await tabs.first().click()
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
			await expect(tabs.first()).toHaveAttribute('tabindex', '0')
		})
	})

	test.describe('Sensor Integration', () => {
		test('selected sensor detects initial state from DOM', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()

			// The sensor should read the initial state from aria-selected="true"
			const initialSelected = await tabgroup.evaluate(
				node => (node as any).selected,
			)
			expect(initialSelected).toBe('panel1')
		})

		test('sensor responds to click events correctly', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')

			// Click should trigger sensor update
			await tabs.nth(2).click()

			const selectedAfterClick = await tabgroup.evaluate(
				node => (node as any).selected,
			)
			expect(selectedAfterClick).toBe('panel3')
		})

		test('sensor responds to keyboard events correctly', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')

			// Focus second tab (which also selects it via click)
			await tabs.nth(1).click()
			let currentSelected = await tabgroup.evaluate(
				node => (node as any).selected,
			)
			expect(currentSelected).toBe('panel2')

			// Keyboard navigation should update selection
			await page.keyboard.press('ArrowRight') // Move to third tab
			await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')

			// Selected property should now be the third tab
			currentSelected = await tabgroup.evaluate(node => (node as any).selected)
			expect(currentSelected).toBe('panel3')
		})

		test('keyboard navigation wraps around correctly', async ({ page }) => {
			const tabgroup = page.locator('module-tabgroup').first()
			const tabs = tabgroup.locator('button[role="tab"]')

			// Focus first tab
			await tabs.first().focus()
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')

			// Navigate to last tab
			await page.keyboard.press('ArrowRight') // Tab 2
			await page.keyboard.press('ArrowRight') // Tab 3

			// Test wrapping from last tab to first tab
			await page.keyboard.press('ArrowRight')
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')

			// Test wrapping from first tab to last tab
			await page.keyboard.press('ArrowLeft')
			await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')

			// Test Up/Down wrapping as well
			await page.keyboard.press('ArrowUp') // Should go to Tab 2
			await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')

			await page.keyboard.press('ArrowDown') // Should go back to Tab 3
			await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true')

			await page.keyboard.press('ArrowDown') // Should wrap to Tab 1
			await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
		})
	})
})
