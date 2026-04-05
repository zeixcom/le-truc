import { expect, test } from '@playwright/test'

test.describe('basic-on: on() helper', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/basic-on')
		await page.waitForSelector('basic-on')
	})

	test('element target — handler return updates host prop', async ({
		page,
	}) => {
		const output = page.locator('#output')
		await expect(output).toHaveText('0')

		await page.locator('button#btn').click()

		await expect(output).toHaveText('1')
	})

	test('Memo target delegation — click on first input sets count', async ({
		page,
	}) => {
		const output = page.locator('#output')
		await page.locator('input').first().click()
		await expect(output).toHaveText('10')
	})

	test('Memo target delegation — click on second input sets count', async ({
		page,
	}) => {
		const output = page.locator('#output')
		await page.locator('input').nth(1).click()
		await expect(output).toHaveText('20')
	})

	test('non-bubbling (focus) Memo fallback — focusing input sets focused prop', async ({
		page,
	}) => {
		const focusLog = page.locator('#focus-log')
		await expect(focusLog).toHaveText('blurred')

		await page.locator('input').first().focus()

		await expect(focusLog).toHaveText('focused')
	})

	test('handler return value — batch-updates host in single tick', async ({
		page,
	}) => {
		// Clicking the button sets count to 1 — verify via property accessor
		await page.locator('button#btn').click()

		const count = await page.evaluate(
			() => (document.querySelector('basic-on') as any).count,
		)
		expect(count).toBe(1)
	})
})
