/**
 * Shared corpus fixture for tests that exercise the corpus runner
 * (`compileCorpus`) the way the build does.
 */

import * as path from 'node:path'
import { resolveCorpusConfig } from '../../compiler/corpus-config'
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
