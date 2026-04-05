import { expect, test } from '@playwright/test'

test.describe('basic-each: each() helper', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/basic-each')
		await page.waitForSelector('basic-each')
	})

	test('initially no item is active', async ({ page }) => {
		const items = page.locator('basic-each li')
		for (let i = 0; i < 3; i++) {
			await expect(items.nth(i)).not.toHaveClass(/active/)
		}
	})

	test('nested run — marks correct item active when selected changes', async ({
		page,
	}) => {
		const items = page.locator('basic-each li')

		await page.evaluate(() => {
			const el = document.querySelector('basic-each') as any
			el.selected = 1
		})

		await expect(items.nth(0)).not.toHaveClass(/active/)
		await expect(items.nth(1)).toHaveClass('active')
		await expect(items.nth(2)).not.toHaveClass(/active/)
	})

	test('nested run — switches active class when selected changes again', async ({
		page,
	}) => {
		const items = page.locator('basic-each li')

		await page.evaluate(() => {
			const el = document.querySelector('basic-each') as any
			el.selected = 0
		})
		await expect(items.nth(0)).toHaveClass('active')

		await page.evaluate(() => {
			const el = document.querySelector('basic-each') as any
			el.selected = 2
		})
		await expect(items.nth(0)).not.toHaveClass(/active/)
		await expect(items.nth(2)).toHaveClass('active')
	})

	test('nested on — clicking item updates selected prop', async ({ page }) => {
		const items = page.locator('basic-each li')

		await items.nth(1).click()

		const selected = await page.evaluate(() => {
			const el = document.querySelector('basic-each') as any
			return el.selected
		})
		expect(selected).toBe(1)
		await expect(items.nth(1)).toHaveClass('active')
	})

	test('nested on — clicking different items updates selection', async ({
		page,
	}) => {
		const items = page.locator('basic-each li')

		await items.nth(0).click()
		await expect(items.nth(0)).toHaveClass('active')
		await expect(items.nth(1)).not.toHaveClass(/active/)

		await items.nth(2).click()
		await expect(items.nth(0)).not.toHaveClass(/active/)
		await expect(items.nth(2)).toHaveClass('active')

		const selected = await page.evaluate(() => {
			const el = document.querySelector('basic-each') as any
			return el.selected
		})
		expect(selected).toBe(2)
	})

	test('per-element lifecycle — dynamically added item gets effects', async ({
		page,
	}) => {
		// Set selected=3 first so the effect fires with the right value when item3 connects
		await page.evaluate(() => {
			const el = document.querySelector('basic-each') as any
			el.selected = 3
		})

		// Add item3 — each() will re-run, set up run/on for item3,
		// and the run effect immediately fires with selected=3
		await page.evaluate(() => {
			const ul = document.querySelector('basic-each ul')!
			const li = document.createElement('li')
			li.dataset.index = '3'
			li.textContent = 'Item 3'
			ul.appendChild(li)
		})

		const newItem = page.locator('basic-each li[data-index="3"]')
		await expect(newItem).toHaveClass('active')
	})
})
