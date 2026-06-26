import { expect, test } from '@playwright/test'

/**
 * dangerouslyBindInnerHTML sanitize hook
 *
 * Assigning innerHTML is an XSS sink that fires event-handler attributes on
 * non-`<script>` elements (e.g. <img onerror>) even with allowScripts:false.
 * The sanitize hook is the supported defense. The audit-sanitize component wires
 * a minimal on*-stripper via the sanitize option; the spec injects a payload
 * carrying an <img onerror> vector and asserts the hook removed it.
 *
 * dangerouslyBindInnerHTML defers the write via schedule() (one RAF), so the
 * spec waits for the frame before asserting.
 */
test.describe('dangerouslyBindInnerHTML sanitize hook', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/test-sanitize')
		// The component has no visible content until `content` is set, so wait
		// for attachment, not visibility.
		await page.waitForSelector('audit-sanitize', { state: 'attached' })
	})

	test('sanitize hook runs before innerHTML assignment', async ({ page }) => {
		// Track whether the onerror vector fires. If sanitize works, it won't.
		const fired = await page.evaluate(async () => {
			let fired = false
			;(window as any).__xssFired = () => {
				fired = true
			}
			const el = document.getElementById('san') as any
			el.content =
				'<img src=x onerror="window.__xssFired && window.__xssFired()"><p>ok</p>'
			// Wait for the scheduled RAF write.
			await new Promise<void>(r => requestAnimationFrame(() => r()))
			await new Promise<void>(r => setTimeout(r, 50))
			// Give the errored image a tick to fire its handler.
			await new Promise<void>(r => setTimeout(r, 50))
			return fired
		})
		expect(fired).toBe(false)
	})

	test('sanitized markup is rendered (hook preserves safe content)', async ({
		page,
	}) => {
		await page.evaluate(async () => {
			const el = document.getElementById('san') as any
			el.content = '<img src="/ok.png" onerror="alert(1)"><p>hello</p>'
			await new Promise<void>(r => requestAnimationFrame(() => r()))
		})
		const html = await page.evaluate(
			() =>
				(
					document
						.getElementById('san')!
						.querySelector('[data-target]') as HTMLElement
				).innerHTML,
		)
		// onerror stripped, but the <img> and <p> preserved.
		expect(html).toContain('<img src="/ok.png">')
		expect(html).toContain('<p>hello</p>')
		expect(html).not.toMatch(/onerror/i)
	})

	test('sanitize hook is the only defense — raw onerror would fire (control)', async ({
		page,
	}) => {
		// Control: bypass the hook by assigning innerHTML directly, proving the
		// vector is live and that it is the hook (not the browser) neutralizing it.
		const fired = await page.evaluate(async () => {
			let fired = false
			;(window as any).__xssFired = () => {
				fired = true
			}
			const target = document.querySelector('[data-target]') as HTMLElement
			target.innerHTML =
				'<img src=x onerror="window.__xssFired && window.__xssFired()">'
			await new Promise<void>(r => setTimeout(r, 50))
			return fired
		})
		expect(fired).toBe(true)
	})

	test('a reset cannot be clobbered by an earlier-scheduled, now-stale write', async ({
		page,
	}) => {
		// content goes non-empty then falsy within the same synchronous tick, i.e.
		// before the RAF that the first write scheduled has a chance to fire. Both
		// writes now go through schedule()'s per-element dedup, so the later one —
		// the reset — must win.
		const html = await page.evaluate(async () => {
			const el = document.getElementById('san') as any
			el.content = '<p>stale</p>'
			el.content = ''
			await new Promise<void>(r => requestAnimationFrame(() => r()))
			await new Promise<void>(r => requestAnimationFrame(() => r()))
			return (
				document
					.getElementById('san')!
					.querySelector('[data-target]') as HTMLElement
			).innerHTML
		})
		expect(html).toBe('')
	})

	test('a non-empty write after a reset, same tick, still wins (no regression)', async ({
		page,
	}) => {
		const html = await page.evaluate(async () => {
			const el = document.getElementById('san') as any
			el.content = '<p>first</p>'
			await new Promise<void>(r => requestAnimationFrame(() => r()))
			el.content = ''
			el.content = '<p>second</p>'
			await new Promise<void>(r => requestAnimationFrame(() => r()))
			await new Promise<void>(r => requestAnimationFrame(() => r()))
			return (
				document
					.getElementById('san')!
					.querySelector('[data-target]') as HTMLElement
			).innerHTML
		})
		expect(html).toContain('<p>second</p>')
	})
})
