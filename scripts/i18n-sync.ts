#!/usr/bin/env bun

/**
 * `i18n:sync` (ADR 0030 sub-design 5, LT-173 step 3b).
 *
 * The one writer for the committed catalogs — the build itself stays
 * read-only over tracked files. For every locale that has an
 * `i18n/<locale>.json` catalog:
 *
 * 1. every declared key the catalog is MISSING lands as an empty entry
 *    (`""`) — the translator's placeholder; the source-locale string
 *    renders until it is filled,
 * 2. every key the catalog CARRIES gets its staleness-manifest entry set
 *    to the CURRENT source string's hash (`i18n/manifest.json`) — the
 *    person running this confirms the translation matches the source it
 *    will ship against. Stale keys are listed, not silently confirmed:
 *    review the diff and decide whether the translation needs rework
 *    before committing.
 *
 * Run by a person, diffable in review. The compile this performs writes
 * only into the gitignored `server/generated/tsrx/`.
 */

import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Glob } from 'bun'
import {
	collectI18n,
	I18N_DIR,
	SOURCE_LOCALE,
	sourceHash,
} from '../server/effects/i18n'
import { compileTsrxCorpus } from '../server/effects/tsrx'
import type { ComponentRegistry } from '../server/compiler/registry'
import type { FileInfo } from '../server/file-signals'

const ROOT = resolve(import.meta.dir, '..')

const files: FileInfo[] = []
const glob = new Glob('examples/**/*.tsrx')
for (const rel of glob.scanSync({ cwd: ROOT, onlyFiles: true })) {
	const path = join(ROOT, rel)
	const stat = statSync(path)
	files.push({
		path,
		filename: rel,
		content: readFileSync(path, 'utf8'),
		hash: '',
		lastModified: stat.mtimeMs,
		size: stat.size,
		exists: true,
	})
}

// The compile writes the generated artifacts (gitignored) and, as a side
// effect, the freshest registry.json — the same corpus view the build sees.
await compileTsrxCorpus(files)

const registry = JSON.parse(
	readFileSync(join(ROOT, 'server/generated/tsrx/registry.json'), 'utf8'),
) as ComponentRegistry
const collection = await collectI18n(Object.values(registry))

if (collection.locales.length === 0) {
	console.log(
		`No catalogs to sync — create one first (e.g. ${join('i18n', 'de.json')} = "{}"), then re-run \`bun run i18n:sync\`.`,
	)
	console.log(
		`Source locale is '${SOURCE_LOCALE}' — its strings live inline in the .tsrx sources, no catalog file.`,
	)
	process.exit(0)
}

const manifestPath = join(I18N_DIR, 'manifest.json')
const manifest: Record<string, Record<string, string>> = (() => {
	try {
		return JSON.parse(readFileSync(manifestPath, 'utf8'))
	} catch {
		return {}
	}
})()

let writtenKeys = 0
let confirmedKeys = 0
const staleKeys: string[] = []

for (const locale of collection.locales) {
	const catalogPath = join(I18N_DIR, `${locale}.json`)
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
		} else {
			// Stale: listed for review. The manifest entry is refreshed like
			// every carried key — the translator decides whether the wording
			// needs rework; the census stops counting it either way.
			staleKeys.push(`${gap.key} (${locale})`)
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
	await Bun.write(catalogPath, `${JSON.stringify(sorted, null, '\t')}\n`)
}

await Bun.write(
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
