import { expect, test } from '@playwright/test'

test.describe('test-context-late-provider: requestContext recovers from a late-defined provider', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/test-context-late-provider')
		await page.waitForSelector('#consumer #output')
	})

	test('consumer shows fallback first, then switches to the provider value after the provider upgrades', async ({
		page,
	}) => {
		const output = page.locator('#consumer #output')

		// The provider is deliberately defined on a 50 ms setTimeout, so at
		// first connect the consumer's context-request reaches no listener and
		// the memo serves the fallback (-1).
		await expect(output).toHaveText('-1')

		// After the provider upgrades, the microtask/timeout retry in
		// requestContext re-dispatches and the consumer switches to the
		// provider's value (42) with no user interaction.
		await expect(output).toHaveText('42', { timeout: 5000 })
	})
})
