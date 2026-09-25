import { expect, type Page, test } from '@playwright/test'

/**
 * context-media: the four sensor-backed read-only props, each seeded from
 * its media query at connect and updated live, provided to a descendant
 * `card-mediaqueries` over the context protocol, and the breakpoint
 * attributes read once at connect. Written against the `.ts` twin before the
 * `.tsx` migration (LT-106, LT-324 precedent), so `test:variants` verifies
 * both surfaces.
 *
 * Default breakpoints: sm 32em (512px), md 48em (768px), lg 72em (1152px),
 * xl 104em (1664px).
 */

type Media = HTMLElement & {
	readonly motion: string
	readonly theme: string
	readonly viewport: string
	readonly orientation: string
}

const hostState = (page: Page, selector = 'context-media') =>
	page.evaluate((sel: string) => {
		const el = document.querySelector(sel) as Media
		return {
			motion: el.motion,
			theme: el.theme,
			viewport: el.viewport,
			orientation: el.orientation,
		}
	}, selector)

const consumer = (page: Page) => page.locator('context-media card-mediaqueries')

test.describe('context-media component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})
	})

	test.describe('Initial State', () => {
		test('seeds every prop from its media query', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
			await page.setViewportSize({ width: 800, height: 600 })
			await page.goto('http://localhost:3000/test/context-media')
			await page.waitForSelector('context-media')
			expect(await hostState(page)).toEqual({
				motion: 'reduce',
				theme: 'dark',
				viewport: 'md',
				orientation: 'landscape',
			})
		})

		test('seeds the opposite preferences', async ({ page }) => {
			await page.emulateMedia({
				reducedMotion: 'no-preference',
				colorScheme: 'light',
			})
			await page.setViewportSize({ width: 400, height: 700 })
			await page.goto('http://localhost:3000/test/context-media')
			await page.waitForSelector('context-media')
			expect(await hostState(page)).toEqual({
				motion: 'no-preference',
				theme: 'light',
				viewport: 'xs',
				orientation: 'portrait',
			})
		})

		test('provides every value to a descendant consumer', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
			await page.setViewportSize({ width: 800, height: 600 })
			await page.goto('http://localhost:3000/test/context-media')
			await page.waitForSelector('context-media')
			const card = consumer(page)
			await expect(card.locator('.motion')).toHaveText('reduce')
			await expect(card.locator('.theme')).toHaveText('dark')
			await expect(card.locator('.viewport')).toHaveText('md')
			await expect(card.locator('.orientation')).toHaveText('landscape')
		})
	})

	test.describe('Live updates', () => {
		test.beforeEach(async ({ page }) => {
			await page.emulateMedia({
				reducedMotion: 'no-preference',
				colorScheme: 'light',
			})
			await page.setViewportSize({ width: 800, height: 600 })
			await page.goto('http://localhost:3000/test/context-media')
			await page.waitForSelector('context-media')
		})

		test('a color-scheme change reaches the consumer', async ({ page }) => {
			await page.emulateMedia({ colorScheme: 'dark' })
			await expect(consumer(page).locator('.theme')).toHaveText('dark')
			expect((await hostState(page)).theme).toBe('dark')
		})

		test('a reduced-motion change reaches the consumer', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'reduce' })
			await expect(consumer(page).locator('.motion')).toHaveText('reduce')
		})

		test('a resize crosses breakpoints and flips orientation', async ({
			page,
		}) => {
			await page.setViewportSize({ width: 1200, height: 800 })
			await expect(consumer(page).locator('.viewport')).toHaveText('lg')
			await page.setViewportSize({ width: 500, height: 900 })
			await expect(consumer(page).locator('.viewport')).toHaveText('xs')
			await expect(consumer(page).locator('.orientation')).toHaveText(
				'portrait',
			)
		})
	})

	test.describe('Breakpoint attributes', () => {
		test.beforeEach(async ({ page }) => {
			await page.setViewportSize({ width: 700, height: 600 })
			await page.goto('http://localhost:3000/test/context-media')
			await page.waitForSelector('context-media')
		})

		test('the defaults apply without attributes', async ({ page }) => {
			// 700px: at least sm (512px), below md (768px).
			expect((await hostState(page)).viewport).toBe('sm')
		})

		test('an attribute overrides its breakpoint at connect', async ({
			page,
		}) => {
			await page.evaluate(() => {
				const el = document.createElement('context-media')
				el.id = 'custom-breakpoints'
				el.setAttribute('md', '600px')
				document.body.append(el)
			})
			await expect
				.poll(
					async () => (await hostState(page, '#custom-breakpoints')).viewport,
				)
				.toBe('md')
		})

		test('an `em` breakpoint keeps its unit', async ({ page }) => {
			await page.evaluate(() => {
				const el = document.createElement('context-media')
				el.id = 'em-breakpoints'
				// 40em = 640px: 700px is at least md under this override.
				el.setAttribute('md', '40em')
				document.body.append(el)
			})
			await expect
				.poll(async () => (await hostState(page, '#em-breakpoints')).viewport)
				.toBe('md')
		})

		test('an invalid value falls back to the default', async ({ page }) => {
			await page.evaluate(() => {
				const el = document.createElement('context-media')
				el.id = 'bad-breakpoints'
				el.setAttribute('md', 'wide')
				document.body.append(el)
			})
			await expect
				.poll(async () => (await hostState(page, '#bad-breakpoints')).viewport)
				.toBe('sm')
		})
	})
})
