import { expect, test } from '@playwright/test'
import { converter, formatCss, type Oklch } from 'culori'

/*
 * FORM-COLORGRAPH COMPONENT TESTS
 *
 * Test Coverage:
 * - Form integration: single serialized CSS color value submitted via ElementInternals
 * - Form reset: restores the initial color (managed by the value attribute)
 * - Basic rendering
 *
 * The component exposes `value` (a CSS color string like "oklch(0.48 0.23 263)")
 * as its form value. `lightness`, `chroma`, and `hue` are readonly derived props.
 * `stepUp`/`stepDown` write serialized CSS color strings back to `value`.
 *
 * Note: `page.evaluate` callbacks run in the browser and cannot close over Node-side
 * helpers, so each evaluate is self-contained. CSS strings are computed in the Node
 * test process (via culori) and passed into evaluate as serializable arguments.
 */

const oklchConverter = converter('oklch')
const parseOklch = (value: string): Oklch =>
	oklchConverter(value) ?? { mode: 'oklch', l: 0.48, c: 0.23, h: 263 }

test.describe('form-colorgraph component', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/form-colorgraph')
		await page.waitForSelector('form-colorgraph')
	})

	test('renders initial state with value attribute', async ({ page }) => {
		const component = page.locator('form-colorgraph')
		await expect(component).toHaveAttribute('value', 'oklch(.48 .23 263)')

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

	test('host is form-associated and submits serialized CSS color value', async ({
		page,
	}) => {
		// FormData should include the serialized CSS color value under 'color'
		// (the field name comes from the host's name="color" attribute)
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

	test('stepDown / stepUp update the value string', async ({ page }) => {
		// Capture the initial value string
		const initialValue = await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as HTMLElement & {
				value: string
			}
			return el.value
		})

		// Advance hue by one step via stepUp('h')
		await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as HTMLElement & {
				stepUp: (axis: 'h', bigStep?: boolean) => void
			}
			el.stepUp('h')
		})
		await page.waitForTimeout(50)

		const steppedValue = await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as HTMLElement & {
				value: string
			}
			return el.value
		})

		// value must have changed and still be an oklch CSS string
		expect(steppedValue).not.toBe(initialValue)
		expect(steppedValue).toMatch(/oklch/)
	})

	test('each axis form-spinbutton is bounded by its own min/max attributes', async ({
		page,
	}) => {
		// min/max/step/big-step (e.g. min="0" max="360" big-step="15" on the
		// hue spinbutton, per form-colorgraph.html) live only on each
		// <form-spinbutton>, not duplicated in form-colorgraph.ts. Exercise
		// the spinbuttons directly (not via form-colorgraph's stepUp/stepDown,
		// which additionally gates commits on gamut) to isolate that bounds
		// resolution specifically.
		const hue = await page.evaluate(() => {
			const el = document.querySelector(
				'form-spinbutton.hue',
			) as HTMLElement & {
				stepUp: (big?: boolean) => void
				value: number
				max: number
			}
			for (let i = 0; i < 30; i++) el.stepUp(true)
			return { value: el.value, max: el.max }
		})
		expect(hue).toEqual({ value: 360, max: 360 })

		const lightness = await page.evaluate(() => {
			const el = document.querySelector(
				'form-spinbutton.lightness',
			) as HTMLElement & {
				stepDown: (big?: boolean) => void
				value: number
				min: number
			}
			for (let i = 0; i < 30; i++) el.stepDown(true)
			return { value: el.value, min: el.min }
		})
		expect(lightness).toEqual({ value: 0, min: 0 })
	})

	test('form reset restores the initial color', async ({ page }) => {
		// Get initial value (the form value is a CSS color string) and hue
		const initial = await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as HTMLElement & {
				value: string
				hue: number
			}
			return { value: el.value, hue: el.hue }
		})

		// Change the color programmatically: keep l and c, set h to 100.
		// Compute the serialized CSS string in Node (culori), pass into the browser.
		const changedCss = formatCss({ ...parseOklch(initial.value), h: 100 })
		await page.evaluate((css: string) => {
			const el = document.querySelector('form-colorgraph') as HTMLElement & {
				value: string
			}
			el.value = css
		}, changedCss)
		await page.waitForTimeout(100)

		// Verify hue changed (derived prop reflects the new value)
		const changedHue = await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as HTMLElement & {
				hue: number
			}
			return el.hue
		})
		expect(changedHue).toBeCloseTo(100, 5)

		// Reset the form
		await page.evaluate(() => {
			;(document.querySelector('form') as HTMLFormElement)?.reset()
		})
		await page.waitForTimeout(100)

		// value should be restored to the initial CSS color string
		const reset = await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as HTMLElement & {
				value: string
				hue: number
			}
			return { value: el.value, hue: el.hue }
		})
		expect(reset.value).toBe(initial.value)
		expect(reset.hue).toBeCloseTo(initial.hue, 5)
	})
})
