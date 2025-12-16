import { expect, test } from '@playwright/test'

test.describe('basic-pluralize component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/basic-pluralize.html')
		await page.waitForSelector('basic-pluralize')
	})

	test('renders correctly with count=0 (shows none, hides some)', async ({
		page,
	}) => {
		// Set count to 0 on the default element
		await page.evaluate(() => {
			const element = document.querySelector('basic-pluralize') as any
			element.setAttribute('count', '0')
		})

		// Should show .none and hide .some when count is 0
		const defaultElement = page.locator('basic-pluralize').first()
		const noneElement = defaultElement.locator('.none')
		const someElement = defaultElement.locator('.some')

		await expect(noneElement).toBeVisible()
		await expect(someElement).toBeHidden()
	})

	test('renders correctly with count>0 (hides none, shows some)', async ({
		page,
	}) => {
		// Set count to 5 on the default element
		await page.evaluate(() => {
			const element = document.querySelector('basic-pluralize') as any
			element.setAttribute('count', '5')
		})

		const defaultElement = page.locator('basic-pluralize').first()
		const noneElement = defaultElement.locator('.none')
		const someElement = defaultElement.locator('.some')
		const countSpan = defaultElement.locator('.count')

		await expect(noneElement).toBeHidden()
		await expect(someElement).toBeVisible()
		await expect(countSpan).toHaveText('5')
	})

	test('updates count display when attribute changes', async ({ page }) => {
		await page.evaluate(() => {
			const element = document.querySelector('basic-pluralize') as any
			element.setAttribute('count', '1')
		})

		const defaultElement = page.locator('basic-pluralize').first()
		const countSpan = defaultElement.locator('.count')
		await expect(countSpan).toHaveText('1')

		// Change to different count
		await page.evaluate(() => {
			const element = document.querySelector('basic-pluralize') as any
			element.setAttribute('count', '42')
		})

		await expect(countSpan).toHaveText('42')
	})

	test('handles plural categories correctly (English)', async ({ page }) => {
		// Use the existing #plural-test element from HTML
		const testElement = page.locator('#plural-test')
		const oneElement = testElement.locator('.one')
		const otherElement = testElement.locator('.other')

		// Should start with count=1, showing 'one' category
		await expect(oneElement).toBeVisible()
		await expect(otherElement).toBeHidden()

		// Test count = 2 (should show 'other' category)
		await page.evaluate(() => {
			const element = document.querySelector('#plural-test') as any
			element.setAttribute('count', '2')
		})

		await expect(oneElement).toBeHidden()
		await expect(otherElement).toBeVisible()
	})

	test('handles Welsh pluralization with all 6 categories (zero, one, two, few, many, other)', async ({
		page,
	}) => {
		// Use the existing Welsh example from HTML
		const welshElement = page.locator('#welsh-test')
		const countSpan = welshElement.locator('.count')

		// Should start with count=0, showing zero form "cŵn"
		await expect(countSpan).toHaveText('0')
		await expect(welshElement.locator('.none')).toBeVisible()
		await expect(welshElement.locator('.some')).toBeHidden()

		// Test count=1 (should show "ci" - one form)
		await page.evaluate(() => {
			const element = document.querySelector('#welsh-test') as any
			element.setAttribute('count', '1')
		})
		await expect(welshElement.locator('.none')).toBeHidden()
		await expect(welshElement.locator('.some')).toBeVisible()
		await expect(welshElement.locator('.one')).toBeVisible()
		await expect(welshElement.locator('.other')).toBeHidden()

		// Test count=2 (should show "gi" - two form)
		await page.evaluate(() => {
			const element = document.querySelector('#welsh-test') as any
			element.setAttribute('count', '2')
		})
		await expect(welshElement.locator('.one')).toBeHidden()
		await expect(welshElement.locator('.two')).toBeVisible()
		await expect(welshElement.locator('.other')).toBeHidden()

		// Test count=3 (should show "chi" - few form)
		await page.evaluate(() => {
			const element = document.querySelector('#welsh-test') as any
			element.setAttribute('count', '3')
		})
		await expect(welshElement.locator('.two')).toBeHidden()
		await expect(welshElement.locator('.few')).toBeVisible()
		await expect(welshElement.locator('.other')).toBeHidden()

		// Test count=6 (should show "chi" - many form)
		await page.evaluate(() => {
			const element = document.querySelector('#welsh-test') as any
			element.setAttribute('count', '6')
		})
		await expect(welshElement.locator('.few')).toBeHidden()
		await expect(welshElement.locator('.many')).toBeVisible()
		await expect(welshElement.locator('.other')).toBeHidden()

		// Test count=4 (should show "ci" - other form)
		await page.evaluate(() => {
			const element = document.querySelector('#welsh-test') as any
			element.setAttribute('count', '4')
		})
		await expect(welshElement.locator('.many')).toBeHidden()
		await expect(welshElement.locator('.other')).toBeVisible()
		await expect(welshElement.locator('.few')).toBeHidden()
	})

	test('handles ordinal attribute correctly', async ({ page }) => {
		// Use the existing #ordinal-test element from HTML
		const ordinalElement = page.locator('#ordinal-test')
		const countSpan = ordinalElement.locator('.count')

		// Should start with count=1, showing "st" (first)
		await expect(countSpan).toHaveText('1')
		await expect(ordinalElement.locator('.some')).toBeVisible()
		await expect(ordinalElement.locator('.none')).toBeHidden()
		await expect(ordinalElement.locator('.one')).toBeVisible()
		await expect(ordinalElement.locator('.other')).toBeHidden()

		// Test count=2 (should show "nd" - second)
		await page.evaluate(() => {
			const element = document.querySelector('#ordinal-test') as any
			element.setAttribute('count', '2')
		})
		await expect(countSpan).toHaveText('2')
		await expect(ordinalElement.locator('.one')).toBeHidden()
		await expect(ordinalElement.locator('.two')).toBeVisible()
		await expect(ordinalElement.locator('.other')).toBeHidden()

		// Test count=3 (should show "rd" - third)
		await page.evaluate(() => {
			const element = document.querySelector('#ordinal-test') as any
			element.setAttribute('count', '3')
		})
		await expect(countSpan).toHaveText('3')
		await expect(ordinalElement.locator('.two')).toBeHidden()
		await expect(ordinalElement.locator('.few')).toBeVisible()
		await expect(ordinalElement.locator('.other')).toBeHidden()

		// Test count=4 (should show "th" - other)
		await page.evaluate(() => {
			const element = document.querySelector('#ordinal-test') as any
			element.setAttribute('count', '4')
		})
		await expect(countSpan).toHaveText('4')
		await expect(ordinalElement.locator('.few')).toBeHidden()
		await expect(ordinalElement.locator('.other')).toBeVisible()
	})

	test('handles multiple instances with different counts', async ({ page }) => {
		// Use the existing elements from HTML
		const firstElement = page.locator('#pluralize-1')
		const secondElement = page.locator('#pluralize-2')

		// First element (count=0) - should show "No items"
		await expect(firstElement.locator('.none')).toBeVisible()
		await expect(firstElement.locator('.some')).toBeHidden()

		// Second element (count=5) - should show "5 filter criteria" (other form)
		await expect(secondElement.locator('.none')).toBeHidden()
		await expect(secondElement.locator('.some')).toBeVisible()
		await expect(secondElement.locator('.count')).toHaveText('5')
		await expect(secondElement.locator('.other')).toBeVisible()
		await expect(secondElement.locator('.one')).toBeHidden()
	})

	test('handles large counts correctly', async ({ page }) => {
		await page.evaluate(() => {
			const element = document.querySelector('basic-pluralize') as any
			element.setAttribute('count', '1000')
		})

		const defaultElement = page.locator('basic-pluralize').first()
		const noneElement = defaultElement.locator('.none')
		const someElement = defaultElement.locator('.some')
		const countSpan = defaultElement.locator('.count')

		// Large count should show .some and hide .none
		await expect(noneElement).toBeHidden()
		await expect(someElement).toBeVisible()
		await expect(countSpan).toHaveText('1000')
	})

	test('handles negative counts by falling back to 0', async ({ page }) => {
		await page.evaluate(() => {
			const element = document.querySelector('basic-pluralize') as any
			element.setAttribute('count', '-5')
		})

		const defaultElement = page.locator('basic-pluralize').first()
		const noneElement = defaultElement.locator('.none')
		const someElement = defaultElement.locator('.some')
		const countSpan = defaultElement.locator('.count')

		// Negative count should be treated as 0: .none shows, .some hides
		await expect(noneElement).toBeVisible()
		await expect(someElement).toBeHidden()
		await expect(countSpan).toHaveText('0')
	})

	test('handles non-numeric count gracefully', async ({ page }) => {
		// Test with invalid count - asPositiveInteger should default to 0
		await page.evaluate(() => {
			const element = document.querySelector('basic-pluralize') as any
			element.setAttribute('count', 'invalid')
		})

		const defaultElement = page.locator('basic-pluralize').first()
		const noneElement = defaultElement.locator('.none')
		const someElement = defaultElement.locator('.some')
		const countSpan = defaultElement.locator('.count')

		// Should default to 0, showing .none
		await expect(noneElement).toBeVisible()
		await expect(someElement).toBeHidden()
		await expect(countSpan).toHaveText('0')
	})
})
