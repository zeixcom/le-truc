/**
 * Shared corpus fixture for tests that exercise the corpus runner
 * (`compileCorpus`) the way the build does.
 */

import * as path from 'node:path'
import { resolveCorpusConfig } from '../../compiler/corpus-config'
import { compileSource } from '../../compiler/frontend/tsrx/compiler'
import { compileSourceTsx } from '../../compiler/frontend/tsx/compiler-tsx'
import { collectCorpusSources } from '../../corpus-sources'
import type { FileInfo } from '../../file-signals'

const ROOT = path.resolve(import.meta.dir, '../../..')

/**
 * The corpus under `examples/` — BOTH authored surfaces — as `FileInfo[]`,
 * read through the CONFIGURED scan (LT-273): the same glob list, dedup and
 * runtime-neutral order the build, `check:corpus` and `i18n:sync` get, so a
 * test fixture cannot drift from what the pipeline actually compiles.
 */
export const loadCorpus = async (): Promise<FileInfo[]> =>
	collectCorpusSources(resolveCorpusConfig(ROOT))

/**
 * Front-end-only compile of one corpus file, the surface chosen by
 * extension — the same dispatch `compileCorpus` makes (ADR 0039 variant
 * sets put a `.tsx` beside a `.tsrx` in one folder, LT-237).
 */
export const compileCorpusSource = (content: string, filename: string) =>
	filename.endsWith('.tsx')
		? compileSourceTsx(content, filename)
		: compileSource(content, filename)
