import { expect, test } from '@playwright/test'

test.describe('basic-hello component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/basic-hello')
		await page.waitForSelector('basic-hello')
	})

	test('renders default greeting and updates output on input', async ({
		page,
	}) => {
		// Use the default (first) basic-hello element
		const defaultElement = page.locator('basic-hello').first()
		const output = defaultElement.locator('output')
		const input = defaultElement.locator('input[name="name"]')

		// Check initial state
		await expect(output).toHaveText('World')
		await expect(input).toHaveValue('')

		// Type a new name and verify reactive update
		await input.fill('Esther')
		await expect(output).toHaveText('Esther')

		// Clear input and verify fallback to default
		await input.fill('')
		await expect(output).toHaveText('World')
	})

	test('supports initial name attribute', async ({ page }) => {
		// Use the existing element with initial name from HTML
		const initialElement = page.locator('#initial-name-test')
		const output = initialElement.locator('output')

		// Should show the initial name "Alice"
		await expect(output).toHaveText('Alice')
	})

	test('updates when name property changes programmatically', async ({
		page,
	}) => {
		// Use the existing programmatic test element from HTML
		const programmaticElement = page.locator('#programmatic-test')
		const output = programmaticElement.locator('output')

		// Change name property directly
		await programmaticElement.evaluate(node => {
			;(node as any).name = 'Bob'
		})

		await expect(output).toHaveText('Bob')

		// Change via property
		await programmaticElement.evaluate(node => {
			;(node as any).name = 'Charlie'
		})

		await expect(output).toHaveText('Charlie')
	})

	test('preserves input value when switching between programmatic and user input', async ({
		page,
	}) => {
		// Use the existing preservation test element from HTML
		const preservationElement = page.locator('#preservation-test')
		const input = preservationElement.locator('input')
		const output = preservationElement.locator('output')

		// User types something
		await input.fill('David')
		await expect(output).toHaveText('David')
		await expect(input).toHaveValue('David')

		// Programmatic change
		await preservationElement.evaluate(node => {
			;(node as any).name = 'Eve'
		})
		await expect(output).toHaveText('Eve')

		// Input field should not be affected by programmatic changes
		await expect(input).toHaveValue('David')

		// User continues typing
		await input.fill('Frank')
		await expect(output).toHaveText('Frank')
	})

	test('handles special characters and unicode', async ({ page }) => {
		// Use the existing unicode test element from HTML
		const unicodeElement = page.locator('#unicode-test')
		const input = unicodeElement.locator('input')
		const output = unicodeElement.locator('output')

		// Test special characters
		await input.fill('José María')
		await expect(output).toHaveText('José María')

		// Test unicode emoji
		await input.fill('🎉 Alice 🚀')
		await expect(output).toHaveText('🎉 Alice 🚀')

		// Test HTML-sensitive characters
		await input.fill('<script>alert("test")</script>')
		await expect(output).toHaveText('<script>alert("test")</script>')
	})
})

// ===== FACTORY FORM — PROPERTY INTERFACE =====
// The 2-param factory form sets observedAttributes = [] unconditionally.
// Reactive state flows through the signal-backed property interface only.
// These tests confirm property-based reactivity works correctly.

test.describe('factory form: property interface', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/basic-hello')
		await page.waitForSelector('basic-hello')
	})

	test('setting name property updates the output', async ({ page }) => {
		const element = page.locator('basic-hello').first()
		const output = element.locator('output')

		await expect(output).toHaveText('World')

		await element.evaluate(el => {
			;(el as any).name = 'Property Test'
		})
		await expect(output).toHaveText('Property Test')
	})

	test('observedAttributes is empty in the factory form', async ({ page }) => {
		// The 2-param factory form opts out of observedAttributes entirely.
		const observed = await page.evaluate(() => {
			return Array.from(
				(customElements.get('basic-hello') as any)?.observedAttributes ?? [],
			)
		})
		expect(observed).toHaveLength(0)
	})
})

