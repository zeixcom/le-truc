import { expect, test } from '@playwright/test'

// Phase 1.9: minimal component using expose() + empty return array

test.describe('v1.1 factory form: expose() + empty return array', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/test-expose')
		// test-expose has no visible content — wait for DOM attachment
		await page.waitForSelector('test-expose', { state: 'attached' })
	})

	test('expose() creates reactive properties accessible on host', async ({
		page,
	}) => {
		const result = await page.evaluate(() => {
			const el = document.querySelector('#default') as any
			return { greeting: el.greeting, count: el.count }
		})
		expect(result.greeting).toBe('Hello')
		expect(result.count).toBe(0)
	})

	test('exposed properties are mutable (signal-backed)', async ({ page }) => {
		await page.evaluate(() => {
			const el = document.querySelector('#default') as any
			el.greeting = 'Hi'
			el.count = 42
		})
		const result = await page.evaluate(() => {
			const el = document.querySelector('#default') as any
			return { greeting: el.greeting, count: el.count }
		})
		expect(result.greeting).toBe('Hi')
		expect(result.count).toBe(42)
	})

	test('observedAttributes is empty in v1.1 factory form', async ({ page }) => {
		const observed = await page.evaluate(() =>
			Array.from(
				(customElements.get('test-expose') as any)?.observedAttributes ?? [],
			),
		)
		expect(observed).toHaveLength(0)
	})

	test('multiple instances are independent', async ({ page }) => {
		await page.evaluate(() => {
			const a = document.querySelector('#default') as any
			const b = document.querySelector('#with-count') as any
			a.greeting = 'Instance A'
			b.greeting = 'Instance B'
		})
		const result = await page.evaluate(() => {
			const a = document.querySelector('#default') as any
			const b = document.querySelector('#with-count') as any
			return {
				aGreeting: a.greeting,
				bGreeting: b.greeting,
			}
		})
		expect(result.aGreeting).toBe('Instance A')
		expect(result.bGreeting).toBe('Instance B')
	})
})
