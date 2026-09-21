#!/usr/bin/env bun

/**
 * Standalone corpus compile — the compile effect's pipeline without the build
 * system. Runs the same two-pass compile over every authored component source
 * the configured globs select and writes the generated clients (plus server
 * modules, CSS, and the registry) to the configured output root.
 *
 * Configuration (LT-255): a `le-truc.config.json` at the project root, found
 * by searching upward from the working directory. With none — which is this
 * repo's case — the defaults apply, and the defaults ARE this repo's paths:
 * `examples/**\/*.tsrx` + `examples/**\/*.tsx` in, `server/generated/components/`
 * out. See `server/compiler/corpus-config.ts`.
 *
 * `build:cem` runs this before `cem analyze`: the Custom Element Manifest
 * reads the corpus entries from the generated clients (ADR 0023, LT-006),
 * and that output is gitignored — a fresh checkout has none until compiled.
 */

import { relative } from 'node:path'
import {
	collectCorpusSources,
	loadCorpusConfig,
} from '../server/corpus-sources'
import { compileCorpus } from '../server/effects/compile'

const config = loadCorpusConfig()
const files = collectCorpusSources(config)
if (files.length === 0) {
	console.error(
		`❌ No component sources matched ${config.sources.join(', ')} under ${config.root}`,
	)
	process.exit(1)
}
console.log(
	`📦 ${files.length} source(s) → ${relative(config.root, config.outDir)}`,
)
await compileCorpus(files, config)
