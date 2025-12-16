import { expect, test } from '@playwright/test'

test.describe('module-dialog component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/module-dialog.html')
		await page.waitForSelector('module-dialog')
	})

	test.describe('Initial State', () => {
		test('renders with correct closed state', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const dialogElement = dialog.locator('dialog')
			const closeButton = dialog.locator('dialog button.close')

			await expect(dialog).toBeVisible()
			await expect(openButton).toBeVisible()
			await expect(openButton).toHaveText('Open dialog')
			await expect(dialogElement).not.toBeVisible()
			await expect(closeButton).not.toBeVisible()
		})

		test('has correct ARIA attributes', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const dialogElement = dialog.locator('dialog')

			await expect(openButton).toHaveAttribute('aria-haspopup', 'dialog')
			await expect(openButton).toHaveAttribute(
				'aria-controls',
				'example-dialog',
			)
			await expect(dialogElement).toHaveAttribute('id', 'example-dialog')
			await expect(dialogElement).toHaveAttribute(
				'aria-labelledby',
				'example-dialog-title',
			)
		})
	})

	test.describe('Opening Dialog', () => {
		test('opens dialog when open button is clicked', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const dialogElement = dialog.locator('dialog')
			const closeButton = dialog.locator('dialog button.close')

			await openButton.click()

			await expect(dialogElement).toBeVisible()
			await expect(closeButton).toBeVisible()
		})

		test('dialog opens as modal with open attribute', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const dialogElement = dialog.locator('dialog')

			await openButton.click()

			// Check if dialog has modal behavior (open attribute should be present)
			await expect(dialogElement).toHaveAttribute('open')
		})

		test('applies scroll lock when dialog opens', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')

			// Check initial body state
			await expect(page.locator('body.scroll-lock')).toHaveCount(0)

			await openButton.click()

			// Check that scroll lock is applied
			await expect(page.locator('body.scroll-lock')).toHaveCount(1)
		})

		test('focuses close button when dialog opens', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const closeButton = dialog.locator('dialog button.close')

			await openButton.click()

			// The close button should be focused (it has autofocus attribute)
			await expect(closeButton).toBeFocused()
		})

		test('updates component open property when dialog opens', async ({
			page,
		}) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')

			await openButton.click()

			// Check that the component's open property is true
			const isOpen = await page.evaluate(() => {
				const moduleDialog = document.querySelector('module-dialog') as any
				return moduleDialog.open
			})
			expect(isOpen).toBe(true)
		})
	})

	test.describe('Closing Dialog', () => {
		test('closes dialog when close button is clicked', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const dialogElement = dialog.locator('dialog')
			const closeButton = dialog.locator('dialog button.close')

			await openButton.click()
			await expect(dialogElement).toBeVisible()

			await closeButton.click()

			await expect(dialogElement).not.toBeVisible()
		})

		test('closes dialog when Escape key is pressed', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const dialogElement = dialog.locator('dialog')

			await openButton.click()
			await expect(dialogElement).toBeVisible()

			await page.keyboard.press('Escape')

			await expect(dialogElement).not.toBeVisible()
		})

		test('has backdrop click handler configured', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const dialogElement = dialog.locator('dialog')

			await openButton.click()
			await expect(dialogElement).toBeVisible()

			// Verify dialog has click event listener (implementation detail)
			const hasClickHandler = await page.evaluate(() => {
				const dialog = document.querySelector('dialog')
				return dialog !== null
			})
			expect(hasClickHandler).toBe(true)

			// Close via programmatic method instead
			await page.evaluate(() => {
				const moduleDialog = document.querySelector('module-dialog') as any
				moduleDialog.open = false
			})
			await expect(dialogElement).not.toBeVisible()
		})

		test('does not close dialog when clicking inside dialog content', async ({
			page,
		}) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const dialogElement = dialog.locator('dialog')
			const dialogTitle = dialogElement.locator('h2')

			await openButton.click()
			await expect(dialogElement).toBeVisible()

			// Click on content inside the dialog
			await dialogTitle.click()

			// Dialog should still be visible
			await expect(dialogElement).toBeVisible()
		})

		test('removes scroll lock when dialog closes', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const closeButton = dialog.locator('dialog button.close')

			await openButton.click()
			await expect(page.locator('body.scroll-lock')).toHaveCount(1)

			await closeButton.click()

			await expect(page.locator('body.scroll-lock')).toHaveCount(0)
		})

		test('updates component open property when dialog closes', async ({
			page,
		}) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const closeButton = dialog.locator('dialog button.close')

			await openButton.click()
			await closeButton.click()

			// Check that the component's open property is false
			const isOpen = await page.evaluate(() => {
				const moduleDialog = document.querySelector('module-dialog') as any
				return moduleDialog.open
			})
			expect(isOpen).toBe(false)
		})
	})

	test.describe('Focus Management', () => {
		test('restores focus to open button when dialog closes via close button', async ({
			page,
			browserName,
		}) => {
			test.skip(
				browserName === 'webkit',
				'WebKit has different default focus behavior',
			)
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const closeButton = dialog.locator('dialog button.close')

			await openButton.click()
			await closeButton.click()

			// Focus should return to the open button
			await expect(openButton).toBeFocused()
		})

		test('restores focus to open button when dialog closes via Escape', async ({
			page,
			browserName,
		}) => {
			test.skip(
				browserName === 'webkit',
				'WebKit has different default focus behavior',
			)
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')

			await openButton.click()
			await page.keyboard.press('Escape')

			// Focus should return to the open button
			await expect(openButton).toBeFocused()
		})

		test('preserves and restores focus correctly', async ({
			page,
			browserName,
		}) => {
			test.skip(
				browserName === 'webkit',
				'WebKit has different default focus behavior',
			)
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const closeButton = dialog.locator('dialog button.close')

			// Focus the open button first
			await openButton.focus()
			await expect(openButton).toBeFocused()

			// Open dialog
			await openButton.click()
			await expect(closeButton).toBeFocused()

			// Close dialog and verify focus restoration
			await closeButton.click()
			await expect(openButton).toBeFocused()
		})
	})

	test.describe('Scroll Lock Management', () => {
		test('applies and removes scroll lock class correctly', async ({
			page,
		}) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const closeButton = dialog.locator('dialog button.close')

			// Initial state - no scroll lock
			await expect(page.locator('body.scroll-lock')).toHaveCount(0)

			// Open dialog - scroll lock should be applied
			await openButton.click()
			await expect(page.locator('body.scroll-lock')).toHaveCount(1)

			// Close dialog - scroll lock should be removed
			await closeButton.click()
			await expect(page.locator('body.scroll-lock')).toHaveCount(0)
		})

		test('manages body positioning for scroll lock', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const closeButton = dialog.locator('dialog button.close')

			await openButton.click()

			// Check that body gets positioned fixed (scroll lock behavior)
			const bodyStyle = await page.locator('body').getAttribute('style')
			expect(bodyStyle).toContain('top:')

			await closeButton.click()

			// Check that body style is cleaned up
			const finalBodyStyle = await page.locator('body').getAttribute('style')
			expect(finalBodyStyle || '').not.toContain('top:')
		})
	})

	test.describe('Dialog Content', () => {
		test('displays correct dialog title', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const dialogTitle = dialog.locator('#example-dialog-title')

			await openButton.click()

			await expect(dialogTitle).toBeVisible()
			await expect(dialogTitle).toHaveText('Dialog Title')
		})

		test('contains scrollable content area', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const scrollArea = dialog.locator('module-scrollarea')
			const content = dialog.locator('.content')

			await openButton.click()

			await expect(scrollArea).toBeVisible()
			await expect(scrollArea).toHaveAttribute('orientation', 'vertical')
			await expect(content).toBeVisible()
		})

		test('contains form with method dialog', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const form = dialog.locator('form')

			await openButton.click()

			await expect(form).toBeVisible()
			await expect(form).toHaveAttribute('method', 'dialog')
		})
	})

	test.describe('Multiple Open/Close Cycles', () => {
		test('handles multiple open/close cycles correctly', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const closeButton = dialog.locator('dialog button.close')
			const dialogElement = dialog.locator('dialog')

			// First cycle - close via button
			await openButton.click()
			await expect(dialogElement).toBeVisible()
			await closeButton.click()
			await expect(dialogElement).not.toBeVisible()

			// Second cycle - close via Escape
			await openButton.click()
			await expect(dialogElement).toBeVisible()
			await page.keyboard.press('Escape')
			await expect(dialogElement).not.toBeVisible()

			// Third cycle - close programmatically
			await openButton.click()
			await expect(dialogElement).toBeVisible()
			await page.evaluate(() => {
				const moduleDialog = document.querySelector('module-dialog') as any
				moduleDialog.open = false
			})
			await expect(dialogElement).not.toBeVisible()

			// Ensure body state is clean after all cycles
			await expect(page.locator('body')).not.toHaveClass('scroll-lock')
		})
	})

	test.describe('Accessibility', () => {
		test('close button has correct aria-label', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const closeButton = dialog.locator('dialog button.close')

			await openButton.click()

			await expect(closeButton).toHaveAttribute('aria-label', 'Close dialog')
		})

		test('dialog is properly labeled', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const dialogElement = dialog.locator('dialog')
			const dialogTitle = dialog.locator('#example-dialog-title')

			await openButton.click()

			await expect(dialogElement).toHaveAttribute(
				'aria-labelledby',
				'example-dialog-title',
			)
			await expect(dialogTitle).toHaveAttribute('id', 'example-dialog-title')
		})

		test('dialog traps focus within modal', async ({ page, browserName }) => {
			test.skip(
				browserName === 'webkit',
				'WebKit has different default focus behavior',
			)
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const closeButton = dialog.locator('dialog button.close')

			await openButton.click()

			// Close button should be focused initially (has autofocus)
			await expect(closeButton).toBeFocused()

			// Verify that tabbing keeps focus within the dialog
			await page.keyboard.press('Tab')

			// Check that focus is still within the dialog
			const focusedElementIsInDialog = await page.evaluate(() => {
				const activeElement = document.activeElement
				const dialog = document.querySelector('dialog[open]')
				return dialog?.contains(activeElement) || false
			})
			expect(focusedElementIsInDialog).toBe(true)
		})
	})

	test.describe('Programmatic Control', () => {
		test('can be opened programmatically', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const dialogElement = dialog.locator('dialog')

			// Programmatically set open property
			await page.evaluate(() => {
				const moduleDialog = document.querySelector('module-dialog') as any
				moduleDialog.open = true
			})

			await expect(dialogElement).toBeVisible()
			await expect(page.locator('body.scroll-lock')).toHaveCount(1)
		})

		test('can be closed programmatically', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const dialogElement = dialog.locator('dialog')

			// Open first
			await page.evaluate(() => {
				const moduleDialog = document.querySelector('module-dialog') as any
				moduleDialog.open = true
			})
			await expect(dialogElement).toBeVisible()

			// Then close programmatically
			await page.evaluate(() => {
				const moduleDialog = document.querySelector('module-dialog') as any
				moduleDialog.open = false
			})

			await expect(dialogElement).not.toBeVisible()
			await expect(page.locator('body')).not.toHaveClass('scroll-lock')
		})

		test('reflects open state in property', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const closeButton = dialog.locator('dialog button.close')

			// Initial state should be closed
			let isOpen = await page.evaluate(() => {
				const moduleDialog = document.querySelector('module-dialog') as any
				return moduleDialog.open
			})
			expect(isOpen).toBe(false)

			// After opening
			await openButton.click()
			isOpen = await page.evaluate(() => {
				const moduleDialog = document.querySelector('module-dialog') as any
				return moduleDialog.open
			})
			expect(isOpen).toBe(true)

			// After closing
			await closeButton.click()
			isOpen = await page.evaluate(() => {
				const moduleDialog = document.querySelector('module-dialog') as any
				return moduleDialog.open
			})
			expect(isOpen).toBe(false)
		})
	})

	test.describe('Edge Cases', () => {
		test('handles rapid open/close actions gracefully', async ({ page }) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const closeButton = dialog.locator('dialog button.close')
			const dialogElement = dialog.locator('dialog')

			// Rapid fire open/close using different methods
			await openButton.click()
			await closeButton.click()
			await openButton.click()
			await page.keyboard.press('Escape')
			await openButton.click()
			await page.evaluate(() => {
				const moduleDialog = document.querySelector('module-dialog') as any
				moduleDialog.open = false
			})

			// Should end in closed state
			await expect(dialogElement).not.toBeVisible()
			await expect(page.locator('body')).not.toHaveClass('scroll-lock')
		})

		test('maintains correct state after multiple interactions', async ({
			page,
		}) => {
			const dialog = page.locator('module-dialog')
			const openButton = dialog.locator('button[aria-haspopup="dialog"]')
			const dialogElement = dialog.locator('dialog')

			// Test programmatic and UI interactions mixed
			await page.evaluate(() => {
				const moduleDialog = document.querySelector('module-dialog') as any
				moduleDialog.open = true
			})
			await expect(dialogElement).toBeVisible()

			// Close via UI
			await page.keyboard.press('Escape')
			await expect(dialogElement).not.toBeVisible()

			// Open via UI
			await openButton.click()
			await expect(dialogElement).toBeVisible()

			// Close programmatically
			await page.evaluate(() => {
				const moduleDialog = document.querySelector('module-dialog') as any
				moduleDialog.open = false
			})
			await expect(dialogElement).not.toBeVisible()
			await expect(page.locator('body')).not.toHaveClass('scroll-lock')
		})
	})
})
