import { expect, test } from '@playwright/test'

/**
 * ReservedWords runtime guard
 *
 * A consumer that defeats the type-level ReservedWords exclusion (e.g. via an
 * asJSON-parsed key or a Record<string, …> cast) reaches #initSignals. The
 * runtime isReservedWord guard must throw InvalidPropertyNameError before
 * Object.defineProperty can corrupt the host prototype chain.
 *
 * NOTE on assertion strategy: since ADR 0028 the throw never leaves
 * `connectedCallback` — it is contained and reported through `console.error`
 * (Tier 2). So the failure is observed on the `console` channel, not via
 * `pageerror` and not via try/catch. The guarantee under test is unchanged:
 * the guard runs BEFORE `Object.defineProperty`, so the prototype chain is
 * protected by the ordering, not by the throw escaping.
 */
test.describe('Reserved-word runtime guard', () => {
	test.beforeEach(async ({ page }) => {
		// Loads main.js so audit-reserved-word is defined, but the page has no
		// static instance (it throws on connect).
		await page.goto('http://localhost:3000/test/test-reserved-word')
		await page.waitForSelector('#anchor', { state: 'attached' })
	})

	test('reports InvalidPropertyNameError when a reserved name reaches expose()', async ({
		page,
	}) => {
		const logs: string[] = []
		const pageErrors: string[] = []
		page.on('console', msg => {
			if (msg.type() === 'error') logs.push(msg.text())
		})
		page.on('pageerror', err => pageErrors.push(`${err.name}:${err.message}`))

		await page.evaluate(() => {
			const el = document.createElement('audit-reserved-word')
			document.body.appendChild(el) // triggers connectedCallback → #initSignals
		})
		// Give the reaction a tick to flush.
		await page.waitForTimeout(100)

		const match = logs.find(e => e.includes('InvalidPropertyNameError'))
		expect(
			match,
			`expected InvalidPropertyNameError on console, got: ${logs.join(' | ')}`,
		).toBeTruthy()
		// Contained, not escaped — one broken component must not surface as a
		// page-level error (ADR 0028 Tier 2).
		expect(pageErrors).toHaveLength(0)
	})

	test('the report names the component and the offending property', async ({
		page,
	}) => {
		const logs: string[] = []
		page.on('console', msg => {
			if (msg.type() === 'error') logs.push(msg.text())
		})

		await page.evaluate(() => {
			const el = document.createElement('audit-reserved-word')
			document.body.appendChild(el)
		})
		await page.waitForTimeout(100)

		const msg = logs.find(e => e.includes('audit-reserved-word'))
		expect(msg, `console errors: ${logs.join(' | ')}`).toBeTruthy()
		expect(msg).toContain('audit-reserved-word')
		expect(msg).toContain('constructor')
		expect(msg).toContain('reserved word')
	})

	test('the reserved property is NOT installed as an own accessor on the host', async ({
		page,
	}) => {
		// The guarantee: the prototype chain is not corrupted. The guard must
		// throw BEFORE Object.defineProperty(this, 'constructor', …) runs —
		// the ordering is what protects it, which is why containing the throw
		// costs nothing (ADR 0028 inventory).
		await page.evaluate(() => {
			const el = document.createElement('audit-reserved-word')
			document.body.appendChild(el)
		})
		await page.waitForTimeout(100)

		const ownProps = await page.evaluate(() => {
			// The element connected despite the error (reactions don't abort
			// connection); find it and check it has no own 'constructor' descriptor.
			const el = document.querySelector('audit-reserved-word') as any
			if (!el) return { found: false }
			const desc = Object.getOwnPropertyDescriptor(el, 'constructor')
			return {
				found: true,
				hasOwnConstructor: Object.hasOwn(el, 'constructor'),
				descType: desc ? typeof desc : 'none',
			}
		})
		expect(ownProps.found).toBe(true)
		expect(ownProps.hasOwnConstructor).toBe(false)
	})

	test('a non-reserved name connects without error', async ({ page }) => {
		// Sanity: the guard is specific. A normal component must still connect
		// and initialize its props.
		const errors: string[] = []
		page.on('pageerror', err => errors.push(err.name))
		page.on('console', msg => {
			if (msg.type() === 'error') errors.push(msg.text())
		})

		const ok = await page.evaluate(() => {
			const el = document.createElement('test-expose') // registered, safe props
			document.body.appendChild(el)
			return (el as any).greeting === 'Hello'
		})
		expect(ok).toBe(true)
		expect(errors).toHaveLength(0)
	})
})
