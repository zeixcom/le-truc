import { expect, test } from '@playwright/test'

test.describe('card-mediaqueries component', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/card-mediaqueries')
		await page.waitForSelector('card-mediaqueries')
	})

	test('renders component elements correctly', async ({ page }) => {
		// Check both instances exist
		const componentWithoutContext = page.locator('card-mediaqueries').first()
		const componentWithContext = page.locator('context-media card-mediaqueries')

		await expect(componentWithoutContext).toBeVisible()
		await expect(componentWithContext).toBeVisible()

		// Check that each has the expected structure
		for (const component of [componentWithoutContext, componentWithContext]) {
			await expect(component.locator('h5')).toBeVisible()
			await expect(component.locator('.motion')).toBeVisible()
			await expect(component.locator('.theme')).toBeVisible()
			await expect(component.locator('.viewport')).toBeVisible()
			await expect(component.locator('.orientation')).toBeVisible()
		}
	})

	test('shows fallback values without context provider', async ({ page }) => {
		const componentWithoutContext = page.locator('card-mediaqueries').first()

		// All values should show 'unknown' fallback
		await expect(componentWithoutContext.locator('.motion')).toHaveText(
			'unknown',
		)
		await expect(componentWithoutContext.locator('.theme')).toHaveText(
			'unknown',
		)
		await expect(componentWithoutContext.locator('.viewport')).toHaveText(
			'unknown',
		)
		await expect(componentWithoutContext.locator('.orientation')).toHaveText(
			'unknown',
		)
	})

	test('receives context values from provider', async ({ page }) => {
		const componentWithContext = page.locator('context-media card-mediaqueries')

		// Motion preference should be detected
		const motionText = await componentWithContext
			.locator('.motion')
			.textContent()
		expect(['no-preference', 'reduce']).toContain(motionText)

		// Theme preference should be detected
		const themeText = await componentWithContext.locator('.theme').textContent()
		expect(['light', 'dark']).toContain(themeText)

		// Viewport should be detected based on current window size
		const viewportText = await componentWithContext
			.locator('.viewport')
			.textContent()
		expect(['xs', 'sm', 'md', 'lg', 'xl']).toContain(viewportText)

		// Orientation should be detected
		const orientationText = await componentWithContext
			.locator('.orientation')
			.textContent()
		expect(['portrait', 'landscape']).toContain(orientationText)
	})

	test('responds to media query changes', async ({ page, isMobile }) => {
		const componentWithContext = page.locator('context-media card-mediaqueries')

		// Change viewport size to trigger media query changes
		if (!isMobile) {
			// Test desktop -> mobile transition
			await page.setViewportSize({ width: 400, height: 600 })
			await page.waitForTimeout(100) // Allow time for media query listeners

			const mobileViewport = await componentWithContext
				.locator('.viewport')
				.textContent()

			// Should show mobile viewport size
			expect(['xs', 'sm']).toContain(mobileViewport)

			// Change back to desktop
			await page.setViewportSize({ width: 1200, height: 800 })
			await page.waitForTimeout(100)

			const desktopViewport = await componentWithContext
				.locator('.viewport')
				.textContent()

			// Should show larger viewport size
			expect(['md', 'lg', 'xl']).toContain(desktopViewport)

			// Values should have changed
			expect(mobileViewport).not.toBe(desktopViewport)
		}
	})

	test('context provider supports custom breakpoints via attributes', async ({
		page,
	}) => {
		// Add custom breakpoint attributes to the context-media element
		await page.evaluate(() => {
			const contextMedia = document.querySelector('context-media')
			if (contextMedia) {
				contextMedia.setAttribute('sm', '40em')
				contextMedia.setAttribute('md', '60em')
				contextMedia.setAttribute('lg', '80em')
				contextMedia.setAttribute('xl', '120em')
			}
		})

		// Wait a moment for the changes to take effect
		await page.waitForTimeout(100)

		const componentWithContext = page.locator('context-media card-mediaqueries')

		// Viewport should still be a valid value
		const viewportText = await componentWithContext
			.locator('.viewport')
			.textContent()
		expect(['xs', 'sm', 'md', 'lg', 'xl']).toContain(viewportText)
	})

	test('multiple components receive same context values', async ({ page }) => {
		// Add another card-mediaqueries component inside the context provider
		await page.evaluate(() => {
			const contextMedia = document.querySelector('context-media')
			if (contextMedia) {
				const newCard = document.createElement('card-mediaqueries')
				newCard.innerHTML = `
					<h5>Additional Card</h5>
					<dl>
						<dt>Motion:</dt><dd class="motion"></dd>
						<dt>Theme:</dt><dd class="theme"></dd>
						<dt>Viewport:</dt><dd class="viewport"></dd>
						<dt>Orientation:</dt><dd class="orientation"></dd>
					</dl>
				`
				contextMedia.appendChild(newCard)
			}
		})

		const firstCard = page.locator('context-media card-mediaqueries').first()
		const secondCard = page.locator('context-media card-mediaqueries').nth(1)

		await expect(secondCard).toBeVisible()

		// Both cards should receive the same context values
		const [
			firstMotion,
			firstTheme,
			firstViewport,
			firstOrientation,
			secondMotion,
			secondTheme,
			secondViewport,
			secondOrientation,
		] = await Promise.all([
			firstCard.locator('.motion').textContent(),
			firstCard.locator('.theme').textContent(),
			firstCard.locator('.viewport').textContent(),
			firstCard.locator('.orientation').textContent(),
			secondCard.locator('.motion').textContent(),
			secondCard.locator('.theme').textContent(),
			secondCard.locator('.viewport').textContent(),
			secondCard.locator('.orientation').textContent(),
		])

		expect(firstMotion).toBe(secondMotion)
		expect(firstTheme).toBe(secondTheme)
		expect(firstViewport).toBe(secondViewport)
		expect(firstOrientation).toBe(secondOrientation)
	})
})
