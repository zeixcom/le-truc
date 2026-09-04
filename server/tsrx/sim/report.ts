/**
 * The build-report channel (ADR 0027 Consequences, LT-153 decision 1,
 * LT-163).
 *
 * Simulation trades a compiler that refuses and names the mistake for a
 * driver that ships a wrong answer quietly; fixture-pinning is necessary
 * but is not a channel. This module is the channel: it turns the realm's
 * `diagnostics` (LT-154) into **build warnings attributed to a component**.
 *
 * **Tier 2, Contained** (ADR 0028 sub-design 1): the build completes and the
 * affected component keeps its server-rendered markup. Nothing here prevents
 * a build and nothing escalates — but nothing is silenced either.
 *
 * **Channel is compiler/build.** None of the five conditions (a `jsdomError`
 * from the `virtualConsole`, an unhandled rejection inside the realm, a
 * contained per-component throw during connect, an attempted network call, a
 * `non-quiescent` drain overrun) is statically decidable — that is precisely
 * why they moved off the compiler — so no `TSRX` rule is owed for them.
 *
 * ## The baseline
 *
 * The corpus must report **zero unclassified** diagnostics. A diagnostic the
 * build cannot affect is **classified**, never silenced: it stays listed with
 * the reason it cannot affect the serialized markup (`CLASSIFIED_DIAGNOSTICS`),
 * and a new — unclassified — entry fails the gate. Together with the compile
 * baseline (`check:tsrx`), this is one of the two wave-4 regression numbers:
 * a migration that renders wrong shows up here as a new entry.
 */

import type { SimDiagnostic, SimDiagnosticKind } from './realm.ts'

/* === Types === */

/**
 * A standing diagnostic the build has classified as unable to affect the
 * serialized markup — recorded, not silenced: every occurrence stays listed
 * with its `reason` in the report.
 */
export type ClassifiedDiagnostic = {
	kind: SimDiagnosticKind
	/** Restrict the classification to one component; undefined matches any. */
	component?: string
	/**
	 * The message must match this pattern. The specificity is the point: a
	 * classification admits exactly the diagnostic it was written for, so a
	 * message change re-opens the question instead of slipping through.
	 */
	message: RegExp
	/** Why this diagnostic cannot affect the serialized markup. */
	reason: string
}

/** One build report: the corpus's diagnostics, partitioned. */
export type SimReport = {
	/** Standing entries — listed with their reason, never a failure. */
	classified: Array<{
		diagnostic: SimDiagnostic
		classification: ClassifiedDiagnostic
	}>
	/** New entries — each one fails the gate until fixed or classified. */
	unclassified: SimDiagnostic[]
}

/* === Classified Diagnostics === */

/**
 * Every diagnostic below is known, explained, and expected on the corpus.
 * Adding an entry is a design decision, not a convenience: name the exact
 * condition and why it cannot affect the serialized markup. If an entry stops
 * matching anything — the component was fixed — retire it; a classification
 * that admits nothing is kept only as a record, and the baseline test says so.
 */
export const CLASSIFIED_DIAGNOSTICS: readonly ClassifiedDiagnostic[] = [
	{
		kind: 'jsdom-error',
		component: 'form-colorgraph',
		message: /Not implemented: HTMLCanvasElement's getContext/,
		reason:
			'jsdom does not implement canvas. form-colorgraph guards the missing ' +
			'context (`if (!ctx) return`). Canvas pixels do not serialize, so the ' +
			'notice cannot affect the serialized markup.',
	},
]

/* === Internal Functions === */

/** The component a warning names, or the honest stand-in when none is known. */
const attribution = (diagnostic: SimDiagnostic): string =>
	diagnostic.component ?? 'unattributed'

/** Where the diagnostic happened, phrased for the attribution at hand. */
const location = (diagnostic: SimDiagnostic): string =>
	diagnostic.component === undefined
		? 'a simulated connect outside any render window'
		: 'its simulated connect'

/* === Exported Functions === */

/**
 * Match a diagnostic against one classification: same kind, same component
 * (unless the classification is component-blind), and a message the pattern
 * admits.
 */
export const classifyDiagnostic = (
	diagnostic: SimDiagnostic,
	classification: ClassifiedDiagnostic,
): boolean =>
	diagnostic.kind === classification.kind &&
	(classification.component === undefined ||
		diagnostic.component === classification.component) &&
	classification.message.test(diagnostic.message)

/**
 * Find the classification that admits a diagnostic, if any. First match
 * wins; keep the registry small enough that order does not matter.
 */
export const classificationFor = (
	diagnostic: SimDiagnostic,
): ClassifiedDiagnostic | undefined =>
	CLASSIFIED_DIAGNOSTICS.find(classification =>
		classifyDiagnostic(diagnostic, classification),
	)

/**
 * Format one diagnostic as the build-warning line the report prints.
 *
 * The copy follows the error-message lifecycle criteria (ADR 0028): the
 * condition in the component author's vocabulary, the component named, and
 * the decision to make — fix the condition, or classify the entry with a
 * reason when it genuinely cannot affect the serialized markup. Tier 2
 * wording throughout: a contained component KEEPS its server-rendered
 * markup; nothing here says the page broke.
 */
export const formatSimDiagnostic = (diagnostic: SimDiagnostic): string => {
	const who = attribution(diagnostic)
	const where = location(diagnostic)
	const detail = diagnostic.message
	switch (diagnostic.kind) {
		case 'jsdom-error':
			return (
				`${who}: jsdom reported an error during ${where}: ${detail} — fix ` +
				'the call if it can affect the serialized markup. Otherwise ' +
				'classify it in `CLASSIFIED_DIAGNOSTICS` with a reason.'
			)
		case 'console': {
			const source =
				diagnostic.level === undefined
					? 'the realm console'
					: `console.${diagnostic.level}`
			return (
				`${who}: ${source} logged during ${where}: ${detail} — fix the ` +
				'reported problem, or remove the call. If it cannot affect the ' +
				'serialized markup, classify it in `CLASSIFIED_DIAGNOSTICS` with a reason.'
			)
		}
		case 'network':
			// The stub's message is final copy (LT-151): condition, closed
			// realm, and the resolution-phase fix. Attribution is all this adds.
			return `${who}: ${detail}`
		case 'unhandled-rejection':
			return (
				`${who}: an unhandled rejection occurred during ${where} (${detail}) — ` +
				'the build cannot know whether it affected the serialized markup. ' +
				'Handle the rejection in the component, or declare the work as a ' +
				'resolution-phase dependency.'
			)
		case 'component-throw':
			return (
				`${who}: threw during ${where}: ${detail} — the component keeps its ` +
				'server-rendered markup. Fix the throw so the component can enhance ' +
				'it at connect.'
			)
		case 'non-quiescent':
			// The realm's message is final copy: condition, mechanism, outcome,
			// and the fix. Attribution is all this adds.
			return `${who}: ${detail}`
	}
}

/**
 * Partition a realm's diagnostics into the report the baseline gate reads:
 * classified standing entries (listed, with their reason) and unclassified
 * new entries (each one a failure).
 */
export const reportDiagnostics = (
	diagnostics: readonly SimDiagnostic[],
): SimReport => {
	const classified: SimReport['classified'] = []
	const unclassified: SimDiagnostic[] = []
	for (const diagnostic of diagnostics) {
		const classification = classificationFor(diagnostic)
		if (classification) classified.push({ diagnostic, classification })
		else unclassified.push(diagnostic)
	}
	return { classified, unclassified }
}

/**
 * Format the full report. Unclassified entries print as the warnings they
 * are; classified entries print with the reason they are standing, so the
 * report explains itself instead of hiding what it admits.
 */
export const formatSimReport = (report: SimReport): string => {
	const lines = report.unclassified.map(formatSimDiagnostic)
	for (const { diagnostic, classification } of report.classified)
		lines.push(
			`${formatSimDiagnostic(diagnostic)}\n    classified (standing): ${classification.reason}`,
		)
	return lines.join('\n')
}
