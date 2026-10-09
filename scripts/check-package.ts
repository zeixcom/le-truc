#!/usr/bin/env bun

/**
 * The published-package check (LT-254, ADR 0034 s1–s2, s8).
 *
 * Proves the distribution end to end, from tarballs to rendered HTML, in
 * an empty project outside the repo:
 *
 * 1. Builds the package (`build:compiler`), then `npm pack`s BOTH the
 *    compiler (`compiler/`) and the runtime peer (repo root).
 * 2. Installs the two tarballs into a scratch project — the compiler's
 *    own dependency closure (`@tsrx/core`, `typescript-estree`, the CSS
 *    and ICU packages) resolves from the registry, proving the manifest
 *    is complete.
 * 3. A Node consumer imports ONLY `@zeix/le-truc-compiler` and compiles a
 *    three-component corpus with NO `runtimeImport` set: two `.tsx`
 *    components, one composing the other, and one `.tsrx` component —
 *    the experimental surface ships and compiles, and `@tsrx/core` rides
 *    only inside the compiler's dependency closure (never a direct
 *    dependency of the consumer's project, never in an emitted module).
 * 4. A Bun render run imports the generated server module — its harness
 *    import lands on the package's `./runtime` subpath, whose runtime
 *    library import lands on the installed `@zeix/le-truc` — and asserts
 *    the composed markup. Node proves the compile; Bun proves the
 *    generated TypeScript renders.
 *
 *   bun run check:package
 *
 * Needs network (the registry) for step 2. Exit code is non-zero on any
 * failure, so it is usable as a gate.
 */

import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/* === Constants === */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const run = (cmd: string[], cwd: string, label: string): string => {
	const proc = Bun.spawnSync(cmd, {
		cwd,
		env: { ...process.env, NODE_ENV: 'production' },
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const out = proc.stdout.toString() + proc.stderr.toString()
	if (proc.exitCode !== 0) {
		console.error(
			`✗ ${label} exited ${proc.exitCode}\n${out.split('\n').slice(-25).join('\n')}`,
		)
		process.exit(1)
	}
	return out
}

/** The `.tsx` child: one arg, one rendered signal, the `css` marker. */
const CHILD = `import { createCell, type FactoryContext } from '@zeix/le-truc'
import { css } from '@zeix/le-truc-compiler/macros'

export type ScratchGreetingProps = {
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'scratch-greeting': HTMLElement & ScratchGreetingProps
	}
}

export function ScratchGreeting(
	{ start = 0 }: { start?: number },
	{ expose }: FactoryContext<ScratchGreetingProps>,
) {
	const count = createCell(start)
	expose({ count: count.get })

	return (
		<scratch-greeting>
			<p>
				<span class="count">{count}</span>
			</p>
			<style>{css\`
				@scope {
					:where(:scope) p {
						margin: 0;
					}
				}
			\`}</style>
		</scratch-greeting>
	)
}
`

/** The `.tsx` parent: composes the child with server args. */
const PARENT = `import { css } from '@zeix/le-truc-compiler/macros'
import { ScratchGreeting } from './scratch-greeting.tsx'

export type ScratchCardProps = {}

declare global {
	interface HTMLElementTagNameMap {
		'scratch-card': HTMLElement & ScratchCardProps
	}
}

// biome-ignore lint/correctness/noEmptyPattern: the compiler's params contract requires an (empty) destructured object pattern.
export function ScratchCard({}: ScratchCardProps) {
	return (
		<scratch-card>
			<h2>{'Scratch card'}</h2>
			<ScratchGreeting start={7} />
			<style>{css\`
				@scope {
					:where(:scope) h2 {
						font-size: 1rem;
					}
				}
			\`}</style>
		</scratch-card>
	)
}
`

/** The `.tsrx` component: statement-context control flow, the pre-.tsx surface. */
const PLAIN = `import { createCell } from '@zeix/le-truc'

export type ScratchPlainProps = {
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'scratch-plain': HTMLElement & ScratchPlainProps
	}
}

export function ScratchPlain({ start = 3 }: { start?: number })
	@{
		const count = createCell(start)
		expose({ count: count.get })

		<scratch-plain>
			<button type="button" onClick={() => count.set(count.get() + 1)}>
				<span>{count}</span>
			</button>
		</scratch-plain>
	}
`

/** The Node consumer: compile only, through the published entry point. */
const CONSUMER = `
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compileCorpus } from '@zeix/le-truc-compiler'

const assert = (condition, label) => {
	if (!condition) throw new Error('package check failed: ' + label)
	console.log('  ok: ' + label)
}

// No runtimeImport set: the published default must apply.
const config = {
	root: process.cwd(),
	sources: ['src/**/*.tsx', 'src/**/*.tsrx'],
	siblingModules: [],
	outDir: join(process.cwd(), 'out'),
	i18nDir: join(process.cwd(), 'i18n'),
	locales: ['en'],
	variantSurface: 'tsx',
	variantOverrides: {},
	cssTargets: {},
}

const { diagnostics, summary } = await compileCorpus(config)
assert(summary.components === 3, 'summary: three components served')
assert(summary.errors === 0, 'summary: no error diagnostics')
assert(
	diagnostics.every(d => d.severity !== 'error'),
	'diagnostics: no errors returned',
)

const registry = JSON.parse(readFileSync(join(config.outDir, 'registry.json'), 'utf8'))
assert(
	Object.keys(registry).sort().join() === 'scratch-card,scratch-greeting,scratch-plain',
	'registry: all three tags, both surfaces',
)
assert(
	registry['scratch-card'].composesTags.includes('scratch-greeting'),
	'registry: the composition recorded',
)
assert(
	registry['scratch-plain'].tier === 'folded',
	'registry: the .tsrx component compiled and routed',
)

const files = readdirSync(config.outDir).sort()
for (const expected of [
	'scratch-card.client.ts',
	'scratch-card.server.ts',
	'scratch-card.css',
	'scratch-plain.client.ts',
	'scratch-plain.server.ts',
	'scratch-plain.css',
	'tsrx-imports.d.ts',
	'i18n.ts',
])
	assert(files.includes(expected), 'artifact: ' + expected)

const harness = readFileSync(join(config.outDir, 'scratch-card.server.ts'), 'utf8')
assert(
	harness.includes("from '@zeix/le-truc-compiler/runtime'"),
	'generated server module: the default runtimeImport is the package subpath',
)

for (const name of files) {
	if (!name.endsWith('.client.ts') && !name.endsWith('.server.ts')) continue
	const text = readFileSync(join(config.outDir, name), 'utf8')
	assert(
		!text.includes('@tsrx/core'),
		'emitted module imports no @tsrx/core: ' + name,
	)
}

// The macros subpath carries no dependency of the compiler's.
const macros = readFileSync(
	join(process.cwd(), 'node_modules/@zeix/le-truc-compiler/dist/macros.js'),
	'utf8',
)
assert(!/\\bfrom\\s+'/.test(macros), 'macros subpath: no imports at all')

console.log('package check: the published entry point compiled a three-component corpus in an empty project')
`

/** The Bun render run: generated server module → harness → runtime peer. */
const RENDER = `
import { renderScratchCard } from './out/scratch-card.server.ts'

const html = await renderScratchCard({})
if (!html.includes('<scratch-greeting')) throw new Error('render: composed child missing')
if (!html.includes('scratch-card')) throw new Error('render: host tag missing')
console.log('package check: the generated server module rendered through ./runtime and the @zeix/le-truc peer')
if (!html.includes('>7<')) throw new Error('render: composed arg not folded in: ' + html)
console.log('  ok: composed start={7} folded into the child render')
`

/* === Main === */

const scratch = mkdtempSync(join(tmpdir(), 'le-truc-package-'))
const keep = process.argv.includes('--keep')
try {
	// 1. Build + pack both tarballs.
	run(['bun', 'run', 'build:compiler'], ROOT, 'build:compiler')
	const runtimePack = run(
		['npm', 'pack', '--pack-destination', scratch, '--json'],
		ROOT,
		'npm pack (runtime)',
	)
	const compilerPack = run(
		['npm', 'pack', '--pack-destination', scratch, '--json'],
		join(ROOT, 'compiler'),
		'npm pack (compiler)',
	)
	const tarballOf = (json: string): string =>
		join(scratch, (JSON.parse(json)[0] as { filename: string }).filename)
	const runtimeTgz = tarballOf(runtimePack)
	const compilerTgz = tarballOf(compilerPack)
	console.log(
		`✓ packed ${runtimeTgz.split('/').pop()} and ${compilerTgz.split('/').pop()}`,
	)

	// 2. The empty project installs both.
	writeFileSync(
		join(scratch, 'package.json'),
		JSON.stringify({ name: 'le-truc-scratch', private: true }, null, '\t'),
	)
	run(
		[
			'npm',
			'install',
			'--no-audit',
			'--no-fund',
			'--loglevel=error',
			compilerTgz,
			runtimeTgz,
		],
		scratch,
		'npm install (scratch)',
	)
	console.log('✓ installed both tarballs into the empty project')

	// @tsrx/core rides inside the compiler's closure only: it is present,
	// but the scratch project itself declares no dependency on it.
	const scratchManifest = JSON.parse(
		readFileSync(join(scratch, 'package.json'), 'utf8'),
	) as { dependencies?: Record<string, string> }
	if (scratchManifest.dependencies?.['@tsrx/core'])
		throw new Error(
			'package check failed: @tsrx/core became a direct dependency of the scratch project',
		)
	const tree = run(
		['npm', 'ls', '@tsrx/core', '--json'],
		scratch,
		'npm ls @tsrx/core',
	)
	if (!tree.includes('@zeix/le-truc-compiler'))
		throw new Error(
			'package check failed: @tsrx/core not recorded under the compiler in the install tree',
		)
	console.log('✓ @tsrx/core only inside the compiler dependency closure')

	// 3. Compile through the published entry point, under Node.
	mkdirSync(join(scratch, 'src'))
	writeFileSync(join(scratch, 'src', 'scratch-greeting.tsx'), CHILD)
	writeFileSync(join(scratch, 'src', 'scratch-card.tsx'), PARENT)
	writeFileSync(join(scratch, 'src', 'scratch-plain.tsrx'), PLAIN)
	writeFileSync(join(scratch, 'consumer.mjs'), CONSUMER)
	console.log(run(['node', 'consumer.mjs'], scratch, 'node consumer').trimEnd())

	// 4. Render the generated server module, under Bun.
	writeFileSync(join(scratch, 'render.mjs'), RENDER)
	console.log(
		run(['bun', 'run', 'render.mjs'], scratch, 'bun render').trimEnd(),
	)

	console.log(
		'\n✓ published package holds: pack → install → compile (Node) → render (Bun), .tsx stable and .tsrx experimental both shipped',
	)
} finally {
	if (keep) console.log(`\nkept: ${scratch}`)
	else rmSync(scratch, { recursive: true, force: true })
}
