import { expect, test } from '@playwright/test'

/**
 * ReservedWords runtime guard
 *
 * A consumer that defeats the type-level ReservedWords exclusion (e.g. via an
 * asJSON-parsed key or a Record<string, …> cast) reaches #initSignals. The
 * runtime isReservedWord guard must throw InvalidPropertyNameError before
 * Object.defineProperty can corrupt the host prototype chain.
 *
 * NOTE on assertion strategy: custom-element lifecycle callbacks
 * (connectedCallback) run inside the browser's "custom element reactions"
 * internal slot, which reports exceptions via the global error handler
 * (pageerror) rather than re-throwing synchronously to the appendChild caller.
 * So the throw is observed via the `pageerror` listener, not via try/catch.
 */
test.describe('Reserved-word runtime guard', () => {
	test.beforeEach(async ({ page }) => {
		// Loads main.js so audit-reserved-word is defined, but the page has no
		// static instance (it throws on connect).
		await page.goto('http://localhost:3000/test/test-reserved-word')
		await page.waitForSelector('#anchor', { state: 'attached' })
	})

	test('emits InvalidPropertyNameError when a reserved name reaches expose()', async ({
		page,
	}) => {
		const errors: string[] = []
		page.on('pageerror', err => errors.push(`${err.name}:${err.message}`))

		await page.evaluate(() => {
			const el = document.createElement('audit-reserved-word')
			document.body.appendChild(el) // triggers connectedCallback → #initSignals
		})
		// Give the reaction a tick to flush.
		await page.waitForTimeout(100)

		const match = errors.find(e => e.startsWith('InvalidPropertyNameError:'))
		expect(
			match,
			`expected InvalidPropertyNameError, got: ${errors.join(' | ')}`,
		).toBeTruthy()
		expect(match).toContain('constructor')
	})

	test('error names the component and the offending property', async ({
		page,
	}) => {
		const errors: string[] = []
		page.on('pageerror', err => errors.push(err.message))

		await page.evaluate(() => {
			const el = document.createElement('audit-reserved-word')
			document.body.appendChild(el)
		})
		await page.waitForTimeout(100)

		const msg = errors.find(e => e.includes('audit-reserved-word'))
		expect(msg, `errors: ${errors.join(' | ')}`).toBeTruthy()
		expect(msg).toContain('audit-reserved-word')
		expect(msg).toContain('constructor')
		expect(msg).toContain('reserved word')
	})

	test('the reserved property is NOT installed as an own accessor on the host', async ({
		page,
	}) => {
		// The guarantee: the prototype chain is not corrupted. Even though the
		// browser swallows the reaction exception, the guard must throw BEFORE
		// Object.defineProperty(this, 'constructor', …) runs.
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

		const ok = await page.evaluate(() => {
			const el = document.createElement('test-expose') // registered, safe props
			document.body.appendChild(el)
			return (el as any).greeting === 'Hello'
		})
		expect(ok).toBe(true)
		expect(errors).toHaveLength(0)
	})
})
