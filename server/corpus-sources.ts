/**
 * This repo's corpus facts (LT-255; the loading and globbing half moved
 * into the compiler package at LT-480 — `server/compiler/corpus-scan.ts`
 * — where the corpus entry point finds its own inputs).
 *
 * What stays here is everything anchored to THIS repository: its root, and
 * the default configuration the docs build and the runner scripts compile
 * under — the defaults ARE this repo's paths, which is why the repo needs
 * no config file. A consumer's configuration comes from their
 * `le-truc.config.json` through the package's loader; nothing in this
 * module is theirs.
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	type CorpusConfig,
	resolveCorpusConfig,
} from './compiler/corpus-config'
import { collectSiblingModules } from './compiler/corpus-scan'

/* === Constants === */

/**
 * This repo's own root — the default project root, and the reason the docs
 * build needs no config file: the defaults ARE this repo's paths. Anchored
 * to this module's location, portably (LT-267): the module is the constant,
 * whichever runtime loads it.
 */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The configuration the in-repo pipeline runs under: the defaults, which ARE
 * this repo's paths. A consumer's own configuration is loaded from their
 * `le-truc.config.json` by the package's `loadCorpusConfig` and handed to
 * `compileCorpus`.
 */
export const REPO_CONFIG: CorpusConfig = resolveCorpusConfig(REPO_ROOT)

/**
 * Where the corpus compile writes its artifacts, including the registry the
 * tier census reads (`scripts/check-corpus.ts`). Exported for the scripts and
 * tests that address the same directory the pipeline defaults to.
 */
export const GENERATED_DIR = REPO_CONFIG.outDir

/**
 * Custom element tags of the hand-written example components, mapped to
 * their source paths (relative to the generated dir). Registry-aware
 * attribute dispatch needs the tags too: a reactive attribute on ANY example
 * custom element the docs pages load alongside (e.g. `basic-button` inside
 * module-list) lowers to `pass()`, exactly as for migrated .tsrx tags — and
 * the generated client imports the module for its `declare global` entry.
 *
 * LT-255 moved the glob and the back-to-the-root prefix into the
 * configuration (`collectSiblingModules`); this wrapper keeps the in-repo
 * name and behaviour.
 */
export const handwrittenExampleModules = (): Map<string, string> =>
	collectSiblingModules(REPO_CONFIG)
