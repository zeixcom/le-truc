import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@playwright/test'
import { PROBED, RULES } from './sheets'

/**
 * LT-465 probe: which authored rules reach which element, per shape and
 * emission. Reads `fixtures.json` (run `generate.ts` first) and writes
 * `results-<browser>.json`.
 */
const here = join(process.cwd(), 'spike/children-scope')
const { page: PAGE, variants } = JSON.parse(
	readFileSync(join(here, 'fixtures.json'), 'utf8'),
) as {
	page: string
	variants: Array<{ name: string; css: string; html: string }>
}

test('matrix', async ({ page }) => {
	const out: Record<string, Record<string, string[]>> = {}
	for (const v of variants) {
		await page.setContent(
			`<style>${PAGE}</style><style>${v.css}</style>${v.html}`,
		)
		out[v.name] = await page.evaluate(
			([ids, rules]) =>
				Object.fromEntries(
					(ids as string[]).map(id => {
						const cs = getComputedStyle(document.getElementById(id)!)
						const hits: string[] = []
						for (const [prop, list] of Object.entries(
							rules as Record<string, [string, string][]>,
						))
							for (const [rule, value] of list)
								if (cs.getPropertyValue(prop) === value) hits.push(rule)
						return [id, hits]
					}),
				),
			[PROBED, RULES] as const,
		)
	}
	writeFileSync(
		join(here, `results-${test.info().project.name}.json`),
		`${JSON.stringify(out, null, '\t')}\n`,
	)
})

/**
 * Shape (b)'s wrapper in served HTML: where the parser keeps it, and
 * whether `>`-anchored rules still reach the children through it.
 */
test('wrapper parse', async ({ page }) => {
	const W = '<div data-children="p-par" style="display: contents">'
	await page.setContent(`
<style>ul > li, tbody > tr, select > option, dl > dt { outline-color: rgb(8, 8, 8); }</style>
<ul id="ul">${W}<li id="li">li</li></div></ul>
<table><tbody id="tbody">${W}<tr id="tr"><td>td</td></tr></div></tbody></table>
<select id="select">${W}<option id="option">o</option></div></select>
<dl id="dl">${W}<dt id="dt">dt</dt></div></dl>`)
	const out = await page.evaluate(() =>
		Object.fromEntries(
			[
				['li', 'ul'],
				['tr', 'tbody'],
				['option', 'select'],
				['dt', 'dl'],
			].map(([child, parent]) => {
				const el = document.getElementById(child)!
				const wrapper = document.querySelector(`#${parent} [data-children]`)
				return [
					child,
					{
						wrapperKept: wrapper !== null,
						parentIsWrapper:
							el.parentElement?.hasAttribute('data-children') ?? false,
						childRuleMatches:
							getComputedStyle(el).outlineColor === 'rgb(8, 8, 8)',
					},
				]
			}),
		),
	)
	writeFileSync(
		join(here, `wrapper-${test.info().project.name}.json`),
		`${JSON.stringify(out, null, '\t')}\n`,
	)
})
