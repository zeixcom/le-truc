#!/usr/bin/env bun

/**
 * Build the `@zeix/le-truc-compiler` package (LT-254, ADR 0034 s1–s2).
 *
 * `compiler/` carries the manifest and README; this script fills its `dist/`
 * from `server/compiler/` so the exports map resolves:
 *
 * 1. `tsc -p tsconfig.compiler.json` emits JS plus declarations for the
 *    whole compiler — both front ends, the shared pipeline, the value
 *    harness `runtime.ts` (the `./runtime` subpath generated server modules
 *    import), and `macros.ts` (the `./macros` subpath, dependency-free).
 *    The runtime peer resolves against the repo's committed `types/`
 *    declaration build, so nothing outside `server/compiler/` is emitted.
 * 2. A normalization pass appends `.js` to every relative import specifier
 *    in the emitted `.js` and `.d.ts` files: the sources use bundler-style
 *    extensionless imports, and plain-ESM Node resolution needs the
 *    extension. External specifiers (`@tsrx/core`, `@zeix/le-truc`,
 *    `node:*`, the already-suffixed `@messageformat/*` subpaths) pass
 *    through untouched.
 *
 *   bun run build:compiler
 *
 * Exit code is non-zero on any failure, so it is usable as a gate. The
 * `.d.ts` tree this emits is what LT-377's no-TypeScript-type check reads.
 */

import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/* === Constants === */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'compiler', 'dist')

/**
 * A relative specifier, extensionless: `./corpus`, `../icu/evaluate`.
 * Matched inside quotes after `from`, after `import(`, or after a bare
 * `import ` — multi-line import statements included, since only the tail
 * carries the specifier.
 */
const RELATIVE_SPECIFIER =
	/(from\s*|import\s*\(\s*|import\s+)(['"])(\.\.?\/[^'"]*)\2/g

/**
 * Rewrite one emitted file's relative specifiers to carry `.js` — a
 * directory import (`./frontend/tsrx`, resolved by the bundler-style source
 * graph to its `index.ts`) becomes `./frontend/tsrx/index.js`, not
 * `./frontend/tsrx.js`. The specifier is resolved against the emitted
 * file's own location, the same way Node will resolve it at runtime.
 */
const normalizeSpecifiers = (path: string, text: string): number => {
	const directoryOf = (specifier: string): boolean => {
		try {
			readdirSync(join(dirname(path), specifier))
			return true
		} catch {
			return false
		}
	}
	let rewrites = 0
	const out = text.replace(
		RELATIVE_SPECIFIER,
		(whole: string, lead: string, quote: string, specifier: string) => {
			if (/\.(js|cjs|mjs|json)$/.test(specifier)) return whole
			rewrites++
			const resolved = directoryOf(specifier)
				? `${specifier}/index.js`
				: `${specifier}.js`
			return `${lead}${quote}${resolved}${quote}`
		},
	)
	if (rewrites > 0) writeFileSync(path, out)
	return rewrites
}

/** Every file under a directory, recursively, as absolute paths. */
const walkFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
		entry.isDirectory()
			? walkFiles(join(dir, entry.name))
			: [join(dir, entry.name)],
	)

/* === Main === */

rmSync(DIST, { recursive: true, force: true })

const tsc = Bun.spawnSync(['bunx', 'tsc', '-p', 'tsconfig.compiler.json'], {
	cwd: ROOT,
	env: { ...process.env, NODE_ENV: 'production' },
	stdout: 'inherit',
	stderr: 'inherit',
})
if (tsc.exitCode !== 0) {
	console.error('✗ compiler build failed: tsc reported errors')
	process.exit(1)
}

let files = 0
let rewrites = 0
for (const path of walkFiles(DIST)) {
	if (!/\.(js|d\.ts)$/.test(path)) continue
	files++
	rewrites += normalizeSpecifiers(path, readFileSync(path, 'utf8'))
}

console.log(
	`📦 @zeix/le-truc-compiler built: ${files} module(s) under compiler/dist (${rewrites} relative specifier(s) normalized to .js)`,
)
