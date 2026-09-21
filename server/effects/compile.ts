/**
 * Component compiler build effect (ADR 0023 milestone 1, LT-001).
 *
 * Watches every authored `.tsrx` AND `.tsx` source the CONFIGURED source
 * globs select (dual front end, ADR 0032 sub-design 6; LT-202) and re-runs
 * the corpus compile on every change. The compile itself lives in
 * `server/corpus-compile.ts` (LT-267) — deliberately outside the effects
 * directory, because it is the published package's build path and must be
 * importable without the reactive machinery; this module is the docs
 * build's reactive wrapper around it and nothing else.
 */

import { compileCorpus } from '../corpus-compile'
import { componentFiles } from '../file-signals'
import { createBuildEffect } from './build-effect'

/* === Exported Effect === */

export const compileEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'Corpus compiler',
		[componentFiles.sources],
		async ([files]) => {
			console.log('🔄 Compiling corpus components...')
			await compileCorpus(files)
		},
		onRebuild,
	)
