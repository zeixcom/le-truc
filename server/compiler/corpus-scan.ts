/**
 * Corpus discovery: config loading and source globbing (LT-255; moved into
 * the compiler package at LT-480, D-32 — the corpus entry point needs to
 * find its own inputs in an installing project).
 *
 * Everything here goes through the package's file-system seam (`fs.ts`) —
 * no `Bun.*`, no `import.meta`, no repo anchor. In particular there is no
 * default PROJECT ROOT in this module: with no config file within the
 * project boundary, the caller's `fallbackRoot` decides where the default
 * globs scan, and this repo's own root is the repo-side caller's fact
 * (`server/corpus-sources.ts`), never the package's.
 */

import { dirname, join, resolve } from 'node:path'
import {
	CONFIG_FILENAME,
	type CorpusConfig,
	type CorpusConfigInput,
	outDirPrefix,
	resolveCorpusConfig,
} from './corpus-config'
import {
	pathExistsSync,
	readTextFile,
	readTextFileSync,
	scanGlobSync,
} from './fs'

/* === Types === */

/**
 * One authored component source, as the corpus pass consumes it. The build
 * effect hands these in from its watch signals (`FileInfo` satisfies the
 * shape structurally); the scan produces them from the configured globs.
 */
export type CorpusFile = {
	/** Source path on disk, as the scan (or the caller) produced it. */
	path: string
	/** Path relative to the scan root — the tag's derivation input. */
	filename: string
	content: string
}

/* === Internal Functions === */

/**
 * The config search's outcome: the nearest `le-truc.config.json` at or
 * above `from`, or the PROJECT BOUNDARY the walk stopped at — the first
 * directory, `from` itself included, holding a `package.json` or a `.git`
 * — or neither, when the walk ran out of directories.
 *
 * A stray config file anywhere above a checkout must not retarget that
 * checkout's build, and a config at the boundary directory itself still
 * applies (the config is checked before the marker in the same directory).
 */
const findConfigFile = (
	from: string,
): { file: string } | { boundary: string } | {} => {
	let dir = resolve(from)
	for (;;) {
		const candidate = join(dir, CONFIG_FILENAME)
		if (pathExistsSync(candidate)) return { file: candidate }
		if (
			pathExistsSync(join(dir, 'package.json')) ||
			pathExistsSync(join(dir, '.git'))
		)
			return { boundary: dir }
		const parent = dirname(dir)
		if (parent === dir) return {}
		dir = parent
	}
}

/* === Exported Functions === */

/**
 * The configuration in force for a compile run.
 *
 * Searches from `cwd` upward — no further than the project boundary, the
 * nearest directory holding a `package.json` or a `.git` (LT-273) — for a
 * `le-truc.config.json`, and takes the directory holding it as the project
 * root. With no config file within that boundary, the project root IS the
 * boundary and the default configuration resolves there — which is what
 * makes this repo's callers need no config file: run from the repo root,
 * the defaults ARE this repo's paths. `fallbackRoot` answers the degenerate
 * case of no boundary at all (no `package.json`/`.git` anywhere above):
 * the caller's own root, defaulting to `cwd`.
 */
export const loadCorpusConfig = (
	cwd: string = process.cwd(),
	fallbackRoot: string = resolve(cwd),
): CorpusConfig => {
	const found = findConfigFile(cwd)
	if ('file' in found) {
		let input: CorpusConfigInput
		try {
			input = JSON.parse(readTextFileSync(found.file)) as CorpusConfigInput
		} catch (e) {
			throw new Error(
				`${found.file}: not valid JSON — ${e instanceof Error ? e.message : String(e)}`,
			)
		}
		return resolveCorpusConfig(dirname(found.file), input)
	}
	if ('boundary' in found) return resolveCorpusConfig(found.boundary)
	return resolveCorpusConfig(fallbackRoot)
}

/**
 * Every authored component source the configured globs select, as the
 * {@link CorpusFile} records the corpus pass consumes.
 *
 * Deduplicated by path: overlapping globs are a reasonable thing for a
 * consumer to write, and a file compiled twice would look like a duplicate
 * tag (LTC048) to a check that exists to catch two different files declaring
 * the same one. The scan is the seam's, so the matched set and its order
 * are the same under every runtime.
 */
export const collectCorpusSources = async (
	config: CorpusConfig,
): Promise<CorpusFile[]> => {
	const byPath = new Map<string, CorpusFile>()
	for (const pattern of config.sources) {
		for (const rel of scanGlobSync(pattern, config.root)) {
			const path = join(config.root, rel)
			if (byPath.has(path)) continue
			byPath.set(path, {
				path,
				filename: rel,
				content: await readTextFile(path),
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
		for (const rel of scanGlobSync(pattern, config.root)) {
			const tag = (rel.split('/').pop() ?? '').replace(/\.ts$/, '')
			if (!/^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)+$/.test(tag)) continue
			modules.set(tag, `${prefix}${rel.replace(/\.ts$/, '')}`)
		}
	}
	return modules
}
