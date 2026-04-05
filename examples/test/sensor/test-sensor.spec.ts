import { expect, test } from '@playwright/test'

test.describe('test-sensor: createEventsSensor(element, init, events) v1.1 form', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/test-sensor')
		await page.waitForSelector('test-sensor')
	})

	test('initial value reflects element state at connect time', async ({
		page,
	}) => {
		// Empty input → initial length = 0
		await expect(page.locator('#default #output')).toHaveText('0')
		// Pre-filled input → initial length = 5 ("hello")
		await expect(page.locator('#prefilled #output')).toHaveText('5')
	})

	test('input event updates sensor value', async ({ page }) => {
		const input = page.locator('#default input')
		const output = page.locator('#default #output')

		await input.fill('hi')
		await expect(output).toHaveText('2')

		await input.fill('longer text')
		await expect(output).toHaveText('11')
	})

	test('clearing input resets sensor to 0', async ({ page }) => {
		const input = page.locator('#default input')
		const output = page.locator('#default #output')

		await input.fill('abc')
		await expect(output).toHaveText('3')

		await input.fill('')
		await expect(output).toHaveText('0')
	})

	test('sensor value is accessible as host property', async ({ page }) => {
		await page.locator('#default input').fill('test')

		const length = await page.evaluate(
			() => (document.querySelector('#default') as any).length,
		)
		expect(length).toBe(4)
	})

	test('pre-filled instance updates correctly on input', async ({ page }) => {
		const input = page.locator('#prefilled input')
		const output = page.locator('#prefilled #output')

		// Initial: "hello" → 5
		await expect(output).toHaveText('5')

		await input.fill('hi there')
		await expect(output).toHaveText('8')
	})

	test('multiple instances are independent', async ({ page }) => {
		await page.locator('#default input').fill('abc')
		await page.locator('#prefilled input').fill('xy')

		await expect(page.locator('#default #output')).toHaveText('3')
		await expect(page.locator('#prefilled #output')).toHaveText('2')
	})
})
