import { expect, type Page, test } from '@playwright/test'

/**
 * Playwright-tier verification for `bindAria()` (LT-007) and the
 * element-internals-declaration registry (LT-008), per ADR 0026.
 *
 * The stale-attribute rule's contract halves are attribute-observable on
 * every engine; the internals side is read back through the declaration
 * registry (`globalThis._elementInternals` — tooling surface, ADR 0026 §3).
 * Computed-accessibility-tree ground truth for the underlying reflection
 * channels is pinned separately in `test/poc/` (Chromium CDP tier).
 */

const readAriaState = (page: Page, selector: string) =>
	page.evaluate((sel: string) => {
		const el = document.querySelector(sel)! as any
		return {
			attribute: el.getAttribute('aria-expanded'),
			internals: (globalThis as any)._elementInternals.get(el).ariaExpanded,
		}
	}, selector)

test.describe('test-aria: bindAria() + element-internals registry', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/test-aria')
		await page.waitForSelector('test-aria')
	})

	test('adopts the server-rendered aria-expanded as initial state', async ({
		page,
	}) => {
		await expect(page.locator('#default #state')).toHaveText('false')
		const expanded = await page.evaluate(
			() => (document.querySelector('#default') as any).expanded,
		)
		expect(expanded).toBe(false)
	})

	test('stale attribute removed at first assertion; reflection reaches internals', async ({
		page,
	}) => {
		const state = await readAriaState(page, '#default')
		expect(state.attribute).toBeNull()
		expect(state.internals).toBe('false')
	})

	test('reflection updates reach internals; attribute stays absent', async ({
		page,
	}) => {
		await page.evaluate(() => {
			;(document.querySelector('#default') as any).expanded = true
		})
		await expect(page.locator('#default #state')).toHaveText('true')
		const state = await readAriaState(page, '#default')
		expect(state.attribute).toBeNull()
		expect(state.internals).toBe('true')
	})

	test('Element target mirrors via the attribute channel — no removal', async ({
		page,
	}) => {
		const inner = page.locator('#default #inner')
		await expect(inner).toHaveAttribute('aria-expanded', 'false')
		await page.evaluate(() => {
			;(document.querySelector('#default') as any).expanded = true
		})
		await expect(inner).toHaveAttribute('aria-expanded', 'true')
	})

	test('consumer override set after connect survives later binding updates', async ({
		page,
	}) => {
		const el = page.locator('#default')
		// Move the component's own value first so a later change is a real
		// binding update.
		await page.evaluate(() => {
			;(document.querySelector('#default') as any).expanded = true
		})
		await expect(page.locator('#default #state')).toHaveText('true')
		// Consumer override via the attribute channel (§1 row 2)…
		await el.evaluate(node => node.setAttribute('aria-expanded', 'false'))
		// …then a binding update fires. A buggy every-ok removal would wipe
		// the override here; the one-shot rule must leave it in place.
		await page.evaluate(() => {
			;(document.querySelector('#default') as any).expanded = false
		})
		await expect(el).toHaveAttribute('aria-expanded', 'false')
		const internals = await page.evaluate(
			() =>
				(globalThis as any)._elementInternals.get(
					document.querySelector('#default'),
				).ariaExpanded,
		)
		expect(internals).toBe('false')
	})

	test('pending source: attribute keeps authority, internals stay unset', async ({
		page,
	}) => {
		const state = await readAriaState(page, '#pending')
		expect(state.attribute).toBe('false')
		expect(state.internals).toBeNull()
	})

	test('pending source: first resolved assertion removes the attribute', async ({
		page,
	}) => {
		await page.evaluate(() => {
			;(document.querySelector('#pending') as any).resolve()
		})
		await expect
			.poll(async () => (await readAriaState(page, '#pending')).attribute)
			.toBeNull()
		const state = await readAriaState(page, '#pending')
		expect(state.internals).toBe('true')
	})
})

test.describe('test-aria: axe-core visibility via the declaration registry', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/test-aria')
		// The trap elements have no content (zero height), so the default
		// visible state would never settle — attached is the right wait here.
		await page.waitForSelector('test-aria-trap', { state: 'attached' })
		await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' })
	})

	const axeViolations = (page: Page, selector: string) =>
		page.evaluate(async (sel: string) => {
			const result = await (globalThis as any).axe.run(
				document.querySelector(sel),
			)
			return (result.violations as Array<{ id: string }>).map(v => v.id)
		}, selector)

	test('registered component with an invalid attribute is flagged (LT-005 trap)', async ({
		page,
	}) => {
		const violations = await axeViolations(page, '#trap')
		expect(violations).toContain('aria-allowed-attr')
	})

	test('registered correct component stays clean', async ({ page }) => {
		const violations = await axeViolations(page, '#trap-ok')
		expect(violations).toEqual([])
	})
})
