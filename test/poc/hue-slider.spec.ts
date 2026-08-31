/**
 * LT-002 verification: the host default-semantics channel (ADR 0026 §1)
 * against the hardest real case — the colorgraph hue slider
 * (poc-hue-slider.ts, modeled on examples/form/colorgraph/form-colorgraph.ts)
 * — plus the no-mixing wrinkle (poc-stale-expanded.ts).
 *
 * Assertions are pinned to behavior OBSERVED on 2026-08-31 (Playwright 1.62,
 * Chromium). Findings and rationale in test/poc/README.md.
 */
import { expect, test } from '@playwright/test'
import { computedAriaTree, engineOf } from './fixtures/aria'

test.beforeEach(async ({ page }) => {
	await page.goto('/hue-slider')
	await page.locator('poc-hue-slider').first().waitFor({ state: 'attached' })
})

test('internals-only: role, bounds, and live value/text all reach the AX tree', async ({
	page,
}) => {
	test.skip(engineOf(page) !== 'chromium', 'CDP AX tree is Chromium-only')

	await page.evaluate(() => {
		const el = document.querySelector('#slider-internals') as HTMLElement & {
			setHue(deg: number): void
		}
		el.setHue(120)
	})
	const tree = await computedAriaTree(page, '#slider-internals')
	expect(tree.role).toBe('slider')
	expect(tree.props.valuemin).toBe('0')
	expect(tree.props.valuemax).toBe('360')
	expect(tree.value).toBe('120')
	const idl = await page.evaluate(() => {
		const el = document.querySelector('#slider-internals')
		const registry = (
			globalThis as unknown as {
				_elementInternals?: WeakMap<Element, ElementInternals>
			}
		)._elementInternals
		const internals = registry?.get(el as Element)
		return {
			valuemin: internals?.ariaValueMin,
			valuemax: internals?.ariaValueMax,
			valuenow: internals?.ariaValueNow,
			valuetext: internals?.ariaValueText,
		}
	})
	expect(idl).toEqual({
		valuemin: '0',
		valuemax: '360',
		valuenow: '120',
		valuetext: '120°',
	})
})

test('consumer override wins over the internals default, and removing it restores the internals value', async ({
	page,
}) => {
	test.skip(engineOf(page) !== 'chromium', 'CDP AX tree is Chromium-only')

	// #slider-override authors a static aria-valuenow="270" in HTML; the
	// component's own default is 0 (its connectedCallback calls
	// setHue(0)). The platform's default-semantics model — the override
	// claim ADR 0026 §1 rests on — should let the attribute win.
	const before = await computedAriaTree(page, '#slider-override')
	expect(before.value).toBe('270')

	await page.evaluate(() =>
		document
			.querySelector('#slider-override')
			?.removeAttribute('aria-valuenow'),
	)
	await expect
		.poll(async () => (await computedAriaTree(page, '#slider-override')).value)
		.toBe('0')
})

test('no glitching under high-frequency updates: throttle coalesces to one flush per frame', async ({
	page,
}) => {
	const flush = await page.evaluate(async () => {
		const el = document.querySelector('#slider-internals') as HTMLElement & {
			setHue(deg: number): void
			flushCount: number
		}
		const before = el.flushCount
		for (let i = 0; i < 50; i++) el.setHue(i * 7)
		await new Promise(r =>
			requestAnimationFrame(() => requestAnimationFrame(r)),
		)
		return { before, after: el.flushCount }
	})
	// 50 synchronous setHue() calls collapse into exactly one throttled
	// flush (cause-effect's per-animation-frame dedup, M5) — the same
	// pattern form-colorgraph's real pointer handlers rely on.
	expect(flush.after - flush.before).toBe(1)
})

test('no-mixing wrinkle: a stale server-rendered aria-expanded permanently shadows the internals value', async ({
	page,
}) => {
	test.skip(engineOf(page) !== 'chromium', 'CDP AX tree is Chromium-only')

	await page.evaluate(() => {
		;(document.querySelector('#toggle-clean') as any).expand()
		;(document.querySelector('#toggle-stale') as any).expand()
		;(document.querySelector('#toggle-mitigated') as any).expand()
	})

	// Clean (no host attribute): internals value governs.
	expect((await computedAriaTree(page, '#toggle-clean')).props.expanded).toBe(
		'true',
	)
	// Stale, unmitigated: the SSR-authored aria-expanded="false" attribute
	// permanently shadows the runtime internals value — the failure mode
	// ADR 0026 §1's no-mixing note warns about. Calling expand() has no
	// observable effect in the computed tree.
	expect((await computedAriaTree(page, '#toggle-stale')).props.expanded).toBe(
		'false',
	)
	// Mitigated: the component drops its own stale attribute on connect,
	// before reflecting via internals, restoring internals authority.
	expect(
		(await computedAriaTree(page, '#toggle-mitigated')).props.expanded,
	).toBe('true')
})
