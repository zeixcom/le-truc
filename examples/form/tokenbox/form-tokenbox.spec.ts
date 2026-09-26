import { expect, test } from '@playwright/test'

/*
 * The event-time strings of the compiled form-tokenbox (LT-219, ADR 0030
 * s9): the status-region announcements and the duplicate-token validity
 * message format in the browser from the root `i18n` attribute, or from the
 * source-locale record when the instance carries none.
 */

test.describe('form-tokenbox event-time messages', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})
		await page.goto('http://localhost:3000/test/form-tokenbox')
		await page.waitForSelector('form-tokenbox')
	})

	test('announces added and removed tokens in the source locale', async ({
		page,
	}) => {
		const tokenbox = page.locator('form-tokenbox').first()
		const input = tokenbox.locator('input')
		const status = tokenbox.locator('.status')

		await input.fill('apple')
		await input.press('Enter')
		await expect(status).toHaveText('Added token: apple')

		await tokenbox.locator('button.remove').first().click()
		await expect(status).toHaveText('Removed token: apple')
	})

	test('announces added and removed tokens in German from the i18n attribute', async ({
		page,
	}) => {
		const tokenbox = page.locator('#german-test')
		const input = tokenbox.locator('input')
		const status = tokenbox.locator('.status')

		await input.fill('rot')
		await input.press('Enter')
		await expect(status).toHaveText('Token hinzugefügt: rot')

		await input.press('Backspace')
		await expect(status).toHaveText('Token entfernt: rot')
	})

	test('the duplicate-token validity message follows the attribute', async ({
		page,
	}) => {
		const tokenbox = page.locator('#german-test')
		const input = tokenbox.locator('input')

		await input.fill('rot')
		await input.press('Enter')
		await input.fill('rot')
		await input.press('Enter')
		await expect
			.poll(() =>
				tokenbox.evaluate(
					el => (el as HTMLElement & ElementInternals).validationMessage,
				),
			)
			.toBe('rot ist bereits in der Liste')
	})
})
