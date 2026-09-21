/**
 * Corpus discovery: config loading and source globbing (LT-255).
 *
 * The file-IO half of the corpus configuration surface — everything in
 * `server/compiler/corpus-config.ts` is pure path math, and everything that
 * touches a disk lives here. That split is deliberate: LT-267 makes the
 * build's file IO runtime-neutral, and this module is one of the places it
 * replaces. `server/compiler/` stays free of `Bun.*` and `import.meta.dir`.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Glob } from 'bun'
import {
	CONFIG_FILENAME,
	type CorpusConfig,
	type CorpusConfigInput,
	outDirPrefix,
	resolveCorpusConfig,
} from './compiler/corpus-config'
import type { FileInfo } from './file-signals'

/* === Constants === */

/**
 * This repo's own root — the default project root, and the reason the docs
 * build needs no config file: the defaults ARE this repo's paths.
 */
export const REPO_ROOT = resolve(import.meta.dir, '..')

/* === Internal Functions === */

/** Nearest `le-truc.config.json` at or above `from`, or null. */
const findConfigFile = (from: string): string | null => {
	let dir = resolve(from)
	for (;;) {
		const candidate = join(dir, CONFIG_FILENAME)
		if (existsSync(candidate)) return candidate
		const parent = dirname(dir)
		if (parent === dir) return null
		dir = parent
	}
}

/* === Exported Functions === */

/**
 * The configuration in force for a compile run.
 *
 * Searches from `cwd` upward for a `le-truc.config.json` and takes the
 * directory holding it as the project root. With no config file anywhere
 * above `cwd`, falls back to this repo's defaults — which is what every
 * in-repo script and the docs build get, so their output is unchanged.
 */
export const loadCorpusConfig = (cwd: string = process.cwd()): CorpusConfig => {
	const file = findConfigFile(cwd)
	if (!file) return resolveCorpusConfig(REPO_ROOT)
	let input: CorpusConfigInput
	try {
		input = JSON.parse(readFileSync(file, 'utf8')) as CorpusConfigInput
	} catch (e) {
		throw new Error(
			`${file}: not valid JSON — ${e instanceof Error ? e.message : String(e)}`,
		)
	}
	return resolveCorpusConfig(dirname(file), input)
}

/**
 * Every authored component source the configured globs select, as the
 * `FileInfo` records `compileCorpus` consumes.
 *
 * Deduplicated by path: overlapping globs are a reasonable thing for a
 * consumer to write, and a file compiled twice would look like a duplicate
 * tag (LTC048) to a check that exists to catch two different files declaring
 * the same one.
 */
export const collectCorpusSources = (config: CorpusConfig): FileInfo[] => {
	const byPath = new Map<string, FileInfo>()
	for (const pattern of config.sources) {
		for (const rel of new Glob(pattern).scanSync({
			cwd: config.root,
			onlyFiles: true,
		})) {
			const path = join(config.root, rel)
			if (byPath.has(path)) continue
			const stat = statSync(path)
			byPath.set(path, {
				path,
				filename: rel,
				content: readFileSync(path, 'utf8'),
				hash: '', // unused by compileCorpus
				lastModified: stat.mtimeMs,
				size: stat.size,
				exists: true,
			})
		}
	}
	return [...byPath.values()]
}

/**
 * Hand-written custom-element modules, tag → import specifier relative to the
 * configured output root.
 *
 * Component files are named for their tag (dashed); helpers (`main.ts`,
 * `copyToClipboard.ts`) and tests carry no dash or a dot suffix and are
 * skipped. Specifiers are extensionless (bundler-style resolution,
 * TS5097-safe) and prefixed back to the project root, so they stay valid from
 * the flat output root whatever depth it was configured at.
 */
export const collectSiblingModules = (
	config: CorpusConfig,
): Map<string, string> => {
	const prefix = outDirPrefix(config.root, config.outDir)
	const modules = new Map<string, string>()
	for (const pattern of config.siblingModules) {
		for (const rel of new Glob(pattern).scanSync({ cwd: config.root })) {
			const tag = (rel.split('/').pop() ?? '').replace(/\.ts$/, '')
			if (!/^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)+$/.test(tag)) continue
			modules.set(tag, `${prefix}${rel.replace(/\.ts$/, '')}`)
		}
	}
	return modules
}
