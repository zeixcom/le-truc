/**
 * LT-003 verification: the element-reference channel (ADR 0026 §1,
 * "component-internal relationships") against the hardest real case — the
 * combobox pattern (poc-combobox.ts) — plus the `:not(:defined)` edge case
 * (poc-late-ref.ts).
 *
 * Assertions are pinned to behavior OBSERVED on 2026-08-31 (Playwright 1.62,
 * Chromium). Findings and rationale in test/poc/README.md.
 */
import { expect, test } from '@playwright/test'
import { computedAriaTree, engineOf } from './fixtures/aria'

test.beforeEach(async ({ page }) => {
	await page.goto('/combobox')
	await page.locator('poc-combobox').first().waitFor({ state: 'attached' })
})

test('static relationships: controls/describedby/labelledby all reach the AX tree via relatedNodes', async ({
	page,
}) => {
	test.skip(engineOf(page) !== 'chromium', 'CDP AX tree is Chromium-only')

	const tree = await computedAriaTree(page, 'poc-combobox input')
	expect(tree.role).toBe('combobox')
	// labelledby drives the accessible name directly.
	expect(tree.name).toBe('Choose a fruit')
	// describedby/controls/labelledby carry no plain string value when set
	// via the IDL element-reference properties (there is no IDREF string) —
	// the relationship lives in CDP's relatedNodes, which fixtures/aria.ts's
	// propValue() falls back to (idref when the target has an id, else
	// `#<backendDOMNodeId>`).
	expect(tree.props.describedby).toBe('fruit-description')
	expect(tree.props.labelledby).toBe('fruit-label')
	expect(tree.props.controls).toMatch(/^#\d+$/) // popup has no id
})

test('errormessage only surfaces once aria-invalid is set — same relatedNodes mechanism', async ({
	page,
}) => {
	test.skip(engineOf(page) !== 'chromium', 'CDP AX tree is Chromium-only')

	// Before: ariaErrorMessageElements is wired, but errormessage does not
	// appear in the AX tree at all — ARIA only exposes the error-message
	// relationship while the field is marked invalid.
	const before = await computedAriaTree(page, 'poc-combobox input')
	expect(before.props.errormessage).toBeUndefined()

	await page.evaluate(() => {
		const el = document.querySelector('poc-combobox input') as HTMLInputElement
		el.ariaInvalid = 'true'
	})
	const after = await computedAriaTree(page, 'poc-combobox input')
	expect(after.props.errormessage).toBe('fruit-error')
})

test('spec side effect: assigning an element-reference property clears the content attribute value', async ({
	page,
}) => {
	// The textbox starts with a stale aria-describedby="stale-id" attribute
	// in the HTML (pages/combobox.html) — nobody's id. poc-combobox's
	// constructor assigns ariaDescribedByElements, ariaControlsElements,
	// and ariaLabelledByElements via the IDL. Per spec, writing an
	// element-reference property clears (empties, not removes) the
	// corresponding content attribute — there is no IDREF string that could
	// represent a live element reference.
	const values = await page.evaluate(() => {
		const el = document.querySelector('poc-combobox input')!
		return {
			describedby: el.getAttribute('aria-describedby'),
			controls: el.getAttribute('aria-controls'),
			labelledby: el.getAttribute('aria-labelledby'),
		}
	})
	expect(values).toEqual({ describedby: '', controls: '', labelledby: '' })
	// The attribute node itself survives (present, just emptied) — it is
	// not removed outright.
	const attrNames = await page.evaluate(() =>
		document.querySelector('poc-combobox input')?.getAttributeNames(),
	)
	expect(attrNames).toEqual(
		expect.arrayContaining([
			'aria-describedby',
			'aria-controls',
			'aria-labelledby',
		]),
	)
})

test('activedescendant retargets per keystroke across the all()-backed option list', async ({
	page,
}) => {
	test.skip(engineOf(page) !== 'chromium', 'CDP AX tree is Chromium-only')

	await page.locator('poc-combobox input').focus()
	await page.keyboard.press('ArrowDown')
	expect(
		(await computedAriaTree(page, 'poc-combobox input')).props.activedescendant,
	).toBe('opt-apple')
	await page.keyboard.press('ArrowDown')
	expect(
		(await computedAriaTree(page, 'poc-combobox input')).props.activedescendant,
	).toBe('opt-banana')
	await page.keyboard.press('ArrowUp')
	expect(
		(await computedAriaTree(page, 'poc-combobox input')).props.activedescendant,
	).toBe('opt-apple')
	await page.keyboard.press('Escape')
	expect(
		(await computedAriaTree(page, 'poc-combobox input')).props.activedescendant,
	).toBeUndefined()
})

test("all()'s MutationObserver retargets after an option is removed and a fresh one re-added", async ({
	page,
}) => {
	test.skip(engineOf(page) !== 'chromium', 'CDP AX tree is Chromium-only')

	await page.locator('poc-combobox input').focus()

	// Remove the middle option (opt-banana) — all()'s Cell must drop it.
	await page.evaluate(() => document.querySelector('#opt-banana')?.remove())
	await expect
		.poll(() => page.locator('poc-combobox [role="option"]').count())
		.toBe(2)
	// Two ArrowDown presses now land on the third original option (cherry),
	// since the list is [apple, cherry] post-removal.
	await page.keyboard.press('ArrowDown')
	await page.keyboard.press('ArrowDown')
	expect(
		(await computedAriaTree(page, 'poc-combobox input')).props.activedescendant,
	).toBe('opt-cherry')

	// Re-add a *fresh* element (not the removed node) with the same id —
	// the observer must pick it up as a new list entry, not silently miss it.
	await page.evaluate(() => {
		const popup = document.querySelector('poc-combobox .popup')!
		const fresh = document.createElement('div')
		fresh.setAttribute('role', 'option')
		fresh.id = 'opt-banana'
		fresh.textContent = 'Banana'
		popup.insertBefore(fresh, document.querySelector('#opt-cherry'))
	})
	await expect
		.poll(() => page.locator('poc-combobox [role="option"]').count())
		.toBe(3)
	await page.keyboard.press('Escape')
	await page.keyboard.press('ArrowDown')
	await page.keyboard.press('ArrowDown')
	expect(
		(await computedAriaTree(page, 'poc-combobox input')).props.activedescendant,
	).toBe('opt-banana')
})

test(':not(:defined) target: an element-reference property to a never-defined custom element resolves immediately, no dependency wait', async ({
	page,
}) => {
	test.skip(engineOf(page) !== 'chromium', 'CDP AX tree is Chromium-only')

	// poc-late-ref's constructor wires ariaDescribedByElements to
	// #late-target-el synchronously — a <late-target-el> tag that no script
	// on this page ever registers. Unlike Le Truc's first()/all(), which
	// collect undefined custom-element targets as dependencies and defer
	// effect activation up to DEPENDENCY_TIMEOUT (200ms), an element
	// reference to an Element node needs nothing but that node's identity.
	const idl = await page.evaluate(() => {
		const el = document.querySelector('#late-ref')
		const registry = (
			globalThis as unknown as {
				_elementInternals?: WeakMap<Element, ElementInternals>
			}
		)._elementInternals
		return {
			describedByIds: registry
				?.get(el as Element)
				?.ariaDescribedByElements?.map(e => e.id),
			targetDefined: customElements.get('late-target-el') != null,
		}
	})
	expect(idl.targetDefined).toBe(false)
	expect(idl.describedByIds).toEqual(['late-target-el'])

	// The relationship is already computed in the AX tree — role=button
	// surfaces it as the top-level `description` field, not a `describedby`
	// property (a role-dependent AX-tree shape difference from the
	// combobox/textbox case above).
	const tree = await computedAriaTree(page, '#late-ref')
	expect(tree.role).toBe('button')
	expect(tree.description).toBe('a not-yet-defined description')
	expect(tree.props.describedby).toBeUndefined()
})
