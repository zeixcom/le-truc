/**
 * Cross-runtime check for the corpus build (LT-267).
 *
 * Bundles a minimal corpus-compile entry and runs the SAME bundle under
 * every runtime found on PATH, compiling this repo's corpus into a scratch
 * output root each time. The runtime seam (`server/runtimes/`) selects the
 * Bun implementation under Bun and the Node one under Node and Deno, so a
 * disagreement proves a runtime-specific behavior leak — in the glob, the
 * file IO, or the compiler itself. All emitted `.ts`/`.css`/`.json` bytes
 * must be identical.
 *
 * The bundle exists for module RESOLUTION only — the same trade
 * `sim-portability-probe.ts` made: the repo's source graph uses
 * bundler-style extensionless imports, a fact the published package's own
 * build step will normalize. What this check answers is whether the BUILD
 * behaves identically once the module graph is resolvable.
 *
 *   bun run check:portability
 *
 * Exit code is non-zero on any disagreement, so it is usable as a gate.
 */

import { createHash } from 'node:crypto'
import {
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/* === Constants === */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR_NAME = 'out'

/**
 * The entry the bundle is built from. It pins the configuration to the
 * repo's defaults with ONE twist — the output root comes from the
 * environment — so each runtime writes its own scratch tree for the diff.
 * The project ROOT is baked in as a literal at bundle time: a module-relative
 * anchor cannot see through the bundle, and the configuration's own contract
 * (a root handed to `resolveCorpusConfig`, ultimately from the consumer's
 * config file) is root-by-value, not root-by-module-location.
 */
const ENTRY = `
import { collectCorpusSources } from '${ROOT}/server/corpus-sources'
import { compileCorpus } from '${ROOT}/server/corpus-compile'
import { resolveCorpusConfig } from '${ROOT}/server/compiler/corpus-config'

const outDir = process.env.CORPUS_PORTABILITY_OUT
if (!outDir) throw new Error('CORPUS_PORTABILITY_OUT is not set')
const config = { ...resolveCorpusConfig('${ROOT}'), outDir }
const files = collectCorpusSources(config)
if (files.length === 0) throw new Error('no corpus sources matched')
await compileCorpus(files, config)
`

const RUNTIMES: ReadonlyArray<{
	name: 'bun' | 'node' | 'deno'
	command: string
	args: (bundle: string) => string[]
}> = [
	{
		name: 'bun',
		command: 'bun',
		args: bundle => [bundle],
	},
	{
		name: 'node',
		command: 'node',
		// Node ≥ 22.18 strips types unflagged; the flag keeps older Node honest.
		args: bundle => ['--experimental-strip-types', bundle],
	},
	{
		name: 'deno',
		command: 'deno',
		// `--node-modules-dir=none` on purpose: `auto` makes Deno REWRITE
		// ./node_modules into symlinks to its own store, wrecking the
		// Bun-installed tree. `--no-lock` keeps a deno.lock off the repo.
		args: bundle => [
			'run',
			'--allow-read',
			'--allow-write',
			'--allow-env',
			'--allow-sys',
			'--node-modules-dir=none',
			'--no-lock',
			bundle,
		],
	},
]

/* === Internal Functions === */

const hasRuntime = (command: string): boolean =>
	Bun.spawnSync(['which', command]).exitCode === 0

/** Sorted relative paths of every file in a tree. */
const walkTree = (dir: string, prefix = ''): string[] => {
	const out: string[] = []
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name
		if (entry.isDirectory()) out.push(...walkTree(join(dir, entry.name), rel))
		else out.push(rel)
	}
	return out.sort()
}

/** Content hash over every file of a tree, path-tagged so order cannot lie. */
const treeDigest = (dir: string): string => {
	const hash = createHash('sha256')
	for (const rel of walkTree(dir)) {
		hash.update(rel)
		hash.update('\0')
		hash.update(readFileSync(join(dir, rel)))
		hash.update('\0')
	}
	return hash.digest('hex').slice(0, 32)
}

/* === Main === */

const workDir = mkdtempSync(join(tmpdir(), 'le-truc-portability-'))
const keep = process.argv.includes('--keep')

try {
	// 1. The portable bundle. Fully self-contained — every bare specifier
	//    (typescript, @tsrx/core, culori, the self-referencing library) is
	//    inlined at bundle time from this repo's node_modules, because Node
	//    and Deno resolve a bundle's imports from the BUNDLE's location, not
	//    the working directory. The runtime-specific part that the check
	//    exists to exercise — the seam — stays dynamic: `index.ts` picks the
	//    implementation at runtime via `typeof Bun`.
	const entryPath = join(workDir, 'entry.ts')
	writeFileSync(entryPath, ENTRY)
	const built = await Bun.build({
		entrypoints: [entryPath],
		outdir: join(workDir, 'bundle'),
		target: 'node',
		format: 'esm',
		naming: '[dir]/portability.mjs',
	})
	if (!built.success)
		throw new Error(
			`bundling the corpus build failed:\n${built.logs.map(String).join('\n')}`,
		)
	const bundle = built.outputs[0]?.path
	if (!bundle) throw new Error('bundle produced no output file')

	// 2. Run the identical bundle under every runtime on PATH.
	const results = new Map<string, string>()
	const failed: string[] = []
	const skipped: string[] = []
	for (const spec of RUNTIMES) {
		if (!hasRuntime(spec.command)) {
			skipped.push(spec.name)
			continue
		}
		const outDir = join(workDir, `${spec.name}-${OUT_DIR_NAME}`)
		const run = Bun.spawnSync([spec.command, ...spec.args(bundle)], {
			cwd: ROOT,
			env: {
				...process.env,
				CORPUS_PORTABILITY_OUT: outDir,
				NODE_ENV: 'production',
			},
		})
		if (run.exitCode !== 0) {
			console.error(`✗ ${spec.name} exited ${run.exitCode}`)
			console.error(run.stderr.toString().split('\n').slice(-12).join('\n'))
			failed.push(spec.name)
			continue
		}
		results.set(spec.name, outDir)
	}

	// 3. Diff the emitted trees byte-for-byte.
	for (const name of results.keys())
		console.log(`  ran on: ${name} → ${results.get(name)}`)
	if (skipped.length) console.log(`  not found: ${skipped.join(', ')}`)

	const [first, ...rest] = [...results.keys()]
	if (first === undefined) {
		console.error('✗ no runtime produced output')
		process.exitCode = 1
	} else {
		const referenceDir = results.get(first) as string
		const referenceDigest = treeDigest(referenceDir)
		let agree = true
		for (const name of rest) {
			const otherDir = results.get(name) as string
			const otherDigest = treeDigest(otherDir)
			if (otherDigest === referenceDigest) {
				console.log(`✓ ${name} emitted byte-identical output to ${first}`)
				continue
			}
			agree = false
			console.error(`✗ ${name} differs from ${first}`)
			const referenceFiles = new Set(walkTree(referenceDir))
			const otherFiles = new Set(walkTree(otherDir))
			for (const rel of walkTree(referenceDir))
				if (!otherFiles.has(rel)) console.error(`  only in ${first}: ${rel}`)
			for (const rel of walkTree(otherDir))
				if (!referenceFiles.has(rel)) console.error(`  only in ${name}: ${rel}`)
			for (const rel of walkTree(referenceDir).filter(rel =>
				otherFiles.has(rel),
			)) {
				const a = await Bun.file(join(referenceDir, rel)).text()
				const b = await Bun.file(join(otherDir, rel)).text()
				if (a !== b) {
					const line = [...a].findIndex((ch, i) => ch !== b[i])
					console.error(
						`  ${rel}: first differing byte at ${line >= 0 ? line : 0}`,
					)
				}
			}
		}
		if (failed.length) {
			console.error(
				`✗ ${failed.join(', ')} failed to run the corpus build at all`,
			)
			agree = false
		}
		if (agree) {
			console.log(
				`\n✓ corpus build is runtime-neutral: ${results.size} runtime(s), identical emitted bytes`,
			)
		} else {
			process.exitCode = 1
		}
	}
} finally {
	if (keep) console.log(`\nkept: ${workDir}`)
	else rmSync(workDir, { recursive: true, force: true })
}
