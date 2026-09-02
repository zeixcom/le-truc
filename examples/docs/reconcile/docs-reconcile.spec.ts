import { expect, test } from '@playwright/test'

/**
 * Test Suite: docs-reconcile Component
 *
 * Teaching component for the Dynamic Lists docs page. Verifies keyed
 * reconciliation: rows are adopted, reused across reorders, and newly
 * created keys are stamped in creation order.
 */

test.describe('docs-reconcile', () => {
	test('adopts the server-rendered rows in key order', async ({ page }) => {
		await page.goto('http://localhost:3000/test/docs-reconcile')
		const keys = page.locator('[data-container] .label')
		await expect(keys).toHaveCount(4)
		await expect(keys.nth(0)).toHaveText('Adelboden')
		await expect(keys.nth(3)).toHaveText('Davos')
	})

	test('checkbox state survives a reverse — rows move, they are not recreated', async ({
		page,
	}) => {
		await page.goto('http://localhost:3000/test/docs-reconcile')
		await page.locator('li[data-key="Basel"] form-checkbox label').click()
		await page.click('[data-reverse]')
		const keys = page.locator('[data-container] .label')
		await expect(keys.nth(2)).toHaveText('Basel')
		await expect(page.locator('li[data-key="Basel"] input')).toBeChecked()
	})

	test('adding and removing keys stamps and unstamps rows', async ({ page }) => {
		await page.goto('http://localhost:3000/test/docs-reconcile')
		await page.click('[data-add]')
		await expect(page.locator('[data-container] .label').nth(4)).toHaveText(
			'Engelberg',
		)
		await page.click('[data-remove]')
		await expect(page.locator('[data-container] li')).toHaveCount(4)
	})
})
