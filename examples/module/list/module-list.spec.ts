import { expect, test } from '@playwright/test'

/**
 * Test Suite: module-list Component
 *
 * module-list is a passive list receiver: it accepts a `keys` signal injected
 * via pass() and reactively reconciles its DOM to match. User interactions
 * (delete, reorder) fire custom events; the coordinator mutates the data.
 */

test.describe('module-list component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})
		await page.goto('http://localhost:3000/test/module-list')
		await page.waitForSelector('module-list')
	})

	test.describe('Initial State', () => {
		test('renders with empty container initially', async ({ page }) => {
			const container = page.locator('module-list [data-container]')
			await expect(container.locator('li')).toHaveCount(0)
		})

		test('has template and live region', async ({ page }) => {
			await expect(page.locator('module-list template')).toBeAttached()
			await expect(page.locator('module-list [role="status"]')).toBeAttached()
		})
	})

	test.describe('Reactive rendering from keys signal', () => {
		test('renders items when keys are injected', async ({ page }) => {
			await page.evaluate(() => {
				const ml = document.querySelector('module-list') as any
				// Simulate coordinator injecting keys
				ml.keys = ['k1', 'k2', 'k3']
			})
			await expect(page.locator('module-list [data-container] li')).toHaveCount(
				3,
			)
		})

		test('each rendered li has correct data-key', async ({ page }) => {
			await page.evaluate(() => {
				const ml = document.querySelector('module-list') as any
				ml.keys = ['alpha', 'beta']
			})
			const items = page.locator('module-list [data-container] li')
			await expect(items.nth(0)).toHaveAttribute('data-key', 'alpha')
			await expect(items.nth(1)).toHaveAttribute('data-key', 'beta')
		})

		test('removes item when key is removed', async ({ page }) => {
			await page.evaluate(() => {
				const ml = document.querySelector('module-list') as any
				ml.keys = ['a', 'b', 'c']
			})
			await expect(page.locator('module-list [data-container] li')).toHaveCount(
				3,
			)
			await page.evaluate(() => {
				const ml = document.querySelector('module-list') as any
				ml.keys = ['a', 'c']
			})
			const items = page.locator('module-list [data-container] li')
			await expect(items).toHaveCount(2)
			await expect(items.nth(0)).toHaveAttribute('data-key', 'a')
			await expect(items.nth(1)).toHaveAttribute('data-key', 'c')
		})

		test('reorders DOM to match new key order', async ({ page }) => {
			await page.evaluate(() => {
				const ml = document.querySelector('module-list') as any
				ml.keys = ['x', 'y', 'z']
			})
			await page.evaluate(() => {
				const ml = document.querySelector('module-list') as any
				ml.keys = ['z', 'x', 'y']
			})
			const items = page.locator('module-list [data-container] li')
			await expect(items.nth(0)).toHaveAttribute('data-key', 'z')
			await expect(items.nth(1)).toHaveAttribute('data-key', 'x')
			await expect(items.nth(2)).toHaveAttribute('data-key', 'y')
		})
	})

	test.describe('Delete interaction', () => {
		test('fires item-delete event with key on delete button click', async ({
			page,
		}) => {
			await page.evaluate(() => {
				const ml = document.querySelector('module-list') as any
				ml.keys = ['del-me']
			})
			const eventDetail = page.evaluate(
				() =>
					new Promise<string>(resolve => {
						document
							.querySelector('module-list')!
							.addEventListener('item-delete', e =>
								resolve((e as CustomEvent).detail.key),
							)
					}),
			)
			const deleteBtn = page
				.locator(
					'module-list [data-container] li basic-button.remove button, module-list [data-container] li basic-button.delete button',
				)
				.first()
			await deleteBtn.click()
			expect(await eventDetail).toBe('del-me')
		})

		test('does not remove DOM element on delete click (coordinator drives removal)', async ({
			page,
		}) => {
			await page.evaluate(() => {
				const ml = document.querySelector('module-list') as any
				ml.keys = ['stays']
			})
			const deleteBtn = page
				.locator(
					'module-list [data-container] li basic-button.remove button, module-list [data-container] li basic-button.delete button',
				)
				.first()
			// Catch and suppress the event so coordinator doesn't act
			await page.evaluate(() => {
				document
					.querySelector('module-list')!
					.addEventListener('item-delete', e => e.stopPropagation())
			})
			await deleteBtn.click()
			// Item still in DOM — coordinator hasn't removed the key yet
			await expect(page.locator('module-list [data-container] li')).toHaveCount(
				1,
			)
		})
	})

	test.describe('Reorder button disabled state', () => {
		test('reorder button disabled with single item', async ({ page }) => {
			await page.evaluate(() => {
				const ml = document.querySelector('module-list') as any
				ml.keys = ['only']
			})
			await expect(
				page.locator('module-list [data-container] li button.reorder'),
			).toBeDisabled()
		})

		test('reorder buttons enabled with multiple items', async ({ page }) => {
			await page.evaluate(() => {
				const ml = document.querySelector('module-list') as any
				ml.keys = ['a', 'b']
			})
			const btns = page.locator(
				'module-list [data-container] li button.reorder',
			)
			await expect(btns.nth(0)).not.toBeDisabled()
			await expect(btns.nth(1)).not.toBeDisabled()
		})
	})
})
