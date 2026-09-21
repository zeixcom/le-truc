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
 */

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { type DefaultTreeAdapterMap, parseFragment } from 'parse5'
import {
	formatSimReport,
	reportDiagnostics,
	type SimReport,
} from '../compiler/build-report'
import type { ComponentRegistry, RegistryEntry } from '../compiler/registry'
import type {
	ClassifiedDiagnostic,
	SimulationProvider,
	SimulationRealm,
	SimulationRealmOptions,
} from '../compiler/simulation/contract'
import { resolveSimulationProvider } from '../compiler/simulation/resolve'
import type { EvaluationTier } from '../compiler/tier'
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
 * Throws on an unclassified build-report entry (the gate) and on any attempt
 * to simulate a component of another tier (the invariant).
 */
export const simulateCorpus = async ({
	registry,
	generatedDir = GENERATED_DIR,
	root = REPO_CONFIG.root,
	createRealm,
	classifications,
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
			occurrences,
			locales: LOCALES,
			realmOpened: false,
			ms: performance.now() - started,
			report,
		}
	}

	// Activation is installation (ADR 0035 sub-design 4): the driver is
	// resolved, never configured. The test seam short-circuits it.
	const provider =
		createRealm === undefined ? await resolveSimulationProvider() : null
	if (createRealm === undefined && provider === null)
		throw new Error(
			`No simulation driver is installed, but ${subjects.length} component(s) ` +
				`route to the Simulated tier (${subjects
					.map(subject => `<${subject.tag}>`)
					.join(', ')}). Install the optional jsdom dependency to render ` +
				'them through the realm. Routing them to the Static tier instead — ' +
				'an `unavailable substrate` census row rather than a failed build ' +
				'(ADR 0034 sub-design 5) — is not implemented yet.',
		)
	const openRealm =
		createRealm ??
		((options: SimulationRealmOptions) =>
			(provider as SimulationProvider).createSimulationRealm(options))
	const standingEntries = classifications ?? provider?.classifications ?? []
	const realm = openRealm({
		composesTags: tag => entries[tag]?.composesTags ?? [],
		suppressedSites: tag => entries[tag]?.suppressedSites ?? [],
	})
	try {
		// Resolution phase. A composed child whose parent's client module
		// already imports it is recorded as a side effect of the parent's
		// load, so its own load() would record nothing NEW and trip the
		// load-once assertion (ADR 0027 sub-design 10).
		for (const subject of subjects) {
			if (realm.loadedTags.includes(subject.tag)) continue
			await realm.load(
				() => import(pathToFileURL(subject.clientModulePath).href),
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
		if (report.classified.length > 0) log(formatSimReport(report))
		gateOnSimReport(report)
		return {
			simulated,
			skipped,
			withoutMarkup,
			occurrences,
			locales: LOCALES,
			realmOpened: true,
			ms,
			report,
		}
	} finally {
		// End of build, not between renders: every render the build will ever
		// do has happened by here, including the ones an exception cut short.
		realm.dispose()
	}
}
