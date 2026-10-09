/**
 * Component compiler build effect (ADR 0024 milestone 1, LT-001).
 *
 * Watches every authored `.tsrx` AND `.tsx` source the CONFIGURED source
 * globs select (dual front end, ADR 0032 sub-design 6; LT-202) and re-runs
 * the corpus compile on every change. The compile itself lives in the
 * compiler package (`server/compiler/corpus.ts`, LT-480) — importable
 * without the reactive machinery; the in-repo shorthand wrapper
 * (`server/corpus-compile.ts`) keeps the repo's fail-on-error contract.
 * This module is the docs build's reactive wrapper and nothing else.
 */

import { compileCorpus, REPO_CONFIG } from '../corpus-compile'
import { componentFiles } from '../file-signals'
import { createBuildEffect } from './build-effect'

/* === Exported Effect === */

export const compileEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'Corpus compiler',
		[componentFiles.sources],
		async ([files]) => {
			console.log('🔄 Compiling corpus components...')
			await compileCorpus(files, REPO_CONFIG)
		},
		onRebuild,
	)
