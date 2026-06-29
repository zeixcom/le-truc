import { expect, test } from '@playwright/test'

/**
 * Reconnect must not accumulate effects/listeners
 *
 * Before the fix, connectedCallback re-ran runSetup() on an already-initialized
 * element, overwriting #cleanup without invoking the previous one. Each reparent
 * (disconnect → reconnect) cycle added another event listener for the same effect.
 *
 * The audit-reconnect component increments `value` by 1 per button click. If
 * listeners accumulate, a single click after N reconnects increments by N. The
 * fix runs the previous cleanup before re-activating #setup, so a click always
 * increments by exactly 1.
 */
test.describe('Reconnect does not leak listeners', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/test-reconnect')
		await page.waitForSelector('audit-reconnect')
	})

	const REPARENT_COUNT = 5

	test('a single click increments value by exactly 1 after N reparents', async ({
		page,
	}) => {
		// Reparent the host between two containers REPARENT_COUNT times.
		// Each move triggers disconnectedCallback then connectedCallback.
		await page.evaluate(count => {
			const host = document.getElementById('rc')!
			const a = document.getElementById('reparent-a')!
			const b = document.getElementById('reparent-b')!
			for (let i = 0; i < count; i++) {
				;(host.parentElement === a ? b : a).appendChild(host)
			}
		}, REPARENT_COUNT)

		// Reset value to 0, then click once.
		await page.evaluate(() => {
			;(document.getElementById('rc') as any).value = 0
		})
		await page.locator('#rc button').click()

		const value = await page.evaluate(
			() => (document.getElementById('rc') as any).value,
		)
		// With the leak, this would be REPARENT_COUNT + 1 (6). With the fix, it's 1.
		expect(value).toBe(1)
	})

	test('value stays 0 before any click, even after reparenting', async ({
		page,
	}) => {
		await page.evaluate(count => {
			const host = document.getElementById('rc')!
			const a = document.getElementById('reparent-a')!
			const b = document.getElementById('reparent-b')!
			for (let i = 0; i < count; i++) {
				;(host.parentElement === a ? b : a).appendChild(host)
			}
		}, REPARENT_COUNT)

		const value = await page.evaluate(
			() => (document.getElementById('rc') as any).value,
		)
		expect(value).toBe(0)
	})

	test('repeated connect/disconnect does not throw', async ({ page }) => {
		const ok = await page.evaluate(count => {
			try {
				const host = document.getElementById('rc')!
				const a = document.getElementById('reparent-a')!
				const b = document.getElementById('reparent-b')!
				for (let i = 0; i < count; i++) {
					;(host.parentElement === a ? b : a).appendChild(host)
				}
				return true
			} catch {
				return false
			}
		}, REPARENT_COUNT)
		expect(ok).toBe(true)
	})
})
