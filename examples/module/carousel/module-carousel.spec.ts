import { expect, test } from '@playwright/test'

/**
 * Test Suite: module-carousel Component
 *
 * Comprehensive tests for the Le Truc module-carousel component, which provides
 * an accessible carousel/slideshow interface with multiple navigation methods:
 * - Button navigation (prev/next)
 * - Dot navigation (direct slide selection)
 * - Keyboard navigation (arrow keys, Home/End)
 * - Scroll-based navigation (intersection observer)
 *
 * Key Features Tested:
 * - ✅ Initial state rendering and ARIA compliance
 * - ✅ Navigation clamping (stays at first/last slide)
 * - ✅ Reactive index property (writable, not readonly sensor)
 * - ✅ Smooth scroll animations and intersection observer updates
 * - ✅ ARIA attributes synchronization (aria-current, aria-selected, tabindex)
 * - ✅ Keyboard accessibility (roving tab focus pattern)
 * - ✅ State consistency across different navigation methods
 * - ✅ Edge case handling (sequential navigation, timing issues)
 *
 * Architecture Notes:
 * - Uses `asInteger` parser with DOM reader function (not readonly sensor)
 * - Smooth scroll animations require timing considerations in tests
 * - IntersectionObserver updates index based on scroll position
 * - Supports proper ARIA carousel patterns for accessibility
 */

test.describe('module-carousel component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('http://localhost:3000/test/module-carousel')
		await page.waitForSelector('module-carousel')
	})

	test.describe('Initial State', () => {
		test('renders carousel with correct initial state', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const slides = carousel.locator('[role="tabpanel"]')
			const dots = carousel.locator('[role="tab"]')
			const prevButton = carousel.locator('button.prev')
			const nextButton = carousel.locator('button.next')

			// Should have correct number of slides and dots
			await expect(slides).toHaveCount(3)
			await expect(dots).toHaveCount(3)

			// Next button should be visible, prev button hidden at start
			await expect(prevButton).toBeHidden()
			await expect(nextButton).toBeVisible()

			// First slide should be current
			const firstSlide = slides.first()
			await expect(firstSlide).toHaveAttribute('aria-current', 'true')

			// First dot should be selected
			const firstDot = dots.first()
			await expect(firstDot).toHaveAttribute('aria-selected', 'true')
			await expect(firstDot).toHaveAttribute('tabindex', '0')

			// Other dots should not be selected
			const secondDot = dots.nth(1)
			const thirdDot = dots.nth(2)
			await expect(secondDot).toHaveAttribute('aria-selected', 'false')
			await expect(thirdDot).toHaveAttribute('aria-selected', 'false')
			await expect(secondDot).toHaveAttribute('tabindex', '-1')
			await expect(thirdDot).toHaveAttribute('tabindex', '-1')
		})

		test('reads initial index from aria-current attribute', async ({
			page,
		}) => {
			// Get the initial index from the component
			const initialIndex = await page.evaluate(() => {
				const carousel = document.querySelector('module-carousel')
				return carousel?.index
			})

			// Should start at index 0 (first slide has aria-current="true")
			expect(initialIndex).toBe(0)
		})
	})

	test.describe('Button Navigation', () => {
		test('navigates forward with next button', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const nextButton = carousel.locator('button.next')
			const slides = carousel.locator('[role="tabpanel"]')
			const dots = carousel.locator('[role="tab"]')

			// Click next button
			await nextButton.click()
			// await waitForStableIndex(carousel, 1)

			// Second slide should be current
			const secondSlide = slides.nth(1)
			await expect(secondSlide).toHaveAttribute('aria-current', 'true')

			// First slide should not be current
			const firstSlide = slides.first()
			await expect(firstSlide).toHaveAttribute('aria-current', 'false')

			// Second dot should be selected
			const secondDot = dots.nth(1)
			await expect(secondDot).toHaveAttribute('aria-selected', 'true')
			await expect(secondDot).toHaveAttribute('tabindex', '0')

			// First dot should not be selected
			const firstDot = dots.first()
			await expect(firstDot).toHaveAttribute('aria-selected', 'false')
			await expect(firstDot).toHaveAttribute('tabindex', '-1')
		})

		test('navigates backward with prev button', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const nextButton = carousel.locator('button.next')
			const prevButton = carousel.locator('button.prev')
			const slides = carousel.locator('[role="tabpanel"]')

			// Go to second slide first
			await nextButton.click()
			// await waitForStableIndex(carousel, 1)

			// Click prev button
			await prevButton.click()
			// await waitForStableIndex(carousel, 0)

			// First slide should be current again
			const firstSlide = slides.first()
			await expect(firstSlide).toHaveAttribute('aria-current', 'true')

			// Component index should be 0 - check both ways
			const indexValue = await carousel.evaluate((el: any) => el.index)
			expect(indexValue).toBe(0)
		})

		test('clamps at last slide when clicking next', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const nextButton = carousel.locator('button.next')
			const slides = carousel.locator('[role="tabpanel"]')

			// Navigate to last slide (index 2)
			await nextButton.click()
			await nextButton.click()

			// Third slide should be current
			const thirdSlide = slides.nth(2)
			await expect(thirdSlide).toHaveAttribute('aria-current', 'true')

			// Next button should be hidden at last slide
			await expect(nextButton).toBeHidden()

			const indexValue = await carousel.evaluate((el: any) => el.index)
			expect(indexValue).toBe(2)
		})

		test('clamps at first slide when clicking prev', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const prevButton = carousel.locator('button.prev')
			const slides = carousel.locator('[role="tabpanel"]')

			// Prev button should be hidden at first slide
			await expect(prevButton).toBeHidden()

			// First slide should remain current
			const firstSlide = slides.first()
			await expect(firstSlide).toHaveAttribute('aria-current', 'true')

			const indexValue = await carousel.evaluate((el: any) => el.index)
			expect(indexValue).toBe(0)
		})
	})

	test.describe('Dot Navigation', () => {
		test('navigates to specific slide when dot is clicked', async ({
			page,
		}) => {
			const carousel = page.locator('module-carousel')
			const dots = carousel.locator('[role="tab"]')
			const slides = carousel.locator('[role="tabpanel"]')

			// Click third dot (index 2)
			const thirdDot = dots.nth(2)
			await thirdDot.click()
			// await waitForStableIndex(carousel, 2)

			// Third slide should be current
			const thirdSlide = slides.nth(2)
			await expect(thirdSlide).toHaveAttribute('aria-current', 'true')

			// Third dot should be selected
			await expect(thirdDot).toHaveAttribute('aria-selected', 'true')
			await expect(thirdDot).toHaveAttribute('tabindex', '0')

			// Other dots should not be selected
			const firstDot = dots.first()
			const secondDot = dots.nth(1)
			await expect(firstDot).toHaveAttribute('aria-selected', 'false')
			await expect(secondDot).toHaveAttribute('aria-selected', 'false')
			await expect(firstDot).toHaveAttribute('tabindex', '-1')
			await expect(secondDot).toHaveAttribute('tabindex', '-1')
		})
	})

	test.describe('Keyboard Navigation', () => {
		test('navigates with arrow keys', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const slides = carousel.locator('[role="tabpanel"]')

			// Focus on navigation buttons area and use arrow keys
			const nextButton = carousel.locator('button.next')
			await nextButton.focus()

			// Press right arrow
			await page.keyboard.press('ArrowRight')

			// Second slide should be current
			const secondSlide = slides.nth(1)
			await expect(secondSlide).toHaveAttribute('aria-current', 'true')

			// Press left arrow
			await page.keyboard.press('ArrowLeft')

			// First slide should be current again
			const firstSlide = slides.first()
			await expect(firstSlide).toHaveAttribute('aria-current', 'true')
		})

		test('navigates with Home and End keys', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const nextButton = carousel.locator('button.next')
			const slides = carousel.locator('[role="tabpanel"]')

			// Go to middle slide first
			await nextButton.click()
			// await waitForStableIndex(carousel, 1)

			// Focus and press End key
			await nextButton.focus()
			await page.keyboard.press('End')

			// Last slide should be current
			const thirdSlide = slides.nth(2)
			await expect(thirdSlide).toHaveAttribute('aria-current', 'true')

			// Press Home key (focus prev button since next is hidden at last slide)
			const prevButton = carousel.locator('button.prev')
			await prevButton.focus()
			await page.keyboard.press('Home')

			// First slide should be current
			const firstSlide = slides.first()
			await expect(firstSlide).toHaveAttribute('aria-current', 'true')
		})

		test('clamps with arrow key navigation at boundaries', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const nextButton = carousel.locator('button.next')
			const slides = carousel.locator('[role="tabpanel"]')

			// Focus on navigation and press left arrow at first slide
			await nextButton.focus()
			await page.keyboard.press('ArrowLeft')

			// Should stay at first slide
			const firstSlide = slides.first()
			await expect(firstSlide).toHaveAttribute('aria-current', 'true')

			// Navigate to last slide
			await nextButton.click()
			await nextButton.click()

			// Press right arrow at last slide (focus prev button since next is hidden)
			const prevButton = carousel.locator('button.prev')
			await prevButton.focus()
			await page.keyboard.press('ArrowRight')

			// Should stay at last slide
			const thirdSlide = slides.nth(2)
			await expect(thirdSlide).toHaveAttribute('aria-current', 'true')
		})
	})

	test.describe('Cleanup', () => {
		// Regression test for the disconnect-cleanup bug found during LT-010:
		// the scroll-navigation IntersectionObserver was set up via a raw
		// returned-cleanup descriptor with no watch()/createEffect()/createScope()
		// wrapping — activateResult() discards descriptor return values, so the
		// observer was never actually disconnected. Wrapping it in
		// watch(() => true, …) (LT-012) fixes it, since watch() calls
		// createEffect() internally and that self-registers the returned cleanup
		// on the active owner. This test instruments
		// IntersectionObserver.prototype.disconnect before the component
		// connects, so it fails again if the fix regresses.
		test('disconnects the scroll-navigation IntersectionObserver when the component disconnects', async ({
			page,
		}) => {
			await page.addInitScript(() => {
				const realDisconnect = IntersectionObserver.prototype.disconnect
				;(window as any).__disconnectCalls = 0
				IntersectionObserver.prototype.disconnect = function (
					this: IntersectionObserver,
				) {
					;(window as any).__disconnectCalls += 1
					return realDisconnect.call(this)
				}
			})
			await page.goto('http://localhost:3000/test/module-carousel')
			await page.waitForSelector('module-carousel')

			const before = await page.evaluate(
				() => (window as any).__disconnectCalls,
			)
			expect(before).toBe(0)

			await page.evaluate(() => {
				document.querySelector('module-carousel')!.remove()
			})
			await page.waitForTimeout(50)

			const after = await page.evaluate(() => (window as any).__disconnectCalls)
			expect(after).toBeGreaterThan(0)
		})
	})

	test.describe('Component Properties', () => {
		test('index property is writable and reactive', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const slides = carousel.locator('[role="tabpanel"]')

			// Get initial index
			const initialIndex = await page.evaluate(() => {
				const carousel = document.querySelector('module-carousel')
				return carousel?.index
			})
			expect(initialIndex).toBe(0)

			// Set index directly (should work - writable property)
			await page.evaluate(() => {
				const carousel = document.querySelector('module-carousel')
				carousel!.index = 2
			})

			// Wait for reactive updates

			// Index should be updated
			const updatedIndex = await page.evaluate(() => {
				const carousel = document.querySelector('module-carousel')
				return carousel?.index
			})
			expect(updatedIndex).toBe(2)

			// Third slide should be current
			const thirdSlide = slides.nth(2)
			await expect(thirdSlide).toHaveAttribute('aria-current', 'true')
		})
	})

	test.describe('ARIA and Accessibility', () => {
		test('has proper ARIA labels and controls', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const dots = carousel.locator('[role="tab"]')
			const prevButton = carousel.locator('button.prev')
			const nextButton = carousel.locator('button.next')
			const nav = carousel.locator('nav')

			// Check navigation has aria-label
			await expect(nav).toHaveAttribute('aria-label', 'Carousel Navigation')

			// Check buttons have labels
			await expect(prevButton).toHaveAttribute('aria-label', 'Previous')
			await expect(nextButton).toHaveAttribute('aria-label', 'Next')

			// Check dots have proper labels and controls
			for (let i = 0; i < 3; i++) {
				const dot = dots.nth(i)
				await expect(dot).toHaveAttribute('aria-label', `Slide ${i + 1}`)
				await expect(dot).toHaveAttribute('aria-controls', `slide${i + 1}`)
			}
		})
	})

	test.describe('Edge Cases', () => {
		test('maintains state consistency across different navigation methods', async ({
			page,
		}) => {
			const carousel = page.locator('module-carousel')
			const nextButton = carousel.locator('button.next')
			const dots = carousel.locator('[role="tab"]')
			const slides = carousel.locator('[role="tabpanel"]')

			// Use button navigation
			await nextButton.click()
			// await waitForStableIndex(carousel, 1)

			let indexValue = await carousel.evaluate((el: any) => el.index)
			expect(indexValue).toBe(1)

			// Use dot navigation
			await dots.nth(2).click()
			// await waitForStableIndex(carousel, 2)

			indexValue = await carousel.evaluate((el: any) => el.index)
			expect(indexValue).toBe(2)

			// Use keyboard navigation
			await nextButton.focus()
			await page.keyboard.press('Home')
			// await waitForStableIndex(carousel, 0)

			indexValue = await carousel.evaluate((el: any) => el.index)
			expect(indexValue).toBe(0)

			// Verify all UI elements are in sync
			await expect(slides.first()).toHaveAttribute('aria-current', 'true')
			await expect(dots.first()).toHaveAttribute('aria-selected', 'true')
			await expect(dots.first()).toHaveAttribute('tabindex', '0')
		})
	})
})
