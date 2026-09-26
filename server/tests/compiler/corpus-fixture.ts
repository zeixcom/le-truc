/**
 * Shared corpus fixture for tests that exercise the corpus runner
 * (`compileCorpus`) the way the build does.
 */

import { readdirSync, readFileSync } from 'node:fs'
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

/**
 * Every ICU pattern the corpus declares, with its render locale: each
 * component's inline source string (`en`) and every non-empty catalog
 * translation under `i18n/`. The oracle test (icu.test.ts) and the MF2
 * exit (mf2-exit.test.ts) walk the same list.
 */
export const corpusPatterns = async (): Promise<[string, string][]> => {
	const out: [string, string][] = []
	for (const file of await loadCorpus()) {
		const { component } = compileCorpusSource(file.content, file.path)
		for (const pattern of Object.values(component?.i18nMessages ?? {}))
			out.push(['en', pattern])
	}
	const dir = path.join(ROOT, 'i18n')
	for (const file of readdirSync(dir)) {
		if (!file.endsWith('.json') || file === 'manifest.json') continue
		const locale = file.replace(/\.json$/, '')
		const catalog = JSON.parse(readFileSync(path.join(dir, file), 'utf8'))
		for (const value of Object.values(catalog as Record<string, unknown>))
			if (typeof value === 'string' && value !== '') out.push([locale, value])
	}
	return out
}
