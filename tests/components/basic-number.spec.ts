import { expect, test } from '@playwright/test'

test.describe('basic-number component', () => {
	test('renders default number formatting', async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:4173/test/basic-number.html')
		await page.waitForSelector('basic-number')

		// Test the first example: basic unit formatting
		const firstNumber = page.locator('basic-number').first()
		await expect(firstNumber).toHaveText('25,678.9 liters')
	})

	test('formats currency with locale-specific formatting', async ({
		page,
	}) => {
		await page.goto('http://localhost:4173/test/basic-number.html')
		await page.waitForSelector('basic-number')

		// Test German-Swiss currency formatting
		const germanNumber = page.locator('basic-number[lang="de-CH"]').first()
		await expect(germanNumber).toContainText('CHF') // Should contain Swiss Franc
		await expect(germanNumber).toContainText('25') // Should contain the base number

		// Test French-Swiss currency formatting
		const frenchNumber = page.locator('basic-number[lang="fr-CH"]').first()
		await expect(frenchNumber).toContainText('CHF') // Should contain Swiss Franc
		await expect(frenchNumber).toContainText('25') // Should contain the base number
	})

	test('handles different unit types and locales', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-number.html')
		await page.waitForSelector('basic-number')

		// Test Arabic locale with speed unit - expect Arabic-Indic numerals
		const arabicNumber = page.locator('basic-number[lang="ar-EG"]')
		await expect(arabicNumber).toContainText('٢٥') // Should contain Arabic-Indic numerals for 25

		// Test Chinese locale with time unit - should contain time unit and some form of the number
		const chineseNumber = page.locator(
			'basic-number[lang="zh-Hans-CN-u-nu-hanidec"]',
		)
		await expect(chineseNumber).toContainText('秒') // Should contain Chinese word for "second"
	})

	test('updates when value property changes', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-number.html')
		await page.waitForSelector('basic-number')

		const numberElement = page.locator('basic-number').first()

		// Get initial text
		const initialText = await numberElement.textContent()
		expect(initialText).toContain('25,678.9')

		// Change the value property
		await numberElement.evaluate(node => {
			;(node as any).value = 12345.6
		})

		// Should update to show new formatted number
		await expect(numberElement).toHaveText('12,345.6 liters')
	})

	test('handles invalid JSON options gracefully', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-number.html')

		// Create element with invalid JSON options
		await page.evaluate(() => {
			const element = document.createElement('basic-number') as any
			element.value = 1234.5
			element.setAttribute('options', '{ invalid json }')
			document.body.appendChild(element)
		})

		await page.waitForSelector('basic-number')

		// Should fall back to default formatting
		const newElement = page.locator('basic-number').last()
		await expect(newElement).toHaveText('1,234.5')
	})

	test('handles missing required currency gracefully', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-number.html')

		// Create element with currency style but no currency specified
		await page.evaluate(() => {
			const element = document.createElement('basic-number') as any
			element.value = 1000
			element.setAttribute('options', '{"style":"currency"}')
			document.body.appendChild(element)
		})

		await page.waitForSelector('basic-number')

		// Should fall back to default formatting
		const newElement = page.locator('basic-number').last()
		await expect(newElement).toHaveText('1,000')
	})

	test('handles missing required unit gracefully', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-number.html')

		// Create element with unit style but no unit specified
		await page.evaluate(() => {
			const element = document.createElement('basic-number') as any
			element.value = 500
			element.setAttribute('options', '{"style":"unit"}')
			document.body.appendChild(element)
		})

		await page.waitForSelector('basic-number')

		// Should fall back to default formatting
		const newElement = page.locator('basic-number').last()
		await expect(newElement).toHaveText('500')
	})

	test('works with decimal style formatting', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-number.html')

		// Create element with decimal formatting options
		await page.evaluate(() => {
			const element = document.createElement('basic-number') as any
			element.value = 1234.56789
			element.setAttribute(
				'options',
				'{"style":"decimal","minimumFractionDigits":2,"maximumFractionDigits":3}',
			)
			document.body.appendChild(element)
		})

		await page.waitForSelector('basic-number')

		const newElement = page.locator('basic-number').last()
		// Should respect the fraction digit limits
		await expect(newElement).toHaveText('1,234.568')
	})

	test('inherits locale from closest lang attribute', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-number.html')

		// Create a container with lang attribute and nested basic-number
		await page.evaluate(() => {
			const container = document.createElement('div')
			container.setAttribute('lang', 'de-DE')

			const element = document.createElement('basic-number') as any
			element.value = 1234.5
			element.setAttribute(
				'options',
				'{"style":"currency","currency":"EUR"}',
			)

			container.appendChild(element)
			document.body.appendChild(container)
		})

		await page.waitForSelector('basic-number')

		const newElement = page.locator('div[lang="de-DE"] basic-number')
		// Should use German formatting for currency
		await expect(newElement).toContainText('€')
		await expect(newElement).toContainText('1') // Should contain the number
	})

	test('handles zero and negative values correctly', async ({ page }) => {
		await page.goto('http://localhost:4173/test/basic-number.html')

		// Test zero value
		await page.evaluate(() => {
			const element = document.createElement('basic-number') as any
			element.value = 0
			element.setAttribute('id', 'zero-test')
			document.body.appendChild(element)
		})

		// Test negative value
		await page.evaluate(() => {
			const element = document.createElement('basic-number') as any
			element.value = -1234.5
			element.setAttribute('id', 'negative-test')
			document.body.appendChild(element)
		})

		await page.waitForSelector('#zero-test')
		await page.waitForSelector('#negative-test')

		const zeroElement = page.locator('#zero-test')
		const negativeElement = page.locator('#negative-test')

		await expect(zeroElement).toHaveText('0')
		await expect(negativeElement).toHaveText('-1,234.5')
	})
})
