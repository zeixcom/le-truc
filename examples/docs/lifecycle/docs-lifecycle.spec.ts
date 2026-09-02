import { expect, test } from '@playwright/test'

/**
 * Test Suite: docs-lifecycle Component
 *
 * Teaching component for the Component Lifecycle docs section. Verifies
 * that connecting and disconnecting a `docs-pulse` instance produces the
 * expected observable lifecycle log.
 */

test.describe('docs-lifecycle', () => {
	test('starts with the server-rendered instance alive', async ({ page }) => {
		await page.goto('http://localhost:3000/test/docs-lifecycle')
		await expect(page.locator('docs-pulse')).toHaveCount(1)
		await expect(page.locator('ol.log li')).toContainText('upgraded in place')
		await expect(page.locator('button.connect')).toBeDisabled()
		await expect(page.locator('button.disconnect')).toBeEnabled()
	})

	test('disconnect removes the instance and logs the cleanup', async ({ page }) => {
		await page.goto('http://localhost:3000/test/docs-lifecycle')
		await page.click('button.disconnect')
		await expect(page.locator('docs-pulse')).toHaveCount(0)
		await expect(page.locator('ol.log li').first()).toContainText(
			'pulse.remove()',
		)
		await expect(
			page.locator('ol.log li', { hasText: 'cleanup() ran' }),
		).toHaveCount(1)
	})

	test('reconnect creates a fresh instance with a new number', async ({ page }) => {
		await page.goto('http://localhost:3000/test/docs-lifecycle')
		await page.click('button.disconnect')
		await page.click('button.connect')
		await expect(page.locator('docs-pulse')).toHaveCount(1)
		await expect(page.locator('docs-pulse .instance')).toHaveText('#2')
		await expect(
			page.locator('ol.log li', { hasText: 'factory() ran — instance #2' }),
		).toHaveCount(1)
	})
})
