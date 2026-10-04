#!/usr/bin/env bun

/**
 * `i18n:sync` (ADR 0030 sub-design 5, LT-173 step 3b).
 *
 * The one writer for the committed catalogs — the build itself stays
 * read-only over tracked files. For every locale that has an
 * `<i18nDir>/<locale>.json` catalog:
 *
 * 1. every declared key the catalog is MISSING lands as an empty entry
 *    (`""`) — the translator's placeholder; the source-locale string
 *    renders until it is filled,
 * 2. every key the catalog CARRIES gets its staleness-manifest entry set
 *    to the CURRENT source string's hash (`<i18nDir>/manifest.json`) — the
 *    person running this confirms the translation matches the source it
 *    will ship against. Stale keys are listed, not silently confirmed:
 *    review the diff and decide whether the translation needs rework
 *    before committing,
 * 3. every ORPHANED key — a catalog entry nothing in the corpus declares
 *    (a translator's typo, a renamed key, a deleted component; the
 *    census's `orphaned` status, LT-196) — is pruned from the catalog and
 *    from the staleness manifest. Every locale carries the same key set
 *    (one ICU pattern per key, ADR 0030 s4), so an orphan is unconditional:
 *    it reports, and prunes, in every locale that carries it,
 * 4. every pattern-integrity finding (LT-219: a `malformed` entry — an
 *    unparseable pattern, or a value that is not a string at all, such as
 *    a group nested under the component (LT-249) — an
 *    `argument-mismatch`, `missing-arms`, a `client-fallback`) is LISTED and
 *    left alone — each is a translation only a translator can correct.
 *
 * A catalog FILE that does not parse as JSON, or whose top level is not an
 * object (a trailing comma, a merge-conflict marker), is REFUSED (LT-356):
 * sync names the file and the parse error, writes nothing to it or to its
 * manifest entries, syncs the other locales, and exits non-zero. Reading
 * it as empty would overwrite a translator's whole catalog with
 * placeholders.
 *
 * The corpus scan is the CONFIGURED one (LT-273): `le-truc.config.json`
 * selects the sources, the output root and the catalog directory, exactly
 * as for the build — this was the last script that hard-coded the corpus
 * glob, which re-opened the drift LT-255 closed. Run by a person, diffable
 * in review. The compile this performs writes only into the configured
 * output root (gitignored).
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ComponentRegistry } from '../server/compiler/registry'
import { compileCorpus } from '../server/corpus-compile'
import {
	collectCorpusSources,
	loadCorpusConfig,
	REPO_ROOT,
} from '../server/corpus-sources'
import {
	collectI18n,
	readCatalogs,
	SOURCE_LOCALE,
	syncLocale,
} from '../server/effects/i18n'
import { io } from '../server/runtimes'

const config = loadCorpusConfig(REPO_ROOT)

// The compile writes the generated artifacts (gitignored) and, as a side
// effect, the freshest registry.json — the same corpus view the build sees.
await compileCorpus(collectCorpusSources(config), config)

const registry = JSON.parse(
	readFileSync(join(config.outDir, 'registry.json'), 'utf8'),
) as ComponentRegistry
// The build's own reader (LT-356): an unreadable catalog file is reported,
// never read as empty.
const catalogs = await readCatalogs(config.i18nDir)
const collection = await collectI18n(
	Object.values(registry),
	catalogs,
	config.i18nDir,
)

if (collection.locales.length === 0) {
	console.log(
		`No catalogs to sync — create one first (e.g. ${join(config.i18nDir, 'de.json')} = "{}"), then re-run \`bun run i18n:sync\`.`,
	)
	console.log(
		`Source locale is '${SOURCE_LOCALE}' — its strings live inline in the component sources, no catalog file.`,
	)
	process.exit(0)
}

const manifestPath = join(config.i18nDir, 'manifest.json')
const manifest: Record<string, Record<string, string>> = (() => {
	try {
		return JSON.parse(readFileSync(manifestPath, 'utf8'))
	} catch {
		return {}
	}
})()

let writtenKeys = 0
let confirmedKeys = 0
let prunedKeys = 0
const staleKeys: string[] = []
const orphanKeys: string[] = []
const flaggedKeys: string[] = []
const refused: string[] = []

for (const locale of collection.locales) {
	const catalogPath = join(config.i18nDir, `${locale}.json`)
	const unreadable = catalogs.unreadable?.get(locale)
	if (unreadable !== undefined) {
		// Untouched: the file, and the locale's manifest entries.
		refused.push(`${catalogPath}: ${unreadable}`)
		continue
	}
	const catalog = catalogs.overrides.get(locale) ?? {}
	const result = syncLocale(
		catalog,
		collection.gaps.filter(g => g.locale === locale),
		collection.sources,
		manifest[locale] ?? {},
	)
	manifest[locale] = result.manifest
	writtenKeys += result.written
	confirmedKeys += result.confirmed
	prunedKeys += result.pruned.length
	staleKeys.push(...result.stale.map(key => `${key} (${locale})`))
	orphanKeys.push(...result.pruned.map(key => `${key} (${locale})`))
	flaggedKeys.push(
		...result.flagged.map(
			gap =>
				`${gap.key} (${locale}): ${gap.status}${gap.detail ? ` — ${gap.detail}` : ''}`,
		),
	)
	await io.writeTextFile(
		catalogPath,
		`${JSON.stringify(result.catalog, null, '\t')}\n`,
	)
}

await io.writeTextFile(
	manifestPath,
	`${JSON.stringify(manifest, null, '\t')}\n`,
)

console.log(
	`i18n:sync — ${writtenKeys} missing key(s) written as empty entries, ${confirmedKeys} carried key(s) confirmed against current sources across ${collection.locales.length} locale(s).`,
)
if (staleKeys.length > 0) {
	console.log(
		`${staleKeys.length} STALE key(s) — the source string changed after the translation was recorded; review the wording before committing:\n` +
			staleKeys.map(key => `  • ${key}`).join('\n'),
	)
}
if (orphanKeys.length > 0) {
	console.log(
		`${prunedKeys} orphaned key(s) PRUNED — nothing in the corpus declares them, so they never rendered:\n` +
			orphanKeys.map(key => `  • ${key}`).join('\n'),
	)
}
if (flaggedKeys.length > 0) {
	console.log(
		`${flaggedKeys.length} translation(s) FLAGGED — malformed (unparseable or not a string), argument mismatch, missing plural arms or client fallback; fix them by hand, nothing was changed:\n` +
			flaggedKeys.map(key => `  • ${key}`).join('\n'),
	)
}
if (refused.length > 0) {
	console.error(
		`i18n:sync did not sync ${refused.length} catalog file(s) — none reads as a JSON object, so nothing in it or in its manifest entries was changed:\n` +
			refused.map(entry => `  • ${entry}`).join('\n') +
			'\nFix each file by hand (look for a trailing comma or a merge-conflict marker), then re-run `bun run i18n:sync`.',
	)
	process.exit(1)
}
