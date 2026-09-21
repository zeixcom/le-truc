/**
 * The corpus configuration surface (LT-255, ADR 0034 sub-design 1).
 *
 * A corpus is "every authored component source a project wants compiled, and
 * where the generated artifacts go". This repo's docs build is ONE consumer of
 * that mechanism, not the mechanism itself: its `examples/**` globs and its
 * `server/generated/components/` output root are the DEFAULTS, and an
 * installing project overrides them from a `le-truc.config.json` at its own
 * root.
 *
 * This module is pure — types, defaults, validation, and path math. It reads
 * no files and calls no runtime-specific API (no `Bun.*`, no
 * `import.meta.dir`), so `server/compiler/` stays runtime-neutral for LT-267.
 * Config LOADING and source globbing live in `server/corpus-sources.ts`, the
 * file-IO layer LT-267 replaces. The emitter-facing subset lives one level
 * down in `emit-paths.ts`, which carries no `node:` import because the
 * browser bundle reaches it.
 */

import { isAbsolute, relative, resolve, sep } from 'node:path'
import {
	DEFAULT_OUT_DIR,
	DEFAULT_RUNTIME_IMPORT,
	type EmitPaths,
} from './emit-paths'

/* === Constants === */

/** The config file an installing project puts at its own root. */
export const CONFIG_FILENAME = 'le-truc.config.json'

/**
 * Source globs, relative to the project root.
 *
 * BOTH authored extensions (ADR 0032 sub-design 6): the front end is chosen
 * per file by extension in `compileCorpus`. Before LT-255 the standalone
 * runner globbed `.tsrx` only while `check:corpus` and the build effect
 * globbed both, so a `.tsx` component was invisible to `build:cem` and
 * `typecheck` (VOCABULARY_LEDGER § 1, "Known gap"). One configured glob list
 * closes that as a side effect — there is now a single place to widen.
 */
export const DEFAULT_SOURCES = ['examples/**/*.tsrx', 'examples/**/*.tsx']

/**
 * Hand-written custom-element modules the corpus may address, relative to the
 * project root.
 *
 * These are components the compiler does NOT produce but must know about:
 * a reactive attribute on one of their tags lowers to `pass()` rather than
 * `bindProperty()`, and a generated client imports the module so the tag is
 * defined. Files are matched to tags by filename (`basic-button.ts` →
 * `basic-button`); a file whose stem is not a valid custom-element tag is
 * skipped, which is how helpers (`main.ts`) and tests stay out.
 */
export const DEFAULT_SIBLING_MODULES = ['examples/**/*.ts']

/**
 * Directory holding the committed per-locale translation catalogs, relative
 * to the project root (ADR 0030 sub-design 5).
 *
 * Configured for the same reason the sources are: a consumer's build that
 * read THIS repo's catalogs would census another project's translation keys
 * as orphans. A project with no such directory gets zero locales and zero
 * gaps, which is the correct answer for one that does not translate.
 */
export const DEFAULT_I18N_DIR = 'i18n'

export { DEFAULT_OUT_DIR, DEFAULT_RUNTIME_IMPORT }

/* === Types === */

/** The config file's shape — every field optional, defaults as above. */
export type CorpusConfigInput = {
	/** Globs selecting authored `.tsx`/`.tsrx` component sources. */
	sources?: string[]
	/** Globs selecting hand-written custom-element modules. */
	siblingModules?: string[]
	/** Output root for the generated artifacts, relative to the root. */
	outDir?: string
	/** Translation-catalog directory, relative to the root. */
	i18nDir?: string
	/** Specifier the generated server modules import the harness from. */
	runtimeImport?: string
}

/** A fully resolved corpus configuration; all paths absolute. */
export type CorpusConfig = {
	/** Project root. Every glob is scanned with this as its cwd. */
	root: string
	sources: readonly string[]
	siblingModules: readonly string[]
	outDir: string
	i18nDir: string
	runtimeImport: string
}

/* === Exported Functions === */

/**
 * `../` once per segment of `outDir` below `root`.
 *
 * `server/generated/components` → `../../../`, the value this repo's layout
 * hard-coded before LT-255.
 */
export const outDirPrefix = (root: string, outDir: string): string => {
	const rel = relative(root, outDir)
	const segments = rel.split(sep).filter(s => s.length > 0 && s !== '.')
	return '../'.repeat(segments.length)
}

/**
 * Resolve a config file's contents (or nothing) against a project root.
 *
 * Relative path fields resolve against `root`; an absolute one is taken as
 * given. Throws on an output root outside the project root — the emitted
 * relative specifiers are expressed as "`../` back to the root, then a
 * root-relative path", a scheme that cannot address an output root the root
 * does not contain. That is a configuration mistake, not an authoring one, so
 * it is a thrown error rather than a compile diagnostic.
 */
export const resolveCorpusConfig = (
	root: string,
	input: CorpusConfigInput = {},
): CorpusConfig => {
	const resolvedRoot = resolve(root)
	const at = (p: string) =>
		isAbsolute(p) ? resolve(p) : resolve(resolvedRoot, p)
	const outDir = at(input.outDir ?? DEFAULT_OUT_DIR)
	const rel = relative(resolvedRoot, outDir)
	if (rel.length === 0 || rel.startsWith('..') || isAbsolute(rel))
		throw new Error(
			`${CONFIG_FILENAME}: "outDir" must be a directory INSIDE the project ` +
				`root — got ${outDir}, root is ${resolvedRoot}. Generated modules ` +
				`address the project root relatively, so an output root outside it ` +
				`cannot be expressed.`,
		)
	const sources = input.sources ?? DEFAULT_SOURCES
	if (sources.length === 0)
		throw new Error(
			`${CONFIG_FILENAME}: "sources" must list at least one glob.`,
		)
	return {
		root: resolvedRoot,
		sources: [...sources],
		siblingModules: [...(input.siblingModules ?? DEFAULT_SIBLING_MODULES)],
		outDir,
		i18nDir: at(input.i18nDir ?? DEFAULT_I18N_DIR),
		runtimeImport: input.runtimeImport ?? DEFAULT_RUNTIME_IMPORT,
	}
}

/** The emitter-facing projection of a configuration. */
export const emitPathsFor = (config: CorpusConfig): EmitPaths => ({
	outDirPrefix: outDirPrefix(config.root, config.outDir),
	runtimeImport: config.runtimeImport,
})
