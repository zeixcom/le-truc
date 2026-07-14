import { expect, test } from '@playwright/test'

/*
 * FORM-COLORGRAPH COMPONENT TESTS
 *
 * Test Coverage:
 * - Form integration: single serialized oklch value submitted via ElementInternals
 * - Form reset: restores the initial color
 * - Basic rendering
 */

test.describe('form-colorgraph component', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/form-colorgraph')
		await page.waitForSelector('form-colorgraph')
	})

	test('renders initial state with color attribute', async ({ page }) => {
		const component = page.locator('form-colorgraph')
		await expect(component).toHaveAttribute('color', 'oklch(.48 .23 263)')

		// Check that inputs are present and have no name attributes
		const lightnessInput = page.locator('#lightness')
		const chromaInput = page.locator('#chroma')
		const hueInput = page.locator('#hue')
		await expect(lightnessInput).toBeVisible()
		await expect(chromaInput).toBeVisible()
		await expect(hueInput).toBeVisible()

		// Inputs should not have name attributes (host is the form participant)
		await expect(lightnessInput).not.toHaveAttribute('name')
		await expect(chromaInput).not.toHaveAttribute('name')
		await expect(hueInput).not.toHaveAttribute('name')
	})

	test('host is form-associated and submits serialized oklch value', async ({
		page,
	}) => {
		// FormData should include the serialized oklch value under 'color'
		const formData = await page.evaluate(() => {
			const form = document.querySelector('form') as HTMLFormElement
			if (!form) return null
			const data = new FormData(form)
			return Object.fromEntries(data.entries())
		})

		expect(formData).toBeTruthy()
		expect(formData!.color).toBeTruthy()
		expect(formData!.color).toMatch(/oklch/)
	})

	test('form reset restores the initial color', async ({ page }) => {
		// Get initial color
		const initialColor = await page.evaluate(() => {
			return (document.querySelector('form-colorgraph') as any).color
		})

		// Change the color programmatically
		await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as any
			el.color = { ...el.color, h: 100 }
		})
		await page.waitForTimeout(100)

		// Verify color changed
		const changedColor = await page.evaluate(() => {
			return (document.querySelector('form-colorgraph') as any).color
		})
		expect(changedColor.h).toBe(100)

		// Reset the form
		await page.evaluate(() => {
			;(document.querySelector('form') as HTMLFormElement)?.reset()
		})
		await page.waitForTimeout(100)

		// Color should be restored to initial
		const resetColor = await page.evaluate(() => {
			return (document.querySelector('form-colorgraph') as any).color
		})
		expect(resetColor.h).toBe(initialColor.h)
	})
})
