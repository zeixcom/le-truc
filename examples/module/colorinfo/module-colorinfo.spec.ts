import { expect, type Locator, test } from '@playwright/test'

/**
 * module-colorinfo: the connect state derived from the `value` attribute,
 * a `value` write fanning out to all six composed `basic-number`s and the
 * three text outputs, and the `label` harvest (LT-324).
 */

type Oklch = { mode: 'oklch'; l: number; c: number; h?: number }

const numbersOf = (host: Locator, axis: 'lightness' | 'chroma' | 'hue') =>
	host.locator(`basic-number.${axis}`)

const expectNumbers = async (
	host: Locator,
	axis: 'lightness' | 'chroma' | 'hue',
	value: number,
	texts: [string, string],
) => {
	const numbers = numbersOf(host, axis)
	await expect(numbers).toHaveCount(2)
	for (let i = 0; i < 2; i++) {
		const number = numbers.nth(i)
		await expect(number).toHaveText(texts[i] as string)
		expect(
			await number.evaluate(
				el => (el as HTMLElement & { value: number }).value,
			),
		).toBeCloseTo(value, 6)
	}
}

test.describe('module-colorinfo component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})
		await page.goto('http://localhost:3000/test/module-colorinfo')
		await page.waitForSelector('module-colorinfo')
	})

	test.describe('Initial State', () => {
		test('parses `value` into Oklch', async ({ page }) => {
			const host = page.locator('module-colorinfo')
			const value = await host.evaluate(
				el => (el as HTMLElement & { value: Oklch }).value,
			)
			expect(value.mode).toBe('oklch')
			expect(value.l).toBeCloseTo(0.48, 6)
			expect(value.c).toBeCloseTo(0.23, 6)
			expect(value.h).toBeCloseTo(263, 6)
		})

		test('renders the hex, RGB and HSL strings', async ({ page }) => {
			const host = page.locator('module-colorinfo')
			await expect(host.locator('.hex')).toHaveText('#0849dc')
			await expect(host.locator('.rgb')).toHaveText('rgb(8, 73, 220)')
			await expect(host.locator('.hsl')).toHaveText(
				'hsl(221.42, 93.23%, 44.63%)',
			)
		})

		test('passes each channel to both of its basic-numbers', async ({
			page,
		}) => {
			const host = page.locator('module-colorinfo')
			await expectNumbers(host, 'lightness', 0.48, ['48%', '0.48'])
			await expectNumbers(host, 'chroma', 0.23, ['0.23', '0.23'])
			await expectNumbers(host, 'hue', 263, ['263', '263'])
		})

		test('sets the swatch custom properties', async ({ page }) => {
			const host = page.locator('module-colorinfo')
			const [swatch, fallback] = await host.evaluate(el => [
				(el as HTMLElement).style.getPropertyValue(
					'--module-colorinfo-color-swatch',
				),
				(el as HTMLElement).style.getPropertyValue(
					'--module-colorinfo-color-fallback',
				),
			])
			expect(swatch).toContain('oklch(')
			expect(fallback).toBe('#0849dc')
		})
	})

	test.describe('Value write', () => {
		test('updates all six basic-numbers and the text outputs', async ({
			page,
		}) => {
			const host = page.locator('module-colorinfo')
			await host.evaluate(el => {
				;(el as HTMLElement & { value: Oklch }).value = {
					mode: 'oklch',
					l: 0.7,
					c: 0.1,
					h: 120,
				}
			})
			await expectNumbers(host, 'lightness', 0.7, ['70%', '0.7'])
			await expectNumbers(host, 'chroma', 0.1, ['0.1', '0.1'])
			await expectNumbers(host, 'hue', 120, ['120', '120'])
			await expect(host.locator('.hex')).toHaveText('#96a85e')
			await expect(host.locator('.rgb')).toHaveText('rgb(150, 168, 94)')
			await expect(host.locator('.hsl')).toHaveText('hsl(74.26, 29.58%, 51.4%)')
			expect(
				await host.evaluate(el => (el as HTMLElement & { hex: string }).hex),
			).toBe('#96a85e')
		})
	})

	test.describe('Label', () => {
		test('harvests `label` from the rendered name', async ({ page }) => {
			const host = page.locator('module-colorinfo')
			expect(
				await host.evaluate(
					el => (el as HTMLElement & { label: string }).label,
				),
			).toBe('Blue')
		})

		test('writing `label` updates the rendered name', async ({ page }) => {
			const host = page.locator('module-colorinfo')
			await host.evaluate(el => {
				;(el as HTMLElement & { label: string }).label = 'Azure'
			})
			await expect(host.locator('.label strong')).toHaveText('Azure')
		})
	})
})
