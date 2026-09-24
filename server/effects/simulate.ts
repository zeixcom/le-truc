/**
 * The simulation pass of the docs build (ADR 0027 stage 2, LT-169).
 *
 * Runs the server-simulation driver (`server/compiler/sim/`) over the compiled
 * corpus in `server/generated/components/` and gates the build on what it reports.
 * This is the first build stage that EXECUTES a generated client module — up
 * to LT-165 the driver existed only under test.
 *
 * ## Only the Simulated tier
 *
 * ADR 0029 exists to stop the build simulating components that do not need
 * it: a Folded-tier component's initial HTML comes from `emit-server.ts` and
 * the value harness with no jsdom in the picture, and a Static-tier
 * component's markup is the skeleton by decision — no realm can improve
 * either, so opening one for them is pure cost. That waste has no
 * correctness symptom, so it cannot be caught by an output assertion; it is
 * enforced structurally instead, by {@link assertSimulatedTier} on the one
 * path that reaches `render()`.
 *
 * The tier read here is the registry's — the POST-contamination one written
 * by `compileCorpus` after `contaminateComposeReads` runs. The
 * classifier's own per-file verdict (`server/compiler/frontend/tsrx/index.ts`) is taken before
 * the corpus compose fixpoint, so a component that is Simulated purely
 * because it READS a simulated composed child (`form-combobox` today) still
 * carries a Folded verdict there. Gating on that verdict would silently skip
 * exactly the component that needs the realm most.
 *
 * ## What it loads
 *
 * More than it renders: every subject's client module plus the transitive
 * `composesTags` closure over the registry, whatever the children's tier
 * (LT-188). Children-first replay can only order definitions the realm has
 * recorded, and a server-spliced child its parent never imports would
 * otherwise stay undefined. Loading a Folded-tier child's module DEFINES its
 * tag; it never renders it, so the tier invariant below is unaffected.
 *
 * ## What it renders
 *
 * One render per OCCURRENCE, not per component: the markup is the
 * component's own authored demo HTML (`examples/**\/<tag>.html` — what the
 * docs actually serve), split into the top-level occurrences of the
 * component's tag.
 *
 * ## One pass per locale
 *
 * Per-locale page rendering (ADR 0030 sub-design 1, LT-174) means each
 * occurrence is rendered once per locale, with the locale seeded onto
 * `<html lang>` before the markup parses. The pass loops locales for real
 * rather than assuming today's corpus is locale-blind: no Simulated-tier
 * component declares `i18n` right now, but that is a property of the corpus,
 * not of the pass, and it will stop holding the moment an i18n component
 * routes to the Simulated tier.
 *
 * ## Disposal
 *
 * One realm per build process, disposed once in a `finally` after every
 * render the build will ever do — never between renders. A disposed realm's
 * deleted globals turn a contained component's lingering dependency-wait
 * into a synchronous `customElements is not defined` flood that aborts the
 * process (LT-152 review). This is also why `build.ts` runs the pass only
 * for a one-shot build and not on watch rebuilds: one module cache per
 * process means a second load of the same generated client records no
 * definitions, which `realm.load()` asserts against (ADR 0027 sub-design
 * 10).
 *
 * ## The gate
 *
 * `reportDiagnostics` partitions the realm's diagnostics into the classified
 * standing entries (listed with their reason, never a failure) and
 * unclassified ones. **Zero unclassified is the build's own gate**, the same
 * baseline `sim-driver.test.ts` holds — a new entry fails the build and
 * names the component. The channel is the build report, not the compile
 * warnings: nothing the realm reports is statically decidable.
 *
 * ## The absent substrate
 *
 * jsdom is an optional peer dependency (ADR 0034 s5), so a consumer build
 * may have no substrate at all — and that configuration must stay green
 * ([M28](REQUIREMENTS.md#m28-distribution-and-dependency-weight)). The pass
 * then routes the Simulated-tier components Static, appends an
 * `unavailable-substrate` routing signal to each (the census prints it),
 * and rewrites the registry so the tier census reports the outcome; the
 * resolver's narrowed catch (`isSubstrateAbsence`) is what keeps a broken
 * substrate from masquerading as this benign configuration.
 */

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { type DefaultTreeAdapterMap, parseFragment } from 'parse5'
import {
	formatSimReport,
	reportDiagnostics,
	type SimReport,
} from '../compiler/build-report'
import {
	formatCensus,
	type TierCensusSubject,
	tierCensus,
} from '../compiler/census'
import {
	type ComponentRegistry,
	type RegistryEntry,
	registryJson,
} from '../compiler/registry'
import type {
	ClassifiedDiagnostic,
	SimulationProvider,
	SimulationRealm,
	SimulationRealmOptions,
} from '../compiler/simulation/contract'
import { resolveSimulationProvider } from '../compiler/simulation/resolve'
import type { EvaluationTier, RoutingSignal } from '../compiler/tier'
import { LOCALES } from '../config'
import { GENERATED_DIR, REPO_CONFIG } from '../corpus-compile'
import { io } from '../runtimes'

/* === Types === */

/** One Simulated-tier component, as the pass addresses it. */
export type SimulationSubject = {
	tag: string
	/** Generated client module path on disk, absolute. */
	clientModulePath: string
	/** Authored demo markup path on disk, absolute. */
	markupPath: string
}

export type SimulationPassResult = {
	/** Tags actually rendered through the realm, in render order. */
	simulated: string[]
	/** Tags the pass declined to simulate, with the tier that decided it. */
	skipped: Array<{ tag: string; tier: EvaluationTier }>
	/** Simulated-tier tags with no authored demo markup to render. */
	withoutMarkup: string[]
	/**
	 * Tags routed Static because no substrate is installed (ADR 0034 s5) —
	 * the census records why on each one's registry entry.
	 */
	rerouted: string[]
	/** `render()` calls — one per occurrence PER LOCALE. */
	occurrences: number
	/** Locales the pass rendered each occurrence for (LT-174). */
	locales: readonly string[]
	/** False when the corpus has no Simulated-tier component at all. */
	realmOpened: boolean
	/** Wall time of the whole pass, milliseconds. */
	ms: number
	report: SimReport
}

export type SimulationPassOptions = {
	/** Defaults to the registry the pipeline just wrote. */
	registry?: ComponentRegistry
	/** Defaults to `server/generated/components/`. */
	generatedDir?: string
	/**
	 * The PROJECT ROOT the registry's `source` paths are relative to.
	 * Defaults to the configured corpus root — NOT this module's location:
	 * a module-anchored root was the same latent bug the i18n census hit
	 * (LT-255), silently resolved against the wrong project the first time
	 * the pass ran outside this repo.
	 */
	root?: string
	/**
	 * Seam for tests: defaults to the driver the resolver finds
	 * (`../compiler/simulation/resolve.ts`). A test that supplies this also
	 * supplies {@link SimulationPassOptions.classifications}, since the two
	 * travel together on a real provider.
	 */
	createRealm?: (options: SimulationRealmOptions) => SimulationRealm
	/** Standing entries for the substrate in use; defaults to the driver's. */
	classifications?: readonly ClassifiedDiagnostic[]
	/**
	 * Seam for tests: defaults to the real resolver. Answering `null` is the
	 * substrate-absent configuration (ADR 0034 s5), which routes the
	 * Simulated-tier components Static instead of failing the build.
	 */
	resolveProvider?: () => Promise<SimulationProvider | null>
	/**
	 * Seam for tests: defaults to rewriting `generatedDir/registry.json` with
	 * the re-routed entries, so the tier census — which reads the registry —
	 * reports the routing outcome. Called only when a reroute happened; a
	 * build with the substrate present never touches the written registry.
	 */
	writeRegistry?: (registry: ComponentRegistry) => Promise<void>
	/** Seam for tests: defaults to reading `subject.markupPath`. */
	readMarkup?: (subject: SimulationSubject) => Promise<string | null>
	log?: (message: string) => void
}

/* === Internal Functions === */

/**
 * The structural half of "Simulated tier only" (ADR 0029): the invariant is
 * asserted on the path to `render()` rather than trusted to the caller's
 * filter, because opening a realm for a Folded- or Static-tier component
 * produces correct output — the waste is invisible to every output
 * assertion, and only a check at the render site can fail on it.
 */
export const assertSimulatedTier = (tag: string, tier: EvaluationTier) => {
	if (tier === 'simulated') return
	throw new Error(
		`Refusing to open a simulation realm for <${tag}>: it routes to the ` +
			`${tier} tier, which no realm can improve (ADR 0029). A ${tier}-tier ` +
			'component renders through emit-server.ts and the value harness; ' +
			'simulating it is build cost with no output difference. Gate on the ' +
			"registry's post-contamination tier before reaching the driver.",
	)
}

/**
 * Fail the build on any unclassified build-report entry, naming the
 * components (LT-163's baseline, now the build's own gate).
 */
export const gateOnSimReport = (report: SimReport) => {
	if (report.unclassified.length === 0) return
	const components = [
		...new Set(
			report.unclassified.map(entry => entry.component ?? '(unknown)'),
		),
	]
	throw new Error(
		`Simulation build report — ${report.unclassified.length} unclassified ` +
			`entr${report.unclassified.length === 1 ? 'y' : 'ies'} on ` +
			`${components.map(tag => `<${tag}>`).join(', ')}. Fix the component, ` +
			'or classify the entry with a reason in ' +
			'server/compiler/sim/classifications.ts:\n' +
			formatSimReport(report),
	)
}

/** Registry entries that need the realm, in registry order. */
const simulationSubjects = (
	registry: ComponentRegistry,
	generatedDir: string,
	root: string,
): {
	subjects: SimulationSubject[]
	skipped: SimulationPassResult['skipped']
} => {
	const subjects: SimulationSubject[] = []
	const skipped: SimulationPassResult['skipped'] = []
	for (const entry of Object.values(registry) as RegistryEntry[]) {
		if (entry.tier !== 'simulated') {
			skipped.push({ tag: entry.tag, tier: entry.tier })
			continue
		}
		subjects.push({
			tag: entry.tag,
			clientModulePath: join(generatedDir, entry.clientModule),
			markupPath: join(root, entry.source.replace(/\.tsrx$/, '.html')),
		})
	}
	return { subjects, skipped }
}

/**
 * The client modules the realm must LOAD: every subject plus the transitive
 * `composesTags` closure over the registry, children-first and de-duplicated
 * (LT-188).
 *
 * Children-first replay (LT-154) can only order definitions the realm has
 * RECORDED, and a composed child that its parent's client module never
 * imports (pure server-splice composition, no `pass()`/`first()` binding) is
 * never pulled in by the import graph. Without the closure a Simulated-tier
 * parent composing a Folded- or Static-tier child renders that child
 * un-upgraded — silently wrong markup that looks like ordinary SSR output.
 *
 * The closure widens the LOAD set only. Defining a tag is not simulating a
 * component: the RENDER set stays the Simulated-tier subjects, so
 * {@link assertSimulatedTier} and the ADR 0029 saving are untouched. A
 * composed tag with no registry entry (not a compiled component) has no
 * client module to load and is left to the page.
 */
const loadClosure = (
	subjects: readonly SimulationSubject[],
	registry: ComponentRegistry,
	generatedDir: string,
): Array<{ tag: string; clientModulePath: string }> => {
	const visited = new Set<string>()
	const ordered: Array<{ tag: string; clientModulePath: string }> = []
	const visit = (tag: string): void => {
		if (visited.has(tag)) return
		visited.add(tag)
		const entry = registry[tag]
		if (!entry) return
		for (const child of entry.composesTags) visit(child)
		ordered.push({
			tag,
			clientModulePath: join(generatedDir, entry.clientModule),
		})
	}
	for (const subject of subjects) visit(subject.tag)
	return ordered
}

/**
 * Split authored demo markup into the top-level occurrences of `tag`.
 *
 * parse5, not the realm's document (LT-263). This is build-side work — it
 * happens before any substrate is involved and the result is a string the
 * seam takes as input — so routing it through `realm.document` was the last
 * place a `Document` crossed the boundary (ADR 0035 sub-design 3 limb 3).
 * parse5 is already the build's HTML reader (`page-render.ts`), and slicing
 * by source location hands the driver the author's own bytes rather than a
 * re-serialization of them.
 *
 * A nested occurrence of the same tag belongs to its outer one's markup and
 * is not rendered on its own.
 */
const occurrencesOf = (tag: string, html: string): string[] => {
	const found: string[] = []
	const walk = (node: DefaultTreeAdapterMap['node']): void => {
		const children = 'childNodes' in node ? node.childNodes : []
		for (const child of children) {
			const element = child as DefaultTreeAdapterMap['element']
			if (element.nodeName === tag) {
				// Top-level only: descend no further, so a nested occurrence
				// stays part of its outer one's markup.
				const at = element.sourceCodeLocation
				if (at) found.push(html.slice(at.startOffset, at.endOffset))
				continue
			}
			walk(child)
		}
	}
	walk(parseFragment(html, { sourceCodeLocationInfo: true }))
	return found
}

/* === Exported Functions === */

/**
 * Run the driver over every Simulated-tier component of the compiled corpus.
 *
 * Routes the Simulated-tier components Static when no substrate is
 * installed (ADR 0034 s5) — a census outcome, never a failed build. Throws
 * on an unclassified build-report entry (the gate) and on any attempt to
 * simulate a component of another tier (the invariant).
 */
export const simulateCorpus = async ({
	registry,
	generatedDir = GENERATED_DIR,
	root = REPO_CONFIG.root,
	createRealm,
	classifications,
	resolveProvider = resolveSimulationProvider,
	writeRegistry = async reroutedEntries =>
		io.writeTextFile(
			join(generatedDir, 'registry.json'),
			registryJson(Object.values(reroutedEntries) as RegistryEntry[]),
		),
	readMarkup = async subject => {
		if (!(await io.fileExists(subject.markupPath))) return null
		return await io.readTextFile(subject.markupPath)
	},
	log = message => console.log(message),
}: SimulationPassOptions = {}): Promise<SimulationPassResult> => {
	const started = performance.now()
	const entries: ComponentRegistry =
		registry ??
		(JSON.parse(
			await io.readTextFile(join(generatedDir, 'registry.json')),
		) as ComponentRegistry)
	const { subjects, skipped } = simulationSubjects(entries, generatedDir, root)

	const simulated: string[] = []
	const withoutMarkup: string[] = []
	let occurrences = 0

	// No Simulated-tier component means no realm at all — the ADR 0029 saving
	// in its degenerate form.
	if (subjects.length === 0) {
		log(
			`🎭 Simulation pass: no Simulated-tier component (${skipped.length} skipped) — no realm opened`,
		)
		const report = reportDiagnostics([], [])
		return {
			simulated,
			skipped,
			withoutMarkup,
			rerouted: [],
			occurrences,
			locales: LOCALES,
			realmOpened: false,
			ms: performance.now() - started,
			report,
		}
	}

	// Activation is installation (ADR 0035 sub-design 4): the driver is
	// resolved, never configured. The test seam short-circuits it.
	const provider = createRealm === undefined ? await resolveProvider() : null
	if (createRealm === undefined && provider === null) {
		// ADR 0034 s5 (ADR 0029 s6, amended 2026-09-19): absence is a routing
		// outcome, never a failure. The classifier's Simulated verdict stands
		// in the signals — it is a fact about the code — but the mechanism
		// that would serve it is not installed, so the tier is set to Static
		// DIRECTLY rather than through classifyTier (whose realm-answerable
		// signals would re-yield simulated) and the substrate signal records
		// why. Served bytes are unaffected either way: a Simulated-tier
		// occurrence rides pages authored exactly as a Static one does
		// (page-render.ts qualifies Folded-tier components only).
		const rerouted: string[] = []
		const reroutedSubjects: TierCensusSubject[] = []
		for (const subject of subjects) {
			const routedEntry = entries[subject.tag]
			if (!routedEntry) continue
			const signal: RoutingSignal = {
				origin: 'unavailable-substrate',
				detail:
					'the jsdom substrate is not installed; no realm can run, so the component serves its phase-1 skeleton',
				resolution: { by: 'substrate-unavailable' },
			}
			routedEntry.tier = 'static'
			routedEntry.routingSignals = [...routedEntry.routingSignals, signal]
			rerouted.push(subject.tag)
			reroutedSubjects.push({
				tag: routedEntry.tag,
				tier: routedEntry.tier,
				routingSignals: routedEntry.routingSignals,
			})
		}
		await writeRegistry(entries)
		log(
			`🎭 Simulation pass: the jsdom substrate is not installed — ` +
				`${rerouted.length} Simulated-tier component(s) routed Static ` +
				'(ADR 0034 s5); the build is green, their initial markup is the skeleton',
		)
		log(formatCensus(tierCensus(reroutedSubjects)))
		return {
			simulated,
			skipped,
			withoutMarkup,
			rerouted,
			occurrences,
			locales: LOCALES,
			realmOpened: false,
			ms: performance.now() - started,
			report: reportDiagnostics([], []),
		}
	}
	const openRealm =
		createRealm ??
		((options: SimulationRealmOptions) =>
			(provider as SimulationProvider).createSimulationRealm(options))
	const standingEntries = classifications ?? provider?.classifications ?? []
	const realm = openRealm({
		composesTags: tag => entries[tag]?.composesTags ?? [],
		suppressedSites: tag => entries[tag]?.suppressedSites ?? [],
	})
	// Set once the normal path has printed the report, so the catch below
	// prints captured diagnostics only when an earlier throw would lose them.
	let reported = false
	try {
		// Resolution phase, over the composed-children closure (LT-188). A
		// module already recorded — a child its parent's client module
		// imports, or one an earlier load pulled in — is skipped: its own
		// load() would record nothing NEW and trip the load-once assertion
		// (ADR 0027 sub-design 10).
		for (const module of loadClosure(subjects, entries, generatedDir)) {
			if (realm.loadedTags.includes(module.tag)) continue
			await realm.load(
				() => import(pathToFileURL(module.clientModulePath).href),
			)
		}
		for (const subject of subjects) {
			assertSimulatedTier(subject.tag, entries[subject.tag]?.tier ?? 'folded')
			const markup = await readMarkup(subject)
			if (markup === null) {
				withoutMarkup.push(subject.tag)
				continue
			}
			const occurrenceMarkup = occurrencesOf(subject.tag, markup)
			// Locale is the OUTER dimension of the render matrix: one full pass
			// per locale, matching how the pages effect emits one page tree per
			// locale (LT-174).
			for (const locale of LOCALES) {
				for (const occurrence of occurrenceMarkup) {
					await realm.render({
						markup: occurrence,
						component: subject.tag,
						locale,
					})
					occurrences++
				}
			}
			simulated.push(subject.tag)
		}
		const report = reportDiagnostics(realm.diagnostics, standingEntries)
		const ms = performance.now() - started
		log(
			`🎭 Simulation pass: ${simulated.length} Simulated-tier component(s), ` +
				`${occurrences} occurrence(s) across ${LOCALES.length} locale(s) ` +
				`in ${ms.toFixed(0)}ms — ` +
				`${skipped.length} component(s) skipped (no realm opened for them)`,
		)
		if (withoutMarkup.length > 0)
			console.warn(
				`⚠️ No authored demo markup for ${withoutMarkup
					.map(tag => `<${tag}>`)
					.join(', ')} — not simulated`,
			)
		reported = true
		if (report.classified.length > 0) log(formatSimReport(report))
		gateOnSimReport(report)
		return {
			simulated,
			skipped,
			withoutMarkup,
			rerouted: [],
			occurrences,
			locales: LOCALES,
			realmOpened: true,
			ms,
			report,
		}
	} catch (error) {
		// A throw before the report (a load() assertion, an importer error)
		// would otherwise take the captured host-console lines down with the
		// realm — and they are often the only account of why it threw.
		if (!reported && realm.diagnostics.length > 0)
			log(
				'🎭 Simulation pass aborted — diagnostics captured before the throw:\n' +
					formatSimReport(
						reportDiagnostics(realm.diagnostics, standingEntries),
					),
			)
		throw error
	} finally {
		// End of build, not between renders: every render the build will ever
		// do has happened by here, including the ones an exception cut short.
		realm.dispose()
	}
}
