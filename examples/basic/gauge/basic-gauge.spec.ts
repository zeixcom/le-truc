import { expect, test } from '@playwright/test'

test.describe('basic-gauge component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/basic-gauge')
		await page.waitForSelector('basic-gauge')
	})

	test('renders initial value from the meter fallback', async ({ page }) => {
		const gauge = page.locator('basic-gauge').first()
		await expect(gauge.locator('.label')).toHaveText('Good job!')
		const value = await gauge.evaluate((node: any) => node.value)
		expect(value).toBeCloseTo(0.84)
	})

	test('updates when the value property changes', async ({ page }) => {
		const gauge = page.locator('basic-gauge').first()

		await gauge.evaluate((node: any) => {
			node.value = 0.1
		})

		await expect(gauge.locator('.label')).toHaveText('Try again!')
	})

	test('re-parses the value attribute when it mutates at runtime', async ({
		page,
	}) => {
		// observedAttributes(['value']) re-parses `value` on attribute mutation,
		// not just at connect time — this is the runtime path the property test
		// above does not exercise.
		const gauge = page.locator('basic-gauge').first()

		await gauge.evaluate((node: any) => {
			node.setAttribute('value', '0.6')
		})

		await expect(gauge.locator('.label')).toHaveText('Decent')
		const value = await gauge.evaluate((node: any) => node.value)
		expect(value).toBeCloseTo(0.6)
	})

	test('falls back to the parser default on an unparseable value attribute', async ({
		page,
	}) => {
		// asNumber(meter.value)'s fallback is fixed at connect time (the
		// meter's initial value) — an unparseable mutation re-parses to that
		// fixed fallback, not a no-op, since asNumber() never returns null.
		const gauge = page.locator('basic-gauge').first()
		const initial = await gauge.evaluate((node: any) => node.value)

		await gauge.evaluate((node: any) => {
			node.setAttribute('value', '0.6')
		})
		await gauge.evaluate((node: any) => {
			node.setAttribute('value', 'not-a-number')
		})

		const after = await gauge.evaluate((node: any) => node.value)
		expect(after).toBeCloseTo(initial)
	})
})
