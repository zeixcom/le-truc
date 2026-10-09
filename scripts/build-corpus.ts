#!/usr/bin/env bun

/**
 * Standalone corpus compile — a thin caller of the compiler package's own
 * entry point (LT-480): `compileCorpus(config)` scans the configured
 * sources, compiles them, and writes the generated clients (plus server
 * modules, CSS, the registries and the i18n module) to the configured
 * output root. The pass returns its diagnostics; THIS runner keeps the
 * historical "errors fail the run" contract on top of them.
 *
 * Configuration (LT-255): a `le-truc.config.json` at the project root, found
 * by searching upward from the working directory. With none — which is this
 * repo's case — the defaults apply, and the defaults ARE this repo's paths:
 * `examples/**\/*.tsrx` + `examples/**\/*.tsx` in, `server/generated/components/`
 * out. See `server/compiler/corpus-config.ts`.
 *
 * `build:cem` runs this before `cem analyze`: the Custom Element Manifest
 * reads the corpus entries from the generated clients (ADR 0024, LT-006),
 * and that output is gitignored — a fresh checkout has none until compiled.
 */

import { relative } from 'node:path'
import { compileCorpus } from '../server/compiler/contract'
import { loadCorpusConfig } from '../server/compiler/corpus-scan'

const config = loadCorpusConfig()
try {
	const { diagnostics, summary } = await compileCorpus(config)
	if (diagnostics.some(d => d.severity === 'error')) {
		console.error(
			`❌ Corpus compilation failed — ${diagnostics.filter(d => d.severity === 'error').length} error-severity diagnostic(s); the affected files were dropped from the generated output.`,
		)
		process.exit(1)
	}
	console.log(
		`📦 ${summary.components} component(s) → ${relative(config.root, config.outDir)}`,
	)
} catch (error) {
	// A configuration-shaped refusal (no sources matched, a bad config
	// file): name it cleanly, the way the old runner's own check did.
	console.error(`❌ ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
}
