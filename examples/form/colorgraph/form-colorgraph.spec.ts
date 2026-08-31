import { expect, test } from '@playwright/test'
import { converter, formatCss, type Oklch } from 'culori'

/*
 * FORM-COLORGRAPH COMPONENT TESTS — against the compiled `.tsrx` component
 * served from the plain /test page (LT-092 site cutover).
 *
 * LT-091 originally route-intercepted this URL to serve the generated server
 * HTML with a dedicated second bundle (examples/tsrx-test.ts →
 * /assets/tsrx-test.js) — the isolation existed only to keep the compiled and
 * hand-written definitions of the tag out of one document. Since the cutover,
 * examples/main.ts imports the generated clients directly, so main.js IS the
 * compiled client and the plain page exercises the same surface without
 * interception. That page-level surface is where LT-090's dropped compose-site
 * class shipped invisible: the unit suite asserted client codegen strings,
 * never real DOM, so the required `first('form-spinbutton.lightness')` queries
 * matched nothing and the component threw at activation. The activation test
 * below is the direct regression guard for exactly that failure mode.
 *
 * Test coverage:
 * - Activation: the compiled factory runs without MissingElementError and
 *   the composed per-axis refs resolve (stepDown/stepUp callable)
 * - Basic rendering: host value attribute, per-axis inputs, name="" exclusion
 * - Form integration: single serialized CSS color value submitted via
 *   ElementInternals; form reset restores the initial color
 * - Axis spinbuttons: bounds via their own min/max; committed change
 *   readback updates host.value
 * - Pointer interaction: knob drag rewrites host.value
 * - Keyboard: Arrow keys on the hue slider step the axis
 *
 * `page.evaluate` callbacks run in the browser and cannot close over
 * Node-side helpers, so each evaluate is self-contained. CSS strings are
 * computed in the Node test process (via culori) and passed into evaluate
 * as serializable arguments.
 */

const oklchConverter = converter('oklch')
const parseOklch = (value: string): Oklch =>
	oklchConverter(value) ?? { mode: 'oklch', l: 0.48, c: 0.23, h: 263 }

type Colorgraph = HTMLElement & {
	value: string
	hue: number
	chroma: number
	validationMessage: string
	stepUp: (axis: 'l' | 'c' | 'h', big?: boolean) => void
	stepDown: (axis: 'l' | 'c' | 'h', big?: boolean) => void
}

test.describe('form-colorgraph component (compiled .tsrx)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('http://localhost:3000/test/form-colorgraph')
		await page.waitForSelector('form-colorgraph')
		// The module script defines the tag after parse; wait for the
		// upgrade so every test sees the factory's exposed interface.
		await page.waitForFunction(
			() =>
				(document.querySelector('form-colorgraph') as Colorgraph | null)
					?.value !== undefined,
		)
	})

	test('activates without MissingElementError — composed refs resolve (LT-090 regression guard)', async ({
		page,
	}) => {
		const errors: string[] = []
		page.on('pageerror', error => errors.push(String(error)))
		page.on('console', msg => {
			if (msg.type() === 'error') errors.push(msg.text())
		})

		// The composed per-axis refs are the only constructs addressed through
		// a required `first()` over a discriminator — when the compose-site
		// class never reached the DOM (LT-090), the required queries threw
		// MissingElementError at exactly this point.
		const wired = await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as Colorgraph
			const before = el.value
			el.stepDown('l', true)
			el.stepUp('h')
			return { before, after: el.value, methods: typeof el.stepDown }
		})
		expect(wired.methods).toBe('function')
		expect(wired.after).not.toBe(wired.before)
		expect(errors.join('\n')).not.toContain('MissingElementError')
		expect(errors).toEqual([])
	})

	test('renders initial state with value attribute and per-axis inputs', async ({
		page,
	}) => {
		const component = page.locator('form-colorgraph')
		await expect(component).toHaveAttribute('value', 'oklch(.48 .23 263)')

		// The three axis spinbuttons are addressed by their compose-site class
		// (the LT-089/LT-090 discriminator) — their inner inputs must exist
		// and must carry NO name at all (only the host submits).
		for (const axis of ['lightness', 'chroma', 'hue']) {
			const input = page.locator(`form-spinbutton.${axis} input[type="number"]`)
			await expect(input).toBeVisible()
			await expect(input).not.toHaveAttribute('name')
		}
	})

	test('host is form-associated and submits serialized CSS color value', async ({
		page,
	}) => {
		const formData = await page.evaluate(() => {
			const form = document.querySelector('form') as HTMLFormElement
			if (!form) return null
			const data = new FormData(form)
			return Object.fromEntries(data.entries())
		})

		expect(formData).toBeTruthy()
		expect(formData!.color).toBeTruthy()
		expect(formData!.color).toMatch(/oklch/)
	})

	test('stepDown / stepUp update the value string', async ({ page }) => {
		const initialValue = await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as Colorgraph
			return el.value
		})

		await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as Colorgraph
			el.stepUp('h')
		})
		await page.waitForTimeout(50)

		const steppedValue = await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as Colorgraph
			return el.value
		})

		expect(steppedValue).not.toBe(initialValue)
		expect(steppedValue).toMatch(/oklch/)
	})

	test('each axis form-spinbutton is bounded by its own min/max attributes', async ({
		page,
	}) => {
		// min/max/step/bigStep are compose-site args on each <FormSpinbutton>
		// (LT-088); exercise the spinbuttons directly (not via
		// form-colorgraph's stepUp/stepDown, which additionally gates commits
		// on gamut) to isolate that bounds resolution specifically.
		const hue = await page.evaluate(() => {
			const el = document.querySelector(
				'form-spinbutton.hue',
			) as HTMLElement & {
				stepUp: (big?: boolean) => void
				value: number
				max: number
			}
			for (let i = 0; i < 30; i++) el.stepUp(true)
			return { value: el.value, max: el.max }
		})
		expect(hue).toEqual({ value: 360, max: 360 })

		const lightness = await page.evaluate(() => {
			const el = document.querySelector(
				'form-spinbutton.lightness',
			) as HTMLElement & {
				stepDown: (big?: boolean) => void
				value: number
				min: number
			}
			for (let i = 0; i < 30; i++) el.stepDown(true)
			return { value: el.value, min: el.min }
		})
		expect(lightness).toEqual({ value: 0, min: 0 })
	})

	test('committing a spinbutton change reads back into host.value', async ({
		page,
	}) => {
		// Type 270 into the hue spinbutton's input and commit — the child's
		// onChange harvest writes its own value Slot and dispatches change,
		// which the parent's per-axis `on(<ref>, 'change', …)` handler commits
		// into host.value (the composed-ref read path LT-089/LT-090 enable).
		// 270 stays within the P3 gamut at the other axes' current values
		// (the in-gamut band around the seed chroma is roughly hue 255–290);
		// out-of-gamut hues are correctly rejected by the next test.
		await page.evaluate(() => {
			const input = document.querySelector(
				'form-spinbutton.hue input[type="number"]',
			) as HTMLInputElement
			input.value = '270'
			input.dispatchEvent(new Event('input', { bubbles: true }))
			input.dispatchEvent(new Event('change', { bubbles: true }))
		})
		await page.waitForTimeout(50)
		const { hue, value } = await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as Colorgraph
			return { hue: el.hue, value: el.value }
		})
		expect(hue).toBeCloseTo(270, 5)
		expect(parseOklch(value).h).toBeCloseTo(270, 0)
	})

	test('an out-of-P3-gamut spinbutton commit is rejected with a validity message', async ({
		page,
	}) => {
		// h=180 (green) at the seed's chroma exceeds the P3 gamut — the
		// per-axis readback must NOT commit and must surface why via
		// setCustomValidity instead.
		await page.evaluate(() => {
			const input = document.querySelector(
				'form-spinbutton.hue input[type="number"]',
			) as HTMLInputElement
			input.value = '180'
			input.dispatchEvent(new Event('input', { bubbles: true }))
			input.dispatchEvent(new Event('change', { bubbles: true }))
		})
		await page.waitForTimeout(50)
		const { hue, value, validationMessage } = await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as Colorgraph
			return {
				hue: el.hue,
				value: el.value,
				validationMessage: el.validationMessage,
			}
		})
		expect(hue).toBeCloseTo(263, 0)
		expect(value).toBe('oklch(.48 .23 263)')
		expect(validationMessage).toContain('gamut')
	})

	test('knob drag rewrites host.value', async ({ page }) => {
		const before = await page.evaluate(
			() => (document.querySelector('form-colorgraph') as Colorgraph).value,
		)
		const readValue = () =>
			page.evaluate(
				() => (document.querySelector('form-colorgraph') as Colorgraph).value,
			)

		// Drag within the graph canvas from right of the current chroma toward
		// higher x, staying inside the P3 gamut band (≈ chroma ≤ 0.29 at this
		// lightness/hue; x ≈ 0.575 of the canvas width is the initial chroma
		// of 0.23). The component commits only in-gamut samples, and the
		// pointerdown handler captures the canvas rect and commits on move.
		const canvas = page.locator('.graph-canvas')
		const box = await canvas.boundingBox()
		if (!box) throw new Error('.graph-canvas has no bounding box')
		const midY = box.y + box.height / 2
		await page.mouse.move(box.x + box.width * 0.62, midY)
		await page.mouse.down()
		// Move in stations with > 1 frame between them: Playwright's WebKit
		// delivers a continuous mouse.move({ steps }) burst within a single
		// animation frame, so the rAF-throttled handler would only ever see
		// the last position — which can sit beyond the gamut boundary and be
		// rejected, losing the whole gesture. Real hardware never does this.
		for (const fraction of [0.65, 0.68, 0.7]) {
			await page.mouse.move(box.x + box.width * fraction, midY, { steps: 2 })
			await page.waitForTimeout(30)
		}
		await page.mouse.up()

		// The drag commit is throttled to the next animation frame, so the
		// released position lands up to one frame AFTER pointerup — poll for
		// it instead of reading synchronously (synthesized input can deliver
		// the whole drag within a single frame, e.g. Playwright WebKit).
		await expect.poll(readValue).not.toBe(before)
		const after = await readValue()
		expect(parseOklch(after).c).toBeGreaterThan(parseOklch(before).c)
	})

	test('Arrow keys on the hue slider step the committed color', async ({
		page,
	}) => {
		const before = await page.evaluate(
			() => (document.querySelector('form-colorgraph') as Colorgraph).value,
		)

		await page.locator('.slider').focus()
		await page.keyboard.press('ArrowRight')
		await page.waitForTimeout(50)

		const after = await page.evaluate(
			() => (document.querySelector('form-colorgraph') as Colorgraph).value,
		)
		expect(after).not.toBe(before)
		const hueOf = (css: string): number => parseOklch(css).h ?? 0
		expect(hueOf(after)).not.toBeCloseTo(hueOf(before), 3)
	})

	test('form reset restores the initial color', async ({ page }) => {
		const initial = await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as Colorgraph
			return { value: el.value, hue: el.hue }
		})

		const changedCss = formatCss({ ...parseOklch(initial.value), h: 100 })
		await page.evaluate((css: string) => {
			const el = document.querySelector('form-colorgraph') as Colorgraph
			el.value = css
		}, changedCss)
		await page.waitForTimeout(100)

		const changedHue = await page.evaluate(
			() => (document.querySelector('form-colorgraph') as Colorgraph).hue,
		)
		expect(changedHue).toBeCloseTo(100, 5)

		await page.evaluate(() => {
			;(document.querySelector('form') as HTMLFormElement)?.reset()
		})
		await page.waitForTimeout(100)

		const reset = await page.evaluate(() => {
			const el = document.querySelector('form-colorgraph') as Colorgraph
			return { value: el.value, hue: el.hue }
		})
		expect(reset.value).toBe(initial.value)
		expect(reset.hue).toBeCloseTo(initial.hue, 5)
	})
})
