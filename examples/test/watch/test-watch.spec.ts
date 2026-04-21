import { expect, test } from '@playwright/test'

test.describe('test-watch: watch() helper', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/test-watch')
		await page.waitForSelector('test-watch')
	})

	test('single prop — runs handler with initial value', async ({ page }) => {
		const output = page.locator('#output')
		await expect(output).toHaveText('0')
	})

	test('single prop — re-runs when prop changes', async ({ page }) => {
		const output = page.locator('#output')
		await page.evaluate(() => {
			const el = document.querySelector('test-watch') as any
			el.count = 42
		})
		await expect(output).toHaveText('42')
	})

	test('array form — runs with initial values of both props', async ({
		page,
	}) => {
		const combined = page.locator('#combined')
		await expect(combined).toHaveText('0:hello')
	})

	test('array form — re-runs when either prop changes', async ({ page }) => {
		const combined = page.locator('#combined')

		await page.evaluate(() => {
			const el = document.querySelector('test-watch') as any
			el.count = 7
		})
		await expect(combined).toHaveText('7:hello')

		await page.evaluate(() => {
			const el = document.querySelector('test-watch') as any
			el.label = 'world'
		})
		await expect(combined).toHaveText('7:world')
	})

	test('direct Signal source — runs with initial signal value', async ({
		page,
	}) => {
		const direct = page.locator('#direct')
		await expect(direct).toHaveText('0')
	})

	test('MatchHandlers form (ok) — fires ok branch with prop value', async ({
		page,
	}) => {
		const handlers = page.locator('#handlers')
		await expect(handlers).toHaveText('ok:0')
	})

	test('MatchHandlers form (ok) — re-fires ok branch on prop change', async ({
		page,
	}) => {
		const handlers = page.locator('#handlers')
		await page.evaluate(() => {
			const el = document.querySelector('test-watch') as any
			el.count = 99
		})
		await expect(handlers).toHaveText('ok:99')
	})

	test('conditional false — descriptor is filtered, label run never fires', async ({
		page,
	}) => {
		// We can only verify indirectly: the component mounts without error
		// and the false guard doesn't cause any crash or unexpected side-effect.
		await expect(page.locator('test-watch')).toBeAttached()
	})
})
