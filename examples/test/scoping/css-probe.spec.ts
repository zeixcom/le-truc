import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

/**
 * The platform-CSS contract, compiled emission against the same sheet
 * inline in a plain host (LT-501, ADR 0033). A compiled sheet means what
 * it would mean as an inline `<style>` in its host, so the reference is
 * exactly that: the probe's authored sheet, as an inline `<style>` in a
 * host the page knows nothing about. The compiled emission under test —
 * native `@scope` or the flat lowering, whichever the build ran in — must
 * compute the same styles on the same markup:
 *
 * - the host rules: `:scope` outweighs a page type selector, and
 *   `:where(:scope)` loses to it (both are specificity, pinned);
 * - the authored limit: `to (basic-button > *)` keeps the probe's rules
 *   out of the composed child's internals, and nothing else;
 * - the compose-with-children cells: the probe's rules reach the content
 *   it passes, a custom element in that content, and the child's own
 *   internals — no derived limit is in the way — while the child's own
 *   limit, `to (code > *)`, stops its rules at the content, under a
 *   compiled parent and under a page alike;
 * - live CSS: a plain element or a custom element inserted at runtime is
 *   styled like the rest;
 * - a nested instance of the probe styles its own internals in both forms.
 *
 * Three cells are not twin comparisons, because the inline host cannot
 * share them: the tag-led rule stays contained to `css-probe`, the
 * unscoped rule applies page-wide, and page CSS reaches in (the permanent
 * light-DOM difference from a real shadow root, pinned against one).
 * The authored sheet is read from the source, not duplicated.
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
const GENERATED = join(process.cwd(), 'server/generated/components')
const EMITTED = ['css-probe.css', 'css-probe-child.css'].map(file =>
	join(GENERATED, file),
)

type Cells = Record<string, string>

test.describe('platform-CSS contract: compiled emission vs the sheet inline in a plain host', () => {
	let light: Cells
	let inline: Cells
	let page$: Cells
	let shadow: Cells

	test.beforeEach(async ({ page }) => {
		await page.goto('/test/css-probe')
		await page.waitForSelector('css-probe')
		// The probe's stylesheets stay OUT of the docs bundle: the spec
		// injects the compiler's emitted CSS — the artifact under test —
		// directly, and waits until it is applied.
		for (const path of EMITTED) await page.addStyleTag({ path })
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
		const measured = await page.evaluate(probeSheet => {
			const read = (el: Element, prop: string): string =>
				getComputedStyle(el).getPropertyValue(prop).trim()

			// One measurement over one host, so the compiled probe and its
			// inline reference read the same cells the same way.
			const measure = (root: Element, nestedTag: string): Cells => {
				const q = (selector: string): Element => {
					const el = root.querySelector(selector)
					if (!el) throw new Error(`no ${selector} in ${root.localName}`)
					return el
				}
				const cells: Cells = {
					hostBorder: read(root, 'border-top-color'),
					hostOutline: read(root, 'outline-color'),
					hostBefore: getComputedStyle(root, '::before').content,
					ownTransform: read(q(':scope > button.own'), 'text-transform'),
					labelColor: read(q(':scope > p.label'), 'color'),
					labelSpacing: read(q(':scope > p.label'), 'letter-spacing'),
					globalSpacing: read(q('p.probe-global'), 'letter-spacing'),
					// A page-authored child: in the page's markup, not the template.
					pageChildColor: read(q(':scope > p:last-of-type'), 'color'),
					// The authored limit: the composed child's internals.
					childButtonTransform: read(
						q('basic-button button'),
						'text-transform',
					),
					childLabelColor: read(q('basic-button .label'), 'color'),
					// Compose with children: the content the probe passes.
					kidUnderline: read(
						q('css-probe-child code > span.x'),
						'text-decoration-line',
					),
					kidOutline: read(q('css-probe-child code > span.x'), 'outline-style'),
					kidWidgetTransform: read(
						q('css-probe-child x-kid-widget button'),
						'text-transform',
					),
					// …and the child's own internal beside it.
					childInternalUnderline: read(
						q('css-probe-child > span.x'),
						'text-decoration-line',
					),
					childInternalOutline: read(
						q('css-probe-child > span.x'),
						'outline-style',
					),
					childCodeStyle: read(q('css-probe-child code'), 'font-style'),
				}
				// Live CSS: elements the page inserts after connect.
				const label = document.createElement('p')
				label.className = 'label'
				root.append(label)
				cells.runtimeLabelColor = read(label, 'color')
				const widget = document.createElement('x-runtime-child')
				widget.innerHTML = '<button type="button">Runtime</button>'
				root.append(widget)
				cells.runtimeChildTransform = read(
					widget.querySelector('button')!,
					'text-transform',
				)
				// A nested instance, inside the composed child, where the
				// outer instance's limit applies: it styles its own internals.
				const nested = document.createElement(nestedTag)
				nested.innerHTML = '<p class="label">Nested label</p>'
				if (nestedTag !== 'css-probe')
					nested.append(
						Object.assign(document.createElement('style'), {
							textContent: probeSheet,
						}),
					)
				q('basic-button button').append(nested)
				cells.nestedLabelColor = read(nested.querySelector('p.label')!, 'color')
				cells.nestedHostBefore = getComputedStyle(nested, '::before').content
				return cells
			}

			const probe = document.getElementById('probe')!
			// The reference first, built from a copy of the probe's markup
			// before the compiled probe is measured (and mutated).
			const reference = document.createElement('probe-inline')
			reference.innerHTML = `${probe.innerHTML.replace(/ id="[^"]*"/g, '')}<style>${probeSheet}</style>`
			document.body.append(reference)
			const pageRule = document.createElement('style')
			pageRule.textContent =
				'probe-inline { border-top-color: rgb(0, 128, 0); outline-color: rgb(0, 0, 255); }'
			document.head.append(pageRule)

			const lightCells = measure(probe, 'css-probe')
			const inlineCells = measure(reference, 'probe-inline')

			const pageCells: Cells = {
				outsideGlobalSpacing: read(
					document.getElementById('outside-global')!,
					'letter-spacing',
				),
				tagLedInside: read(
					document.querySelector('css-probe > p.tag-led')!,
					'word-spacing',
				),
				tagLedOutside: read(
					document.getElementById('outside-tag-led')!,
					'word-spacing',
				),
				// The page-rendered child: no owner, no marker, the same styles.
				pageKidOutline: read(
					document.getElementById('page-kid')!,
					'outline-style',
				),
				pageKidUnderline: read(
					document.getElementById('page-kid')!,
					'text-decoration-line',
				),
				pageChildInternalOutline: read(
					document.querySelector('#page-probe-child > span.x')!,
					'outline-style',
				),
			}

			// A real shadow root: page CSS does not reach in, which the light
			// DOM cannot say.
			const twin = document.createElement('probe-shadow')
			document.body.append(twin)
			const root = twin.attachShadow({ mode: 'open' })
			root.innerHTML = '<p class="label">Label</p>'
			const shadowCells: Cells = {
				labelSpacing: read(root.querySelector('p.label')!, 'letter-spacing'),
			}
			return {
				light: lightCells,
				inline: inlineCells,
				page: pageCells,
				shadow: shadowCells,
			}
		}, PROBE_SHEET)
		light = measured.light
		inline = measured.inline
		page$ = measured.page
		shadow = measured.shadow
	})

	test('the compiled emission computes what the sheet computes inline in a plain host', () => {
		// The twin reads the same cells under the page rules scoped to its
		// own tag; every cell that does not depend on the host's tag agrees.
		expect(light).toEqual(inline)
	})

	test('host rules: `:scope` outweighs a page type selector, `:where(:scope)` loses to it', () => {
		// :scope { border-top: 3px solid RED } vs page css-probe { GREEN }.
		expect(light.hostBorder).toBe('rgb(255, 0, 0)')
		// :where(:scope) { outline-color: MAGENTA } vs page css-probe { BLUE }.
		expect(light.hostOutline).toBe('rgb(0, 0, 255)')
		expect(light.hostBefore).toBe('""')
	})

	test('an authored limit keeps the rules out of the composed child, and only there', () => {
		expect(light.ownTransform).toBe('uppercase')
		expect(light.childButtonTransform).toBe('none')
		expect(light.childLabelColor).not.toBe('rgb(0, 0, 255)')
		expect(light.labelColor).toBe('rgb(0, 0, 255)')
	})

	test('page-authored children and runtime insertions are styled — scoped rules are live CSS', () => {
		expect(light.pageChildColor).toBe('rgb(0, 0, 255)')
		expect(light.runtimeLabelColor).toBe('rgb(0, 0, 255)')
		// The limit names `basic-button` only, so a custom element inserted
		// at runtime is no boundary.
		expect(light.runtimeChildTransform).toBe('uppercase')
	})

	test('compose with children: the probe reaches its passed content and the child internals', () => {
		expect(light.kidUnderline).toBe('underline')
		expect(light.kidWidgetTransform).toBe('uppercase')
		expect(light.childInternalUnderline).toBe('underline')
	})

	test('compose with children: the child limit stops its own rules at the content', () => {
		// css-probe-child { @scope to (code > *) { span { outline: dashed } } }
		expect(light.kidOutline).toBe('none')
		expect(light.childInternalOutline).toBe('dashed')
		expect(light.childCodeStyle).toBe('italic')
		// Under a page — no owner, no marker — the child styles its content
		// the same way, and the probe's rules do not reach it.
		expect(page$.pageKidOutline).toBe('none')
		expect(page$.pageKidUnderline).toBe('none')
		expect(page$.pageChildInternalOutline).toBe('dashed')
	})

	test('a nested instance styles its own internals, inside the outer limit too', () => {
		expect(light.nestedLabelColor).toBe('rgb(0, 0, 255)')
		expect(light.nestedHostBefore).toBe('""')
	})

	test('top-level rules: an unscoped rule is page-wide, a tag-led rule stays contained', () => {
		expect(light.globalSpacing).toBe('2px')
		expect(page$.outsideGlobalSpacing).toBe('2px')
		expect(page$.tagLedInside).toBe('5px')
		expect(page$.tagLedOutside).toBe('0px')
	})

	test('page CSS reaches light-DOM internals — and only a real shadow root prevents it', () => {
		// The permanent inward-reach difference, pinned.
		expect(light.labelSpacing).toBe('3px')
		expect(shadow.labelSpacing).toBe('normal')
	})
})
