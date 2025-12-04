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

	test('reads initial count from DOM span content', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-counter.html')

		// Create element with different initial count in span
		await page.evaluate(() => {
			const element = document.createElement('basic-counter') as any
			element.innerHTML = `<button type="button">+ <span>100</span></button>`
			document.body.appendChild(element)
		})

		await page.waitForSelector('basic-counter')

		const newCounter = page.locator('basic-counter').last()
		const countSpan = newCounter.locator('span')
		const incrementButton = newCounter.locator('button')

		// Should read initial count from span content
		await expect(countSpan).toHaveText('100')

		// Should increment from the DOM-read value
		await incrementButton.click()
		await expect(countSpan).toHaveText('101')

		await incrementButton.click()
		await expect(countSpan).toHaveText('102')
	})

	test('handles multiple increment clicks', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-counter.html')
		await page.waitForSelector('basic-counter')

		const countSpan = page.locator('basic-counter span')
		const incrementButton = page.locator('basic-counter button')

		// Start at 42, increment multiple times
		await expect(countSpan).toHaveText('42')

		// Click 5 times
		for (let i = 0; i < 5; i++) {
			await incrementButton.click()
		}

		await expect(countSpan).toHaveText('47')
	})

	test('works with different initial values in DOM', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-counter.html')

		// Test with zero
		await page.evaluate(() => {
			const element = document.createElement('basic-counter') as any
			element.innerHTML = `<button type="button">Count: <span>0</span></button>`
			element.setAttribute('id', 'zero-counter')
			document.body.appendChild(element)
		})

		// Test with negative number
		await page.evaluate(() => {
			const element = document.createElement('basic-counter') as any
			element.innerHTML = `<button type="button">Value: <span>-5</span></button>`
			element.setAttribute('id', 'negative-counter')
			document.body.appendChild(element)
		})

		await page.waitForSelector('#zero-counter')
		await page.waitForSelector('#negative-counter')

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
