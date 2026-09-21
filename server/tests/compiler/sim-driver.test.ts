/**
 * Stage-1 server-simulation driver (ADR 0027 sub-design 7, LT-154).
 *
 * Runs the WHOLE `.tsrx` corpus (`server/generated/components/` scope only — page
 * chrome is out of stage 1, LT-152) through the driver in `server/compiler/sim/`:
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
 * the simulation rather than the template alone. `server.golden.test.ts`
 * itself is unaffected in kind (LT-164): template lowering does not retire
 * (ADR 0027 sub-design 1), so the server modules stay byte-pinned there.
 *
 * The simulated goldens are PER-SUBSTRATE bytes (LT-153 decision 3, LT-164).
 * Inline-style serialization is substrate-specific: happy-dom terminates
 * inline custom-property declarations with `;` where jsdom omits it
 * (LT-152), so swapping the substrate re-baselines every snapshot in this
 * file at once. A mass re-baseline immediately after a substrate change is
 * the expected shape, not a behavior change. A single tag moving with NO
 * substrate change is the dangerous kind — treat it as a behavior change or
 * a driver regression.
 *
 * Two corpus invariants live here too (LT-164):
 *
 * - The double-connect fixed-point gate (sub-design 8): every fixture feeds
 *   its own output back through a second `realm.render()`, mirroring the
 *   browser parsing the served HTML and connecting again over it, and
 *   requires byte-identical serialization. A component whose second pass
 *   differs is a build error against that component.
 * - The two-order hermeticity test (sub-design 10): the corpus renders in
 *   two different orders on two realms and reproduces identical per-tag
 *   output. Order 2 needs its own module tree — one module cache per
 *   process means re-importing order 1's client modules records no
 *   definitions (the load-once assertion throws) — so the compiled tree is
 *   copied to a second generated dir: fresh resolved specifiers, identical
 *   code, so any output difference is order, not rebuild variance.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { cpSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { formatSimReport, reportDiagnostics } from '../../compiler/build-report'
import { tierCensus } from '../../compiler/census'
import type { ComponentRegistry } from '../../compiler/registry'
import { CLASSIFIED_DIAGNOSTICS } from '../../compiler/sim/classifications'
import {
	createSimulationRealm,
	type JsdomSimulationRealm,
} from '../../compiler/sim/realm'
import { compileCorpus } from '../../corpus-compile'
import { createGeneratedDir } from '../helpers/generated-corpus'
// LT-165 step 8: the args table and the tag→render-fn mapping moved to
// `corpus-args.ts` so the equivalence audit (equivalence-audit.test.ts)
// drives BOTH mechanisms from the identical fixture inputs this file uses —
// one copy, no drift. Data is unchanged.
import { CORPUS_ARGS as ARGS, renderName } from './corpus-args'
import { loadCorpus } from './corpus-fixture'

const generated = createGeneratedDir('sim-driver')
afterAll(() => generated.cleanup())

const compiled = await compileCorpus(await loadCorpus(), generated.path)
const registry = JSON.parse(
	await Bun.file(`${generated.path}/registry.json`).text(),
) as ComponentRegistry

// One realm for the whole corpus (ADR 0027 sub-design 2/10): disposed once,
// after every render this file will ever do — never between them (LT-152
// review's disposal finding).
const realm = createSimulationRealm({
	composesTags: tag => registry[tag]?.composesTags ?? [],
	// LT-165 step 7: revert each unresolvable expression's site to its
	// skeleton state after the drain — a no-op while no corpus component
	// carries records, and what keeps the fixed-point gate below honest
	// the day one does (module-ticker's shape).
	suppressedSites: tag => registry[tag]?.suppressedSites ?? [],
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

/** One compiled corpus entry, as `compileCorpus` reported it. */
type CompiledInfo = (typeof compiled)[number]

/** Run the component's server render fn over this file's shared ARGS. */
const serverMarkupOf = async (info: CompiledInfo): Promise<string> => {
	const mod = (await import(
		pathToFileURL(info.serverModulePath).href
	)) as Record<string, unknown>
	const renderFn = mod[renderName(info.tag)] as (args: unknown) => string
	return renderFn(ARGS[info.tag] ?? {})
}

/** Parse `markup` into the realm and simulate one connect pass over it. */
const simulateConnect = (
	r: JsdomSimulationRealm,
	info: CompiledInfo,
	markup: string,
): Promise<string> =>
	r.render({ markup, component: info.tag }).then(result => result.html)

describe('stage-1 server-simulation driver — corpus fixtures (LT-154)', () => {
	test('every corpus component was loaded exactly once', () => {
		const tags = compiled.map(info => info.tag)
		const defined = new Set(realm.definitions.map(entry => entry.name))
		for (const tag of tags) expect(defined.has(tag)).toBe(true)
	})

	// Phase 2 — render many times against the one shared, already-loaded realm.
	for (const info of compiled) {
		test(`${info.tag} renders under simulation, fixture-pinned, and connects to a fixed point (sub-design 8)`, async () => {
			const html = await simulateConnect(
				realm,
				info,
				await serverMarkupOf(info),
			)
			expect(html).toContain(`<${info.tag}`)
			// Double-connect fixed-point gate (sub-design 8, LT-164): the
			// browser parses the simulation's own output and runs connect
			// AGAIN over it, so enhancement must be idempotent over what
			// enhancement produced. Feed the first pass's output back through
			// a second connect pass; a component whose second pass differs
			// fails here, against that component.
			const second = await simulateConnect(realm, info, html)
			if (second !== html)
				throw new Error(
					`${info.tag} is not a connect fixed point: feeding the ` +
						'simulated output back through a second connect pass produced ' +
						'different markup (ADR 0027 sub-design 8). The browser parses ' +
						'the served HTML and runs connect again over it, so this ' +
						'component would change after hydration. Make the second pass ' +
						'byte-identical.',
				)
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
		const report = reportDiagnostics(realm.diagnostics, CLASSIFIED_DIAGNOSTICS)
		if (report.unclassified.length > 0)
			throw new Error(
				'New build-report warnings on the corpus — fix the component, or ' +
					'classify the entry with a reason in\n' +
					'server/compiler/sim/classifications.ts:\n' +
					formatSimReport(report),
			)
	})

	test('every classification still matches a standing entry', () => {
		// A classification that admits nothing is a dead allowlist entry: the
		// diagnostic it classified was fixed, so retire the classification
		// with it (recorded, not silenced — build-report.ts).
		const report = reportDiagnostics(realm.diagnostics, CLASSIFIED_DIAGNOSTICS)
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
		const report = reportDiagnostics(realm.diagnostics, CLASSIFIED_DIAGNOSTICS)
		for (const { classification } of report.classified)
			expect(formatSimReport(report)).toContain(classification.reason)
	})

	test('the tier census rides its own channel, never the diagnostic one (ADR 0029 s6)', () => {
		// The census (LT-165 step 6) is a second KIND of build-report record,
		// not a diagnostic: none of its reasons may be admitted by — or be
		// needed by — the classification table, and the zero-unclassified gate
		// above is unchanged by the census's existence. A census record that
		// showed up here would mean the two record kinds were merged, which
		// would make the census trippable and the baseline lies-prone.
		const census = tierCensus(Object.values(registry))
		for (const entry of census.entries)
			for (const reason of entry.reasons)
				expect(CLASSIFIED_DIAGNOSTICS.some(c => c.message.test(reason))).toBe(
					false,
				)
		const report = reportDiagnostics(realm.diagnostics, CLASSIFIED_DIAGNOSTICS)
		expect(report.unclassified).toEqual([])
	})
})

describe('two-order hermeticity (sub-design 10, LT-164)', () => {
	test('the corpus renders identically in two different orders', async () => {
		// Order 1 — the compiled (glob scan) order, on this file's own realm.
		// Re-rendered here rather than read from the fixtures above: repeat
		// renders of the same component being byte-stable is part of the same
		// invariant (sub-design 10).
		const forward = new Map<string, string>()
		for (const info of compiled)
			forward.set(
				info.tag,
				await simulateConnect(realm, info, await serverMarkupOf(info)),
			)

		// Order 2 — reversed load AND reversed render order, on a fresh realm.
		// The module-cache trap: one module cache per process means a second
		// realm importing order 1's client modules records no definitions and
		// silently renders un-upgraded markup (the load-once assertion throws
		// on it). So order 2 gets its own module tree: the compiled tree is
		// COPIED rather than recompiled — fresh resolved specifiers with
		// byte-identical code, so a diff can only be order, never rebuild
		// variance (scripts/lib/substrate-probe.ts shows the build-fresh
		// pattern this copies the intent of).
		const order2 = createGeneratedDir('sim-driver-order2')
		try {
			cpSync(generated.path, order2.path, { recursive: true })
			const realm2 = createSimulationRealm({
				composesTags: tag => registry[tag]?.composesTags ?? [],
				suppressedSites: tag => registry[tag]?.suppressedSites ?? [],
			})
			try {
				const clientInOrder2 = (info: CompiledInfo): string =>
					join(order2.path, relative(generated.path, info.clientModulePath))
				for (const info of [...compiled].reverse()) {
					if (realm2.definitions.some(entry => entry.name === info.tag))
						continue
					await realm2.load(
						() => import(pathToFileURL(clientInOrder2(info)).href),
					)
				}
				const reversed = new Map<string, string>()
				for (const info of [...compiled].reverse())
					reversed.set(
						info.tag,
						await simulateConnect(realm2, info, await serverMarkupOf(info)),
					)
				expect(reversed.size).toBe(compiled.length)

				for (const [tag, html] of forward) {
					const other = reversed.get(tag)
					if (other === html) continue
					let at = 0
					while (at < html.length && html[at] === other?.[at]) at++
					throw new Error(
						`${tag} does not render as a function of its args: the corpus ` +
							`was rendered in two orders and ${tag}'s output differs ` +
							`(first difference at char ${at}). State is leaking between ` +
							'renders or the children-first replay is order-sensitive ' +
							'(ADR 0027 sub-design 10) — renders must stay isolated on ' +
							'the shared registry.',
					)
				}
			} finally {
				// Realm2 lives only for this test, so disposing here is the
				// end-of-its-renders posture, not a between-renders disposal.
				// It must dispose BEFORE the file-level realm (its restores
				// re-install realm's patches), and this test is the file's last.
				realm2.dispose()
			}
		} finally {
			order2.cleanup()
		}
	})
})
