import { expect, test } from '@playwright/test'

test.describe('section-menu component', () => {
	// The mobile toggle only exists visually below the 48em breakpoint —
	// this spec is about the off-canvas drawer, so pin a narrow viewport.
	test.use({ viewport: { width: 480, height: 800 } })

	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/section-menu')
		await page.waitForSelector('section-menu')
	})

	test.describe('Initial State', () => {
		test('renders closed by default', async ({ page }) => {
			const menu = page.locator('section-menu')
			const nav = page.locator('section-menu nav')
			const toggle = page.locator('#sidebar-toggle')

			// Below the breakpoint, closed means the `<nav>` drawer panel is
			// translated off-canvas — the host itself is a full-viewport,
			// pointer-events:none overlay layer, so it stays "visible" to
			// Playwright (non-empty box); what matters is `<nav>`'s position.
			await expect(menu).toBeVisible()
			await expect(toggle).toBeVisible()
			await expect(menu).not.toHaveClass(/open/)
			await expect(toggle).toHaveAttribute('aria-expanded', 'false')
			const navBox = await nav.boundingBox()
			expect(navBox).not.toBeNull()
			// Off-screen to the left of the viewport.
			expect(navBox!.x + navBox!.width).toBeLessThanOrEqual(0)
		})

		test('toggle references the menu via aria-controls', async ({ page }) => {
			const toggle = page.locator('#sidebar-toggle')
			await expect(toggle).toHaveAttribute('aria-controls', 'sidebar')
			await expect(page.locator('section-menu')).toHaveAttribute(
				'id',
				'sidebar',
			)
		})

		test('marks the active item', async ({ page }) => {
			const activeLink = page.locator('section-menu a.active')
			await expect(activeLink).toHaveAttribute('aria-current', 'page')
			await expect(activeLink).toContainText('Page Two')
		})
	})

	test.describe('Opening and Closing', () => {
		test('opens the drawer when the toggle is clicked', async ({ page }) => {
			const menu = page.locator('section-menu')
			const toggle = page.locator('#sidebar-toggle')

			await toggle.click()

			await expect(menu).toHaveClass(/open/)
			await expect(toggle).toHaveAttribute('aria-expanded', 'true')
		})

		test('closes the drawer when the toggle is clicked again', async ({
			page,
		}) => {
			const menu = page.locator('section-menu')
			const toggle = page.locator('#sidebar-toggle')

			await toggle.click()
			await expect(menu).toHaveClass(/open/)

			await toggle.click()

			await expect(menu).not.toHaveClass(/open/)
			await expect(toggle).toHaveAttribute('aria-expanded', 'false')
		})

		test('closes on Escape', async ({ page }) => {
			const menu = page.locator('section-menu')
			const toggle = page.locator('#sidebar-toggle')

			await toggle.click()
			await expect(menu).toHaveClass(/open/)

			await page.keyboard.press('Escape')

			await expect(menu).not.toHaveClass(/open/)
			await expect(toggle).toHaveAttribute('aria-expanded', 'false')
		})

		test('closes on outside click', async ({ page }) => {
			const menu = page.locator('section-menu')
			const toggle = page.locator('#sidebar-toggle')

			await toggle.click()
			await expect(menu).toHaveClass(/open/)

			await page.locator('#outside-target').click()

			await expect(menu).not.toHaveClass(/open/)
			await expect(toggle).toHaveAttribute('aria-expanded', 'false')
		})

		test('does not close when clicking inside the menu itself', async ({
			page,
		}) => {
			const menu = page.locator('section-menu')
			const toggle = page.locator('#sidebar-toggle')

			await toggle.click()
			await expect(menu).toHaveClass(/open/)

			await page.locator('section-menu li.group').first().click()

			await expect(menu).toHaveClass(/open/)
		})

		test('closes when a menu link is clicked', async ({ page }) => {
			const menu = page.locator('section-menu')
			const toggle = page.locator('#sidebar-toggle')

			await toggle.click()
			await expect(menu).toHaveClass(/open/)

			await page.locator('section-menu a', { hasText: 'Page One' }).click()

			await expect(menu).not.toHaveClass(/open/)
			await expect(toggle).toHaveAttribute('aria-expanded', 'false')
		})
	})

	test.describe('Programmatic Control', () => {
		test('can be opened and closed via the open property', async ({ page }) => {
			const menu = page.locator('section-menu')

			await page.evaluate(() => {
				const el = document.querySelector('section-menu') as any
				el.open = true
			})
			await expect(menu).toHaveClass(/open/)

			await page.evaluate(() => {
				const el = document.querySelector('section-menu') as any
				el.open = false
			})
			await expect(menu).not.toHaveClass(/open/)
		})
	})
})
