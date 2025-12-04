import { expect, test } from '@playwright/test'

test.describe('basic-hello component', () => {
	test('renders default greeting and updates output on input', async ({
		page,
	}) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:4173/test/basic-hello.html')
		await page.waitForSelector('basic-hello')

		// Check initial state
		const output = page.locator('basic-hello output')
		const input = page.locator('basic-hello input[name="name"]')

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
		await page.goto('http://localhost:4173/test/basic-hello.html')

		// Create element with initial name attribute
		await page.evaluate(() => {
			const element = document.createElement('basic-hello') as any
			element.setAttribute('name', 'Alice')
			element.innerHTML = `
				<label for="name">Your name</label>
				<input id="name" name="name" type="text" autocomplete="given-name" />
				<p>Hello, <output for="name">World</output>!</p>
			`
			document.body.appendChild(element)
		})

		await page.waitForSelector('basic-hello')

		const newElement = page.locator('basic-hello').last()
		const output = newElement.locator('output')

		// Should show the initial name
		await expect(output).toHaveText('Alice')
	})

	test('updates when name property changes programmatically', async ({
		page,
	}) => {
		await page.goto('http://localhost:4173/test/basic-hello.html')
		await page.waitForSelector('basic-hello')

		const basicHello = page.locator('basic-hello')
		const output = basicHello.locator('output')

		// Change name property directly
		await basicHello.evaluate(node => {
			;(node as any).name = 'Bob'
		})

		await expect(output).toHaveText('Bob')

		// Change via attribute
		await basicHello.evaluate(node => {
			node.setAttribute('name', 'Charlie')
		})

		await expect(output).toHaveText('Charlie')
	})

	test('preserves input value when switching between programmatic and user input', async ({
		page,
	}) => {
		await page.goto('http://localhost:4173/test/basic-hello.html')
		await page.waitForSelector('basic-hello')

		const basicHello = page.locator('basic-hello')
		const input = basicHello.locator('input')
		const output = basicHello.locator('output')

		// User types something
		await input.fill('David')
		await expect(output).toHaveText('David')
		await expect(input).toHaveValue('David')

		// Programmatic change
		await basicHello.evaluate(node => {
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
		await page.goto('http://localhost:4173/test/basic-hello.html')
		await page.waitForSelector('basic-hello')

		const input = page.locator('basic-hello input')
		const output = page.locator('basic-hello output')

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
