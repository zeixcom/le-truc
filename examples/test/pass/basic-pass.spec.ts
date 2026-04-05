import { expect, test } from '@playwright/test'

test.describe('basic-pass: pass() helper', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/basic-pass')
		await page.waitForSelector('basic-pass')
	})

	test('single element — initial count=0 drives child value', async ({
		page,
	}) => {
		// parent count=0, single child's value should be 0
		await expect(page.locator('basic-number#single')).toHaveText('0')
	})

	test('single element — changing count updates child value', async ({
		page,
	}) => {
		await page.evaluate(() => {
			const el = document.querySelector('basic-pass') as any
			el.count = 42
		})

		await expect(page.locator('basic-number#single')).toHaveText('42')
	})

	test('Memo target — all group children reflect parent count', async ({
		page,
	}) => {
		await page.evaluate(() => {
			const el = document.querySelector('basic-pass') as any
			el.count = 7
		})

		await expect(page.locator('basic-number#group1')).toHaveText('7')
		await expect(page.locator('basic-number#group2')).toHaveText('7')
	})

	test('Memo target — dynamically added child gets pass applied', async ({
		page,
	}) => {
		// Set count first so it's ready when new child connects
		await page.evaluate(() => {
			const el = document.querySelector('basic-pass') as any
			el.count = 99
		})

		// Add a new group child — each() re-runs and pass activates for it
		await page.evaluate(() => {
			const parent = document.querySelector('basic-pass')!
			const child = document.createElement('basic-number') as any
			child.id = 'group3'
			child.className = 'group'
			child.setAttribute('value', '300')
			child.textContent = '300'
			parent.appendChild(child)
		})

		await expect(page.locator('basic-number#group3')).toHaveText('99')
	})

	test('signal restoration — removing child from Memo restores its own value', async ({
		page,
	}) => {
		// Set parent count to a different value from the child's initial value
		await page.evaluate(() => {
			const el = document.querySelector('basic-pass') as any
			el.count = 55
		})

		// Verify group1 currently shows parent's count (55)
		await expect(page.locator('basic-number#group1')).toHaveText('55')

		// Remove group1 from the parent — it leaves the Memo, pass scope disposes,
		// slot is restored to group1's own state signal (value=100)
		await page.evaluate(() => {
			const child = document.querySelector('basic-number#group1')!
			document.body.appendChild(child) // move outside basic-pass
		})

		// group1 is now outside the parent; its connectedCallback re-fires with
		// its own state signal restored → shows its own initial value (100)
		await expect(page.locator('basic-number#group1')).toHaveText('100')
	})
})
