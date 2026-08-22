#!/usr/bin/env bun

/**
 * Standalone TSRX corpus compile — the tsrx effect's pipeline without the
 * build system. Runs the same two-pass compile over every `.tsrx` source
 * under `examples/` and writes the generated clients (plus server modules,
 * CSS, and the registry) to `server/generated/tsrx/`.
 *
 * `build:cem` runs this before `cem analyze`: the Custom Element Manifest
 * reads the corpus entries from the generated clients (ADR 0023, LT-006),
 * and that output is gitignored — a fresh checkout has none until compiled.
 */

import { Glob } from 'bun'
import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { compileTsrxCorpus } from '../server/effects/tsrx'

const ROOT = resolve(import.meta.dir, '..')

const files = []
const glob = new Glob('examples/**/*.tsrx')
for (const rel of glob.scanSync({ cwd: ROOT, onlyFiles: true })) {
	const path = join(ROOT, rel)
	const stat = statSync(path)
	files.push({
		path,
		filename: rel,
		content: readFileSync(path, 'utf8'),
		hash: '', // unused by compileTsrxCorpus
		lastModified: stat.mtimeMs,
		size: stat.size,
		exists: true,
	})
}
if (files.length === 0) {
	console.error('❌ No .tsrx sources found under examples/')
	process.exit(1)
}
await compileTsrxCorpus(files)
