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
 *   a translator's typo, a renamed key, a deleted component). A catalog
 *   value that is not a string reports `malformed` in either direction
 *   (LT-249) — never silently dropped.
 *
 * The build stays READ-ONLY over tracked files (ADR 0030 sub-design 5):
 * writing missing keys into `i18n/<locale>.json` is the separate,
 * person-run `i18n:sync` script (scripts/i18n-sync.ts), never this
 * pipeline.
 */

import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	TRANSLATION_GAP_STATUSES,
	type TranslationGap,
	type TranslationGapStatus,
} from '../compiler/census'
import { DEFAULT_RUNTIME_IMPORT } from '../compiler/emit-paths'
import { PAGE_AMBIENT_TYPES } from '../compiler/fold-inputs'
import {
	carriedKinds,
	clientFallsBack,
	type Message,
} from '../compiler/icu/evaluate'
import { literalOf, parseMessage } from '../compiler/icu/parse'
import type { RegistryEntry } from '../compiler/registry'
import { DEFAULT_LOCALE, LOCALES } from '../config'
import { getFilePath, writeFileSafe } from '../io'

/**
 * This repo's own catalog directory — the DEFAULT, kept so every in-repo
 * caller behaves exactly as before. A consumer's is configured
 * (`i18nDir`, LT-255) and threaded in through `collectI18n` from their
 * configuration, which is what keeps a consumer's census from ever seeing
 * THIS repo's keys (the i18n lesson). Anchored portably (LT-267).
 */
export const I18N_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'i18n',
)

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
	/**
	 * Per locale: the override map keyed by `<tag>.<key>`, values as the
	 * catalog file carries them. A value that is not a string (a nested
	 * group, a number) is data the census reports `malformed` (LT-249);
	 * only the string entries reach {@link I18nCollection}.
	 */
	overrides: Map<string, Record<string, unknown>>
	/**
	 * The staleness manifest (`i18n/manifest.json`): per locale, per key,
	 * the source hash the translation was recorded against. Absent entries
	 * mean "recorded before the manifest existed" — stale until `i18n:sync`
	 * confirms them.
	 */
	manifest: Map<string, Record<string, string>>
	/**
	 * Per locale whose catalog file exists but cannot be used — it does not
	 * parse as JSON, or its top level is not an object (LT-356): why. Its
	 * `overrides` entry is empty. The census records the file once instead
	 * of reporting every declared key `missing`, and `i18n:sync` refuses to
	 * write the locale. Absent from injected test catalogs = none.
	 */
	unreadable?: Map<string, string>
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

/**
 * Read one catalog file: its entries, or why it cannot be used (LT-356).
 * A file that does not parse, or whose top level is not an object, is
 * UNREADABLE — never an empty catalog, which the census would misreport as
 * every key `missing` and `i18n:sync` would overwrite with placeholders.
 */
const readCatalog = async (
	path: string,
): Promise<{ catalog: Record<string, unknown> } | { error: string }> => {
	let value: unknown
	try {
		value = JSON.parse(await readFile(path, 'utf8'))
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) }
	}
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? { catalog: { ...(value as Record<string, unknown>) } }
		: { error: `its top level is ${valueKind(value)}, not an object` }
}

/**
 * The committed catalogs under `i18nDir` — the one reader the build and
 * `i18n:sync` share (LT-356), so neither can mistake an unreadable file
 * for an empty one.
 */
export const readCatalogs = async (i18nDir: string): Promise<Catalogs> => {
	const overrides = new Map<string, Record<string, unknown>>()
	const unreadable = new Map<string, string>()
	const locales: string[] = []
	try {
		// Sorted: readdir order is the runtime's, and the locale order flows
		// into the generated module, the census and the report — which must
		// not differ between runtimes (LT-267).
		for (const file of (await readdir(i18nDir)).sort()) {
			if (!file.endsWith('.json') || file === 'manifest.json') continue
			const locale = file.replace(/\.json$/, '')
			locales.push(locale)
			const read = await readCatalog(join(i18nDir, file))
			if ('error' in read) {
				overrides.set(locale, {})
				unreadable.set(locale, read.error)
			} else overrides.set(locale, read.catalog)
		}
	} catch {
		// No i18n directory yet: zero locales, zero gaps.
	}
	const manifest = new Map<string, Record<string, string>>()
	const rawManifest = await readJson(join(i18nDir, 'manifest.json'))
	if (typeof rawManifest === 'object' && rawManifest !== null)
		for (const [locale, entries] of Object.entries(rawManifest))
			manifest.set(locale, asStringRecord(entries))
	return { locales, overrides, manifest, unreadable }
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
 * injectable for tests; production reads the committed catalogs under
 * `i18nDir` — this repo's `i18n/` by default, a consumer's wherever their
 * config puts it (LT-255).
 */
export const collectI18n = async (
	entries: readonly RegistryEntry[],
	catalogs?: Catalogs,
	i18nDir: string = I18N_DIR,
): Promise<I18nCollection> => {
	const {
		locales,
		overrides: rawOverrides,
		manifest,
		unreadable = new Map<string, string>(),
	} = catalogs ?? (await readCatalogs(i18nDir))
	const sources = new Map<string, Record<string, string>>()
	// Split each catalog into its string entries and the rest (LT-249): a
	// non-string value — most naturally a group nested "under the
	// component" instead of the flat `<tag>.<key>` compound — is
	// `malformed` in its locale, declared or not, and never `missing` or
	// `orphaned`: `i18n:sync` fills the one and prunes the other, and must
	// do neither to an entry whose intended shape it cannot know.
	const overrides = new Map<string, Record<string, string>>()
	const malformed: TranslationGap[] = []
	for (const locale of locales) {
		// An unreadable catalog FILE (LT-356) is one `malformed` record on
		// the file, not one `missing` per declared key — those would blame
		// the translator's keys for a syntax error. Its locale renders the
		// source strings, exactly as an empty catalog would.
		const error = unreadable.get(locale)
		if (error !== undefined)
			malformed.push({
				key: `${locale}.json`,
				locale,
				status: 'malformed',
				detail: `the whole catalog file is unreadable, so no entry in this locale renders — ${error}`,
			})
		const strings: Record<string, string> = {}
		for (const [compound, value] of Object.entries(
			rawOverrides.get(locale) ?? {},
		)) {
			if (typeof value === 'string') strings[compound] = value
			else
				malformed.push({
					key: compound,
					locale,
					status: 'malformed',
					detail: `not a string — found ${valueKind(value)}; catalog keys are flat \`<tag>.<key>\` compounds`,
				})
		}
		overrides.set(locale, strings)
	}
	// Every registry entry by tag — the orphan walk resolves each catalog
	// key's component, including components that declare no keys at all.
	const byTag = new Map<string, RegistryEntry>()
	const gaps: TranslationGap[] = []
	for (const entry of entries) {
		byTag.set(entry.tag, entry)
		if (!entry.i18nMessages) continue
		sources.set(entry.tag, entry.i18nMessages)
		// The client channel's narrowed evaluator (LT-218) carries the node
		// kinds of the component's client-referenced SOURCE messages; the
		// construct-coverage walk asks the same question of each translation.
		const clientKeys = new Set(entry.clientMessageKeys ?? [])
		const carried = carriedKinds(
			[...clientKeys].flatMap(key => {
				const entryOf = compiledEntry(entry.i18nMessages?.[key] ?? '')
				return entryOf === null || typeof entryOf === 'string' ? [] : [entryOf]
			}),
		)
		for (const locale of locales) {
			if (unreadable.has(locale)) continue // one file record, above
			const localeOverrides = overrides.get(locale) ?? {}
			const localeManifest = manifest.get(locale) ?? {}
			for (const [key, source] of Object.entries(entry.i18nMessages)) {
				const compound = `${entry.tag}.${key}`
				if (
					Object.hasOwn(rawOverrides.get(locale) ?? {}, compound) &&
					localeOverrides[compound] === undefined
				)
					continue // non-string: reported malformed above
				if (localeOverrides[compound] === undefined) {
					gaps.push({ key: compound, locale, status: 'missing' })
					continue
				}
				if (localeManifest[compound] !== sourceHash(source))
					gaps.push({ key: compound, locale, status: 'stale' })
				gaps.push(
					...patternGaps(
						compound,
						locale,
						source,
						localeOverrides[compound],
						clientKeys.has(key) ? carried : null,
					),
				)
			}
		}
	}
	// The orphan walk (LT-196): catalog keys nothing declares — a
	// translator's typo, a renamed key, a deleted component. Every locale
	// carries the same key set (one ICU pattern per key, LT-251), so an
	// undeclared key is an orphan in every locale, unconditionally.
	for (const locale of locales) {
		const localeOverrides = overrides.get(locale) ?? {}
		for (const compound of Object.keys(localeOverrides).sort()) {
			const dot = compound.indexOf('.')
			const tag = dot === -1 ? compound : compound.slice(0, dot)
			const key = dot === -1 ? '' : compound.slice(dot + 1)
			if (byTag.get(tag)?.i18nMessages?.[key] === undefined)
				gaps.push({ key: compound, locale, status: 'orphaned' })
		}
	}
	gaps.push(...malformed)
	return { locales, sources, overrides, gaps }
}

/** How a malformed catalog value reads in its census detail (LT-249). */
const valueKind = (value: unknown): string =>
	value === null
		? 'null'
		: Array.isArray(value)
			? 'an array'
			: typeof value === 'object'
				? 'a nested group'
				: `a ${typeof value}`

/** What {@link syncLocale} did to one locale's catalog. */
export type LocaleSync = {
	/** The next catalog, key-sorted. */
	catalog: Record<string, unknown>
	/** The next staleness-manifest entries for the locale, key-sorted. */
	manifest: Record<string, string>
	/** Missing keys written as empty placeholders. */
	written: number
	/** Carried keys confirmed against their current source hash. */
	confirmed: number
	/** Stale keys — listed for review, confirmed like every carried key. */
	stale: string[]
	/** Orphaned keys — pruned from the catalog and the manifest. */
	pruned: string[]
	/** Findings listed and left alone: pattern integrity and `malformed`. */
	flagged: TranslationGap[]
}

/**
 * The `i18n:sync` pass over one locale's catalog (scripts/i18n-sync.ts),
 * pure so the census-to-sync routing is testable. `gaps` are the locale's
 * census records. A `missing` key lands as an empty placeholder; an
 * `orphaned` key is pruned with its manifest entry; everything else
 * `collectI18n` reports about an entry itself — `malformed` included,
 * whether unparseable (LT-219) or not a string at all (LT-249) — is
 * flagged and left alone: only a translator knows what it should have
 * been, so sync must not guess a shape. Every carried STRING entry with a
 * declared source is confirmed against the current source hash.
 */
export const syncLocale = (
	catalog: Record<string, unknown>,
	gaps: readonly TranslationGap[],
	sources: ReadonlyMap<string, Record<string, string>>,
	manifest: Record<string, string>,
): LocaleSync => {
	const next = { ...catalog }
	const nextManifest = { ...manifest }
	const result: Omit<LocaleSync, 'catalog' | 'manifest'> = {
		written: 0,
		confirmed: 0,
		stale: [],
		pruned: [],
		flagged: [],
	}
	for (const gap of gaps) {
		if (gap.status === 'missing') {
			next[gap.key] = next[gap.key] ?? ''
			result.written++
		} else if (gap.status === 'stale') {
			// Listed for review; the manifest entry is refreshed below like
			// every carried key — the translator decides whether the wording
			// needs rework, and the census stops counting it either way.
			result.stale.push(gap.key)
		} else if (gap.status === 'orphaned') {
			// The entry can never render — no component declares it — so
			// keeping it would be residue the census counts forever.
			delete next[gap.key]
			delete nextManifest[gap.key]
			result.pruned.push(gap.key)
		} else result.flagged.push(gap)
	}
	for (const [compound, value] of Object.entries(next)) {
		// A non-string entry is not a translation of anything yet (LT-249).
		if (typeof value !== 'string') continue
		const dot = compound.indexOf('.')
		const source =
			dot === -1
				? undefined
				: sources.get(compound.slice(0, dot))?.[compound.slice(dot + 1)]
		if (source === undefined) continue
		nextManifest[compound] = sourceHash(source)
		result.confirmed++
	}
	const sorted = <T>(record: Record<string, T>): Record<string, T> =>
		Object.fromEntries(
			Object.entries(record).sort(([a], [b]) => (a < b ? -1 : 1)),
		)
	return { catalog: sorted(next), manifest: sorted(nextManifest), ...result }
}

/**
 * The pattern-integrity walks over one translation (ADR 0030 s5, LT-219) —
 * report records, never build errors: a catalog is translator-paced data,
 * and every finding here still renders something (the source, or `other`).
 * An empty entry is `i18n:sync`'s placeholder, not a translation. `carried`
 * is the client evaluator's node kinds when the key is client-referenced,
 * else null.
 */
const patternGaps = (
	key: string,
	locale: string,
	source: string,
	translation: string,
	carried: ReadonlySet<string> | null,
): TranslationGap[] => {
	if (translation === '') return []
	const parsed = parseMessage(translation)
	if (!parsed.ok)
		return [{ key, locale, status: 'malformed', detail: parsed.error }]
	const gaps: TranslationGap[] = []
	const sourceParsed = parseMessage(source)
	if (sourceParsed.ok) {
		const expected = sourceParsed.args.map(arg => arg.name).sort()
		const actual = parsed.args.map(arg => arg.name).sort()
		if (expected.join() !== actual.join())
			gaps.push({
				key,
				locale,
				status: 'argument-mismatch',
				detail: `expected ${argNames(expected)}, found ${argNames(actual)}`,
			})
	}
	const uncovered = new Set<string>()
	const walk = (message: Message): void => {
		for (const node of message) {
			if (typeof node === 'string') continue
			if (node.t === 'plural') {
				for (const category of new Intl.PluralRules(locale, {
					type: node.o ? 'ordinal' : 'cardinal',
				}).resolvedOptions().pluralCategories)
					if (!Object.hasOwn(node.c, category)) uncovered.add(category)
			}
			if (node.t === 'plural' || node.t === 'select')
				for (const body of Object.values(node.c)) walk(body)
		}
	}
	walk(parsed.message)
	if (uncovered.size > 0)
		gaps.push({
			key,
			locale,
			status: 'missing-arms',
			detail: `no ${[...uncovered].sort().join(', ')}`,
		})
	if (carried !== null && sourceParsed.ok) {
		const sourceEntry = literalOf(sourceParsed.message) ?? sourceParsed.message
		const translationEntry = literalOf(parsed.message) ?? parsed.message
		if (clientFallsBack(sourceEntry, translationEntry, carried))
			gaps.push({ key, locale, status: 'client-fallback' })
	}
	return gaps
}

const argNames = (names: readonly string[]): string =>
	names.length === 0 ? 'none' : names.map(name => `{${name}}`).join(', ')

const byKey = (a: [string, unknown], b: [string, unknown]): number =>
	a[0] < b[0] ? -1 : 1

/**
 * One catalog value as the generated module carries it (LT-250, ADR 0030
 * s4): an argument-less pattern as its literal text — MF1 escapes resolved,
 * so `t.<key>` is the same string it always was — and a pattern with
 * arguments as its parsed AST, which `i18nRecord` wraps in a function over
 * the shared evaluator. Null for a pattern that does not parse: a source
 * pattern like that is already LTC055; a translation like that falls back
 * to the source (ADR 0030 s5 — a translator's typo must not make a locale
 * unbuildable; the census reports it, LT-219).
 */
const compiledEntry = (pattern: string): string | Message | null => {
	const parsed = parseMessage(pattern)
	if (!parsed.ok) return null
	return literalOf(parsed.message) ?? parsed.message
}

/** `messages` compiled per {@link compiledEntry}, key-sorted, unparseable dropped. */
const compiledCatalog = (
	messages: Record<string, string>,
): Record<string, string | Message> => {
	const out: Record<string, string | Message> = {}
	for (const [key, pattern] of Object.entries(messages).sort(byKey)) {
		// An EMPTY override is `i18n:sync`'s not-yet-translated placeholder:
		// dropped here, so the key falls back to its source pattern.
		if (pattern === '') continue
		const entry = compiledEntry(pattern)
		// A source pattern that does not parse keeps its raw text (LTC055 has
		// already failed the build); a translation falls back instead.
		if (entry !== null) out[key] = entry
	}
	return out
}

/** The generated `i18n` module every render boundary imports. */
const i18nModuleText = (
	collection: I18nCollection,
	runtimeImport: string,
): string => {
	const sources = [...collection.sources.entries()]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.map(([tag, messages]) => {
			const compiled = compiledCatalog(messages)
			for (const [key, pattern] of Object.entries(messages))
				if (!(key in compiled)) compiled[key] = pattern
			return [
				tag,
				Object.fromEntries(Object.entries(compiled).sort(byKey)),
			] as const
		})
	const overrides = [...collection.overrides.entries()]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.map(([locale, entries]) => [locale, compiledCatalog(entries)] as const)
	const withArguments = [...sources, ...overrides].some(([, catalog]) =>
		Object.values(catalog).some(entry => typeof entry !== 'string'),
	)
	const entriesText = (
		rows: ReadonlyArray<readonly [string, Record<string, string | Message>]>,
	): string =>
		rows
			.map(
				([name, catalog]) =>
					`\t${JSON.stringify(name)}: ${JSON.stringify(
						catalog,
						null,
						'\t\t',
					).replace(/\n/g, '\n\t')},`,
			)
			.join('\n')
	const sourcesEntries = entriesText(sources)
	const overrideEntries = entriesText(overrides)
	return `/**
 * Generated by the Le Truc i18n pipeline (ADR 0030, LT-173) — DO NOT EDIT.
 * Source catalogs fold in each component's \`export const i18n\`; overrides
 * fold in the committed \`i18n/<locale>.json\` files. The staleness
 * manifest lives in the committed \`i18n/manifest.json\` — regenerate this
 * module with the TSRX compile (\`bun run build:docs\`, \`bun run
 * scripts/build-corpus.ts\`, or \`bun test server\`'s corpus fixture).
 */
${
	withArguments
		? `
import { CLIENT_MESSAGE, formatMessage, type Message } from '${runtimeImport}'
`
		: `
/** A parsed ICU pattern (LT-250) — none in this corpus takes arguments. */
type Message = never
`
}
/**
 * The reserved record, generic over its \`t\` shape (LT-308): each generated
 * server module instantiates it with the component's exact per-key record.
 */
export interface I18n<T = Record<string, string>> {
${Object.entries(PAGE_AMBIENT_TYPES)
	.map(([member, type]) => `\t${member}: ${type}`)
	.join('\n')}
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

/**
 * Inline source catalogs, per component tag: key → the message. An
 * argument-less ICU pattern is its literal text; one with arguments is its
 * parsed AST (LT-250).
 */
const SOURCES: Record<string, Record<string, string | Message>> = {
${sourcesEntries}
}

/**
 * Committed per-locale overrides, keyed by \`<tag>.<key>\` (i18n/<locale>.json),
 * compiled like SOURCES. Placeholders and unparseable patterns are absent,
 * so those keys fall back to the source.
 */
const OVERRIDES: Record<string, Record<string, string | Message>> = {
${overrideEntries}
}

/**
 * The reserved \`i18n\` record for one component at one locale (ADR 0030
 * sub-design 2). A key resolves in exactly one place: the locale's
 * override when one is present, else the inline source message
 * (sub-design 5's fallback — a missing key is a census record, never a
 * build error). An argument-less message is a string; one with arguments
 * is a function of its argument record, evaluated by the shared ICU
 * evaluator (sub-design 4). The catalog never reaches the client: \`t\`
 * resolves here, at build time.
 */
export function i18nRecord<T = Record<string, string>>(
	tag: string,
	lang?: string,
): I18n<T> {
	const locale = lang || I18N_PAGE_LOCALE
	const primary = locale.split(/[-_]/)[0]?.toLowerCase() ?? ''
	const t: Record<string, string | ((args: Record<string, unknown>) => string)> = {}
	const localeOverrides = OVERRIDES[locale] ?? {}
	for (const [key, source] of Object.entries(SOURCES[tag] ?? {})) {
		const message = localeOverrides[\`\${tag}.\${key}\`] ?? source${
			withArguments
				? `
		if (typeof message === 'string') {
			t[key] = message
			continue
		}
		const env = { lang: locale, timeZone: I18N_TIME_ZONE, currency: I18N_CURRENCY }
		// The AST rides the closure for the client channel (LT-218): a
		// client-referenced key serializes it into the root \`i18n\` attribute.
		t[key] = Object.assign(
			(args: Record<string, unknown>) => formatMessage(message, args, env),
			{ [CLIENT_MESSAGE]: { message, env } },
		)`
				: `
		t[key] = message`
		}
	}
	return {
		lang: locale,
		// The catalog is keyed by tag at runtime; the caller's render
		// signature states the tag's exact per-key record (LT-308).
		t: t as unknown as T,
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
 * `runtimeImport` is the generated server modules' own harness specifier
 * (LT-255): a catalog with argument messages imports the shared evaluator
 * from there.
 */
export const writeI18nModule = async (
	outDir: string,
	collection: I18nCollection,
	runtimeImport: string = DEFAULT_RUNTIME_IMPORT,
): Promise<void> => {
	await writeFileSafe(
		getFilePath(outDir, 'i18n.ts'),
		i18nModuleText(collection, runtimeImport),
	)
}

/** The gitignored machine-readable report (ADR 0030 sub-design 5). */
export const writeI18nReport = async (
	outDir: string,
	collection: I18nCollection,
): Promise<void> => {
	const emptyBuckets = () =>
		Object.fromEntries(
			TRANSLATION_GAP_STATUSES.map(status => [status, [] as string[]]),
		) as Record<TranslationGapStatus, string[]>
	const perLocale: Record<string, Record<TranslationGapStatus, string[]>> = {}
	for (const locale of collection.locales) perLocale[locale] = emptyBuckets()
	for (const gap of [...collection.gaps].sort((a, b) =>
		a.key < b.key ? -1 : a.key > b.key ? 1 : a.locale < b.locale ? -1 : 1,
	)) {
		const bucket = (perLocale[gap.locale] ??= emptyBuckets())
		bucket[gap.status].push(gap.key)
	}
	const report = {
		sourceLocale: SOURCE_LOCALE,
		pageLocale: BUILD_I18N.pageLocale,
		locales: perLocale,
		counts: Object.fromEntries(
			TRANSLATION_GAP_STATUSES.map(status => [
				status,
				collection.gaps.filter(g => g.status === status).length,
			]),
		),
	}
	await mkdir(outDir, { recursive: true })
	await writeFileSafe(
		getFilePath(outDir, 'i18n-report.json'),
		`${JSON.stringify(report, null, '\t')}\n`,
	)
}
