import { expect, test } from '@playwright/test'

/**
 * Test Suite: module-lazyload Component
 *
 * Comprehensive tests for the Le Truc module-lazyload component, which provides
 * asynchronous loading of HTML content from external sources with proper error
 * handling and loading states.
 *
 * Key Features Tested:
 * - ✅ Basic content loading and rendering
 * - ✅ Loading state display (the live pending arm; per-arm cloning — LT-449)
 * - ✅ Error handling for various failure scenarios
 * - ✅ Content replacement and DOM injection
 * - ✅ Recursive loading prevention
 * - ✅ URL validation and security checks
 * - ✅ Dynamic src attribute changes with stale dimming during re-fetch
 * - ✅ Arm adoption ordering for the scroll beside-watch (LT-449's probe)
 * - ✅ Graceful handling of empty content
 * - ✅ CSS in loaded content (scripts are stripped by the compiled
 *   `truc:html` sanitizer — the script-execution legs moved to the
 *   LT-448 follow-up)
 * - ✅ Inert custom-element markup in loaded content (shake-hands)
 *
 * Architecture Notes:
 * - Uses `asURL`-style src parsing with validation and security checks
 * - Implements `fetchWithCache` for HTTP caching support
 * - The compiled async boundary (`<truc:try>`) clones arms from the
 *   server-baked templates; when ok, no callout exists in the DOM
 * - Manages loading/error states through the boundary's arm routing
 * - Protects against recursive loading scenarios
 */

test.describe('module-lazyload component', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', msg => {
			console.log(`[browser] ${msg.type()}: ${msg.text()}`)
		})

		await page.goto('/test/module-lazyload')
		await page.waitForSelector('module-lazyload')
	})

	test.describe('Basic Loading Functionality', () => {
		test('loads and displays simple content successfully', async ({ page }) => {
			const loader = page.locator('module-lazyload').first()
			const loading = loader.locator('.loading')
			const content = loader.locator('.content')
			const error = loader.locator('.error')
			const callout = loader.locator('card-callout')

			// Wait for content to load successfully
			await expect(content).toBeVisible({ timeout: 1000 })

			// The compiled boundary clones its arms (LT-449): when ok, the
			// callout arms do not exist in the DOM at all — no hidden
			// leftovers (re-ruled expectation, ITERATION ruling 10).
			await expect(loading).toHaveCount(0)
			await expect(error).toHaveCount(0)
			await expect(callout).toHaveCount(0)

			// Verify content was loaded correctly
			await expect(content).toContainText('Simple Text Content')
			await expect(content).toContainText('This is a simple text snippet')
		})

		test('loads content with styles and applies them correctly', async ({
			page,
		}) => {
			const loader = page.locator('#complex-content-test')
			const content = loader.locator('.content')

			// Wait for content to load
			await expect(content).toBeVisible({ timeout: 1000 })

			// Verify styled content is present and styles are applied
			await expect(content).toContainText('Styled Content')
			const styledContent = content.locator('.styled-content')
			await expect(styledContent).toBeVisible()

			// Check that styles are applied (border should be visible)
			const borderStyle = await styledContent.evaluate(
				el => getComputedStyle(el).border,
			)
			expect(borderStyle).toContain('2px')
		})

		test('loads and initializes nested custom components', async ({ page }) => {
			const loader = page.locator('#nested-components-test')
			const content = loader.locator('.content')

			// Wait for content to load
			await expect(content).toBeVisible({ timeout: 1000 })

			// Verify nested components are present
			await expect(content).toContainText('Nested Components')
			const nestedCard = content.locator('card-callout')
			await expect(nestedCard).toBeVisible()

			const counter = content.locator('basic-counter')
			await expect(counter).toBeVisible()

			const hello = content.locator('basic-hello')
			await expect(hello).toBeVisible()

			// Test that nested components are present with correct structure
			const incrementButton = counter.locator('button')
			const counterValue = counter.locator('.value')

			// Verify components have expected initial content
			await expect(counterValue).toBeVisible()
			await expect(incrementButton).toBeVisible()
		})

		test('handles empty content gracefully', async ({ page }) => {
			const loader = page.locator('#empty-content-test')
			const loading = loader.locator('.loading')
			const content = loader.locator('.content')
			const error = loader.locator('.error')
			const callout = loader.locator('card-callout')

			// Wait for loading to complete
			await expect(loading).toBeHidden({ timeout: 5000 })

			// Content area should be hidden if empty
			await expect(content).toBeHidden()
			await expect(error).toBeHidden()
			await expect(callout).toBeHidden()

			// Content should be empty or contain only whitespace/comments
			const contentText = await content.textContent()
			expect(contentText?.trim()).toBe('')
		})
	})

	test.describe('Error Handling', () => {
		test('shows error for invalid URLs', async ({ page }) => {
			const loader = page.locator('#invalid-url-test')
			const loading = loader.locator('.loading')
			const content = loader.locator('.content')
			const error = loader.locator('.error')
			const callout = loader.locator('card-callout')

			// Should show error state quickly since URL validation happens immediately
			await expect(error).toBeVisible({ timeout: 1000 })
			await expect(loading).toBeHidden()
			await expect(content).toBeHidden()
			await expect(callout).toBeVisible()
			await expect(callout).toHaveClass('danger')

			// Verify error message indicates URL problem
			const errorText = await error.textContent()
			expect(errorText).toMatch(/invalid|url|error/i)
		})

		test('shows error for 404 not found', async ({ page }) => {
			const loader = page.locator('#not-found-test')
			const loading = loader.locator('.loading')
			const content = loader.locator('.content')
			const error = loader.locator('.error')
			const callout = loader.locator('card-callout')

			// Should eventually show error due to 404
			await expect(error).toBeVisible({ timeout: 1000 })
			await expect(loading).toBeHidden()
			await expect(content).toBeHidden()
			await expect(callout).toBeVisible()
			await expect(callout).toHaveClass('danger')

			// Verify error message indicates 404
			const errorText = await error.textContent()
			expect(errorText).toMatch(/404|not found/i)
		})

		test('shows error for cross-origin URLs', async ({ page }) => {
			const loader = page.locator('#cross-origin-test')
			const error = loader.locator('.error')
			const callout = loader.locator('card-callout')

			// Should show error for cross-origin URL
			await expect(error).toBeVisible({ timeout: 1000 })
			await expect(callout).toHaveClass('danger')

			// Verify error message indicates origin problem
			const errorText = await error.textContent()
			expect(errorText).toMatch(/origin|invalid/i)
		})

		test('shows error when src attribute is missing', async ({ page }) => {
			const loader = page.locator('#no-src-test')
			const error = loader.locator('.error')
			const callout = loader.locator('card-callout')

			// Should show error immediately for missing src
			await expect(error).toBeVisible({ timeout: 1000 })
			await expect(callout).toHaveClass('danger')

			// Verify error message indicates missing URL
			const errorText = await error.textContent()
			expect(errorText).toMatch(/no url provided|url/i)
		})

		test('prevents recursive loading', async ({ page }) => {
			const loader = page.locator('#recursive-test')
			const outerLoading = loader.locator('> card-callout > .loading')
			const outerContent = loader.locator('> .content')
			const outerError = loader.locator('> card-callout > .error')
			const outerCallout = loader.locator('> card-callout')

			// Wait for outer content to load (should succeed)
			await expect(outerContent).toBeVisible({ timeout: 1000 })
			await expect(outerLoading).toBeHidden()
			await expect(outerError).toBeHidden()
			await expect(outerCallout).toBeHidden()

			// The inner module-lazyload should show error due to recursion detection
			const innerError = outerContent.locator('module-lazyload .error:visible')
			const innerCallout = outerContent.locator(
				'module-lazyload card-callout.danger',
			)

			await expect(innerError).toBeVisible()
			await expect(innerCallout).toBeVisible()

			// Verify error message indicates recursion problem
			const errorText = await innerError.textContent()
			expect(errorText).toMatch(/recursive|recursion/i)
		})
	})

	test.describe('Dynamic Behavior', () => {
		test('updates content when src property changes', async ({ page }) => {
			const loader = page.locator('#dynamic-src-test')
			const content = loader.locator('.content')
			const error = loader.locator('.error')

			// Set src property to start loading
			await loader.evaluate(node => {
				;(node as any).src = '/test/module-lazyload/mocks/simple-text.html'
			})

			// Should load content successfully
			await expect(content).toBeVisible({ timeout: 1000 })
			await expect(content).toContainText('Simple Text Content')
			await expect(error).toBeHidden()

			// Change to different content
			await loader.evaluate(node => {
				;(node as any).src = '/test/module-lazyload/mocks/with-styles.html'
			})

			// Should load new content
			await expect(content).toContainText('Styled Content', {
				timeout: 5000,
			})
		})

		test('handles src property changes programmatically', async ({ page }) => {
			const loader = page.locator('#dynamic-src-test')
			const content = loader.locator('.content')

			// Set src property programmatically
			await loader.evaluate(node => {
				;(node as any).src = '/test/module-lazyload/mocks/simple-text.html'
			})

			// Should load content
			await expect(content).toBeVisible({ timeout: 1000 })
			await expect(content).toContainText('Simple Text Content')

			// Verify property reflects the URL
			const srcProperty = await loader.evaluate(node => (node as any).src)
			expect(srcProperty).toContain('simple-text.html')
		})

		test('dims content while re-fetching after src property changes', async ({
			page,
		}) => {
			const loader = page.locator('#dynamic-src-test')
			const content = loader.locator('.content')

			// Load initial content
			await loader.evaluate(node => {
				;(node as any).src = '/test/module-lazyload/mocks/simple-text.html'
			})
			await expect(content).toBeVisible({ timeout: 1000 })
			await expect(content).toContainText('Simple Text Content')

			// Intercept next fetch to introduce a delay, giving time to observe stale state
			let resolveDelay!: () => void
			const delayPromise = new Promise<void>(resolve => {
				resolveDelay = resolve
			})
			await page.route('**/mocks/with-styles.html', async route => {
				await delayPromise
				await route.continue()
			})

			// Change src — task enters stale state (re-fetching with retained value)
			await loader.evaluate(node => {
				;(node as any).src = '/test/module-lazyload/mocks/with-styles.html'
			})

			// While re-fetching: content is still visible but dimmed
			await expect(content).toBeVisible()
			await page.waitForFunction(
				el => (el as HTMLElement).style.opacity === 'var(--opacity-dimmed)',
				await content.elementHandle(),
				{ timeout: 1000 },
			)
			const opacityDuringFetch = await content.evaluate(
				el => (el as HTMLElement).style.opacity,
			)
			expect(opacityDuringFetch).toBe('var(--opacity-dimmed)')

			// Release the delayed fetch
			resolveDelay()

			// After load: new content visible, opacity style removed
			await expect(content).toContainText('Styled Content', { timeout: 3000 })
			const opacityAfterLoad = await content.evaluate(
				el => (el as HTMLElement).style.opacity,
			)
			expect(opacityAfterLoad).toBe('')
		})

		test('clears content when src becomes invalid', async ({ page }) => {
			const loader = page.locator('#dynamic-src-test')
			const content = loader.locator('.content')
			const error = loader.locator('.error')

			// Set valid src first
			await loader.evaluate(node => {
				;(node as any).src = '/test/module-lazyload/mocks/simple-text.html'
			})

			// Wait for content to load
			await expect(content).toBeVisible({ timeout: 1000 })

			// Change to invalid src
			await loader.evaluate(node => {
				;(node as any).src = 'invalid-url'
			})

			// Should show error and hide content
			await expect(error).toBeVisible({ timeout: 1000 })
			await expect(content).toBeHidden()
		})

		test('scrolls to a heading of the freshly adopted arm on a later src change', async ({
			page,
		}) => {
			// LT-449's ordering probe: the beside-watch's ok fire and the
			// boundary's arm adoption are both driven by the same task
			// settlement — the scroll's `query` into `.content` must run
			// AFTER reconcile has adopted the ok arm and its html watch has
			// written the partial, or the heading is not there yet.
			const loader = page.locator('#dynamic-src-test')
			const content = loader.locator('.content')

			await loader.evaluate(node => {
				;(node as any).src = '/test/module-lazyload/mocks/simple-text.html'
			})
			await expect(content).toContainText('Simple Text Content', {
				timeout: 5000,
			})

			// Record every scrollIntoView with the queried heading's
			// presence at call time.
			await page.evaluate(() => {
				const calls: { hadHeading: boolean }[] = []
				;(window as any).__scrollCalls = calls
				const original = Element.prototype.scrollIntoView
				Element.prototype.scrollIntoView = function (this: Element) {
					const heading = this.closest('.content')?.querySelector(
						'h1, h2, h3, h4, h5, h6',
					)
					calls.push({ hadHeading: heading !== null })
					return undefined
				}
				void original
			})

			await loader.evaluate(node => {
				;(node as any).src = '/test/module-lazyload/mocks/with-styles.html'
			})
			await expect(content).toContainText('Styled Content', {
				timeout: 5000,
			})

			// The scroll fired, and at every fire the freshly written
			// content already carried its heading.
			const calls = await page.evaluate(
				() => (window as any).__scrollCalls as { hadHeading: boolean }[],
			)
			expect(calls.length).toBeGreaterThanOrEqual(1)
			for (const call of calls) expect(call.hadHeading).toBe(true)
		})
	})

	test.describe('Component Properties and State', () => {
		test('src property returns string value', async ({ page }) => {
			const validLoader = page.locator('module-lazyload').first()
			const invalidLoader = page.locator('#cross-origin-test')

			// Valid URL should return the URL string
			const validSrc = await validLoader.evaluate(node => (node as any).src)
			expect(typeof validSrc).toBe('string')
			expect(validSrc).toBeTruthy()

			// Invalid URL should still return the string value
			const invalidSrc = await invalidLoader.evaluate(node => (node as any).src)
			expect(typeof invalidSrc).toBe('string')
			expect(invalidSrc).toBeTruthy()
		})
	})

	test.describe('DOM Structure and Accessibility', () => {
		test('authors the loading and error arms with status/alert roles', async ({
			page,
		}) => {
			const loader = page.locator('module-lazyload').first()

			// The arms ship as inert `<template>`s beside the live winner (the
			// pending arm renders live only until the first load settles), so
			// the roles are read off the templates' content.
			const roles = await loader.evaluate(el => {
				const template = (key: string): HTMLTemplateElement | null =>
					el.querySelector(`template[data-key="${key}"]`)
				const read = (key: string, selector: string): string | null =>
					template(key)
						?.content.querySelector(selector)
						?.getAttribute('role') ?? null
				return {
					loading: read('nil', 'p.loading'),
					error: read('err', 'p.error'),
					errorLive:
						template('err')
							?.content.querySelector('p.error')
							?.getAttribute('aria-live') ?? null,
				}
			})
			expect(roles.loading).toBe('status')
			expect(roles.error).toBe('alert')
			expect(roles.errorLive).toBe('assertive')
		})

		test('removes the callout arms entirely once content loads', async ({
			page,
		}) => {
			const loader = page.locator('#recursive-test')

			// After the outer load succeeds, the ok arm replaced the callout:
			// no callout exists in the DOM at all (LT-449's per-arm shape;
			// re-ruled expectation, ITERATION ruling 10 — the twin kept a
			// hidden callout beside the content).
			const content = loader.locator('> .content')
			await expect(content).toBeVisible({ timeout: 5000 })
			await expect(loader.locator('> card-callout')).toHaveCount(0)
			// The three arm templates stay inert beside the winner — the
			// client's source for every later clone.
			await expect(loader.locator('> template[data-arms]')).toHaveCount(3)
		})
	})

	test.describe('Content Integration', () => {
		// The compiled surface strips scripts from fetched content (the
		// `truc:html` sanitizer, fail-closed). The four script-execution
		// legs the twin's `allow-scripts` behavior had — 'executes JavaScript
		// in loaded content when allow-scripts is present', 'respects
		// allow-scripts attribute for script execution control', 'preserves
		// script type attributes when recreating scripts', and 'loads snippet
		// content independently in multiple instances' — are re-scoped to the
		// script-loading follow-up (LT-448's implementation task, LT-449's
		// entry names them). `mocks/module-with-type.html` stays as its test
		// input; `shake-hands` renders inert until that design rules.

		test('loads snippet content into light DOM', async ({ page }) => {
			const loader = page.locator('#original-snippet-test')

			// Wait for content to load
			const content = loader.locator('.content')
			await expect(content).toBeVisible({ timeout: 1000 })

			// Verify no shadow root — content renders in light DOM
			const hasShadowRoot = await loader.evaluate(el => !!el.shadowRoot)
			expect(hasShadowRoot).toBe(false)

			// shake-hands survives sanitization as an INERT element: markup
			// present, defining script stripped — the counter must NOT move
			// (the interim contract until LT-448's design rules).
			const shakeHands = content.locator('shake-hands')
			await expect(shakeHands).toBeVisible()
			await expect(shakeHands.locator('.count')).toHaveText('42')
			await shakeHands.locator('button').click()
			await expect(shakeHands.locator('.count')).toHaveText('42')

			// Styles from snippet.html are scoped to shake-hands, not body
			const bodyBgColor = await page.evaluate(
				() => getComputedStyle(document.body).backgroundColor,
			)
			expect(bodyBgColor).not.toContain('crimson')
		})

		test('properly isolates loaded content styles', async ({ page }) => {
			const loader = page.locator('#complex-content-test')
			const content = loader.locator('.content')

			// Wait for content to load
			await expect(content).toBeVisible({ timeout: 1000 })

			// Styles should only affect content within the component
			const styledContent = content.locator('.styled-content')
			await expect(styledContent).toBeVisible()

			// Check that styles don't leak outside the component
			const externalElement = page.locator('body')
			const externalBg = await externalElement.evaluate(
				el => getComputedStyle(el).background,
			)

			// External elements shouldn't have the styled content's background
			expect(externalBg).not.toContain('linear-gradient')
		})

		test('sanitizes a style tag that smuggles an event handler', async ({
			page,
		}) => {
			// LT-449 review: two vectors. A policy that splits `<style>` out
			// around the sanitizer and re-concatenates lets the first parse into
			// a live `<style onload>`; a custom-element attribute check that
			// admits `on*` keeps the second's `onfocus`, which `autofocus` fires
			// on insertion. Served inline: the payload is malformed by design.
			await page.route('**/mocks/style-injection.html', route =>
				route.fulfill({
					contentType: 'text/html',
					body: '<style a="</style>" onload=window.__lazyloadInjected=true <b>Injection probe</b></style><x-probe onfocus="window.__lazyloadInjected=true" autofocus tabindex="0"></x-probe><p>After the probe</p>',
				}),
			)
			const loader = page.locator('#dynamic-src-test')
			const content = loader.locator('.content')
			await loader.evaluate(node => {
				;(node as any).src = '/test/module-lazyload/mocks/style-injection.html'
			})
			// Wait on the ok arm, not the marker text: under a bypassed policy the
			// marker is swallowed into the smuggled style's raw text, and the
			// handler assertion below is the one that should report it.
			await expect(content).toHaveCount(1, { timeout: 1000 })
			const handlerAttrs = await content.evaluate(el =>
				[...el.querySelectorAll('*')].flatMap(child =>
					[...child.attributes]
						.map(attr => attr.name)
						.filter(name => name.startsWith('on')),
				),
			)
			expect(handlerAttrs).toEqual([])
			await expect(content).toContainText('After the probe')
			expect(
				await page.evaluate(() => (window as any).__lazyloadInjected),
			).toBeUndefined()
		})
	})
})
