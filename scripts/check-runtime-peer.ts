#!/usr/bin/env bun

/**
 * The runtime-peer floor check (LT-254, ADR 0034 s8).
 *
 * The emitted client modules import the browser runtime by name from
 * `@zeix/le-truc`, and the compiler declares that runtime a peer
 * dependency with a minimum version. This check enforces the floor's
 * promise — a consumer holding the minimum version can always run what
 * this compiler emits:
 *
 * 1. The floor in `compiler/package.json`'s peer range must be satisfied
 *    by THIS repo's runtime version — the two packages release in
 *    lockstep from one checkout, so a runtime major (or a floor the
 *    current runtime cannot satisfy) fails here until the manifest moves.
 * 2. Every `@zeix/le-truc` import in the corpus's emitted client AND
 *    server modules — values and types, authored plain imports included —
 *    must exist in that version's export list. The export list is read
 *    from the repo barrel `index.ts`: the runtime's committed declaration
 *    build is generated from exactly this file, so it IS the list the
 *    floor version publishes (v3 is not yet on the registry; once it is,
 *    the barrel remains the in-lockstep source of the same fact).
 *
 *   bun run check:peer
 *   bun run check:peer -- --plant=notARealExport   # prove the failure mode
 *
 * Exit code is non-zero on any failure, so it is usable as a gate. The
 * `--plant` flag splices a bogus import into the scan input in memory —
 * the file on disk is never touched.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileCorpus } from '../server/compiler/contract'
import { loadCorpusConfig } from '../server/compiler/corpus-scan'

/* === Constants === */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** `3.0.0-next.1` out of a peer range like `^3.0.0-next.1`. */
const floorOf = (range: string): string =>
	range.replace(/^[~^>=\s]+/, '').replace(/\s*<.*$/, '')

/** Every name a barrel `export { … } from '…'` statement exports. */
const barrelExportNames = (source: string): Set<string> => {
	const names = new Set<string>()
	for (const match of source.matchAll(
		/export\s+(?:type\s+)?\{([^}]+)\}\s*from/g,
	)) {
		for (const raw of (match[1] ?? '').split(',')) {
			const entry = raw.trim().replace(/^type\s+/, '')
			if (entry.length === 0) continue
			// `local as exported` names the exported binding.
			names.add(entry.split(/\s+as\s+/).pop() ?? entry)
		}
	}
	return names
}

/** One `@zeix/le-truc` import's names, from an emitted module's text. */
const runtimeImportsOf = (text: string): string[] =>
	[
		...text.matchAll(
			/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+'@zeix\/le-truc'/g,
		),
	]
		.flatMap(match => (match[1] ?? '').split(','))
		.map(raw => raw.trim().replace(/^type\s+/, ''))
		.filter(entry => entry.length > 0)

/* === Main === */

const plant = (() => {
	const arg = process.argv.find(a => a.startsWith('--plant='))
	return arg ? arg.slice('--plant='.length) : null
})()

let failed = false

// 1. The lockstep rule: the runtime version satisfies the peer floor.
const compilerManifest = JSON.parse(
	readFileSync(join(ROOT, 'compiler', 'package.json'), 'utf8'),
) as { peerDependencies: Record<string, string> }
const runtimeManifest = JSON.parse(
	readFileSync(join(ROOT, 'package.json'), 'utf8'),
) as { version: string }
const range = compilerManifest.peerDependencies['@zeix/le-truc'] ?? ''
if (range.length === 0) {
	console.error('✗ compiler/package.json declares no @zeix/le-truc peer')
	process.exit(1)
}
const floor = floorOf(range)
const [floorMajor, floorMinor] = floor.split('.').map(Number)
const [runtimeMajor, runtimeMinor] = runtimeManifest.version
	.split('.')
	.map(Number)
if (
	floorMajor === undefined ||
	runtimeMajor === undefined ||
	runtimeMajor < floorMajor ||
	(runtimeMajor === floorMajor && (runtimeMinor ?? 0) < (floorMinor ?? 0))
) {
	console.error(
		`✗ runtime version ${runtimeManifest.version} does not satisfy the peer floor ${floor} — the two packages release in lockstep; move the floor or the version together`,
	)
	process.exit(1)
}
console.log(
	`✓ peer floor ${range} satisfied by runtime ${runtimeManifest.version}`,
)

// 2. The emitted modules import only names the floor version exports.
const exports = barrelExportNames(readFileSync(join(ROOT, 'index.ts'), 'utf8'))
console.log(
	`✓ runtime barrel exports ${exports.size} name(s) at ${runtimeManifest.version}`,
)

const config = loadCorpusConfig()
await compileCorpus(config)

const generated = readdirSync(config.outDir, { withFileTypes: true })
	.filter(entry => entry.isFile())
	.map(entry => entry.name)
	.filter(name => name.endsWith('.client.ts') || name.endsWith('.server.ts'))
	.sort()
if (generated.length === 0) {
	console.error(`✗ no emitted modules found under ${config.outDir}`)
	process.exit(1)
}
let imports = 0
let planted = false
for (const name of generated) {
	const text = readFileSync(join(config.outDir, name), 'utf8')
	const names = runtimeImportsOf(text)
	imports += names.length
	// The failure-mode proof: splice the bogus name into the first client
	// module's scan input, in memory only.
	if (plant && !planted && name.endsWith('.client.ts')) {
		names.push(plant)
		planted = true
	}
	for (const imported of names)
		if (!exports.has(imported)) {
			console.error(
				`✗ ${name} imports { ${imported} } from '@zeix/le-truc' — not exported at the peer floor ${floor}`,
			)
			failed = true
		}
}
if (plant && !planted) {
	console.error('✗ --plant given but no client module was scanned')
	failed = true
}
if (failed) process.exit(1)
console.log(
	`\n✓ runtime-peer floor holds: ${imports} @zeix/le-truc import(s) across ${generated.length} emitted module(s) all exist at ${floor}${plant ? ` (planted { ${plant} } correctly reported above)` : ''}`,
)
