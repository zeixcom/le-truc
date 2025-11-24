import { expect, test } from '@playwright/test'

test.describe('basic-counter component', () => {
	test('renders initial count and increments on button click', async ({
		page,
	}) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:4173/test/basic-counter.html')

		await page.waitForSelector('basic-counter')

		const countSpan = page.locator('basic-counter span')
		await expect(countSpan).toHaveText('42')

		const incrementButton = page.locator('basic-counter button')
		await incrementButton.click()
		await expect(countSpan).toHaveText('43')

		await incrementButton.click()
		await expect(countSpan).toHaveText('44')
	})
})
