/**
 * The catalog pipeline's build half (ADR 0030 sub-designs 4+5, LT-173).
 *
 * Source-locale strings live INLINE in each `.tsrx` (`export const i18n`),
 * collected by the compiler into the registry's `i18nMessages`. This module
 * is everything that spans the corpus rather than one component:
 *
 * - the generated `i18n` module (`writeI18nModule`) — the record type, the
 *   compiled-in source catalogs and per-locale overrides, and the
 *   `i18nRecord(tag, lang?)` constructor every render call boundary uses.
 *   Generated output, gitignored like the rest of `server/generated/components/`.
 * - staleness detection — a source-string edit is a `.tsrx` edit that
 *   silently invalidates that key's translations, so an override alone is
 *   not enough: `i18n/manifest.json` (committed, maintained by
 *   `i18n:sync`) records the source hash each locale's translation was
 *   made against. Override present + manifest hash ≠ current source hash
 *   ⇒ `stale`; no override ⇒ `missing`.
 * - the translation census (`translationCensus`, `compiler/census.ts`) and the
 *   gitignored machine-readable report (`writeI18nReport`). The census
 *   walks BOTH directions (LT-196): declared keys missing from a catalog
 *   (`missing`/`stale`) and catalog keys nothing declares (`orphaned` —
 *   a translator's typo, a renamed key, a deleted component).
 *
 * The build stays READ-ONLY over tracked files (ADR 0030 sub-design 5):
 * writing missing keys into `i18n/<locale>.json` is the separate,
 * person-run `i18n:sync` script (scripts/i18n-sync.ts), never this
 * pipeline.
 */

import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { TranslationGap } from '../compiler/census'
import { PLURAL_CATEGORIES } from '../compiler/i18n'
import type { RegistryEntry } from '../compiler/registry'
import { pluralCategories } from '../compiler/runtime'
import { DEFAULT_LOCALE, LOCALES } from '../config'
import { getFilePath, writeFileSafe } from '../io'

/** The repo-root directory holding the committed per-locale catalogs. */
export const I18N_DIR = join(import.meta.dir, '..', '..', 'i18n')

/**
 * The source locale — the language the inline strings are written in, and
 * the locale every catalog resolves against before an override lands
 * (ADR 0030 sub-design 5). The source locale has NO override file: its
 * strings live in the `.tsrx` sources themselves.
 */
export const SOURCE_LOCALE = 'en'

/**
 * The build's DEFAULT page locale (ADR 0030 sub-design 1) and the record's
 * formatting configuration.
 *
 * Since LT-174 the site builds one page tree per entry in config's `LOCALES`,
 * so the page locale is per-page input supplied by the caller — `i18nRecord`'s
 * `lang` argument. What survives as a constant is the FALLBACK: the locale a
 * record resolves at when no caller supplies one, which is the default locale
 * and the source locale both.
 *
 * Locale-as-build-constant is unchanged and still load-bearing — each page
 * fixes its locale before rendering, which is what keeps `Intl` foldable.
 *
 * `timeZone: 'UTC'` is the ADR's own prescription for date-only values
 * (`Date.UTC(y, m-1, d)` formatted with `timeZone: 'UTC'` never shifts the
 * day); `currency` has no platform mapping from a locale tag, so it stays
 * explicit.
 */
export const BUILD_I18N = {
	pageLocale: DEFAULT_LOCALE,
	timeZone: 'UTC',
	currency: 'USD',
} as const

/**
 * Primary language subtags written right-to-left — the input to the
 * record's `dir` field. There is no platform API for direction-from-locale
 * (unlike plural categories, ADR 0030 sub-design 6), so this is a
 * hand-maintained table of the standard RTL languages; a BCP 47 tag whose
 * PRIMARY subtag is not listed resolves `ltr`. Deliberately minimal: `dir`
 * is exposed for components whose LOGIC is direction-aware, and actual
 * page direction remains the page author's job (the record's `dir` is
 * never rendered per component).
 */
const RTL_LANGUAGES: ReadonlySet<string> = new Set([
	'ar',
	'dv',
	'fa',
	'he',
	'ku',
	'ps',
	'sd',
	'ug',
	'ur',
	'yi',
])

/** Short source-string hash — what the staleness manifest records. */
export const sourceHash = (source: string): string =>
	createHash('sha1').update(source).digest('hex').slice(0, 12)

/** One locale's committed catalog facts. */
export type Catalogs = {
	/** Every locale an override file exists for (never the source locale). */
	locales: string[]
	/** Per locale: the override map keyed by `<tag>.<key>`. */
	overrides: Map<string, Record<string, string>>
	/**
	 * The staleness manifest (`i18n/manifest.json`): per locale, per key,
	 * the source hash the translation was recorded against. Absent entries
	 * mean "recorded before the manifest existed" — stale until `i18n:sync`
	 * confirms them.
	 */
	manifest: Map<string, Record<string, string>>
}

const readJson = async (path: string): Promise<unknown> => {
	try {
		return JSON.parse(await readFile(path, 'utf8'))
	} catch {
		return undefined
	}
}

const asStringRecord = (value: unknown): Record<string, string> =>
	typeof value === 'object' && value !== null
		? Object.fromEntries(
				Object.entries(value as Record<string, unknown>)
					.filter(([, v]) => typeof v === 'string')
					.map(([k, v]) => [k, String(v)]),
			)
		: {}

const readCatalogs = async (): Promise<Catalogs> => {
	const overrides = new Map<string, Record<string, string>>()
	const locales: string[] = []
	try {
		for (const file of await readdir(I18N_DIR)) {
			if (!file.endsWith('.json') || file === 'manifest.json') continue
			const locale = file.replace(/\.json$/, '')
			locales.push(locale)
			overrides.set(
				locale,
				asStringRecord(await readJson(join(I18N_DIR, file))),
			)
		}
	} catch {
		// No i18n directory yet: zero locales, zero gaps.
	}
	const manifest = new Map<string, Record<string, string>>()
	const rawManifest = await readJson(join(I18N_DIR, 'manifest.json'))
	if (typeof rawManifest === 'object' && rawManifest !== null)
		for (const [locale, entries] of Object.entries(rawManifest))
			manifest.set(locale, asStringRecord(entries))
	return { locales, overrides, manifest }
}

/**
 * The corpus's i18n facts, collected from the compiled registry plus the
 * committed catalogs: every declared key's source strings, the per-locale
 * override maps (for the generated module), and every locale's gaps
 * (missing, stale, or orphaned) against them.
 */
export type I18nCollection = {
	locales: readonly string[]
	/** Per component tag: key → source-locale string (components with none omitted). */
	sources: Map<string, Record<string, string>>
	/** Per locale: override map keyed by `<tag>.<key>` (empty maps included). */
	overrides: ReadonlyMap<string, Record<string, string>>
	gaps: TranslationGap[]
}

/**
 * Walk BOTH directions between declarations and catalogs (ADR 0030
 * sub-design 5, LT-196). The declared-key walk below asks "does every
 * declared key have a translation?"; the orphan walk (LT-196) asks the
 * inverse — "does every catalog key have a declaration?" — because a
 * translator's typo, a renamed key, or a deleted component otherwise
 * leaves residue in the catalogs that nothing ever reports. `catalogs` is
 * injectable for tests; production reads the committed `i18n/` files.
 */
export const collectI18n = async (
	entries: readonly RegistryEntry[],
	catalogs?: Catalogs,
): Promise<I18nCollection> => {
	const { locales, overrides, manifest } = catalogs ?? (await readCatalogs())
	const sources = new Map<string, Record<string, string>>()
	// Every registry entry by tag — the orphan walk needs each component's
	// `caseType` for the reachability carve-out, including components that
	// declare no keys at all.
	const byTag = new Map<string, RegistryEntry>()
	const gaps: TranslationGap[] = []
	for (const entry of entries) {
		byTag.set(entry.tag, entry)
		if (!entry.i18nMessages) continue
		sources.set(entry.tag, entry.i18nMessages)
		for (const locale of locales) {
			const localeOverrides = overrides.get(locale) ?? {}
			const localeManifest = manifest.get(locale) ?? {}
			// LT-190: the locale's reachable category set for this component's
			// configured `truc:case-type` — the platform's own answer (never a
			// table), union of cardinal and ordinal when the compiler could not
			// prove the type. A `<key>.<category>` message whose category sits
			// outside this set lives in a pruned span that cannot render in
			// this locale, so its absence is the translator's nothing-to-do,
			// not a gap.
			const reachableCategories =
				entry.caseType === 'union'
					? pluralCategories(locale)
					: pluralCategories(locale, entry.caseType)
			for (const [key, source] of Object.entries(entry.i18nMessages)) {
				const compound = `${entry.tag}.${key}`
				const dot = key.lastIndexOf('.')
				const category = dot === -1 ? null : key.slice(dot + 1)
				if (
					category !== null &&
					PLURAL_CATEGORIES.has(category) &&
					!reachableCategories.has(category)
				)
					continue
				if (localeOverrides[compound] === undefined) {
					gaps.push({ key: compound, locale, status: 'missing' })
					continue
				}
				if (localeManifest[compound] !== sourceHash(source))
					gaps.push({ key: compound, locale, status: 'stale' })
			}
		}
	}
	// The orphan walk (LT-196): catalog keys nothing declares. DECLARATION
	// is checked BEFORE reachability (LT-217): the LT-190 carve-out exists
	// to protect a wholesale translation of a key the component DECLARES —
	// `task.one` in an `{other}`-only locale is a real translation of a
	// span this locale prunes. An UNDECLARED key (a translator's typo, a
	// renamed key, a deleted component) is sheltered by no category set:
	// nothing prunes a span that was never authored, so it reports in
	// every locale — de/lv/zh's missing `few` no longer hides rename
	// residue there.
	for (const locale of locales) {
		const localeOverrides = overrides.get(locale) ?? {}
		for (const compound of Object.keys(localeOverrides).sort()) {
			const dot = compound.indexOf('.')
			const tag = dot === -1 ? compound : compound.slice(0, dot)
			const key = dot === -1 ? '' : compound.slice(dot + 1)
			const entry = byTag.get(tag)
			if (entry === undefined || entry.i18nMessages?.[key] === undefined) {
				gaps.push({ key: compound, locale, status: 'orphaned' })
				continue
			}
			// Declared: the carve-out applies, and only a category-suffixed
			// key can ever be unreachable — anything else falls out with no
			// `pluralCategories` call at all.
			const keyDot = key.lastIndexOf('.')
			const category = keyDot === -1 ? null : key.slice(keyDot + 1)
			if (category === null || !PLURAL_CATEGORIES.has(category)) continue
			const reachableCategories =
				entry.caseType === 'union'
					? pluralCategories(locale)
					: pluralCategories(locale, entry.caseType)
			if (!reachableCategories.has(category)) continue
		}
	}
	return { locales, sources, overrides, gaps }
}

const byKey = (a: [string, unknown], b: [string, unknown]): number =>
	a[0] < b[0] ? -1 : 1

/** The generated `i18n` module every render boundary imports. */
const i18nModuleText = (collection: I18nCollection): string => {
	const sourcesEntries = [...collection.sources.entries()]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.map(
			([tag, messages]) =>
				`\t${JSON.stringify(tag)}: ${JSON.stringify(
					Object.fromEntries(Object.entries(messages).sort(byKey)),
					null,
					'\t\t',
				).replace(/\n/g, '\n\t')},`,
		)
		.join('\n')
	const overrideEntries = [...collection.overrides.entries()]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.map(
			([locale, entries]) =>
				`\t${JSON.stringify(locale)}: ${JSON.stringify(
					Object.fromEntries(Object.entries(entries).sort(byKey)),
					null,
					'\t\t',
				).replace(/\n/g, '\n\t')},`,
		)
		.join('\n')
	return `/**
 * Generated by the Le Truc i18n pipeline (ADR 0030, LT-173) — DO NOT EDIT.
 * Source catalogs fold in each component's \`export const i18n\`; overrides
 * fold in the committed \`i18n/<locale>.json\` files. The staleness
 * manifest lives in the committed \`i18n/manifest.json\` — regenerate this
 * module with the TSRX compile (\`bun run build:docs\`, \`bun run
 * scripts/build-corpus.ts\`, or \`bun test server\`'s corpus fixture).
 */

export interface I18n {
	lang: string
	t: Record<string, string>
	timeZone: string
	currency: string
	dir: 'ltr' | 'rtl'
}

/**
 * The locale a record resolves at when the caller supplies none — the
 * default locale of \`I18N_LOCALES\` (ADR 0030 sub-design 1).
 */
export const I18N_PAGE_LOCALE = ${JSON.stringify(BUILD_I18N.pageLocale)}

/** Every locale the site is built for; the first is the default (LT-174). */
export const I18N_LOCALES = ${JSON.stringify(LOCALES)} as const

/** The source locale: the language the inline \`.tsrx\` strings are written in. */
export const I18N_SOURCE_LOCALE = ${JSON.stringify(SOURCE_LOCALE)}

/** Formatting configuration folded into every record (see effects/i18n.ts). */
export const I18N_TIME_ZONE = ${JSON.stringify(BUILD_I18N.timeZone)}
export const I18N_CURRENCY = ${JSON.stringify(BUILD_I18N.currency)}

/** Primary subtags written right-to-left — the platform has no API for this. */
const RTL_LANGUAGES: ReadonlySet<string> = new Set(${JSON.stringify([...RTL_LANGUAGES])})

/** Inline source catalogs, per component tag: key → source-locale string. */
const SOURCES: Record<string, Record<string, string>> = {
${sourcesEntries}
}

/** Committed per-locale overrides, keyed by \`<tag>.<key>\` (i18n/<locale>.json). */
const OVERRIDES: Record<string, Record<string, string>> = {
${overrideEntries}
}

/**
 * The reserved \`i18n\` record for one component at one locale (ADR 0030
 * sub-design 2). A key resolves in exactly one place: the locale's
 * override when one is present and non-empty, else the inline source
 * string (sub-design 5's fallback — a missing key is a census record,
 * never a build error). An EMPTY override is \`i18n:sync\`'s
 * not-yet-translated placeholder, so it falls back to the source string
 * too; the catalog never reaches the client: \`t\` resolves here, at
 * build time.
 */
export function i18nRecord(tag: string, lang?: string): I18n {
	const locale = lang || I18N_PAGE_LOCALE
	const primary = locale.split(/[-_]/)[0]?.toLowerCase() ?? ''
	const t: Record<string, string> = {}
	const localeOverrides = OVERRIDES[locale] ?? {}
	for (const [key, source] of Object.entries(SOURCES[tag] ?? {})) {
		const override = localeOverrides[\`\${tag}.\${key}\`]
		t[key] = override || source
	}
	return {
		lang: locale,
		t,
		timeZone: I18N_TIME_ZONE,
		currency: I18N_CURRENCY,
		dir: RTL_LANGUAGES.has(primary) ? 'rtl' : 'ltr',
	}
}
`
}

/**
 * Write the generated `i18n` module into the same directory as the other
 * generated artifacts (generated server modules address it as `./i18n`).
 */
export const writeI18nModule = async (
	outDir: string,
	collection: I18nCollection,
): Promise<void> => {
	await writeFileSafe(
		getFilePath(outDir, 'i18n.ts'),
		i18nModuleText(collection),
	)
}

/** The gitignored machine-readable report (ADR 0030 sub-design 5). */
export const writeI18nReport = async (
	outDir: string,
	collection: I18nCollection,
): Promise<void> => {
	const perLocale: Record<
		string,
		{ missing: string[]; stale: string[]; orphaned: string[] }
	> = {}
	for (const locale of collection.locales)
		perLocale[locale] = { missing: [], stale: [], orphaned: [] }
	for (const gap of [...collection.gaps].sort((a, b) =>
		a.key < b.key ? -1 : a.key > b.key ? 1 : a.locale < b.locale ? -1 : 1,
	)) {
		const bucket = (perLocale[gap.locale] ??= {
			missing: [],
			stale: [],
			orphaned: [],
		})
		bucket[gap.status].push(gap.key)
	}
	const report = {
		sourceLocale: SOURCE_LOCALE,
		pageLocale: BUILD_I18N.pageLocale,
		locales: perLocale,
		counts: {
			missing: collection.gaps.filter(g => g.status === 'missing').length,
			stale: collection.gaps.filter(g => g.status === 'stale').length,
			orphaned: collection.gaps.filter(g => g.status === 'orphaned').length,
		},
	}
	await mkdir(outDir, { recursive: true })
	await writeFileSafe(
		getFilePath(outDir, 'i18n-report.json'),
		`${JSON.stringify(report, null, '\t')}\n`,
	)
}
