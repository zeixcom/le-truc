/**
 * Cross-runtime check for the Server-Simulation driver (ADR 0027, LT-151).
 *
 * Prepares one probe job — the `form-colorgraph` stress case from the ADR
 * spike, the heaviest corpus component (canvas drawing, `ResizeObserver`,
 * form-associated, three composed spinbutton children) — then runs
 * `sim-portability-probe.ts` under every server runtime found on PATH and
 * diffs the serialized HTML.
 *
 * This half is Bun-only on purpose: bundling the generated client module and
 * calling the generated server render are build-pipeline jobs. The probe it
 * spawns is the runtime-neutral half.
 *
 *   bun scripts/sim-portability-check.ts [--component form-colorgraph] [--keep]
 *
 * Exit code is non-zero when the runtimes disagree, so this is usable as a
 * build gate.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
	formatSimDiagnostic,
	type SimDiagnostic,
} from '../server/tsrx/sim/index.ts'

/* === Types === */

type ProbeResult = {
	runtime: string
	definitions: string[]
	html: string
	values: Record<string, string | null>
	diagnostics: SimDiagnostic[]
}

type RuntimeSpec = {
	name: 'bun' | 'node' | 'deno'
	command: string
	args: (probe: string, job: string) => string[]
}

/* === Constants === */

const ROOT = resolve(import.meta.dir, '..')
const PROBE = join(ROOT, 'scripts', 'sim-portability-probe.ts')

const RUNTIMES: readonly RuntimeSpec[] = [
	{
		name: 'bun',
		command: 'bun',
		args: (probe, job) => [probe, job],
	},
	{
		name: 'node',
		command: 'node',
		// Node ≥ 22.18 strips types unflagged; the flag keeps older Node honest.
		args: (probe, job) => ['--experimental-strip-types', probe, job],
	},
	{
		name: 'deno',
		command: 'deno',
		// `--node-modules-dir=none` on purpose: `auto` makes Deno REWRITE
		// ./node_modules into symlinks to its own .deno store, which breaks the
		// Bun-installed tree (and the golden tests that walk it). With `none`,
		// Deno resolves the package.json deps into its global cache and leaves
		// the repo alone.
		args: (probe, job) => [
			'run',
			'--allow-read',
			'--allow-env',
			'--allow-sys',
			'--node-modules-dir=none',
			// bun.lock is the repo's lockfile; don't drop a deno.lock beside it.
			'--no-lock',
			probe,
			job,
		],
	},
]

/**
 * The probe fixture. `form-colorgraph` is the ADR's stress case; the args are
 * the spike's, so the numbers stay comparable to the ones in ADR 0027
 * sub-design 7 and LT-150's resolution note.
 */
const FIXTURE = {
	component: 'form-colorgraph',
	client: 'form-colorgraph.client.ts',
	server: 'form-colorgraph.server.ts',
	render: 'renderFormColorgraph',
	args: { name: 'color', value: 'oklch(0.7 0.1 200)' } as Record<
		string,
		unknown
	>,
	probes: [
		{ label: 'knob-style', selector: '.knob', attribute: 'style' },
		{ label: 'thumb-style', selector: '.thumb', attribute: 'style' },
		{
			label: 'slider-valuenow',
			selector: '.slider',
			attribute: 'aria-valuenow',
		},
		{
			label: 'canvas-width',
			selector: 'canvas.graph-canvas',
			attribute: 'width',
		},
	],
}

/* === Internal Functions === */

const hasRuntime = async (command: string): Promise<boolean> => {
	const which = Bun.spawnSync(['which', command])
	return which.exitCode === 0
}

/* === Main === */

const keep = process.argv.includes('--keep')
const generated = join(ROOT, 'server', 'generated', 'tsrx')
const workDir = mkdtempSync(join(tmpdir(), 'le-truc-sim-'))

try {
	// 1. Server markup — the template lowering that stays server-side
	//    (ADR 0027 sub-design 1: the client module builds no markup).
	const serverModule = (await import(
		join(generated, FIXTURE.server)
	)) as Record<string, (args: Record<string, unknown>) => string>
	const renderFn = serverModule[FIXTURE.render]
	if (!renderFn)
		throw new Error(`${FIXTURE.server} exports no ${FIXTURE.render}()`)
	const markup = renderFn(FIXTURE.args)

	// 2. Portable client bundle. The generated modules use Bun-style
	//    extensionless imports and a self-referencing '@zeix/le-truc'; bundling
	//    resolves both so the probe measures the DRIVER, not module resolution.
	const bundleDir = join(workDir, 'bundle')
	const built = await Bun.build({
		entrypoints: [join(generated, FIXTURE.client)],
		outdir: bundleDir,
		target: 'node',
		format: 'esm',
		define: { 'process.env.DEV_MODE': '"false"' },
	})
	if (!built.success)
		throw new Error(
			`bundling ${FIXTURE.client} failed:\n${built.logs.map(String).join('\n')}`,
		)
	const bundle = built.outputs[0]?.path
	if (!bundle) throw new Error('bundle produced no output file')

	// 3. The job file, shared verbatim by every runtime.
	const jobPath = join(workDir, 'job.json')
	writeFileSync(
		jobPath,
		JSON.stringify({
			component: FIXTURE.component,
			markup,
			clientBundle: bundle,
			probes: FIXTURE.probes,
		}),
	)

	// 4. Run the probe everywhere it can run.
	const results = new Map<string, ProbeResult>()
	const skipped: string[] = []
	for (const spec of RUNTIMES) {
		if (!(await hasRuntime(spec.command))) {
			skipped.push(spec.name)
			continue
		}
		const run = Bun.spawnSync([spec.command, ...spec.args(PROBE, jobPath)], {
			cwd: ROOT,
			env: { ...process.env, DEV_MODE: 'false' },
		})
		const stdout = run.stdout.toString()
		if (run.exitCode !== 0) {
			console.error(
				`✗ ${spec.name} exited ${run.exitCode}\n${run.stderr.toString()}`,
			)
			process.exitCode = 1
			continue
		}
		results.set(spec.name, JSON.parse(stdout) as ProbeResult)
	}

	// 5. Report.
	const names = [...results.keys()]
	console.log(`Server-Simulation portability probe — ${FIXTURE.component}`)
	console.log(`  ran on:     ${names.join(', ') || '(none)'}`)
	if (skipped.length) console.log(`  not found:  ${skipped.join(', ')}`)

	for (const [name, result] of results) {
		console.log(
			`\n[${name}] ${result.html.length} chars serialized; defined ${result.definitions.join(', ')}`,
		)
		for (const [label, value] of Object.entries(result.values))
			console.log(`  ${label.padEnd(18)}= ${JSON.stringify(value)}`)
		// Via the report formatter (LT-167): the raw message is subject-less
		// for the kinds whose copy assumes an attribution prefix.
		for (const diagnostic of result.diagnostics)
			console.log(`  ! ${formatSimDiagnostic(diagnostic)}`)
	}

	const [first, ...rest] = names
	if (first !== undefined && rest.length) {
		const reference = results.get(first) as ProbeResult
		for (const name of rest) {
			const other = results.get(name) as ProbeResult
			if (other.html === reference.html) {
				console.log(`\n✓ ${name} serialized identically to ${first}`)
			} else {
				console.error(`\n✗ ${name} differs from ${first}`)
				console.error(`  ${first}: ${reference.html.slice(0, 400)}`)
				console.error(`  ${name}: ${other.html.slice(0, 400)}`)
				process.exitCode = 1
			}
		}
	}
	if (skipped.length)
		console.log(
			`\nNote: ${skipped.join(', ')} not installed — equivalence unverified there.`,
		)
} finally {
	if (keep) console.log(`\nkept: ${workDir}`)
	else rmSync(workDir, { recursive: true, force: true })
}
