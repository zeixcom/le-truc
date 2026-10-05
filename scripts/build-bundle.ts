/**
 * Location-independent `bun build` for the published bundle (LT-433).
 *
 *   bun run scripts/build-bundle.ts <entry>... --outdir <dir> [--define <K>=<V>]...
 *
 * Takes the subset of `bun build` flags `build:prod` uses and runs the same
 * build through `Bun.build`. Bun writes a `// <path>` comment per bundled
 * module, resolved through realpaths: in a task worktree `node_modules` is a
 * symlink to the main checkout's (scripts/worktree.ts), so a dependency
 * comes out as `// ../../node_modules/…` instead of `// node_modules/…`.
 * Neither `--preserve-symlinks` nor `preserveSymlinks` changes that (Bun
 * 1.4). The script rewrites exactly those comment lines — a relative path
 * that resolves inside the real node_modules — back to the repo-root-relative
 * `node_modules/…` form, so one commit builds a byte-identical bundle in the
 * main checkout and in any worktree. Nothing else in the output is touched.
 */

import { realpathSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

const fail = (message: string): never => {
	console.error(`build-bundle: ${message}`)
	process.exit(1)
}

const entrypoints: string[] = []
const define: Record<string, string> = {}
let outdir: string | undefined

const args = process.argv.slice(2)
for (let i = 0; i < args.length; i++) {
	const arg = args[i] as string
	if (arg === '--outdir') {
		outdir = args[++i] ?? fail('--outdir needs a directory')
	} else if (arg === '--define') {
		const pair = args[++i] ?? fail('--define needs <K>=<V>')
		const eq = pair.indexOf('=')
		if (eq < 1) fail(`--define expects <K>=<V>, got "${pair}"`)
		define[pair.slice(0, eq)] = pair.slice(eq + 1)
	} else if (arg.startsWith('-')) {
		fail(`unsupported flag "${arg}" — add it here or call bun build directly`)
	} else {
		entrypoints.push(arg)
	}
}
if (!entrypoints.length) fail('no entry point given')
if (outdir === undefined) fail('--outdir is required')

const result = await Bun.build({
	entrypoints,
	outdir: outdir as string,
	define,
})
if (!result.success) {
	for (const log of result.logs) console.error(log)
	process.exit(1)
}

const root = process.cwd()
const linkedModules = resolve(root, 'node_modules')
let realModules = linkedModules
try {
	realModules = realpathSync(linkedModules)
} catch {
	// No node_modules at all: nothing can resolve into it, nothing to rewrite.
}

/** `// ../../node_modules/x` → `// node_modules/x` when it is the symlink target. */
const normalizeModuleComments = (code: string): string =>
	realModules === linkedModules
		? code
		: code.replace(/^\/\/ (\.\.\/\S*)$/gm, (line, path: string) => {
				const abs = resolve(root, path)
				if (abs !== realModules && !abs.startsWith(realModules + sep))
					return line
				return `// ${relative(
					root,
					resolve(linkedModules, relative(realModules, abs)),
				)
					.split(sep)
					.join('/')}`
			})

for (const output of result.outputs) {
	if (output.kind !== 'entry-point' && output.kind !== 'chunk') continue
	const code = await Bun.file(output.path).text()
	const normalized = normalizeModuleComments(code)
	if (normalized !== code) await Bun.write(output.path, normalized)
	console.log(`  ${relative(root, output.path) || output.path}`)
}
