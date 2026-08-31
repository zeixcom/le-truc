/**
 * LT-005 verification: element-internals-declaration registration + the
 * axe-core visibility gate (ADR 0026 §3) — poc-truc-registration.ts.
 *
 * Assertions are pinned to behavior OBSERVED on 2026-08-31 (Playwright 1.62,
 * Chromium, axe-core 4.13). Findings and rationale in test/poc/README.md.
 */
import { expect, test } from '@playwright/test'
import { engineOf, runAxe } from './fixtures/aria'

test.beforeEach(async ({ page }) => {
	await page.goto('/registration')
	await page
		.locator('poc-reg-button-trap')
		.first()
		.waitFor({ state: 'attached' })
})

test('registry is populated at construction, unconditionally (no DEV_MODE gate in the probe)', async ({
	page,
}) => {
	const registered = await page.evaluate(() => {
		const registry = (
			globalThis as unknown as {
				_elementInternals?: WeakMap<Element, ElementInternals>
			}
		)._elementInternals
		return {
			trap: registry?.has(document.querySelector('#btn-trap') as Element),
			ok: registry?.has(document.querySelector('#btn-ok') as Element),
			// The negative-baseline element deliberately never registers —
			// confirms the registry isn't populated by some other global
			// mechanism (e.g. a MutationObserver watching all custom elements).
			unreg: registry?.has(document.querySelector('#btn-unreg') as Element),
		}
	})
	expect(registered).toEqual({ trap: true, ok: true, unreg: false })
})

test('the trap flips from silent-pass to flagged: identical internals.role + invalid aria-checked attribute, registered vs. not', async ({
	page,
}) => {
	test.skip(
		engineOf(page) !== 'chromium',
		'axe-core registry behavior verified against Chromium only, consistent with the rest of the PoC',
	)

	// Registered: axe computes role='button' via elementInternals (no [role]
	// attribute present), and aria-allowed-attr correctly flags aria-checked
	// as invalid for that role.
	const trap = await runAxe(page, '#btn-trap')
	expect(trap.map(v => v.id)).toContain('aria-allowed-attr')

	// Not registered (today's status quo, before this task's change):
	// identical markup and internals.role, but axe cannot see the role at
	// all, so aria-checked is evaluated against no role constraint and stays
	// silent — the exact false-negative ADR 0016's original advisory worried
	// about, reproduced on the same page in the same axe.run() pass.
	const unreg = await runAxe(page, '#btn-unreg')
	expect(unreg.map(v => v.id)).not.toContain('aria-allowed-attr')
})

test('registration does not blanket-flag every internals-role element', async ({
	page,
}) => {
	test.skip(
		engineOf(page) !== 'chromium',
		'axe-core registry behavior verified against Chromium only, consistent with the rest of the PoC',
	)

	// Same internals.role='button' registration as the trap, no invalid
	// attribute — must stay clean.
	const ok = await runAxe(page, '#btn-ok')
	expect(ok.map(v => v.id)).not.toContain('aria-allowed-attr')
})

test('one WeakMap entry per instance: attachInternals() runs once ever (constructor, not connectedCallback), so nothing leaks across connect/disconnect/reconnect cycles', async ({
	page,
}) => {
	const cycle = await page.evaluate(async () => {
		const host = document.querySelector('#cycle-host') as Element
		const el = document.createElement('poc-reg-button-trap') as HTMLElement & {
			attachCount: number
			internals: ElementInternals
		}
		host.appendChild(el)
		await new Promise(r => requestAnimationFrame(r))
		const registry = (
			globalThis as unknown as {
				_elementInternals?: WeakMap<Element, ElementInternals>
			}
		)._elementInternals
		const firstInternals = registry?.get(el)
		// Disconnect + reconnect twice — connectedCallback/disconnectedCallback
		// fire repeatedly, but the constructor (and its attachInternals() +
		// registry.set() call) never re-runs for an existing instance.
		el.remove()
		host.appendChild(el)
		el.remove()
		host.appendChild(el)
		const secondInternals = registry?.get(el)
		return {
			attachCount: el.attachCount,
			sameInternalsIdentity: firstInternals === secondInternals,
			sameAsOwnInternals: secondInternals === el.internals,
		}
	})
	expect(cycle).toEqual({
		attachCount: 1,
		sameInternalsIdentity: true,
		sameAsOwnInternals: true,
	})
})
