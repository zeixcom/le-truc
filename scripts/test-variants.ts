#!/usr/bin/env bun

/**
 * Variant Spec Matrix Runner (LT-284, ADR 0039 s2)
 *
 * Runs each variant-carrying example's Playwright spec once per spelling
 * the folder carries — the hand-written `.ts` twin, the `.tsrx` and the
 * `.tsx` compile — unchanged. A variant set is a folder whose component has
 * at least two of `<tag>.ts`, `<tag>.tsrx`, `<tag>.tsx` beside
 * `<tag>.spec.ts`; every other example is out of scope (`bun run test`
 * covers it once).
 *
 * Specs address `http://localhost:3000/test/<tag>` directly, so the surface
 * is chosen server-side: per surface this starts `server/serve.ts` with
 * `TEST_SURFACE=<surface>` and Playwright reuses it (`reuseExistingServer`).
 * A server already listening on the port would silently serve the default
 * page, so the runner refuses to start instead.
 *
 * Usage:
 *   bun run test:variants                  # every variant set, every surface
 *   bun run test:variants basic-counter    # one component
 *   bun run test:variants --project=Chromium
 *   bun run test:variants --no-build       # reuse the examples build (CI)
 */

import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

type Surface = 'ts' | 'tsrx' | 'tsx'

const SURFACES: readonly Surface[] = ['ts', 'tsrx', 'tsx']
const PORT = 3000
const ORIGIN = `http://localhost:${PORT}`
const READY_TIMEOUT_MS = 30_000

type VariantSet = { tag: string; spec: string; surfaces: Surface[] }

const findVariantSets = (dir = 'examples'): VariantSet[] => {
	const sets: VariantSet[] = []
	for (const name of readdirSync(dir).sort()) {
		const path = join(dir, name)
		if (!statSync(path).isDirectory()) continue
		sets.push(...findVariantSets(path))
		const spec = readdirSync(path).find(f => f.endsWith('.spec.ts'))
		if (!spec) continue
		const tag = spec.slice(0, -'.spec.ts'.length)
		const surfaces = SURFACES.filter(s => existsSync(join(path, `${tag}.${s}`)))
		if (surfaces.length >= 2)
			sets.push({ tag, spec: join(path, spec), surfaces })
	}
	return sets
}

const run = (cmd: string, args: string[], env = process.env): Promise<number> =>
	new Promise(done => {
		const child = spawn(cmd, args, { stdio: 'inherit', env })
		child.on('close', code => done(code ?? 1))
		child.on('error', () => done(1))
	})

const isListening = async (): Promise<boolean> => {
	try {
		await fetch(ORIGIN)
		return true
	} catch {
		return false
	}
}

const startServer = async (
	surface: Surface,
	probeTag: string,
): Promise<ChildProcess> => {
	const server = spawn('bun', ['server/serve.ts'], {
		stdio: ['ignore', 'ignore', 'inherit'],
		env: { ...process.env, PLAYWRIGHT: '1', TEST_SURFACE: surface },
	})
	const deadline = Date.now() + READY_TIMEOUT_MS
	while (Date.now() < deadline) {
		if (server.exitCode !== null) break
		try {
			const res = await fetch(`${ORIGIN}/test/${probeTag}`)
			if (res.ok) return server
		} catch {
			// not listening yet
		}
		await Bun.sleep(200)
	}
	server.kill()
	throw new Error(`Server for surface "${surface}" did not become ready`)
}

const stopServer = (server: ChildProcess): Promise<void> =>
	new Promise(done => {
		if (server.exitCode !== null) return done()
		server.once('close', () => done())
		server.kill()
	})

const main = async () => {
	// `bun run` drops a bare `--`, so flags are told apart by shape: a
	// `--flag` goes to Playwright, anything else names a component
	// `--no-build` is the runner's own flag: skip `build:examples` when the
	// caller has just built them (CI runs this right after `bun run test`)
	const argv = process.argv.slice(2).filter(arg => arg !== '--')
	const noBuild = argv.includes('--no-build')
	const args = argv.filter(arg => arg !== '--no-build')
	const filters = args.filter(arg => !arg.startsWith('-'))
	const playwrightArgs = args.filter(arg => arg.startsWith('-'))
	if (playwrightArgs.some(arg => !/^--[a-z][a-z0-9-]*(=.+)?$/.test(arg))) {
		console.error('❌ Playwright args must be --flag or --flag=value form')
		process.exit(1)
	}

	const sets = findVariantSets().filter(
		s => filters.length === 0 || filters.includes(s.tag),
	)
	if (sets.length === 0) {
		console.error(
			filters.length
				? `❌ No variant set matches: ${filters.join(', ')}`
				: '❌ No variant-carrying examples found',
		)
		process.exit(1)
	}
	if (await isListening()) {
		console.error(
			`❌ Port ${PORT} is already in use — stop that server first; it would serve the default surface to every run.`,
		)
		process.exit(1)
	}

	console.log(
		`🧬 Variant sets: ${sets.map(s => `${s.tag} (${s.surfaces.join('/')})`).join(', ')}`,
	)
	if (!noBuild && (await run('bun', ['run', 'build:examples'])) !== 0)
		process.exit(1)

	const failed: Surface[] = []
	for (const surface of SURFACES) {
		const specs = sets.filter(s => s.surfaces.includes(surface))
		if (specs.length === 0) continue
		console.log(
			`\n🎭 Surface "${surface}": ${specs.map(s => s.tag).join(', ')}`,
		)
		const server = await startServer(surface, specs[0]!.tag)
		try {
			const code = await run('bunx', [
				'playwright',
				'test',
				...specs.map(s => s.spec),
				...playwrightArgs,
			])
			if (code !== 0) failed.push(surface)
		} finally {
			await stopServer(server)
		}
	}

	if (failed.length) {
		console.error(`\n❌ Failed surfaces: ${failed.join(', ')}`)
		process.exit(1)
	}
	console.log('\n✅ Every variant set passed on every surface')
}

await main()
