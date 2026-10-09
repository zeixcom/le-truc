/**
 * The repo's shorthand caller of the corpus pass (LT-267; thin since
 * LT-480, when the pass itself moved into the compiler package —
 * `server/compiler/corpus.ts` — as the published entry point, D-32).
 *
 * The pass no longer throws on compile errors: it returns the diagnostics
 * and the summary, and a caller decides. THIS repo's runners keep the
 * historical contract — "errors fail the build run", thrown AFTER the
 * artifacts are written, so `build:cem` fails at the compile step with the
 * real diagnostic instead of shipping a manifest missing the dropped
 * component — and the in-repo shorthand: a bare path means "the repo's
 * configuration, but write here", which is what tests do so they never
 * race the build (LT-140).
 *
 * The full published form — scan the configured sources, compile, return
 * without throwing — is the package's `compileCorpus(config)`.
 */

import { type CompiledSpanInfo, compileCorpusFiles } from './compiler/corpus'
import { type CorpusConfig } from './compiler/corpus-config'
import type { CorpusFile } from './compiler/corpus-scan'
import { REPO_CONFIG } from './corpus-sources'

export { relocateClientSpecifiers } from './compiler/corpus'
export {
	GENERATED_DIR,
	handwrittenExampleModules,
	REPO_CONFIG,
} from './corpus-sources'
export type { CompiledSpanInfo }

/* === Exported Functions === */

/**
 * Compile the given corpus files under the repo's (or the caller's)
 * configuration and FAIL the run on error diagnostics — the wrapper
 * `scripts/build-corpus.ts`, `scripts/check-corpus.ts`,
 * `scripts/i18n-sync.ts`, the build effect and the tests call.
 *
 * `target` is the CONFIGURATION the run compiles under. Passing a bare path
 * is the shorthand for "the repo's config, but write here" (LT-140).
 */
export const compileCorpus = async (
	files: readonly CorpusFile[],
	target: string | CorpusConfig = REPO_CONFIG,
): Promise<CompiledSpanInfo[]> => {
	const config: CorpusConfig =
		typeof target === 'string' ? { ...REPO_CONFIG, outDir: target } : target
	const result = await compileCorpusFiles(files, config)
	if (result.errors.length > 0) {
		throw new Error(
			`Corpus compilation failed — ${result.errors.length} file(s) with error-severity diagnostics (dropped from the generated output):\n` +
				result.errors
					.map(({ file, label }) => `  • ${file} — ${label}`)
					.join('\n'),
		)
	}
	return [...result.spanInfos]
}
