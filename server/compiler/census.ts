/**
 * The census channel (ADR 0029 sub-design 6, LT-165 step 6; moved out of
 * `sim/report.ts` by LT-263, ADR 0035 sub-design 3 limb 1).
 *
 * A census record is a second kind of record — never a diagnostic and never
 * a warning. A named {@link Census} records, per subject, what the build
 * routed or assigned and why. It is expected to grow, and its regression
 * story is its own: a component drifting Folded → Simulated is a build-cost
 * regression, visible in the census, not a warning — so the compile-warning
 * baseline's target stays zero (M23).
 *
 * ## Why this is not in `sim/`
 *
 * It never was simulation. `tierCensus` reads the registry, `translationCensus`
 * reads catalog gaps, and its three importers — `server/effects/i18n.ts`,
 * `server/effects/compile.ts` and `scripts/check-corpus.ts` — simulate nothing.
 * Sharing a module with the realm's diagnostic classification was history,
 * and it was also what made the census unavailable to a build with no
 * substrate installed (ADR 0034 sub-design 5). The census must print with
 * every component classified whether or not jsdom exists; it lives
 * compiler-side so that is true by construction.
 */

import type { EvaluationTier, RoutingSignal } from './tier.ts'

/* === Types === */

/**
 * Which census a record collection is. `'translation'` (LT-173 step 4)
 * rides this same surface — that is the point of the generic shape.
 */
export type CensusKind = 'tier' | 'translation'

/**
 * One record in a census: what a subject was routed or assigned, and why.
 * Factual by design (ADR 0028) — a census record is a build-cost and
 * provenance fact, never an author-facing problem, so its wording names the
 * subject, the value, and the reasons and stops there.
 */
export type CensusEntry = {
	/** What the record is about — the component tag in both planned censuses. */
	subject: string
	/** The value the census records for the subject (the tier name, here). */
	value: string
	/**
	 * Why the subject carries `value`. Empty only where the census says empty
	 * IS the fact — a Folded-tier component has no routing signal, and that
	 * is correct, not a missing reason.
	 */
	reasons: readonly string[]
}

/** A named census riding the build-report channel. */
export type Census = {
	kind: CensusKind
	/** The human label the formatted section opens with. */
	name: string
	/**
	 * The full domain of values the census counts over, so the summary line
	 * reports zero-count values too ("0 static" is the current corpus's
	 * correct classification, not a gap — ADR 0029 Consequences).
	 */
	values: readonly string[]
	entries: readonly CensusEntry[]
}

/**
 * The registry face the tier census reads: one component's final tier and
 * the reasons behind it. Structural, so a parsed `registry.json` entry
 * satisfies it without importing the registry module.
 */
export type TierCensusSubject = {
	tag: string
	tier: EvaluationTier
	routingSignals: readonly RoutingSignal[]
}

/**
 * One gap between a component's inline catalog and a locale's override
 * file (ADR 0030 sub-design 5, LT-173 step 4).
 */
export type TranslationGap = {
	/** The component-namespaced catalog key (`basic-pluralize.remaining`). */
	key: string
	/** The locale the key is missing, stale, or orphaned in. */
	locale: string
	/**
	 * `missing` — no entry in the locale's catalog (the source-locale
	 * string renders); `stale` — an entry exists but the source string
	 * moved after the translation was recorded, so it may no longer match;
	 * `orphaned` — an entry exists in the locale's catalog but nothing in
	 * the corpus declares it (LT-196), so it can never render.
	 */
	status: 'missing' | 'stale' | 'orphaned'
}

/* === Exported Functions === */

/**
 * Build the tier census (ADR 0029 sub-design 6) from the corpus registry's
 * POST-contamination entries — the `tier`/`routingSignals` the compose-read
 * fixpoint in `compileCorpus` leaves on each entry (so `form-combobox`
 * records Simulated with its `compose-read` reason, not the pre-contamination
 * Folded tier its emit used). Sorted by tag so the output is stable whatever
 * order the corpus glob scanned in.
 */
export const tierCensus = (subjects: readonly TierCensusSubject[]): Census => ({
	kind: 'tier',
	name: 'Tier census',
	values: ['folded', 'simulated', 'static'],
	entries: [...subjects]
		.sort((a, b) => (a.tag < b.tag ? -1 : 1))
		.map(subject => ({
			subject: subject.tag,
			value: subject.tier,
			reasons: subject.routingSignals.map(signal =>
				signal.line === undefined
					? `${signal.origin}: ${signal.detail}`
					: `${signal.origin}: ${signal.detail} (line ${signal.line})`,
			),
		})),
})

/**
 * Build the translation census (ADR 0030 sub-design 5, LT-173 step 4) from
 * the corpus's catalog gaps. Deliberately NOT a compile warning: a missing
 * translation is the translator's work, not the component author's, so it
 * rides the census channel rather than re-starting the non-zero warning
 * baseline ADR 0029 sub-design 6 removed. `locales` is the full domain of
 * translated locales the catalogs cover, so the summary reports zero-gap
 * locales too; entries are one per gap, sorted by key then locale so the
 * output is stable whatever order the corpus compiled in.
 */
export const translationCensus = (
	gaps: readonly TranslationGap[],
	locales: readonly string[],
): Census => ({
	kind: 'translation',
	name: 'Translation census',
	values: [...locales].sort((a, b) => (a < b ? -1 : 1)),
	entries: gaps
		.map(gap => ({
			subject: gap.key,
			value: gap.locale,
			reasons:
				gap.status === 'missing'
					? [
							'missing — no entry in this locale’s catalog; the source-locale string renders',
						]
					: gap.status === 'stale'
						? [
								'stale — the source string moved after this translation was recorded',
							]
						: [
								'orphaned — nothing in the corpus declares this key; the entry can never render',
							],
		}))
		.sort((a, b) =>
			a.subject < b.subject
				? -1
				: a.subject > b.subject
					? 1
					: a.value < b.value
						? -1
						: 1,
		),
})

/**
 * Format one census as its own build-report section: a counted summary line,
 * then the entries whose records carry reasons. A reason-less entry is
 * counted but not listed — its line would say nothing the count does not.
 * Plain `console.log` material: never a ⚠️ line, never part of any warning
 * or error count.
 */
export const formatCensus = (census: Census): string => {
	const counts = new Map<string, number>()
	for (const value of census.values) counts.set(value, 0)
	for (const entry of census.entries)
		counts.set(entry.value, (counts.get(entry.value) ?? 0) + 1)
	const summary = [...counts.entries()]
		// Most common first (ties alphabetical): the summary leads with the
		// tier that answers "what does the build mostly pay?".
		.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
		.map(([value, n]) => `${n} ${value}`)
		.join(', ')
	const lines = [
		`${census.name} — ${census.entries.length} entries: ${summary}`,
	]
	for (const entry of census.entries) {
		if (entry.reasons.length === 0) continue
		lines.push(`  ${entry.subject}: ${entry.value}`)
		for (const reason of entry.reasons) lines.push(`    - ${reason}`)
	}
	return lines.join('\n')
}
