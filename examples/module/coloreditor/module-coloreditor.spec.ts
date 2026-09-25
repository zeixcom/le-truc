import { expect, type Page, test } from '@playwright/test'

/**
 * module-coloreditor: the connect state parsed from `value`/`label`, the
 * derived read-only channels and nearest named color, and the fan-out of
 * `value` and `label` to every composed child — the textbox (mediated
 * `label`, pushed `description`), the colorgraph (mediated `value` as a CSS
 * string), the colorscale, and the nine colorinfo steps. Written against the
 * `.ts` twin before the `.tsx` migration (LT-105, LT-324 precedent), so
 * `test:variants` verifies both surfaces.
 */

type Oklch = { mode: 'oklch'; l: number; c: number; h?: number }
type Coloreditor = HTMLElement & {
	value: Oklch
	label: string
	readonly nearest: string
	readonly lightness: number
	readonly chroma: number
	readonly hue: number
}

// The nine colorinfo sites: class and label suffix. Expected hex strings
// below were computed with culori and `getStepColor` from the page's seed
// `oklch(.48 .23 263)`.
const STEPS = [
	['lighten80', '100'],
	['lighten60', '200'],
	['lighten40', '300'],
	['lighten20', '400'],
	['base', '500'],
	['darken20', '600'],
	['darken40', '700'],
	['darken60', '800'],
	['darken80', '900'],
] as const

const editorState = (page: Page) =>
	page.evaluate(() => {
		const el = document.querySelector('module-coloreditor') as Coloreditor
		return {
			value: el.value,
			label: el.label,
			nearest: el.nearest,
			lightness: el.lightness,
			chroma: el.chroma,
			hue: el.hue,
		}
	})

const setEditorValue = (page: Page, value: Oklch) =>
	page.evaluate((v: Oklch) => {
		const el = document.querySelector('module-coloreditor') as Coloreditor
		el.value = v
	}, value)

test.describe('module-coloreditor component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})
		await page.goto('http://localhost:3000/test/module-coloreditor')
		await page.waitForSelector('module-coloreditor')
	})

	test.describe('Initial State', () => {
		test('parses `value` into Oklch and reads `label`', async ({ page }) => {
			const { value, label } = await editorState(page)
			expect(value.mode).toBe('oklch')
			expect(value.l).toBeCloseTo(0.48, 6)
			expect(value.c).toBeCloseTo(0.23, 6)
			expect(value.h).toBeCloseTo(263, 6)
			expect(label).toBe('Blue')
		})

		test('derives the channels and the nearest named color', async ({
			page,
		}) => {
			const state = await editorState(page)
			expect(state.lightness).toBeCloseTo(0.48, 6)
			expect(state.chroma).toBeCloseTo(0.23, 6)
			expect(state.hue).toBeCloseTo(263, 6)
			expect(state.nearest).toBe('slateblue')
		})

		test('passes the label into the textbox and pushes its description', async ({
			page,
		}) => {
			const textbox = page.locator('module-coloreditor form-textbox')
			await expect(textbox.locator('input')).toHaveValue('Blue')
			await expect(textbox.locator('.description')).toHaveText(
				'Nearest named CSS color: slateblue',
			)
		})

		test('passes the value into the colorgraph as a CSS string', async ({
			page,
		}) => {
			const value = await page.evaluate(
				() =>
					(
						document.querySelector(
							'module-coloreditor form-colorgraph',
						) as HTMLElement & { value: string }
					).value,
			)
			expect(value).toBe('oklch(0.48 0.23 263)')
		})

		test('passes label and value into the colorscale', async ({ page }) => {
			const scale = page.locator('module-coloreditor card-colorscale')
			await expect(scale.locator('.base strong')).toHaveText('Blue')
			await expect(scale.locator('.base small')).toHaveText('#0849dc')
		})

		test('labels every colorinfo step', async ({ page }) => {
			for (const [step, suffix] of STEPS)
				await expect(
					page.locator(`module-colorinfo.${step} .label strong`),
				).toHaveText(`Blue ${suffix}`)
		})

		test('colors the base and the outermost steps', async ({ page }) => {
			await expect(page.locator('module-colorinfo.base .hex')).toHaveText(
				'#0849dc',
			)
			await expect(page.locator('module-colorinfo.lighten80 .hex')).toHaveText(
				'#ccdcfb',
			)
			await expect(page.locator('module-colorinfo.darken80 .hex')).toHaveText(
				'#000211',
			)
		})
	})

	test.describe('Value changes', () => {
		const olive: Oklch = { mode: 'oklch', l: 0.6, c: 0.1, h: 120 }

		test('a host `value` write fans out to every child', async ({ page }) => {
			await setEditorValue(page, olive)
			await expect(page.locator('module-colorinfo.base .hex')).toHaveText(
				'#798940',
			)
			await expect(page.locator('module-colorinfo.lighten80 .hex')).toHaveText(
				'#e7ebdc',
			)
			await expect(page.locator('module-colorinfo.darken80 .hex')).toHaveText(
				'#080a03',
			)
			await expect(
				page.locator('module-coloreditor card-colorscale .base small'),
			).toHaveText('#798940')
			const graphValue = await page.evaluate(
				() =>
					(
						document.querySelector(
							'module-coloreditor form-colorgraph',
						) as HTMLElement & { value: string }
					).value,
			)
			expect(graphValue).toBe('oklch(0.6 0.1 120)')
		})

		test('the description follows the nearest named color', async ({
			page,
		}) => {
			await setEditorValue(page, olive)
			await expect(
				page.locator('module-coloreditor form-textbox .description'),
			).toHaveText('Nearest named CSS color: olivedrab')
		})

		test('a colorgraph `value` write reads back into host.value', async ({
			page,
		}) => {
			await page.evaluate(() => {
				const graph = document.querySelector(
					'module-coloreditor form-colorgraph',
				) as HTMLElement & { value: string }
				graph.value = 'oklch(0.6 0.1 120)'
			})
			await expect
				.poll(async () => (await editorState(page)).value.h)
				.toBeCloseTo(120, 5)
			const { value } = await editorState(page)
			expect(value.l).toBeCloseTo(0.6, 5)
			expect(value.c).toBeCloseTo(0.1, 5)
		})
	})

	test.describe('Label changes', () => {
		test('typing a name updates the label everywhere', async ({ page }) => {
			const input = page.locator('module-coloreditor form-textbox input')
			await input.fill('Ocean')
			await input.press('Tab')
			await expect
				.poll(async () => (await editorState(page)).label)
				.toBe('Ocean')
			await expect(
				page.locator('module-coloreditor card-colorscale .base strong'),
			).toHaveText('Ocean')
			await expect(
				page.locator('module-colorinfo.base .label strong'),
			).toHaveText('Ocean 500')
			await expect(
				page.locator('module-colorinfo.darken80 .label strong'),
			).toHaveText('Ocean 900')
		})

		test('a host `label` write reaches the textbox', async ({ page }) => {
			await page.evaluate(() => {
				const el = document.querySelector('module-coloreditor') as Coloreditor
				el.label = 'Sky'
			})
			await expect(
				page.locator('module-coloreditor form-textbox input'),
			).toHaveValue('Sky')
		})
	})
})
