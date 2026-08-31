/**
 * LT-001 verification: the harness must distinguish attribute-set from
 * internals-set ARIA on a trivial throwaway component (`poc-probe` on
 * /basic), in every engine we run, and the observations feed the findings
 * matrix in test/poc/README.md.
 *
 * Three probe instances (see poc-basic.ts):
 *   #via-internals — semantics ONLY via ElementInternals
 *   #via-attribute — identical semantics via content attributes
 *   #via-both      — internals defaults overridden by content attributes
 *
 * Assertions are pinned to behavior OBSERVED on 2026-08-31 (Playwright
 * 1.62, Chromium/Firefox/WebKit); where a tier cannot see internals that
 * is itself the pinned finding. A tooling or engine upgrade that changes
 * any of this should flip a test and force a README.md update.
 *
 * Corrected 2026-08-31 (LT-002): the original pass wrote to
 * `internals.ariaValuenow` (lowercase n) in poc-basic.ts — not the real
 * `ariaValueNow` IDL attribute — so it silently created an inert data
 * property instead of setting ARIA state. The resulting "internals-set
 * aria-valuenow never reaches the tree" finding was an artifact of that
 * typo, not a platform gap. Fixed in poc-basic.ts; see README.md.
 */
import { expect, test } from '@playwright/test'
import {
	ariaSnapshotOf,
	computedAriaTree,
	engineOf,
	runAxe,
} from './fixtures/aria'

test.beforeEach(async ({ page }) => {
	await page.goto('/basic')
	// The probes are empty custom elements — zero-sized, hence never
	// "visible" to Playwright. Attachment is the right readiness signal.
	await page.locator('poc-probe').first().waitFor({ state: 'attached' })
})

test('registry is populated for every probe instance (all engines)', async ({
	page,
}) => {
	const readback = await page.evaluate(() => {
		const registry = (
			globalThis as unknown as {
				_elementInternals?: WeakMap<Element, ElementInternals>
			}
		)._elementInternals
		if (!registry) return null
		return Array.from(document.querySelectorAll('poc-probe')).map(el => {
			const internals = registry.get(el)
			return {
				registered: internals != null,
				ariaLabel: internals?.ariaLabel ?? null,
			}
		})
	})
	// Every instance registers (the probe calls attachInternals + set
	// unconditionally); only the internals-driven modes carry an ariaLabel.
	expect(readback).toEqual([
		{ registered: true, ariaLabel: 'Internals only' },
		{ registered: true, ariaLabel: null },
		{ registered: true, ariaLabel: 'Internals both' },
	])
})

test('engine ground truth: internals-set role, name, and aria-valuenow all reach the AX tree', async ({
	page,
}) => {
	test.skip(engineOf(page) !== 'chromium', 'CDP AX tree is Chromium-only')

	const tree = await computedAriaTree(page, '#via-internals')
	// Chromium maps internals role, aria-label, AND aria-valuenow into the
	// computed tree (observed 2026-08-31, Chromium via Playwright 1.62,
	// correcting an earlier reading of this probe that wrote to a
	// mis-cased `ariaValuenow` property — a plain data property that does
	// nothing — instead of the real `ariaValueNow` IDL attribute; see
	// README.md for the correction).
	expect(tree.role).toBe('progressbar')
	expect(tree.name).toBe('Internals only')
	expect(tree.value).toBe('42')
	const attributes = await page.evaluate(
		sel => document.querySelector(sel)?.getAttributeNames() ?? [],
		'#via-internals',
	)
	expect(attributes).toEqual(['id', 'mode'])
	const idlValuenow = await page.evaluate(() => {
		const el = document.querySelector('#via-internals')
		const registry = (
			globalThis as unknown as {
				_elementInternals?: WeakMap<Element, ElementInternals>
			}
		)._elementInternals
		return registry?.get(el as Element)?.ariaValueNow ?? null
	})
	expect(idlValuenow).toBe('42')
})

test('engine ground truth: attribute-only semantics are in the AX tree', async ({
	page,
}) => {
	test.skip(engineOf(page) !== 'chromium', 'CDP AX tree is Chromium-only')
	const tree = await computedAriaTree(page, '#via-attribute')
	expect(tree.role).toBe('progressbar')
	expect(tree.name).toBe('Attribute only')
	expect(tree.value).toBe('7')
})

test('engine ground truth: host attributes override internals defaults, and removing them restores the internals value', async ({
	page,
}) => {
	test.skip(engineOf(page) !== 'chromium', 'CDP AX tree is Chromium-only')

	// The attribute channel wins over the internals default (platform
	// "default semantics" model — the override claim ADR 0026 §1 rests on).
	const overridden = await computedAriaTree(page, '#via-both')
	expect(overridden.name).toBe('Attribute wins')
	expect(overridden.value).toBe('99')

	// Remove the overriding attributes → the internals defaults reassert,
	// for name AND value alike (both channels map, per the corrected
	// finding above).
	await page.evaluate(() => {
		const el = document.querySelector('#via-both') as HTMLElement | null
		el?.removeAttribute('aria-label')
		el?.removeAttribute('aria-valuenow')
	})
	await expect
		.poll(async () => (await computedAriaTree(page, '#via-both')).name)
		.toBe('Internals both')
	await expect
		.poll(async () => (await computedAriaTree(page, '#via-both')).value)
		.toBe('42')
	const idlValuenow = await page.evaluate(() => {
		const el = document.querySelector('#via-both')
		const registry = (
			globalThis as unknown as {
				_elementInternals?: WeakMap<Element, ElementInternals>
			}
		)._elementInternals
		return registry?.get(el as Element)?.ariaValueNow ?? null
	})
	expect(idlValuenow).toBe('42')
})

test('tooling tier: Playwright sees attribute semantics only, not internals', async ({
	page,
}) => {
	// Playwright's ARIA engine (getByRole / ariaSnapshot) ignores
	// ElementInternals semantics (observed 2026-08-31, Playwright 1.62):
	// only the two attribute-carrying probes count, and the internals-only
	// probe snapshots to an empty string.
	const count = await page.getByRole('progressbar').count()
	expect(count).toBe(2)
	expect(await ariaSnapshotOf(page, '#via-internals')).toBe('')
	expect(await ariaSnapshotOf(page, '#via-attribute')).toBe(
		'- progressbar "Attribute only"',
	)
	expect(await ariaSnapshotOf(page, '#via-both')).toBe(
		'- progressbar "Attribute wins"',
	)
})

test('axe tier: no internals-related violations when the registry is populated', async ({
	page,
}) => {
	const violations = await runAxe(page)
	// axe-core 4.13 with the registry populated: no false positives on the
	// internals-only probe (e.g. no aria-required-attr complaint about its
	// internals-set aria-valuenow). The `region` rule fires on every probe
	// element — page-structure noise from the bare probe page, unrelated to
	// internals. If any OTHER rule appears, that is a regression to explain.
	const internalsNoise = violations.filter(v => v.id !== 'region')
	expect(internalsNoise).toEqual([])
})
