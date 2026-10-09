/**
 * Per-run output directories for tests that must EXECUTE generated TSRX
 * modules (LT-140).
 *
 * Emitting into the real `server/generated/components/` couples the test suite to
 * a directory the build pipeline owns, in two ways that both surface as an
 * unreproducible red run:
 * - any concurrent writer (`bun run scripts/build-corpus.ts`, `check:corpus`, a
 *   running dev server) overwrites a module between a test's write and its
 *   import;
 * - two test files that pick the same tag (`c-el`) overwrite each other,
 *   since `bun test` shares one process and one module registry.
 *
 * Each test file takes its own directory instead, and removes it afterward.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import * as path from 'node:path'
import { DEFAULT_EMIT_PATHS, type EmitPaths } from '../../compiler/emit-paths'

const ROOT = path.resolve(import.meta.dir, '../../..')

/**
 * Emit paths whose harness import stays repo-relative. The published
 * default (LT-254) is the package specifier `@zeix/le-truc-compiler/runtime`,
 * which plain-tsc spawns (`--ignoreConfig`, no `paths`) cannot resolve — the
 * tests that typecheck their emitted modules with such a spawn pin the
 * relative specifier instead, which resolves from this helper's depth (see
 * `BASE` below).
 */
export const REPO_EMIT_PATHS: EmitPaths = {
	...DEFAULT_EMIT_PATHS,
	runtimeImport: '../../compiler/runtime',
}

/**
 * Sibling of the real `server/generated/components/`, NOT an OS temp dir: emitted
 * modules import `'../../compiler/runtime'` (and examples/ helpers three levels
 * up), so the output has to sit at the same depth under the repo root for
 * those relative specifiers to resolve. `server/generated/` is gitignored,
 * so a leaked directory never shows up in `git status`.
 */
const BASE = path.join(ROOT, 'server/generated')

export type GeneratedDir = {
	/** Absolute path of the directory. */
	readonly path: string
	/** Path relative to the repo root — for subprocesses spawned with `cwd: ROOT`. */
	readonly relativePath: string
	/** Write `code` to `filename`; returns the absolute path. */
	emit(filename: string, code: string): string
	/** Import a previously emitted module, re-evaluating it if its code changed. */
	importModule<T = Record<string, unknown>>(filename: string): Promise<T>
	/** Remove the directory. Register with `afterAll`. */
	cleanup(): void
}

const live = new Set<string>()

// Safety net for a test file that throws before its afterAll runs.
process.on('exit', () => {
	for (const dir of live) rmSync(dir, { recursive: true, force: true })
})

/**
 * Create an isolated directory for one test file's generated modules.
 * `label` only makes the directory recognizable while debugging.
 */
export function createGeneratedDir(label: string): GeneratedDir {
	mkdirSync(BASE, { recursive: true })
	const dir = mkdtempSync(path.join(BASE, `corpus-test-${label}-`))
	live.add(dir)

	// The module registry keys on the resolved specifier, so a file re-emitted
	// with DIFFERENT code would otherwise resolve to the first version. Bump a
	// per-file token on change and import through it; identical re-emits keep
	// their token, preserving the cheap cached import.
	const tokens = new Map<string, number>()
	const emitted = new Map<string, string>()

	return {
		path: dir,
		relativePath: path.relative(ROOT, dir),

		emit(filename, code) {
			const out = path.join(dir, filename)
			if (emitted.get(filename) !== code) {
				mkdirSync(path.dirname(out), { recursive: true })
				writeFileSync(out, code)
				emitted.set(filename, code)
				tokens.set(filename, (tokens.get(filename) ?? 0) + 1)
			}
			return out
		},

		async importModule<T>(filename: string): Promise<T> {
			const token = tokens.get(filename)
			if (token === undefined)
				throw new Error(`${filename} was never emitted into ${dir}`)
			return (await import(`${path.join(dir, filename)}?v=${token}`)) as T
		},

		cleanup() {
			live.delete(dir)
			rmSync(dir, { recursive: true, force: true })
		},
	}
}
