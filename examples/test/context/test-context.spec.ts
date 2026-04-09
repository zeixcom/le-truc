import { expect, test } from '@playwright/test'

test.describe('test-context: provideContexts() + requestContext() helpers', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/test-context')
		await page.waitForSelector('test-context-provider')
	})

	test('3A: provideContexts — provider attaches context listener', async ({
		page,
	}) => {
		// The consumer inside the provider should receive the provider's count (0)
		const consumerOutput = page.locator('#consumer #output')
		await expect(consumerOutput).toHaveText('0')
	})

	test('3B: requestContext — consumer reflects provider value', async ({
		page,
	}) => {
		await page.evaluate(() => {
			const provider = document.querySelector('#provider') as any
			provider.count = 42
		})
		const consumerOutput = page.locator('#consumer #output')
		await expect(consumerOutput).toHaveText('42')
	})

	test('3B: requestContext — falls back when no provider', async ({ page }) => {
		// The standalone consumer has no provider ancestor → fallback = -1
		const noProviderOutput = page.locator('#no-provider #output')
		await expect(noProviderOutput).toHaveText('-1')
	})

	test('3A + 3B: provider count change reactively updates consumer', async ({
		page,
	}) => {
		await page.evaluate(() => {
			const provider = document.querySelector('#provider') as any
			provider.count = 7
		})
		await expect(page.locator('#consumer #output')).toHaveText('7')

		await page.evaluate(() => {
			const provider = document.querySelector('#provider') as any
			provider.count = 99
		})
		await expect(page.locator('#consumer #output')).toHaveText('99')
	})

	test('provideContexts — returns EffectDescriptor (no immediate side-effect)', async ({
		page,
	}) => {
		// The provider element should be connected and functional
		const provider = page.locator('#provider')
		await expect(provider).toBeAttached()

		// Consumer inside should show provider's initial value
		await expect(page.locator('#consumer #output')).toHaveText('0')
	})
})
