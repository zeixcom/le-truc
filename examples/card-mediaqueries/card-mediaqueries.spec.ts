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
			await expect(component.locator('h2')).toBeVisible()
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

	test('context values differ from fallback values', async ({ page }) => {
		const componentWithoutContext = page.locator('card-mediaqueries').first()
		const componentWithContext = page.locator('context-media card-mediaqueries')

		// Get values from both components
		const [
			motionWithoutContext,
			motionWithContext,
			themeWithoutContext,
			themeWithContext,
			viewportWithoutContext,
			viewportWithContext,
			orientationWithoutContext,
			orientationWithContext,
		] = await Promise.all([
			componentWithoutContext.locator('.motion').textContent(),
			componentWithContext.locator('.motion').textContent(),
			componentWithoutContext.locator('.theme').textContent(),
			componentWithContext.locator('.theme').textContent(),
			componentWithoutContext.locator('.viewport').textContent(),
			componentWithContext.locator('.viewport').textContent(),
			componentWithoutContext.locator('.orientation').textContent(),
			componentWithContext.locator('.orientation').textContent(),
		])

		// Without context should always be 'unknown'
		expect(motionWithoutContext).toBe('unknown')
		expect(themeWithoutContext).toBe('unknown')
		expect(viewportWithoutContext).toBe('unknown')
		expect(orientationWithoutContext).toBe('unknown')

		// With context should be actual detected values (not 'unknown')
		expect(motionWithContext).not.toBe('unknown')
		expect(themeWithContext).not.toBe('unknown')
		expect(viewportWithContext).not.toBe('unknown')
		expect(orientationWithContext).not.toBe('unknown')
	})

	test('properties reflect context values', async ({ page }) => {
		const componentWithContext = page.locator('context-media card-mediaqueries')

		// Check that component properties are accessible and match displayed values
		const [
			displayedMotion,
			displayedTheme,
			displayedViewport,
			displayedOrientation,
		] = await Promise.all([
			componentWithContext.locator('.motion').textContent(),
			componentWithContext.locator('.theme').textContent(),
			componentWithContext.locator('.viewport').textContent(),
			componentWithContext.locator('.orientation').textContent(),
		])

		const [
			propertyMotion,
			propertyTheme,
			propertyViewport,
			propertyOrientation,
		] = await page.evaluate(() => {
			const element = document.querySelector(
				'context-media card-mediaqueries',
			) as any
			return [
				element.motion,
				element.theme,
				element.viewport,
				element.orientation,
			]
		})

		expect(propertyMotion).toBe(displayedMotion)
		expect(propertyTheme).toBe(displayedTheme)
		expect(propertyViewport).toBe(displayedViewport)
		expect(propertyOrientation).toBe(displayedOrientation)
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
					<h2>Additional Card</h2>
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

	// TODO: Re-enable this test when context-theme component is implemented
	// This test doesn't make sense with context-media since it always returns
	// the same browser/system values regardless of nesting
	test.skip('context isolation - nested providers override parent values', async ({
		page,
	}) => {
		// Create a nested context structure where inner context might override values
		await page.evaluate(() => {
			const outerContext = document.querySelector('context-media')
			if (outerContext) {
				const innerContext = document.createElement('context-media')
				const nestedCard = document.createElement('card-mediaqueries')
				nestedCard.innerHTML = `
					<h2>Nested Card</h2>
					<dl>
						<dt>Motion:</dt><dd class="motion"></dd>
						<dt>Theme:</dt><dd class="theme"></dd>
						<dt>Viewport:</dt><dd class="viewport"></dd>
						<dt>Orientation:</dt><dd class="orientation"></dd>
					</dl>
				`
				innerContext.appendChild(nestedCard)
				outerContext.appendChild(innerContext)
			}
		})

		const outerCard = page.locator('context-media > card-mediaqueries')
		const nestedCard = page.locator(
			'context-media context-media card-mediaqueries',
		)

		await expect(nestedCard).toBeVisible()

		// Both should receive context values (same source since it's media queries)
		const [outerMotion, nestedMotion] = await Promise.all([
			outerCard.locator('.motion').textContent(),
			nestedCard.locator('.motion').textContent(),
		])

		// Should both be valid motion preferences (not 'unknown')
		expect(['no-preference', 'reduce']).toContain(outerMotion)
		expect(['no-preference', 'reduce']).toContain(nestedMotion)
	})
})
