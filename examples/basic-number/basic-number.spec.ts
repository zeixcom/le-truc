import { expect, test } from '@playwright/test'

test.describe('basic-number component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/basic-number')
		await page.waitForSelector('basic-number')
	})

	test('renders default number formatting', async ({ page }) => {
		// Test the first example: basic unit formatting
		const firstNumber = page.locator('basic-number').first()
		await expect(firstNumber).toHaveText('25,678.9 liters')
	})

	test('formats currency with locale-specific formatting', async ({ page }) => {
		// Test German-Swiss currency formatting
		const germanNumber = page.locator('#german-swiss')
		await expect(germanNumber).toContainText('CHF') // Should contain Swiss Franc
		await expect(germanNumber).toContainText('25') // Should contain the base number

		// Test French-Swiss currency formatting
		const frenchNumber = page.locator('#french-swiss')
		await expect(frenchNumber).toContainText('CHF') // Should contain Swiss Franc
		await expect(frenchNumber).toContainText('25') // Should contain the base number
	})

	test('handles different unit types and locales', async ({ page }) => {
		// Test Arabic locale with speed unit - expect Arabic-Indic numerals
		const arabicNumber = page.locator('#arabic-speed')
		await expect(arabicNumber).toContainText('٢٥') // Should contain Arabic-Indic numerals for 25

		// Test Chinese locale with time unit - should contain time unit and some form of the number
		const chineseNumber = page.locator('#chinese-time')
		await expect(chineseNumber).toContainText('秒') // Should contain Chinese word for "second"
	})

	test('updates when value property changes', async ({ page }) => {
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
		// Test HTML markup error logging - should log error on page load
		const htmlElement = page.locator('#invalid-json-html')
		await expect(htmlElement).toHaveText('1,234.5') // Should fall back to default

		// Test dynamic creation also logs errors
		const consoleMessages: string[] = []
		page.on('console', msg => {
			if (msg.type() === 'error') {
				consoleMessages.push(msg.text())
			}
		})

		await page.evaluate(() => {
			const element = document.createElement('basic-number') as any
			element.value = 9999
			element.setAttribute('options', '{ invalid json }')
			element.setAttribute('id', 'invalid-json-dynamic')
			document.body.appendChild(element)
		})

		const dynamicElement = page.locator('#invalid-json-dynamic')
		await expect(dynamicElement).toHaveText('9,999') // Should fall back to default

		// Verify console error was logged for dynamic creation
		const hasJsonError = consoleMessages.some(
			msg => msg.includes('Invalid JSON') || msg.includes('JSON'),
		)
		expect(hasJsonError).toBe(true)
	})

	test('handles missing required currency gracefully', async ({ page }) => {
		// Test HTML markup error logging - should log error on page load
		const htmlElement = page.locator('#missing-currency-html')
		await expect(htmlElement).toHaveText('1,000') // Should fall back to default

		// Test dynamic creation also logs errors
		const consoleMessages: string[] = []
		page.on('console', msg => {
			if (msg.type() === 'error') {
				consoleMessages.push(msg.text())
			}
		})

		await page.evaluate(() => {
			const element = document.createElement('basic-number') as any
			element.value = 9999
			element.setAttribute('options', '{"style":"currency"}')
			element.setAttribute('id', 'missing-currency-dynamic')
			document.body.appendChild(element)
		})

		const dynamicElement = page.locator('#missing-currency-dynamic')
		await expect(dynamicElement).toHaveText('9,999') // Should fall back to default

		// Verify console error was logged for dynamic creation
		const hasCurrencyError = consoleMessages.some(
			msg => msg.includes('currency') && msg.includes('CHF'),
		)
		expect(hasCurrencyError).toBe(true)
	})

	test('handles missing required unit gracefully', async ({ page }) => {
		// Test HTML markup error logging - should log error on page load
		const htmlElement = page.locator('#missing-unit-html')
		await expect(htmlElement).toHaveText('500') // Should fall back to default

		// Test dynamic creation also logs errors
		const consoleMessages: string[] = []
		page.on('console', msg => {
			if (msg.type() === 'error') {
				consoleMessages.push(msg.text())
			}
		})

		await page.evaluate(() => {
			const element = document.createElement('basic-number') as any
			element.value = 9999
			element.setAttribute('options', '{"style":"unit"}')
			element.setAttribute('id', 'missing-unit-dynamic')
			document.body.appendChild(element)
		})

		const dynamicElement = page.locator('#missing-unit-dynamic')
		await expect(dynamicElement).toHaveText('9,999') // Should fall back to default

		// Verify console error was logged for dynamic creation
		const hasUnitError = consoleMessages.some(
			msg =>
				msg.includes('unit') &&
				(msg.includes('liter') || msg.includes('kilometer')),
		)
		expect(hasUnitError).toBe(true)
	})

	test('works with decimal style formatting', async ({ page }) => {
		// Use the existing decimal test element from HTML
		const decimalElement = page.locator('#decimal-test')
		// Should respect the fraction digit limits
		await expect(decimalElement).toHaveText('1,234.568')
	})

	test('inherits locale from closest lang attribute', async ({ page }) => {
		// Use the existing inheritance test element from HTML
		const inheritElement = page.locator('#inherit-test')
		// Should use German formatting for currency
		await expect(inheritElement).toContainText('€')
		await expect(inheritElement).toContainText('1') // Should contain the number
	})

	test('handles zero and negative values correctly', async ({ page }) => {
		// Use the existing elements from HTML
		const zeroElement = page.locator('#zero-test')
		const negativeElement = page.locator('#negative-test')

		await expect(zeroElement).toHaveText('0')
		await expect(negativeElement).toHaveText('-1,234.5')
	})
})
