/**
 * Stage-1 server-simulation driver (ADR 0027 sub-design 7, LT-154).
 *
 * Runs the WHOLE `.tsrx` corpus (`server/generated/tsrx/` scope only — page
 * chrome is out of stage 1, LT-152) through the driver in `server/tsrx/sim/`:
 * one shared realm, each component's client module loaded exactly once
 * (`realm.load()`'s own assertion enforces that — see `realm.ts`), every
 * component rendered from its server-rendered markup through the hermetic-
 * quiescence boundary, children-first replay driven by the compiler's
 * compose graph (`RegistryEntry.composesTags`). Disposal happens once, at
 * the end of this whole file (end-of-process posture, LT-152 review) — not
 * between renders.
 *
 * Fixture-pinned: this is what "the old render function remains the
 * template-tree source, the client connect is simulated against it, and
 * serialization overlays the computed initial state" looks like end to end.
 * A snapshot diff here is either a real behavior change (re-approve with
 * `--update-snapshots`) or a driver regression — same posture as
 * `server.golden.test.ts` for hand-picked tags, but corpus-wide and through
 * the simulation rather than the template alone.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { pathToFileURL } from 'node:url'
import { compileTsrxCorpus } from '../../effects/tsrx'
import type { ComponentRegistry } from '../../tsrx/registry'
import { createSimulationRealm } from '../../tsrx/sim/realm'
import {
	CLASSIFIED_DIAGNOSTICS,
	formatSimReport,
	reportDiagnostics,
} from '../../tsrx/sim/report'
import { createGeneratedDir } from '../helpers/generated-tsrx'
import { loadTsrxCorpus } from './corpus-fixture'

/** `form-spinbutton` → `renderFormSpinbutton`. */
const renderName = (tag: string): string =>
	`render${tag
		.split('-')
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join('')}`

/**
 * Same posture as `server-render-smoke.test.ts`: components whose args are
 * genuinely required get a value, everything else renders from `{}`.
 */
const ARGS: Record<string, Record<string, unknown>> = {
	'form-spinbutton': { name: 'quantity' },
	'form-checkbox': { name: 'agree', label: 'I agree' },
	'form-radiogroup': {
		name: 'choice',
		label: 'Pick one',
		options: [
			{ value: 'a', label: 'A' },
			{ value: 'b', label: 'B' },
		],
	},
	'form-textbox': { name: 'title', label: 'Title' },
	'form-combobox': {
		name: 'fruit',
		label: 'Fruit',
		options: [
			{ value: 'a', label: 'Apple' },
			{ value: 'b', label: 'Banana' },
		],
	},
	'form-tokenbox': { name: 'tags', label: 'Tags' },
	'form-listbox': {
		name: 'fruit',
		options: [
			{ value: 'a', label: 'Apple' },
			{ value: 'b', label: 'Banana' },
		],
	},
	'module-tabgroup': {
		tabs: [
			{ id: 'one', label: 'One', content: 'First' },
			{ id: 'two', label: 'Two', content: 'Second' },
		],
	},
	'card-blogpost': { title: 'Title', href: '#' },
	'card-callout': { title: 'Heads up' },
	'card-collapsible': { title: 'Details' },
	'basic-button': { label: 'Add' },
}

const generated = createGeneratedDir('sim-driver')
afterAll(() => generated.cleanup())

const compiled = await compileTsrxCorpus(await loadTsrxCorpus(), generated.path)
const registry = JSON.parse(
	await Bun.file(`${generated.path}/registry.json`).text(),
) as ComponentRegistry

// One realm for the whole corpus (ADR 0027 sub-design 2/10): disposed once,
// after every render this file will ever do — never between them (LT-152
// review's disposal finding).
const realm = createSimulationRealm({
	composesTags: tag => registry[tag]?.composesTags ?? [],
})
afterAll(() => realm.dispose())

// Phase 1 — load every corpus component's client module exactly once. A
// composed child a parent's own client module already imports (e.g.
// form-colorgraph → form-spinbutton) gets recorded as a side effect of the
// parent's load, so this loop skips it when it reaches the child's own
// entry — calling load() on an already-cached module records nothing NEW
// and load()'s own assertion (sub-design 10) would otherwise throw.
for (const info of compiled) {
	if (realm.definitions.some(entry => entry.name === info.tag)) continue
	await realm.load(() => import(pathToFileURL(info.clientModulePath).href))
}

describe('stage-1 server-simulation driver — corpus fixtures (LT-154)', () => {
	test('every corpus component was loaded exactly once', () => {
		const tags = compiled.map(info => info.tag)
		const defined = new Set(realm.definitions.map(entry => entry.name))
		for (const tag of tags) expect(defined.has(tag)).toBe(true)
	})

	// Phase 2 — render many times against the one shared, already-loaded realm.
	for (const info of compiled) {
		test(`${info.tag} renders under simulation (fixture-pinned)`, async () => {
			const mod = (await import(
				pathToFileURL(info.serverModulePath).href
			)) as Record<string, unknown>
			const renderFn = mod[renderName(info.tag)] as (args: unknown) => string
			const markup = renderFn(ARGS[info.tag] ?? {})
			const html = await realm.render({ markup, component: info.tag })
			expect(html).toContain(`<${info.tag}`)
			expect(html).toMatchSnapshot()
		})
	}
})

describe('quiescence is hermetic (sub-design 9) — no build warning on the standing corpus', () => {
	test('no component reports non-quiescent', () => {
		const overruns = realm.diagnostics.filter(
			entry => entry.kind === 'non-quiescent',
		)
		expect(overruns).toEqual([])
	})
})

describe('build-report baseline (LT-163) — the wave-4 regression signal', () => {
	test('zero unclassified build-report warnings on the corpus', () => {
		const report = reportDiagnostics(realm.diagnostics)
		if (report.unclassified.length > 0)
			throw new Error(
				'New build-report warnings on the corpus — fix the component, or ' +
					'classify the entry with a reason in server/tsrx/sim/report.ts:\n' +
					formatSimReport(report),
			)
	})

	test('every classification still matches a standing entry', () => {
		// A classification that admits nothing is a dead allowlist entry: the
		// diagnostic it classified was fixed, so retire the classification
		// with it (recorded, not silenced — report.ts).
		const report = reportDiagnostics(realm.diagnostics)
		for (const classification of CLASSIFIED_DIAGNOSTICS) {
			const used = report.classified.some(
				entry => entry.classification === classification,
			)
			if (!used)
				throw new Error(
					`The classification for ${
						classification.component ?? 'any component'
					} (${classification.message}) no longer matches any diagnostic — retire it from CLASSIFIED_DIAGNOSTICS.`,
				)
		}
	})

	test('classified entries are listed with their reason, not silenced', () => {
		const report = reportDiagnostics(realm.diagnostics)
		for (const { classification } of report.classified)
			expect(formatSimReport(report)).toContain(classification.reason)
	})
})
