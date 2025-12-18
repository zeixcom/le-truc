import { expect, test } from '@playwright/test'

test.describe('basic-counter component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/basic-counter')
		await page.waitForSelector('basic-counter')
	})

	test('renders initial count and increments on button click', async ({
		page,
	}) => {
		// Use the default (first) basic-counter element
		const defaultElement = page.locator('basic-counter').first()
		const countSpan = defaultElement.locator('span')
		const incrementButton = defaultElement.locator('button')

		await expect(countSpan).toHaveText('42')

		await incrementButton.click()
		await expect(countSpan).toHaveText('43')

		await incrementButton.click()
		await expect(countSpan).toHaveText('44')
	})

	test('reads initial count from DOM span content', async ({ page }) => {
		// Use the existing DOM read test element from HTML
		const domReadElement = page.locator('#dom-read-test')
		const countSpan = domReadElement.locator('span')
		const incrementButton = domReadElement.locator('button')

		// Should read initial count from span content
		await expect(countSpan).toHaveText('100')

		// Should increment from the DOM-read value
		await incrementButton.click()
		await expect(countSpan).toHaveText('101')

		await incrementButton.click()
		await expect(countSpan).toHaveText('102')
	})

	test('handles multiple increment clicks', async ({ page }) => {
		// Use the existing multiple increment test element from HTML
		const multipleElement = page.locator('#multiple-increment-test')
		const countSpan = multipleElement.locator('span')
		const incrementButton = multipleElement.locator('button')

		// Start at 42, increment multiple times
		await expect(countSpan).toHaveText('42')

		// Click 5 times
		for (let i = 0; i < 5; i++) {
			await incrementButton.click()
		}

		await expect(countSpan).toHaveText('47')
	})

	test('works with different initial values in DOM', async ({ page }) => {
		// Use the existing elements from HTML
		const zeroCounter = page.locator('#zero-counter')
		const negativeCounter = page.locator('#negative-counter')

		// Test zero counter
		const zeroSpan = zeroCounter.locator('span')
		const zeroButton = zeroCounter.locator('button')
		await expect(zeroSpan).toHaveText('0')
		await zeroButton.click()
		await expect(zeroSpan).toHaveText('1')

		// Test negative counter
		const negativeSpan = negativeCounter.locator('span')
		const negativeButton = negativeCounter.locator('button')
		await expect(negativeSpan).toHaveText('-5')
		await negativeButton.click()
		await expect(negativeSpan).toHaveText('-4')
		await negativeButton.click()
		await expect(negativeSpan).toHaveText('-3')
	})
})
