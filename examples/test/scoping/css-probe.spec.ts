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
 * - s1: scoped rules are live CSS — a plain element inserted at runtime
 *   is styled like the rest (no build-time snapshot).
 * - s7: the documented DIFFERENCES, each pinned against the shadow twin:
 *   inward reach (page CSS reaches a light-DOM component's internals);
 *   page-authored children styled by the component's rules; a custom
 *   element inserted at runtime is no boundary (parent rules reach its
 *   internals — the boundary is the template's tags, decided at build);
 *   and, LOWERED MODE ONLY, self-nesting through a boundary: in
 *   `A > B > A′` with B a tag A renders, the guard's `A B > *` matches
 *   through the OUTER A, so A′'s own internals and its guarded
 *   `:host…` rules (`:host::before`, `:host .x`) go unstyled. Native
 *   `@scope` styles them (A′ is its own scope root), as a shadow root
 *   does. The mode is read from the emitted artifact under test.
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
	const m =
		/<style>\s*\{css`([\s\S]*?)`\}<\/style>/.exec(source) ??
		/<style>([\s\S]*?)<\/style>/.exec(source)
	return m?.[1]?.trim() ?? ''
}

const PROBE_SHEET = sheetOf('css-probe.tsx')
const CHILD_SHEET = sheetOf('../../basic/button/basic-button.tsrx')
const EMITTED_PATH = join(
	process.cwd(),
	'server/generated/components/css-probe.css',
)
/** The emission mode the build ran in (ADR 0033 s3/s4). */
const NATIVE = readFileSync(EMITTED_PATH, 'utf8').includes('@scope')

test.describe('scoped-CSS contract: compiled light DOM vs a real shadow root', () => {
	let light: Record<string, string>
	let shadow: Record<string, string>

	test.beforeEach(async ({ page }) => {
		await page.goto('/test/css-probe')
		await page.waitForSelector('css-probe')
		// The probe's stylesheet stays OUT of the docs bundle (LT-306): the
		// spec injects the compiler's emitted CSS — the artifact under test —
		// directly, and waits until it is applied.
		await page.addStyleTag({ path: EMITTED_PATH })
		await page.waitForFunction(
			() => {
				const label = document.querySelector('css-probe > p.label')
				return (
					label !== null && getComputedStyle(label).color === 'rgb(0, 0, 255)'
				)
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
				labelSpacing: read(
					document.querySelector('css-probe > p.label')!,
					'letter-spacing',
				),
				labelColor: read(
					document.querySelector('css-probe > p.label')!,
					'color',
				),
				globalSpacing: read(
					document.querySelector('css-probe > p.probe-global')!,
					'letter-spacing',
				),
				// s7: a page-authored child — in the page's markup, not the
				// template — is styled by the component's rules.
				pageChildColor: read(document.getElementById('page-child')!, 'color'),
				bodyColor: read(document.body, 'color'),
				// s1: scoped rules are live CSS — a plain element the page
				// appends after connect is matched like the rest.
				runtimeLabelColor: (() => {
					const p = document.createElement('p')
					p.className = 'label'
					document.getElementById('probe')!.append(p)
					return read(p, 'color')
				})(),
				// s7: a custom element inserted at RUNTIME is no boundary — the
				// guard/limit names the template's tags only, so the parent's
				// `button` rule reaches the newcomer's internals.
				runtimeChildTransform: (() => {
					const host = document.createElement('x-runtime-child')
					host.innerHTML = '<button type="button">Runtime</button>'
					document.getElementById('probe')!.append(host)
					return read(host.querySelector('button')!, 'text-transform')
				})(),
				// s7 (lowered only): A > B > A′ — a second probe nested in the
				// composed basic-button. Its own `.label` and its guarded
				// `:host::before` are excluded by the OUTER probe's guard.
				...(() => {
					const inner = document.createElement('css-probe')
					inner.id = 'nested-probe'
					inner.innerHTML = '<p class="label">Nested label</p>'
					document.getElementById('child')!.append(inner)
					return {
						nestedLabelColor: read(inner.querySelector('p.label')!, 'color'),
						nestedHostBefore: getComputedStyle(inner, '::before').content,
						outerHostBefore: getComputedStyle(
							document.getElementById('probe')!,
							'::before',
						).content,
					}
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
				// The page-authored child, as a shadow host's light child: the
				// slot renders it (inheriting), the shadow sheet never matches
				// it — only `::slotted()` could.
				twin.innerHTML = '<p class="label" id="twin-page-child">Page child</p>'
				const shadow = twin.attachShadow({ mode: 'open' })
				shadow.innerHTML = `<style>${probeSheet}</style>
					<p class="label">Label</p>
					<p class="probe-global">Global</p>
					<div id="twin-child"></div>
					<button type="button" class="own">Own</button>
					<slot></slot>`
				// The composed child as a shadow host: the probe sheet cannot
				// cross into it, exactly as the boundary guard models it.
				const childHost = shadow.getElementById('twin-child')!
				const childShadow = childHost.attachShadow({ mode: 'open' })
				childShadow.innerHTML = `<style>${childSheet}</style><button type="button">Child</button><div id="twin-nested"></div>`
				// A > B > A′: the nested probe is its own shadow host with its
				// own copy of the sheet — styled, whatever encloses it.
				const nested = childShadow.getElementById('twin-nested')!
				const nestedShadow = nested.attachShadow({ mode: 'open' })
				nestedShadow.innerHTML = `<style>${probeSheet}</style><p class="label">Nested label</p>`
				// A custom element inserted at runtime inside the shadow root:
				// its own shadow root keeps the parent sheet out.
				const runtimeHost = document.createElement('div')
				shadow.append(runtimeHost)
				runtimeHost.attachShadow({ mode: 'open' }).innerHTML =
					'<button type="button">Runtime</button>'
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
					labelSpacing: read(
						shadow.querySelector('p.label')!,
						'letter-spacing',
					),
					labelColor: read(shadow.querySelector('p.label')!, 'color'),
					// The global rule ships at DOCUMENT level in shadow mode
					// (a global rule cannot live in a shadow root) — the
					// s7 difference the closing test pins.
					globalSpacing: read(
						shadow.querySelector('p.probe-global')!,
						'letter-spacing',
					),
					pageChildColor: read(
						twin.querySelector('#twin-page-child')!,
						'color',
					),
					bodyColor: read(document.body, 'color'),
					runtimeChildTransform: read(
						runtimeHost.shadowRoot!.querySelector('button')!,
						'text-transform',
					),
					nestedLabelColor: read(
						nestedShadow.querySelector('p.label')!,
						'color',
					),
					nestedHostBefore: getComputedStyle(nested, '::before').content,
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
		expect(shadow.globalSpacing).toBe('normal')
	})

	test('s7: page-authored children are styled by the component rules in light DOM only', () => {
		expect(light.pageChildColor).toBe('rgb(0, 0, 255)')
		// A shadow root's sheet never matches its host's light children.
		expect(shadow.pageChildColor).toBe(shadow.bodyColor)
	})

	test('s1: scoped rules are live CSS — a plain element inserted at runtime is styled', () => {
		expect(light.runtimeLabelColor).toBe('rgb(0, 0, 255)')
	})

	test('s7: a custom element inserted at runtime is no boundary in light DOM', () => {
		// The guard/limit names the template's tags, decided at build: the
		// parent's `button` rule reaches the newcomer's internals.
		expect(light.runtimeChildTransform).toBe('uppercase')
		expect(shadow.runtimeChildTransform).toBe('none')
	})

	test('s7: self-nesting through a boundary — lowered unstyles the nested instance, native and shadow style it', () => {
		// The outer instance's guarded host rule applies either way.
		expect(light.outerHostBefore).toBe('""')
		expect(shadow.nestedLabelColor).toBe('rgb(0, 0, 255)')
		expect(shadow.nestedHostBefore).toBe('""')
		if (NATIVE) {
			expect(light.nestedLabelColor).toBe('rgb(0, 0, 255)')
			expect(light.nestedHostBefore).toBe('""')
		} else {
			// The OUTER probe's `css-probe basic-button > *` matches the
			// nested probe: its internals and guarded `:host::before` drop.
			expect(light.nestedLabelColor).not.toBe('rgb(0, 0, 255)')
			expect(light.nestedHostBefore).toBe('none')
		}
	})
})
