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
 *    from the staleness manifest. An unreachable DECLARED key is not an
 *    orphan (the census's carve-out, LT-217), so a wholesale translation
 *    of a pruned category survives the pass untouched; an undeclared key
 *    is sheltered by no category set and reports — and prunes — in every
 *    locale,
 * 4. every pattern-integrity finding (LT-219: a `malformed` entry, an
 *    `argument-mismatch`, `missing-arms`, a `client-fallback`) is LISTED and
 *    left alone — each is a translation only a translator can correct.
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
import { collectI18n, SOURCE_LOCALE, sourceHash } from '../server/effects/i18n'
import { io } from '../server/runtimes'

const config = loadCorpusConfig(REPO_ROOT)

// The compile writes the generated artifacts (gitignored) and, as a side
// effect, the freshest registry.json — the same corpus view the build sees.
await compileCorpus(collectCorpusSources(config), config)

const registry = JSON.parse(
	readFileSync(join(config.outDir, 'registry.json'), 'utf8'),
) as ComponentRegistry
const collection = await collectI18n(
	Object.values(registry),
	undefined,
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

for (const locale of collection.locales) {
	const catalogPath = join(config.i18nDir, `${locale}.json`)
	let catalog: Record<string, string> = {}
	try {
		catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
	} catch {
		catalog = {}
	}
	const next = { ...catalog }
	for (const gap of collection.gaps.filter(g => g.locale === locale)) {
		if (gap.status === 'missing') {
			next[gap.key] = next[gap.key] ?? ''
			writtenKeys++
		} else if (gap.status === 'stale') {
			// Stale: listed for review. The manifest entry is refreshed like
			// every carried key — the translator decides whether the wording
			// needs rework; the census stops counting it either way.
			staleKeys.push(`${gap.key} (${locale})`)
		} else if (gap.status !== 'orphaned') {
			// A pattern-integrity finding (LT-219): listed, never fixed — the
			// entry is a translation, and only a translator can say what it
			// should have been.
			flaggedKeys.push(
				`${gap.key} (${locale}): ${gap.status}${gap.detail ? ` — ${gap.detail}` : ''}`,
			)
		} else {
			// Orphaned: pruned. The entry can never render — no component
			// declares it — so keeping it would be residue the census counts
			// forever. The manifest entry goes with it.
			delete next[gap.key]
			delete manifest[locale]?.[gap.key]
			prunedKeys++
			orphanKeys.push(`${gap.key} (${locale})`)
		}
	}
	// Confirm every carried key against the CURRENT source strings.
	const localeManifest = { ...(manifest[locale] ?? {}) }
	const sourcesFor = (compound: string): string | undefined => {
		const dot = compound.indexOf('.')
		const tag = compound.slice(0, dot)
		const key = compound.slice(dot + 1)
		return collection.sources.get(tag)?.[key]
	}
	for (const key of Object.keys(next)) {
		const source = sourcesFor(key)
		if (source === undefined) continue
		localeManifest[key] = sourceHash(source)
		confirmedKeys++
	}
	manifest[locale] = Object.fromEntries(
		Object.entries(localeManifest).sort(([a], [b]) => (a < b ? -1 : 1)),
	)
	const sorted = Object.fromEntries(
		Object.entries(next).sort(([a], [b]) => (a < b ? -1 : 1)),
	)
	await io.writeTextFile(catalogPath, `${JSON.stringify(sorted, null, '\t')}\n`)
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
		`${staleKeys.length} STALE key(s) — the source string moved after the translation was recorded; review the wording before committing:\n` +
			staleKeys.map(key => `  • ${key}`).join('\n'),
	)
}
if (orphanKeys.length > 0) {
	console.log(
		`${prunedKeys} orphaned key(s) PRUNED — nothing in the corpus declares them, so they could never render:\n` +
			orphanKeys.map(key => `  • ${key}`).join('\n'),
	)
}
if (flaggedKeys.length > 0) {
	console.log(
		`${flaggedKeys.length} translation(s) FLAGGED — malformed, argument mismatch, missing plural arms or client fallback; fix them by hand, nothing was changed:\n` +
			flaggedKeys.map(key => `  • ${key}`).join('\n'),
	)
}
