import { expect, type Locator, test } from '@playwright/test'

/**
 * Test Suite: module-ticker Component
 *
 * The variant set's shared behavior (LT-110): every spelling — the
 * hand-written `.ts` twin and the `.tsrx`/`.tsx` compiles — enhances the
 * same regenerated markup, so `bun run test:variants module-ticker` runs this
 * spec once per surface.
 *
 * - ✅ The server-rendered rows are adopted, keyed by symbol
 * - ✅ Prices random-walk while running, and stop when paused
 * - ✅ "Add 100 rows" appends one block
 * - ✅ An off-screen block virtualizes to a height-matched placeholder and
 *   re-materializes when scrolled back
 */

/** The formatted price texts of a block's rendered rows, in order. */
const priceTexts = (block: Locator): Promise<string[]> =>
	block.locator('tr[data-key] data.price').allTextContents()

test.describe('module-ticker component', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/test/module-ticker')
		await page.waitForSelector('module-ticker')
	})

	test('adopts the server-rendered rows', async ({ page }) => {
		const ticker = page.locator('module-ticker')
		await expect(ticker.locator('table > tbody')).toHaveCount(1)
		await expect(ticker.locator('tr[data-key]')).toHaveCount(100)
		await expect(ticker.locator('tr[data-key]').first()).toHaveAttribute(
			'data-key',
			'AAPL',
		)
	})

	test('prices update while running and stop when paused', async ({ page }) => {
		const ticker = page.locator('module-ticker')
		const block = ticker.locator('table > tbody').first()
		const initial = await priceTexts(block)
		await expect
			.poll(async () => (await priceTexts(block)).join('|'))
			.not.toBe(initial.join('|'))

		const toggle = ticker.locator('basic-button.toggle button')
		await toggle.click()
		await expect(toggle).toHaveText('▶️ Resume')
		const paused = await priceTexts(block)
		await page.waitForTimeout(300)
		expect(await priceTexts(block)).toEqual(paused)

		await toggle.click()
		await expect(toggle).toHaveText('⏸️ Pause')
		await expect
			.poll(async () => (await priceTexts(block)).join('|'))
			.not.toBe(paused.join('|'))
	})

	test('adds a block of 100 rows', async ({ page }) => {
		const ticker = page.locator('module-ticker')
		await ticker.locator('basic-button.add-rows button').click()
		const blocks = ticker.locator('table > tbody')
		await expect(blocks).toHaveCount(2)
		const added = blocks.nth(1)
		await added.scrollIntoViewIfNeeded()
		await expect(added.locator('tr[data-key]')).toHaveCount(100)
	})

	test('virtualizes an off-screen block and restores it', async ({ page }) => {
		const ticker = page.locator('module-ticker')
		await ticker.locator('basic-button.add-rows button').click()
		const first = ticker.locator('table > tbody').first()
		const height = (await first.boundingBox())?.height ?? 0

		await page.evaluate(() =>
			window.scrollTo(0, document.documentElement.scrollHeight),
		)
		await expect(first.locator('tr[data-key]')).toHaveCount(0)
		const placeholder = (await first.boundingBox())?.height ?? 0
		expect(Math.abs(placeholder - height)).toBeLessThan(2)

		await page.evaluate(() => window.scrollTo(0, 0))
		await expect(first.locator('tr[data-key]')).toHaveCount(100)
	})
})
