import { expect, type Locator, type Page, test } from '@playwright/test'

/**
 * module-splitview: the `split` ratio, its two outputs (the host's
 * `--module-splitview-ratio` and the divider's `aria-valuenow`), keyboard
 * steps and pointer drag on the divider (LT-324).
 */

const ratioOf = (host: Locator) =>
	host.evaluate(el =>
		(el as HTMLElement).style.getPropertyValue('--module-splitview-ratio'),
	)

const splitOf = (host: Locator) =>
	host.evaluate(el => (el as HTMLElement & { split: number }).split)

const expectSplit = async (host: Locator, percent: number) => {
	await expect(host.locator('.divider')).toHaveAttribute(
		'aria-valuenow',
		String(percent),
	)
	expect(await ratioOf(host)).toBe(`${percent.toFixed(2)}%`)
}

const setup = async (page: Page) => {
	page.on('console', msg => {
		console.log(`[browser] ${msg.type()}: ${msg.text()}`)
	})
	await page.goto('http://localhost:3000/test/module-splitview')
	await page.waitForSelector('module-splitview')
}

test.describe('module-splitview component', () => {
	test.beforeEach(async ({ page }) => {
		await setup(page)
	})

	test.describe('Initial State', () => {
		test('defaults to an even split', async ({ page }) => {
			const host = page.locator('#horizontal-splitview')
			expect(await splitOf(host)).toBe(0.5)
			await expectSplit(host, 50)
		})

		test('the divider is an ARIA separator', async ({ page }) => {
			const divider = page.locator('#horizontal-splitview .divider')
			await expect(divider).toHaveAttribute('role', 'separator')
			await expect(divider).toHaveAttribute('aria-orientation', 'horizontal')
			await expect(divider).toHaveAttribute('aria-valuemin', '10')
			await expect(divider).toHaveAttribute('aria-valuemax', '90')
		})

		test('reads a preset `split` attribute', async ({ page }) => {
			const host = page.locator('#preset-splitview')
			expect(await splitOf(host)).toBe(0.3)
			await expectSplit(host, 30)
		})
	})

	test.describe('Keyboard', () => {
		test('ArrowRight and ArrowLeft step by 5%', async ({ page }) => {
			const host = page.locator('#horizontal-splitview')
			const divider = host.locator('.divider')
			await divider.focus()
			await page.keyboard.press('ArrowRight')
			await expectSplit(host, 55)
			await page.keyboard.press('ArrowLeft')
			await page.keyboard.press('ArrowLeft')
			await expectSplit(host, 45)
		})

		test('Home and End jump to the bounds', async ({ page }) => {
			const host = page.locator('#horizontal-splitview')
			await host.locator('.divider').focus()
			await page.keyboard.press('Home')
			await expectSplit(host, 10)
			await page.keyboard.press('End')
			await expectSplit(host, 90)
		})

		test('steps clamp at the bounds', async ({ page }) => {
			const host = page.locator('#horizontal-splitview')
			await host.locator('.divider').focus()
			await page.keyboard.press('End')
			await page.keyboard.press('ArrowRight')
			await expectSplit(host, 90)
			await page.keyboard.press('Home')
			await page.keyboard.press('ArrowLeft')
			await expectSplit(host, 10)
		})

		test('steps from a preset split', async ({ page }) => {
			const host = page.locator('#preset-splitview')
			await host.locator('.divider').focus()
			await page.keyboard.press('ArrowLeft')
			await expectSplit(host, 25)
		})

		test('the vertical split steps with ArrowUp/ArrowDown only', async ({
			page,
		}) => {
			const host = page.locator('#vertical-splitview')
			await expect(host.locator('.divider')).toHaveAttribute(
				'aria-orientation',
				'vertical',
			)
			await host.locator('.divider').focus()
			await page.keyboard.press('ArrowRight')
			await expectSplit(host, 50)
			await page.keyboard.press('ArrowDown')
			await expectSplit(host, 55)
			await page.keyboard.press('ArrowUp')
			await page.keyboard.press('ArrowUp')
			await expectSplit(host, 45)
		})
	})

	test.describe('Property', () => {
		test('writing `split` updates both outputs', async ({ page }) => {
			const host = page.locator('#horizontal-splitview')
			await host.evaluate(el => {
				;(el as HTMLElement & { split: number }).split = 0.7
			})
			await expectSplit(host, 70)
		})
	})

	test.describe('Pointer', () => {
		test('dragging the divider sets the split from the pointer position', async ({
			page,
		}) => {
			const host = page.locator('#horizontal-splitview')
			const divider = host.locator('.divider')
			const hostBox = await host.boundingBox()
			const dividerBox = await divider.boundingBox()
			if (!hostBox || !dividerBox) throw new Error('splitview not laid out')
			const midY = dividerBox.y + dividerBox.height / 2
			await page.mouse.move(dividerBox.x + dividerBox.width / 2, midY)
			await page.mouse.down()
			await page.mouse.move(hostBox.x + hostBox.width * 0.25, midY, {
				steps: 5,
			})
			await page.mouse.up()
			await expect
				.poll(async () => Math.round((await splitOf(host)) * 100))
				.toBe(25)
			await expect(divider).toHaveAttribute('aria-valuenow', '25')
		})

		test('dragging clamps to the bounds', async ({ page }) => {
			const host = page.locator('#horizontal-splitview')
			const divider = host.locator('.divider')
			const hostBox = await host.boundingBox()
			const dividerBox = await divider.boundingBox()
			if (!hostBox || !dividerBox) throw new Error('splitview not laid out')
			const midY = dividerBox.y + dividerBox.height / 2
			await page.mouse.move(dividerBox.x + dividerBox.width / 2, midY)
			await page.mouse.down()
			await page.mouse.move(hostBox.x + 1, midY, { steps: 5 })
			await page.mouse.up()
			await expectSplit(host, 10)
		})

		test('the vertical split drags along the y axis', async ({ page }) => {
			const host = page.locator('#vertical-splitview')
			const divider = host.locator('.divider')
			const hostBox = await host.boundingBox()
			const dividerBox = await divider.boundingBox()
			if (!hostBox || !dividerBox) throw new Error('splitview not laid out')
			const midX = dividerBox.x + dividerBox.width / 2
			await page.mouse.move(midX, dividerBox.y + dividerBox.height / 2)
			await page.mouse.down()
			await page.mouse.move(midX, hostBox.y + hostBox.height * 0.75, {
				steps: 5,
			})
			await page.mouse.up()
			await expect
				.poll(async () => Math.round((await splitOf(host)) * 100))
				.toBe(75)
		})
	})
})
