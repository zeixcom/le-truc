import { expect, test } from '@playwright/test'

/**
 * End-to-end coverage for the DEV_MODE debug instrumentation (ADR 0022)
 * — real browser DOM/CSS and real addEventListener ordering
 * semantics that `bun:test` fake-DOM stubs can't exercise. The examples
 * bundle is built with `DEV_MODE=true` (see `build:examples:js` in
 * package.json), so `debug()` is auto-injected into every component here.
 */

test.describe('debug instrumentation (ADR 0022)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/test-debug')
		await page.waitForSelector('test-debug')
	})

	test('debug defaults to false — zero instrumentation until enabled', async ({
		page,
	}) => {
		const consoleDebugCalls: string[] = []
		page.on('console', msg => {
			if (msg.type() === 'debug') consoleDebugCalls.push(msg.text())
		})

		await page.locator('test-debug #btn').click()

		const marked = await page.evaluate(() =>
			document.querySelector('#btn')?.hasAttribute('data-le-truc-on'),
		)
		expect(marked).toBe(false)
		expect(consoleDebugCalls).toHaveLength(0)
	})

	test('auto-injection: debug is a settable boolean property with zero source changes in test-debug.ts', async ({
		page,
	}) => {
		const before = await page.evaluate(
			() => typeof (document.querySelector('test-debug') as any).debug,
		)
		expect(before).toBe('boolean')

		await page.evaluate(() => {
			;(document.querySelector('test-debug') as any).debug = true
		})
		const after = await page.evaluate(
			() => (document.querySelector('test-debug') as any).debug,
		)
		expect(after).toBe(true)
	})

	test('on(): marks the target, pulses the host, and logs — even though the handler calls stopImmediatePropagation()', async ({
		page,
	}) => {
		const consoleDebugCalls: string[] = []
		page.on('console', msg => {
			if (msg.type() === 'debug') consoleDebugCalls.push(msg.text())
		})

		await page.evaluate(() => {
			;(document.querySelector('test-debug') as any).debug = true
		})

		// Author behavior must be unaffected: the handler's own
		// stopImmediatePropagation() call still applies count = 1.
		await page.locator('test-debug #btn').click()
		const count = await page.evaluate(
			() => (document.querySelector('test-debug') as any).count,
		)
		expect(count).toBe(1)

		// The debug companion must still have fired for this same click,
		// despite the author's stopImmediatePropagation() call.
		const marked = await page.evaluate(() =>
			document.querySelector('#btn')?.hasAttribute('data-le-truc-on'),
		)
		expect(marked).toBe(true)
		expect(
			consoleDebugCalls.some(
				text => text.includes('[le-truc debug]') && text.includes('on'),
			),
		).toBe(true)
	})

	test('watch(): a bind*-produced closure marks its element (attribution)', async ({
		page,
	}) => {
		await page.evaluate(() => {
			;(document.querySelector('test-debug') as any).debug = true
		})

		await page.locator('test-debug #btn').click()

		const marked = await page.evaluate(() =>
			document.querySelector('#attributed')?.hasAttribute('data-le-truc-watch'),
		)
		expect(marked).toBe(true)
	})

	test('watch(): a raw handler is never guessed at — no element mark, host-level signal only', async ({
		page,
	}) => {
		const consoleDebugCalls: string[] = []
		page.on('console', msg => {
			if (msg.type() === 'debug') consoleDebugCalls.push(msg.text())
		})

		await page.evaluate(() => {
			;(document.querySelector('test-debug') as any).debug = true
		})

		await page.locator('test-debug #btn').click()

		const marked = await page.evaluate(() =>
			document
				.querySelector('#unattributed')
				?.hasAttribute('data-le-truc-watch'),
		)
		expect(marked).toBe(false)
		// The firing is still logged (host-level signal) — names the host,
		// but names no target element since there's none to attribute (and
		// the message must not claim otherwise with a placeholder like
		// "(unattributed)" — that's noise, not signal).
		expect(
			consoleDebugCalls.some(
				text =>
					text.includes('[le-truc debug] watch in') &&
					text.includes('test-debug'),
			),
		).toBe(true)
		expect(
			consoleDebugCalls.some(text => text.includes('(unattributed)')),
		).toBe(false)
	})

	test('pass(): marks the child target element', async ({ page }) => {
		await page.evaluate(() => {
			;(document.querySelector('test-debug') as any).debug = true
		})

		const marked = await page.evaluate(() =>
			document.querySelector('#child')?.hasAttribute('data-le-truc-pass'),
		)
		expect(marked).toBe(true)
	})

	test('pass(): toggling debug on alone does not itself log a firing', async ({
		page,
	}) => {
		const consoleDebugCalls: string[] = []
		page.on('console', msg => {
			if (msg.type() === 'debug') consoleDebugCalls.push(msg.text())
		})

		// No click, no value change — just enabling debug. The element still
		// gets marked (previous test), but that must not itself count as a
		// "firing": on()/watch() only log for a real event/value change, and
		// pass() must match, not spam console.debug for every mounted pass()
		// the instant debug turns on.
		await page.evaluate(() => {
			;(document.querySelector('test-debug') as any).debug = true
		})

		expect(
			consoleDebugCalls.some(
				text => text.includes('[le-truc debug]') && text.includes('pass'),
			),
		).toBe(false)
	})

	test('host carries the :state(debug) custom state while debug is true, and only then', async ({
		page,
	}) => {
		const before = await page.evaluate(() =>
			document.querySelector('test-debug')?.matches(':state(debug)'),
		)
		expect(before).toBe(false)

		await page.evaluate(() => {
			;(document.querySelector('test-debug') as any).debug = true
		})
		const after = await page.evaluate(() =>
			document.querySelector('test-debug')?.matches(':state(debug)'),
		)
		expect(after).toBe(true)

		await page.evaluate(() => {
			;(document.querySelector('test-debug') as any).debug = false
		})
		const disabled = await page.evaluate(() =>
			document.querySelector('test-debug')?.matches(':state(debug)'),
		)
		expect(disabled).toBe(false)
	})

	test('metaKey+click toggles debug on the nearest custom-element host', async ({
		page,
	}) => {
		const before = await page.evaluate(
			() => (document.querySelector('test-debug') as any).debug,
		)
		expect(before).toBe(false)

		await page.locator('test-debug').click({ modifiers: ['Meta'] })
		const afterFirst = await page.evaluate(
			() => (document.querySelector('test-debug') as any).debug,
		)
		expect(afterFirst).toBe(true)

		await page.locator('test-debug').click({ modifiers: ['Meta'] })
		const afterSecond = await page.evaluate(
			() => (document.querySelector('test-debug') as any).debug,
		)
		expect(afterSecond).toBe(false)
	})

	test('metaKey+click climbs past structural-only custom elements to reach the real host', async ({
		page,
	}) => {
		// #wrapped sits inside <card-callout>, a plain HTMLElement subclass
		// with no `debug` property. Stopping the ancestor walk at the first
		// dashed localName set a meaningless expando on it and the gesture
		// silently did nothing — the common case in real pages, where
		// components are wrapped in layout elements.
		await page.locator('#wrapped').click({ modifiers: ['Meta'] })

		expect(
			await page.evaluate(
				() => (document.querySelector('test-debug') as any).debug,
			),
		).toBe(true)
		expect(
			await page.evaluate(() =>
				Object.hasOwn(document.querySelector('card-callout')!, 'debug'),
			),
		).toBe(false)
	})

	test('the resting :state(debug) outline is visible on toggle, with no firing to inject the stylesheet', async ({
		page,
	}) => {
		// The stylesheet carries both the pulse keyframes and the resting
		// `*:state(debug)` outline. It used to be injected lazily from
		// pulse(), i.e. only on the first on()/pass()/watch() firing — so
		// enabling debug on a component that wasn't currently firing showed
		// nothing at all. No click here on purpose: pass()'s mark-only
		// companion runs on toggle but never pulses, so nothing else can
		// inject the rules.
		await page.evaluate(() => {
			;(document.querySelector('test-debug') as any).debug = true
		})

		const boxShadow = await page.evaluate(() => {
			const host = document.querySelector('test-debug')!
			return getComputedStyle(host).boxShadow
		})
		expect(boxShadow).not.toBe('none')
		expect(boxShadow).not.toBe('')
	})
})

test.describe('debug reserved-name collision (ADR 0022 Consequences)', () => {
	test('expose({ debug: ... }) throws in a DEV_MODE build — every component reserves "debug", even ones that never reference it', async ({
		page,
	}) => {
		const pageErrors: string[] = []
		page.on('pageerror', err => pageErrors.push(err.message))

		await page.goto('http://localhost:3000/test/test-debug-collision')
		// The throw happens synchronously during connectedCallback, before any
		// content this component would otherwise render — waiting for the
		// custom element to upgrade is enough to have observed it.
		await page.waitForFunction(
			() => customElements.get('test-debug-collision') !== undefined,
		)

		expect(
			pageErrors.some(
				message => message.includes('debug') && message.includes('reserved'),
			),
		).toBe(true)
	})
})
