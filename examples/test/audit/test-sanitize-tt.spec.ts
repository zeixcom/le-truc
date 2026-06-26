import { expect, test } from '@playwright/test'

/**
 * dangerouslyBindInnerHTML under a Trusted-Types-enforcing CSP
 *
 * On a page with `Content-Security-Policy: require-trusted-types-for 'script'`,
 * `target.innerHTML = html` throws a TypeError unless `html` is a `TrustedHTML`
 * instance — a plain string fails this check regardless of how thoroughly a
 * `sanitize` hook cleaned it. The CSP is injected via Playwright route
 * interception (a response header), so it applies only to this spec's page and
 * leaves the unrelated `test-sanitize` page unaffected.
 *
 * - audit-trusted-html's sanitize hook wraps the result in a real `TrustedHTML`
 *   via `window.trustedTypes.createPolicy(...).createHTML(...)` (standing in for
 *   DOMPurify's `RETURN_TRUSTED_TYPE: true`) — the assignment must succeed.
 * - audit-dompurify's sanitize hook uses real DOMPurify with
 *   `RETURN_TRUSTED_TYPE: true` — the exact integration the library's own docs
 *   recommend, exercised for real rather than stood in for.
 * - audit-sanitize's sanitize hook (from test-sanitize.html) returns a plain
 *   string — the assignment must still throw, proving the hook's return *type*
 *   is what matters, not merely the presence of a `sanitize` option.
 * - The reset/clear path (`nil`, or setting `content` back to '') must NOT
 *   throw regardless of `sanitize`, since it never uses the `innerHTML` sink
 *   — covered by the last two tests below.
 */
test.describe('dangerouslyBindInnerHTML under Trusted Types enforcement', () => {
	test.beforeEach(async ({ page }) => {
		await page.route('**/test/test-sanitize-tt', async route => {
			const response = await route.fetch()
			await route.fulfill({
				response,
				headers: {
					...response.headers(),
					'content-security-policy': "require-trusted-types-for 'script'",
				},
			})
		})
		await page.goto('http://localhost:3000/test/test-sanitize-tt')
		await page.waitForSelector('audit-trusted-html', { state: 'attached' })
		await page.waitForSelector('audit-dompurify', { state: 'attached' })
		await page.waitForSelector('audit-sanitize', { state: 'attached' })
	})

	test('the page actually enforces Trusted Types (sanity check)', async ({
		page,
	}) => {
		const hasTrustedTypes = await page.evaluate(
			() => typeof window.trustedTypes !== 'undefined',
		)
		expect(hasTrustedTypes).toBe(true)
	})

	test('a sanitize hook returning TrustedHTML satisfies enforcement and strips the vector', async ({
		page,
	}) => {
		const pageErrors: string[] = []
		page.on('pageerror', err => pageErrors.push(`${err.name}: ${err.message}`))

		await page.evaluate(async () => {
			const el = document.getElementById('san-trusted') as any
			el.content = '<img src=x onerror="window.__xssFired = true"><p>hello</p>'
			await new Promise<void>(r => requestAnimationFrame(() => r()))
		})
		await page.waitForTimeout(100)

		const html = await page.evaluate(
			() =>
				(
					document
						.getElementById('san-trusted')!
						.querySelector('[data-target]') as HTMLElement
				).innerHTML,
		)
		expect(html).toContain('<img src="x">')
		expect(html).toContain('<p>hello</p>')
		expect(html).not.toMatch(/onerror/i)
		expect(
			pageErrors,
			`expected no errors, got: ${pageErrors.join(' | ')}`,
		).toHaveLength(0)
	})

	test('real DOMPurify with RETURN_TRUSTED_TYPE satisfies enforcement and strips the vector', async ({
		page,
	}) => {
		const pageErrors: string[] = []
		page.on('pageerror', err => pageErrors.push(`${err.name}: ${err.message}`))

		await page.evaluate(async () => {
			const el = document.getElementById('san-dompurify') as any
			el.content = '<img src=x onerror="window.__xssFired = true"><p>hello</p>'
			await new Promise<void>(r => requestAnimationFrame(() => r()))
		})
		await page.waitForTimeout(100)

		const html = await page.evaluate(
			() =>
				(
					document
						.getElementById('san-dompurify')!
						.querySelector('[data-target]') as HTMLElement
				).innerHTML,
		)
		expect(html).toContain('<p>hello</p>')
		expect(html).not.toMatch(/onerror/i)
		expect(
			pageErrors,
			`expected no errors, got: ${pageErrors.join(' | ')}`,
		).toHaveLength(0)
	})

	test('a sanitize hook returning a plain string still throws under enforcement', async ({
		page,
	}) => {
		const pageErrors: string[] = []
		page.on('pageerror', err => pageErrors.push(`${err.name}: ${err.message}`))

		await page.evaluate(async () => {
			const el = document.getElementById('san-string') as any
			el.content = '<img src=x onerror="window.__xssFired = true"><p>ok</p>'
			await new Promise<void>(r => requestAnimationFrame(() => r()))
		})
		await page.waitForTimeout(100)

		const match = pageErrors.find(
			e => e.includes('TypeError') && /trusted/i.test(e),
		)
		expect(
			match,
			`expected a TrustedHTML TypeError, got: ${pageErrors.join(' | ')}`,
		).toBeTruthy()

		// The throw happens before the assignment completes, so the target was
		// never written.
		const html = await page.evaluate(
			() =>
				(
					document
						.getElementById('san-string')!
						.querySelector('[data-target]') as HTMLElement
				).innerHTML,
		)
		expect(html).toBe('')
	})

	test('content starting at the empty string does not throw on connect (reset path)', async ({
		page,
	}) => {
		const pageErrors: string[] = []
		const consoleErrors: string[] = []
		page.on('pageerror', err => pageErrors.push(`${err.name}: ${err.message}`))
		page.on('console', msg => {
			if (msg.type() === 'error') consoleErrors.push(msg.text())
		})

		// Re-navigate with both listeners already attached so the very first
		// connectedCallback — `content` initialized to '', hitting the reset
		// path — is observed. Before the fix, this threw via the innerHTML sink
		// and was silently swallowed as a console.error, invisible to the
		// pageerror-only assertions in the tests above.
		await page.goto('http://localhost:3000/test/test-sanitize-tt')
		await page.waitForSelector('audit-trusted-html', { state: 'attached' })
		await page.waitForSelector('audit-dompurify', { state: 'attached' })
		await page.waitForSelector('audit-sanitize', { state: 'attached' })
		await page.waitForTimeout(100)

		expect(
			pageErrors,
			`expected no page errors, got: ${pageErrors.join(' | ')}`,
		).toHaveLength(0)
		expect(
			consoleErrors,
			`expected no console errors, got: ${consoleErrors.join(' | ')}`,
		).toHaveLength(0)
	})

	test('setting content back to the empty string clears it without throwing', async ({
		page,
	}) => {
		const pageErrors: string[] = []
		const consoleErrors: string[] = []
		page.on('pageerror', err => pageErrors.push(`${err.name}: ${err.message}`))
		page.on('console', msg => {
			if (msg.type() === 'error') consoleErrors.push(msg.text())
		})

		// Only san-trusted: san-string's plain-string sanitize hook can't display
		// any non-empty content under enforcement at all (asserted above) — there
		// is no "had content, now reset" scenario for it here.
		await page.evaluate(async () => {
			const el = document.getElementById('san-trusted') as any
			el.content = '<p>hello</p>'
			await new Promise<void>(r => requestAnimationFrame(() => r()))
		})
		await page.evaluate(async () => {
			const el = document.getElementById('san-trusted') as any
			el.content = ''
			await new Promise<void>(r => requestAnimationFrame(() => r()))
		})
		await page.waitForTimeout(100)

		const html = await page.evaluate(
			() =>
				(
					document
						.getElementById('san-trusted')!
						.querySelector('[data-target]') as HTMLElement
				).innerHTML,
		)
		expect(html).toBe('')

		expect(
			pageErrors,
			`expected no page errors, got: ${pageErrors.join(' | ')}`,
		).toHaveLength(0)
		expect(
			consoleErrors,
			`expected no console errors, got: ${consoleErrors.join(' | ')}`,
		).toHaveLength(0)
	})
})
