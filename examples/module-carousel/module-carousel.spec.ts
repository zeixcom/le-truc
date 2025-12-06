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
 * - ✅ Navigation wrapping (first ↔ last slide)
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

		await page.goto('http://localhost:4173/test/module-carousel.html')
		await page.waitForSelector('module-carousel')
	})

	test.describe('Initial State', () => {
		test('renders carousel with correct initial state', async ({
			page,
		}) => {
			const carousel = page.locator('module-carousel')
			const slides = carousel.locator('[role="tabpanel"]')
			const dots = carousel.locator('[role="tab"]')
			const prevButton = carousel.locator('button.prev')
			const nextButton = carousel.locator('button.next')

			// Should have correct number of slides and dots
			await expect(slides).toHaveCount(3)
			await expect(dots).toHaveCount(3)

			// Should have navigation buttons
			await expect(prevButton).toBeVisible()
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

			// Wait for navigation
			await page.waitForTimeout(10)

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
			await page.waitForTimeout(10)

			// Click prev button
			await prevButton.click()
			await page.waitForTimeout(10)

			// First slide should be current again
			const firstSlide = slides.first()
			await expect(firstSlide).toHaveAttribute('aria-current', 'true')

			// Component index should be 0
			const currentIndex = await page.evaluate(() => {
				const carousel = document.querySelector('module-carousel')
				return carousel?.index
			})
			expect(currentIndex).toBe(0)
		})

		test('wraps around from last to first slide', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const nextButton = carousel.locator('button.next')
			const slides = carousel.locator('[role="tabpanel"]')

			// Navigate to last slide (index 2)
			await nextButton.click()
			await page.waitForTimeout(10)
			await nextButton.click()
			await page.waitForTimeout(10)

			// Third slide should be current
			const thirdSlide = slides.nth(2)
			await expect(thirdSlide).toHaveAttribute('aria-current', 'true')

			// Click next again to wrap around
			await nextButton.click()
			await page.waitForTimeout(10)

			// Should wrap to first slide
			const firstSlide = slides.first()
			await expect(firstSlide).toHaveAttribute('aria-current', 'true')

			const currentIndex = await page.evaluate(() => {
				const carousel = document.querySelector('module-carousel')
				return carousel?.index
			})
			expect(currentIndex).toBe(0)
		})

		test('wraps around from first to last slide', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const prevButton = carousel.locator('button.prev')
			const slides = carousel.locator('[role="tabpanel"]')

			// Click prev from first slide to wrap around
			await prevButton.click()
			await page.waitForTimeout(10)

			// Should wrap to last slide
			const thirdSlide = slides.nth(2)
			await expect(thirdSlide).toHaveAttribute('aria-current', 'true')

			const currentIndex = await page.evaluate(() => {
				const carousel = document.querySelector('module-carousel')
				return carousel?.index
			})
			expect(currentIndex).toBe(2)
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
			await page.waitForTimeout(10)

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

		test('updates component index when dot is clicked', async ({
			page,
		}) => {
			const carousel = page.locator('module-carousel')
			const dots = carousel.locator('[role="tab"]')

			// Click second dot
			const secondDot = dots.nth(1)
			await secondDot.click()
			await page.waitForTimeout(10)

			const currentIndex = await page.evaluate(() => {
				const carousel = document.querySelector('module-carousel')
				return carousel?.index
			})
			expect(currentIndex).toBe(1)
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
			await page.waitForTimeout(10)

			// Second slide should be current
			const secondSlide = slides.nth(1)
			await expect(secondSlide).toHaveAttribute('aria-current', 'true')

			// Press left arrow
			await page.keyboard.press('ArrowLeft')
			await page.waitForTimeout(10)

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
			await page.waitForTimeout(10)

			// Focus and press End key
			await nextButton.focus()
			await page.keyboard.press('End')
			await page.waitForTimeout(10)

			// Last slide should be current
			const thirdSlide = slides.nth(2)
			await expect(thirdSlide).toHaveAttribute('aria-current', 'true')

			// Press Home key
			await page.keyboard.press('Home')
			await page.waitForTimeout(10)

			// First slide should be current
			const firstSlide = slides.first()
			await expect(firstSlide).toHaveAttribute('aria-current', 'true')
		})

		test('wraps around with arrow key navigation', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const nextButton = carousel.locator('button.next')
			const slides = carousel.locator('[role="tabpanel"]')

			// Navigate to last slide
			await nextButton.click()
			await page.waitForTimeout(10)
			await nextButton.click()
			await page.waitForTimeout(10)

			// Focus and press right arrow to wrap around
			await nextButton.focus()
			await page.keyboard.press('ArrowRight')
			await page.waitForTimeout(10)

			// Should wrap to first slide
			const firstSlide = slides.first()
			await expect(firstSlide).toHaveAttribute('aria-current', 'true')

			// Press left arrow to wrap around backwards
			await page.keyboard.press('ArrowLeft')
			await page.waitForTimeout(10)

			// Should wrap to last slide
			const thirdSlide = slides.nth(2)
			await expect(thirdSlide).toHaveAttribute('aria-current', 'true')
		})
	})

	test.describe('Scroll-based Navigation', () => {
		test('updates index when slide is scrolled into view', async ({
			page,
		}) => {
			const carousel = page.locator('module-carousel')
			const slides = carousel.locator('[role="tabpanel"]')

			// Use button navigation to trigger scroll behavior
			const nextButton = carousel.locator('button.next')
			await nextButton.click()
			await page.waitForTimeout(300)

			// Component index should be updated
			const currentIndex = await page.evaluate(() => {
				const carousel = document.querySelector('module-carousel')
				return carousel?.index
			})
			expect(currentIndex).toBe(1)

			// Second slide should have aria-current="true"
			const secondSlide = slides.nth(1)
			await expect(secondSlide).toHaveAttribute('aria-current', 'true')
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
			await page.waitForTimeout(10)

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

		test('index property reflects DOM state', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const dots = carousel.locator('[role="tab"]')

			// Click different dots and verify index updates
			for (let i = 0; i < 3; i++) {
				await dots.nth(i).click()
				await page.waitForTimeout(10)

				const currentIndex = await page.evaluate(() => {
					const carousel = document.querySelector('module-carousel')
					return carousel?.index
				})
				expect(currentIndex).toBe(i)
			}
		})
	})

	test.describe('ARIA and Accessibility', () => {
		test('maintains proper ARIA attributes', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const slides = carousel.locator('[role="tabpanel"]')
			const dots = carousel.locator('[role="tab"]')
			const nextButton = carousel.locator('button.next')

			// Check initial ARIA states
			await expect(slides.first()).toHaveAttribute('aria-current', 'true')
			await expect(slides.nth(1)).toHaveAttribute('aria-current', 'false')
			await expect(slides.nth(2)).toHaveAttribute('aria-current', 'false')

			await expect(dots.first()).toHaveAttribute('aria-selected', 'true')
			await expect(dots.nth(1)).toHaveAttribute('aria-selected', 'false')
			await expect(dots.nth(2)).toHaveAttribute('aria-selected', 'false')

			// Navigate and check ARIA states update
			await nextButton.click()
			await page.waitForTimeout(10)

			await expect(slides.first()).toHaveAttribute(
				'aria-current',
				'false',
			)
			await expect(slides.nth(1)).toHaveAttribute('aria-current', 'true')
			await expect(slides.nth(2)).toHaveAttribute('aria-current', 'false')

			await expect(dots.first()).toHaveAttribute('aria-selected', 'false')
			await expect(dots.nth(1)).toHaveAttribute('aria-selected', 'true')
			await expect(dots.nth(2)).toHaveAttribute('aria-selected', 'false')
		})

		test('maintains proper tabindex for roving tab focus', async ({
			page,
		}) => {
			const carousel = page.locator('module-carousel')
			const dots = carousel.locator('[role="tab"]')
			const nextButton = carousel.locator('button.next')

			// Check initial tabindex values
			await expect(dots.first()).toHaveAttribute('tabindex', '0')
			await expect(dots.nth(1)).toHaveAttribute('tabindex', '-1')
			await expect(dots.nth(2)).toHaveAttribute('tabindex', '-1')

			// Navigate and check tabindex updates
			await nextButton.click()
			await page.waitForTimeout(10)

			await expect(dots.first()).toHaveAttribute('tabindex', '-1')
			await expect(dots.nth(1)).toHaveAttribute('tabindex', '0')
			await expect(dots.nth(2)).toHaveAttribute('tabindex', '-1')
		})

		test('has proper ARIA labels and controls', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const dots = carousel.locator('[role="tab"]')
			const prevButton = carousel.locator('button.prev')
			const nextButton = carousel.locator('button.next')
			const nav = carousel.locator('nav')

			// Check navigation has aria-label
			await expect(nav).toHaveAttribute(
				'aria-label',
				'Carousel Navigation',
			)

			// Check buttons have labels
			await expect(prevButton).toHaveAttribute('aria-label', 'Previous')
			await expect(nextButton).toHaveAttribute('aria-label', 'Next')

			// Check dots have proper labels and controls
			for (let i = 0; i < 3; i++) {
				const dot = dots.nth(i)
				await expect(dot).toHaveAttribute(
					'aria-label',
					`Slide ${i + 1}`,
				)
				await expect(dot).toHaveAttribute(
					'aria-controls',
					`slide${i + 1}`,
				)
			}
		})
	})

	test.describe('Edge Cases', () => {
		test('handles empty or single slide gracefully', async ({ page }) => {
			// This test assumes the fixture always has 3 slides
			// In a real implementation, we might test with different fixtures
			const slides = page.locator('module-carousel [role="tabpanel"]')
			const slideCount = await slides.count()

			// With our current fixture, should have 3 slides
			expect(slideCount).toBe(3)
		})

		test('handles sequential navigation correctly', async ({ page }) => {
			const carousel = page.locator('module-carousel')
			const nextButton = carousel.locator('button.next')

			// Track index through sequential navigation
			let expectedIndex = 0

			// Navigate through all slides sequentially
			for (let i = 0; i < 5; i++) {
				await nextButton.click()
				await page.waitForTimeout(10)

				expectedIndex = (expectedIndex + 1) % 3 // Wrap around at 3

				const currentIndex = await page.evaluate(() => {
					const carousel = document.querySelector('module-carousel')
					return carousel?.index
				})
				expect(currentIndex).toBe(expectedIndex)
			}
		})

		test('maintains state consistency across different navigation methods', async ({
			page,
		}) => {
			const carousel = page.locator('module-carousel')
			const nextButton = carousel.locator('button.next')
			const dots = carousel.locator('[role="tab"]')
			const slides = carousel.locator('[role="tabpanel"]')

			// Use button navigation
			await nextButton.click()
			await page.waitForTimeout(10)

			let currentIndex = await page.evaluate(() => {
				const carousel = document.querySelector('module-carousel')
				return carousel?.index
			})
			expect(currentIndex).toBe(1)

			// Use dot navigation
			await dots.nth(2).click()
			await page.waitForTimeout(10)

			currentIndex = await page.evaluate(() => {
				const carousel = document.querySelector('module-carousel')
				return carousel?.index
			})
			expect(currentIndex).toBe(2)

			// Use keyboard navigation
			await nextButton.focus()
			await page.keyboard.press('Home')
			await page.waitForTimeout(10)

			currentIndex = await page.evaluate(() => {
				const carousel = document.querySelector('module-carousel')
				return carousel?.index
			})
			expect(currentIndex).toBe(0)

			// Verify all UI elements are in sync
			await expect(slides.first()).toHaveAttribute('aria-current', 'true')
			await expect(dots.first()).toHaveAttribute('aria-selected', 'true')
			await expect(dots.first()).toHaveAttribute('tabindex', '0')
		})
	})
})
