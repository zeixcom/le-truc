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

import { lineOf } from './diagnostics.ts'
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
	/**
	 * The component-namespaced catalog key (`module-todo.remaining`) —
	 * or, for a `malformed` catalog FILE that does not parse as a JSON
	 * object, the file name (`de.json`, LT-356).
	 */
	key: string
	/** The locale the key is missing, stale, or orphaned in. */
	locale: string
	/**
	 * `missing` — no entry in the locale's catalog (the source-locale
	 * string renders); `stale` — an entry exists but the source string
	 * moved after the translation was recorded, so it may no longer match;
	 * `orphaned` — an entry exists in the locale's catalog but nothing in
	 * the corpus declares it (LT-196), so it can never render.
	 *
	 * The pattern-integrity walks (ADR 0030 s5, LT-219) read the entry
	 * itself: `malformed` — it is not a string (LT-249) or does not parse
	 * as an ICU pattern, so the source renders; `argument-mismatch` — its arguments differ from the
	 * source pattern's; `missing-arms` — a `plural` in it does not cover the
	 * locale's plural categories, so those counts render `other`;
	 * `client-fallback` — a client-referenced key uses a construct its
	 * source does not, so the browser renders the source (LT-350).
	 */
	status: TranslationGapStatus
	/** What the pattern-integrity walks found (the arguments, the categories). */
	detail?: string
}

/** Every {@link TranslationGap} status, in report order. */
export const TRANSLATION_GAP_STATUSES = [
	'missing',
	'stale',
	'orphaned',
	'malformed',
	'argument-mismatch',
	'missing-arms',
	'client-fallback',
] as const

export type TranslationGapStatus = (typeof TRANSLATION_GAP_STATUSES)[number]

/** Census reasons per status — a record, not a fix-it (copy per `writer` → error-messages, reviewed 2026-10-01). */
const TRANSLATION_GAP_REASONS: Record<TranslationGapStatus, string> = {
	missing:
		'missing — no entry in this locale’s catalog; the source-locale string renders',
	stale:
		'stale — the source string changed after this translation was recorded',
	orphaned:
		'orphaned — nothing in the corpus declares this key, so the entry never renders',
	malformed:
		'malformed — the entry is not a valid ICU pattern and never renders; a declared key falls back to its source-locale string',
	'argument-mismatch':
		'argument mismatch — the translation’s arguments differ from the source pattern’s',
	'missing-arms':
		'missing plural arms — a plural does not cover this locale’s categories; those counts render `other`',
	'client-fallback':
		'client fallback — the translation uses a construct its source does not, so the browser renders the source-locale string',
}

/** The line a signal's location starts on, unless it spans its whole file. */
const signalLine = (
	signal: RoutingSignal,
	sourceOf: (file: string) => string | undefined,
): number | undefined => {
	const location = signal.location
	if (!location) return undefined
	const source = sourceOf(location.file)
	if (
		source === undefined ||
		(location.start === 0 && location.end === source.length)
	)
		return undefined
	return lineOf(source, location.start)
}

/* === Exported Functions === */

/**
 * Build the tier census (ADR 0029 sub-design 6) from the corpus registry's
 * POST-contamination entries — the `tier`/`routingSignals` the compose-read
 * fixpoint in `compileCorpus` leaves on each entry (so `form-combobox`
 * records Simulated with its `compose-read` reason, not the pre-contamination
 * Folded tier its emit used). Sorted by tag so the output is stable whatever
 * order the corpus glob scanned in.
 *
 * A signal's location prints as the line it starts on (ADR 0044 s4: the
 * census is a terminal view). `sourceOf` reads the authored file a location
 * names; without it, or for a whole-file location, the reason carries no
 * line.
 */
export const tierCensus = (
	subjects: readonly TierCensusSubject[],
	sourceOf: (file: string) => string | undefined = () => undefined,
): Census => ({
	kind: 'tier',
	name: 'Tier census',
	values: ['folded', 'simulated', 'static'],
	entries: [...subjects]
		.sort((a, b) => (a.tag < b.tag ? -1 : 1))
		.map(subject => ({
			subject: subject.tag,
			value: subject.tier,
			reasons: subject.routingSignals.map(signal => {
				const line = signalLine(signal, sourceOf)
				return line === undefined
					? `${signal.origin}: ${signal.detail}`
					: `${signal.origin}: ${signal.detail} (line ${line})`
			}),
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
			reasons: [
				gap.detail
					? `${TRANSLATION_GAP_REASONS[gap.status]} (${gap.detail})`
					: TRANSLATION_GAP_REASONS[gap.status],
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
