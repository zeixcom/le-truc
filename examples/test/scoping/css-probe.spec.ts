import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

/**
 * The scoped-CSS contract, light DOM against a real shadow root (LT-304,
 * ADR 0033 s1/s3/s7). One fixture per contract point:
 *
 * - s1: the host rule loses to a page type selector — in the compiled
 *   light-DOM output AND in the same sheet inside a real shadow root.
 * - s1: a parent rule never reaches a composed child's internals — in
 *   either world (the boundary guard in light DOM; the shadow boundary in
 *   the root).
 * - s6a: the `:global` rule styles page-authored children in light DOM
 *   (its emission outside the scope is pinned text-level by the compiler
 *   unit tests).
 * - s7: the documented DIFFERENCE — page CSS reaches a light-DOM
 *   component's internals and only a real shadow root prevents it.
 *
 * The shadow twin reconstructs the composition the way a shadow root
 * would host it: the probe's authored sheet in the host's shadow root,
 * the composed child as its own shadow host carrying basic-button's
 * authored sheet — no custom elements, so no upgrade is involved. The
 * authored sheets are read from the sources, not duplicated.
 */

// Playwright runs the spec from the repo root; the sources the sheets
// are read from are repo-relative.
const here = join(process.cwd(), 'examples/test/scoping')
const sheetOf = (path: string): string => {
	const source = readFileSync(join(here, path), 'utf8')
	const m = /<style>\s*\{css`([\s\S]*?)`\}<\/style>/.exec(source) ??
		/<style>([\s\S]*?)<\/style>/.exec(source)
	return m?.[1]?.trim() ?? ''
}

const PROBE_SHEET = sheetOf('css-probe.tsx')
const CHILD_SHEET = sheetOf('../../basic/button/basic-button.tsrx')

test.describe('scoped-CSS contract: compiled light DOM vs a real shadow root', () => {
	let light: Record<string, string>
	let shadow: Record<string, string>

	test.beforeEach(async ({ page }) => {
		await page.goto('/test/css-probe')
		await page.waitForSelector('css-probe')
		// The probe's stylesheet stays OUT of the docs bundle (LT-306): the
		// spec injects the compiler's emitted CSS — the artifact under test —
		// directly, and waits until it is applied.
		await page.addStyleTag({
			path: join(process.cwd(), 'server/generated/components/css-probe.css'),
		})
		await page.waitForFunction(
			() => {
				const label = document.querySelector('css-probe > p.label')
				return label !== null &&
					getComputedStyle(label).color === 'rgb(0, 0, 255)'
			},
			undefined,
			{ timeout: 10_000 },
		)
		light = await page.evaluate(() => {
			const read = (el: Element, prop: string): string =>
				getComputedStyle(el).getPropertyValue(prop).trim()
			return {
				hostBorder: read(document.getElementById('probe')!, 'border-top-color'),
				ownTransform: read(
					document.querySelector('css-probe > button.own')!,
					'text-transform',
				),
				childButtonTransform: read(
					document.querySelector('basic-button button')!,
					'text-transform',
				),
				labelSpacing: read(document.querySelector('css-probe > p.label')!, 'letter-spacing'),
				labelColor: read(document.querySelector('css-probe > p.label')!, 'color'),
				globalSpacing: read(
					document.querySelector('css-probe > p.probe-global')!,
					'letter-spacing',
				),
				// s7: children inserted at RUNTIME are matched live by the
				// scoped rules in light DOM — matching is not a build-time
				// snapshot.
				runtimeLabelColor: (() => {
					const p = document.createElement('p')
					p.className = 'label'
					document.querySelector('css-probe')!.append(p)
					return read(p, 'color')
				})(),
			}
		})
		shadow = await page.evaluate(
			([probeSheet, childSheet]) => {
				// The twin host is an UNUPGRADED custom element, so the page
				// side of the s1 comparison is a page TYPE selector — the
				// same shape as the light-DOM side's `css-probe { … }`.
				const twin = document.createElement('css-probe-twin')
				twin.id = 'scoping-twin'
				document.body.append(twin)
				const pageRule = document.createElement('style')
				pageRule.textContent =
					'css-probe-twin { border-top-color: rgb(0, 128, 0); }'
				document.head.append(pageRule)
				const shadow = twin.attachShadow({ mode: 'open' })
				shadow.innerHTML = `<style>${probeSheet}</style>
					<p class="label">Label</p>
					<p class="probe-global">Global</p>
					<div id="twin-child"></div>
					<button type="button" class="own">Own</button>`
				// The composed child as a shadow host: the probe sheet cannot
				// cross into it, exactly as the boundary guard models it.
				const childHost = shadow.getElementById('twin-child')!
				const childShadow = childHost.attachShadow({ mode: 'open' })
				childShadow.innerHTML = `<style>${childSheet}</style><button type="button">Child</button>`
				const read = (el: Element, prop: string): string =>
					getComputedStyle(el).getPropertyValue(prop).trim()
				return {
					hostBorder: read(twin, 'border-top-color'),
					ownTransform: read(
						shadow.querySelector('button.own')!,
						'text-transform',
					),
					childButtonTransform: read(
						childShadow.querySelector('button')!,
						'text-transform',
					),
					labelSpacing: read(shadow.querySelector('p.label')!, 'letter-spacing'),
					labelColor: read(shadow.querySelector('p.label')!, 'color'),
					// The global rule ships at DOCUMENT level in shadow mode
					// (a global rule cannot live in a shadow root) — the
					// s7 difference the closing test pins.
					globalSpacing: read(
						shadow.querySelector('p.probe-global')!,
						'letter-spacing',
					),
				}
			},
			[PROBE_SHEET, CHILD_SHEET],
		)
	})

	test('s1: the host rule loses to a page type selector in BOTH worlds', () => {
		// :host { border-top: 3px solid RED } vs page css-probe { GREEN }.
		expect(light.hostBorder).toBe('rgb(0, 128, 0)')
		expect(shadow.hostBorder).toBe('rgb(0, 128, 0)')
	})

	test('s1: a parent rule never reaches a composed child internals in EITHER world', () => {
		// button { uppercase } styles the probe's own button everywhere;
		// the composed child's internal button stays untransformed — by the
		// boundary guard in light DOM, by the shadow boundary in the root.
		expect(light.ownTransform).toBe('uppercase')
		expect(light.childButtonTransform).toBe('none')
		expect(shadow.ownTransform).toBe('uppercase')
		expect(shadow.childButtonTransform).toBe('none')
	})

	test('s1: bare internals rules style the component own elements in both worlds', () => {
		expect(light.labelColor).toBe('rgb(0, 0, 255)')
		expect(shadow.labelColor).toBe('rgb(0, 0, 255)')
	})

	test('s6a: the :global rule styles page-authored children in light DOM', () => {
		expect(light.globalSpacing).toBe('2px')
	})

	test('s7: page CSS reaches light-DOM internals — and only a real shadow root prevents it', () => {
		// The documented inward-reach difference, fixture-pinned.
		expect(light.labelSpacing).toBe('3px')
		expect(shadow.labelSpacing).toBe('normal')
	})

	test('s7: the :global rule does not cross into a real shadow root', () => {
		// Light DOM: the hoisted rule styles the page-authored child.
		expect(light.globalSpacing).toBe('2px')
		// Shadow DOM: a global rule cannot live in a shadow root — the
		// shadow twin's copy of the same content carries no letter-spacing.
		expect(shadow.globalSpacing).not.toBe('2px')
	})

	test('s7: children inserted at runtime are matched live in light DOM', () => {
		// The scoped rules are live CSS, not a build-time snapshot: a
		// `.label` the page appends after connect is styled like the rest.
		expect(light.runtimeLabelColor).toBe('rgb(0, 0, 255)')
	})
})
