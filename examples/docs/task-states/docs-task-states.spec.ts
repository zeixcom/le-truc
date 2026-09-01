import { expect, test } from '@playwright/test'

/**
 * Test Suite: docs-task-states Component
 *
 * Teaching component for the Async State guide section. Verifies that one
 * unseeded Task routes through all four match() branches as the fetch,
 * refetch, and failure controls are used.
 */

test.describe('docs-task-states', () => {
	test('first fetch routes nil, then ok with the resolved value', async ({ page }) => {
		await page.goto('http://localhost:3000/test/docs-task-states')
		await expect(page.locator('.states')).toHaveAttribute('data-state', 'nil', {
			timeout: 2000,
		})
		await expect(page.locator('ol.log li').first()).toContainText('nil —')

		await expect(page.locator('.states')).toHaveAttribute('data-state', 'ok', {
			timeout: 4000,
		})
		await expect(page.locator('output.value')).toContainText('2.5.0')
		await expect(page.locator('button.fetch')).toHaveText('Refetch')
	})

	test('refetch keeps the retained value visible under stale', async ({ page }) => {
		await page.goto('http://localhost:3000/test/docs-task-states')
		await expect(page.locator('.states')).toHaveAttribute('data-state', 'ok', {
			timeout: 6000,
		})

		await page.click('button.fetch')
		await expect(page.locator('.states')).toHaveAttribute('data-state', 'stale', {
			timeout: 1000,
		})
		await expect(page.locator('output.value')).toContainText('2.5.0')
		await expect(page.locator('ol.log li', { hasText: 'stale —' }).first()).toContainText(
			'keeping 2.5.0',
		)

		await expect(page.locator('.states')).toHaveAttribute('data-state', 'ok', {
			timeout: 4000,
		})
		await expect(page.locator('output.value')).toContainText('2.5.1')
	})

	test('failing refetch routes err, and recovery routes ok again', async ({ page }) => {
		await page.goto('http://localhost:3000/test/docs-task-states')
		await expect(page.locator('.states')).toHaveAttribute('data-state', 'ok', {
			timeout: 6000,
		})

		await page.locator('form-checkbox:has(input.fail) label').click()
		await page.click('button.fetch')
		await expect(page.locator('.states')).toHaveAttribute('data-state', 'err', {
			timeout: 4000,
		})
		await expect(page.locator('p.error')).toBeVisible()
		await expect(page.locator('p.error')).toContainText('Network unavailable')
		await expect(
			page.locator('ol.log li', { hasText: 'err —' }),
		).toHaveCount(1)

		await page.locator('form-checkbox:has(input.fail) label').click()
		await page.click('button.fetch')
		await expect(page.locator('.states')).toHaveAttribute('data-state', 'ok', {
			timeout: 6000,
		})
		await expect(page.locator('output.value')).toContainText('2.5.2')
		await expect(page.locator('p.error')).toBeHidden()
	})
})
