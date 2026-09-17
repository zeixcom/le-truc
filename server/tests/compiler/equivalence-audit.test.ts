/**
 * The CI equivalence audit (ADR 0029 sub-design 7, amended 2026-09-06 —
 * LT-165 step 8).
 *
 * Tiering reinstates the hazard ADR 0027 eliminated: TWO mechanisms produce
 * a Folded-tier component's server answer — the value harness
 * (`render<Name>(args)`, phase 1) and the simulation realm (phase 2, the
 * same connect the browser runs). ADR 0029 s7's original rule required the
 * two outputs to be byte-identical. **The audit found that rule structurally
 * void, and it was amended (see ADR 0029 s7, amendment 2026-09-06):** in a
 * Folded-tier component EVERY signal seeds from a DOM harvest (a signal with
 * no harvestable site is a TSRX004 routing signal and routes Simulated), so
 * the realm's entire state derives from the phase-1 bytes themselves — the
 * two mechanisms cannot independently disagree on a server value. What the
 * byte comparison actually measures is the hydration boundary: serializer
 * normalization (bare boolean attributes, attribute case), the client's
 * designed connect-time writes (ADR 0003's enhancement posture), and — the
 * dangerous class — any write that OVERWRITES or removes server-rendered
 * state (the form-tokenbox input removal surfaced exactly this on first
 * run; see LT-185).
 *
 * The amended rule, implemented here: **phase 2 runs over every
 * Folded-tier component's phase-1 render, and the connect diff between the
 * two is PINNED per component.** A diff that grows, shrinks, or moves is a
 * snapshot regression and a review trigger — a new enhancement write, a
 * serializer change, or a hydration bug all show up here, named against
 * their component. Scope is the FINAL (post-contamination) tier read from
 * the registry the corpus compile writes — the same source the step-6 census
 * reads — so the audit automatically covers whatever is Folded;
 * `tier-corpus.test.ts`'s hardcoded full-map assertion remains the drift pin
 * for what Folded means, and this file deliberately does not duplicate that
 * list.
 *
 * Inputs are identical on both sides (the audit's validity condition): the
 * same fixture args (`corpus-args.ts`, shared with sim-driver) drive phase
 * 1, the exact markup phase 1 produced is what phase 2 parses, and no
 * locale is set on either side.
 *
 * CI cost is bounded by corpus size, not by the tier split (ADR 0029 s7):
 * one corpus compile, one shared realm, one render per Folded component.
 * The audit is CI-only machinery — nothing here rides the docs build or
 * `check:tsrx`.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { pathToFileURL } from 'node:url'
import type { ComponentRegistry } from '../../compiler/registry'
import { createSimulationRealm } from '../../compiler/sim/realm'
import { compileTsrxCorpus } from '../../effects/tsrx'
import { createGeneratedDir } from '../helpers/generated-tsrx'
import { CORPUS_ARGS, renderName } from './corpus-args'
import { loadTsrxCorpus } from './corpus-fixture'

const generated = createGeneratedDir('equivalence-audit')
afterAll(() => generated.cleanup())

const compiled = await compileTsrxCorpus(await loadTsrxCorpus(), generated.path)
const registry = JSON.parse(
	await Bun.file(`${generated.path}/registry.json`).text(),
) as ComponentRegistry

const realm = createSimulationRealm({
	composesTags: tag => registry[tag]?.composesTags ?? [],
	suppressedSites: tag => registry[tag]?.suppressedSites ?? [],
})
afterAll(() => realm.dispose())

// Load every client module exactly once (children arrive as import side
// effects of their parents — same skip-if-defined loop as sim-driver).
for (const info of compiled) {
	if (realm.definitions.some(entry => entry.name === info.tag)) continue
	await realm.load(() => import(pathToFileURL(info.clientModulePath).href))
}

/** One compiled corpus entry, as `compileTsrxCorpus` reported it. */
type CompiledInfo = (typeof compiled)[number]

const foldedEntries = Object.values(registry).filter(
	entry => entry.tier === 'folded',
)

/**
 * The connect diff between a component's phase-1 render and its phase-2
 * (post-connect) serialization, as a bounded record of difference regions:
 * scan forward to each first difference, then resync on the first common
 * stretch of at least `RESYNC` characters and repeat. This is a REVIEW
 * RECORD, not a semantic diff — its shape is what the snapshot pins, and a
 * change in its shape means something about the component's hydration
 * changed (ADR 0029 s7, amended).
 */
const WINDOW = 60
const RESYNC = 32
const connectDiff = (phase1: string, phase2: string): string => {
	const regions: string[] = []
	let a = 0
	let b = 0
	for (;;) {
		while (a < phase1.length && b < phase2.length && phase1[a] === phase2[b]) {
			a++
			b++
		}
		if (a >= phase1.length && b >= phase2.length) break
		// Resync: the smallest advance where both tails rejoin for RESYNC
		// characters. Falls off the end when one side is exhausted.
		let endA = phase1.length
		let endB = phase2.length
		scan: for (let i = a; i <= phase1.length; i++)
			for (let j = b; j <= phase2.length; j++) {
				const n = Math.min(RESYNC, phase1.length - i, phase2.length - j)
				if (
					n === RESYNC &&
					phase1.slice(i, i + RESYNC) === phase2.slice(j, j + RESYNC)
				) {
					endA = i
					endB = j
					break scan
				}
			}
		regions.push(
			`@${a} (-${endA - a}/+${endB - b})  P1: …${phase1.slice(Math.max(0, a - WINDOW), Math.min(phase1.length, endA + WINDOW))}…\n` +
				`          P2: …${phase2.slice(Math.max(0, b - WINDOW), Math.min(phase2.length, endB + WINDOW))}…`,
		)
		a = endA
		b = endB
	}
	return regions.join('\n')
}

describe('CI equivalence audit (ADR 0029 s7, amended 2026-09-06 — LT-165 step 8)', () => {
	test('the audit covers every Folded-tier entry the registry carries — none silently skipped', () => {
		// The vacuous-coverage trap: a Folded registry entry with no matching
		// compiled info (or vice versa) must fail loudly here, or the audit
		// below would quietly shrink while staying green.
		expect(foldedEntries.length).toBeGreaterThan(0)
		for (const entry of foldedEntries)
			expect(
				compiled.some(info => info.tag === entry.tag),
				`${entry.tag} is Folded in the registry but absent from the compiled corpus`,
			).toBe(true)
	})

	for (const entry of foldedEntries) {
		test(`${entry.tag}: the connect diff against the harness render is the recorded hydration boundary`, async () => {
			const info = compiled.find((i): i is CompiledInfo => i.tag === entry.tag)!
			// Phase 1 — the value harness over the shared fixture args.
			const mod = (await import(
				pathToFileURL(info.serverModulePath).href
			)) as Record<string, unknown>
			const renderFn = mod[renderName(entry.tag)] as (args: unknown) => string
			const phase1 = renderFn(CORPUS_ARGS[entry.tag] ?? {})
			// Phase 2 — the realm parses that exact markup and replays the
			// connect. No locale on either side: identical inputs are the
			// audit's validity condition.
			const phase2 = await realm.render({
				markup: phase1,
				component: entry.tag,
			})
			// The amended rule: the diff is the record. A snapshot regression
			// here means the component's hydration boundary moved — a new
			// client write, a serializer change, or a hydration bug — and is a
			// review trigger, not an automatic failure of the mechanism.
			expect(connectDiff(phase1, phase2)).toMatchSnapshot()
		})
	}

	// The audit's first run surfaced exactly one instance of the dangerous
	// class — a client write that REMOVES server-rendered state — and the
	// snapshot above records it only as a shape. This pins the fact itself,
	// so a regression fails on an assertion that names the symptom rather
	// than on a diff a reviewer has to interpret (LT-185).
	test('form-tokenbox: the authored text input survives hydration (LT-185 regression)', async () => {
		const info = compiled.find(i => i.tag === 'form-tokenbox')!
		const mod = (await import(
			pathToFileURL(info.serverModulePath).href
		)) as Record<string, unknown>
		const renderFn = mod[renderName('form-tokenbox')] as (
			args: unknown,
		) => string
		const phase1 = renderFn(CORPUS_ARGS['form-tokenbox'] ?? {})
		expect(phase1).toContain('id="tags-input"')
		const phase2 = await realm.render({
			markup: phase1,
			component: 'form-tokenbox',
		})
		// The input is the only place a user can type. `reconcile()` owns
		// `data-container`'s children and removes every unkeyed one (ADR 0017's
		// self-cleaning container), so the authored input must carry the
		// `data-unreconciled` opt-out to survive the first reconcile pass.
		expect(phase2).toContain('id="tags-input"')
		// Inside the reconcile container specifically — surviving anywhere in
		// the document would not mean it survived the pass that removed it.
		// The container holds only spans, so the first `</div>` closes it.
		const fromContainer = phase2.slice(phase2.indexOf('<div data-container'))
		const containerInner = fromContainer.slice(
			0,
			fromContainer.indexOf('</div>'),
		)
		expect(containerInner).toContain('id="tags-input"')
	})
})
