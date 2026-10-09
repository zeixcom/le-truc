/**
 * The public-contract check (LT-265; re-scoped by LT-370, ADR 0034 s8; and
 * again by LT-480, D-32).
 *
 * Writes a consumer into a scratch project OUTSIDE the repo and runs it
 * there. The consumer imports NOTHING but `server/compiler/contract.ts`,
 * the designated export surface, and drives the published corpus entry
 * point (`compileCorpus(config)`) the way a published-package consumer
 * would: a scratch corpus of four components, varied along the single axis
 * each case isolates —
 *
 * - `seed`'s initializer is never rendered (no harvestable initial-DOM
 *   site), so its value decides the tier: absent → Folded, a literal →
 *   Simulated (realm-answerable), the wall clock → Static. The tier census
 *   in the summary and each entry's tier in `registry.json` carry the
 *   routing, which is how the refusal channel is observed now that the
 *   routing signal itself is internal (D-32);
 * - an `async` component function is a real error diagnostic (LTC008): the
 *   file is dropped from the registry, never a silently wrong component,
 *   and the diagnostic is RETURNED — the pass itself does not throw;
 * - `registry.json` carries exactly the public projection — the ten
 *   consumer-facing fields, nothing wider — and the generated server
 *   module exports `render<Name>`, the generated-module API the stability
 *   policy names.
 *
 * The IR is not part of this check: it is the lowering, internal, and may
 * change in any release (ADR 0034 s8, D-25). The external extension point
 * is the source-to-source adapter seam instead (ADR 0032 s6, LT-376).
 *
 * This run goes against the repo's OWN module paths — the published-
 * exports variant is LT-254's check and replaces the one interpolated
 * specifier below with the package name.
 *
 *   bun run check:contract
 *
 * Exit code is non-zero on any failure, so it is usable as a gate.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/* === Constants === */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SUMMARY =
	'contract check: the published corpus entry point compiled a scratch corpus through the designated contract surface'

/**
 * One scratch component, the LT-370 shape: `seed`'s initializer is never
 * rendered (no harvestable initial-DOM site), so its value alone decides
 * the tier. `name` feeds the id, `expose` the registry's `exposedProps`.
 */
const component = (
	tag: string,
	name: string,
	seed: string | null,
) => `import { css } from '@zeix/le-truc-compiler/macros'
import { asString, createCell } from '@zeix/le-truc'

export function ${name}({ name }: { name: string }) {
\tconst labelId = \`\${name}-label\`
${seed ? `\tconst seed = createCell(${seed})\n` : ''}\texpose({ label: asString('') })
\treturn (
\t\t<${tag}>
\t\t\t<span class="label" id={labelId}>Label</span>
\t\t\t<style>{css\`@scope { :scope { color: red; } }\`}</style>
\t\t</${tag}>
\t)
}
`

const refused = component('contract-refused', 'ContractRefused', '0').replace(
	'export function',
	'export async function',
)

/** The public projection, field for field — the `registry.json` schema. */
const PUBLIC_FIELDS = [
	'tag',
	'name',
	'source',
	'serverModule',
	'clientModule',
	'css',
	'propsType',
	'exposedProps',
	'tier',
	'composesTags',
]
	.slice()
	.sort()
	.join(',')

/**
 * The scratch consumer. It hand-builds its `CorpusConfig` (the type is the
 * contract; the loader is not), compiles, and asserts on everything the
 * published surface exposes: the returned diagnostics and summary, the
 * written `registry.json`, and the generated server module's export names.
 */
const CONSUMER = `
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
	compileCorpus,
	type CompileDiagnostic,
	type CorpusConfig,
} from '${ROOT}/server/compiler/contract'

const config: CorpusConfig = {
	root: process.cwd(),
	sources: ['src/**/*.tsx'],
	siblingModules: [],
	outDir: join(process.cwd(), 'out'),
	i18nDir: join(process.cwd(), 'i18n'),
	locales: ['en'],
	runtimeImport: '@zeix/le-truc',
	variantSurface: 'tsx',
	variantOverrides: {},
	cssTargets: {},
}

const assert = (condition: boolean, label: string) => {
	if (!condition) throw new Error('contract check failed: ' + label)
	console.log('  ok: ' + label)
}

const { diagnostics, summary } = await compileCorpus(config)

// 1. The summary: three tiers served, one file refused.
assert(summary.components === 3, 'summary: three components served')
assert(
	summary.tiers.folded === 1 &&
		summary.tiers.simulated === 1 &&
		summary.tiers.static === 1,
	'summary: one component per tier',
)
assert(summary.errors === 1, 'summary: the refusal counted as an error')

// 2. The diagnostics: the refusal is returned, carried through, not thrown.
const refused = diagnostics.filter(
	(d: CompileDiagnostic) => d.severity === 'error',
)
assert(refused.length === 1, 'diagnostics: exactly one error diagnostic')
assert(
	refused[0]?.code === 'LTC008' &&
		refused[0]?.location.file === 'src/contract-refused.tsx',
	'diagnostics: the LTC008 refusal names its file',
)

// 3. registry.json: the public projection only, one entry per served tag.
const registry = JSON.parse(
	readFileSync(join(config.outDir, 'registry.json'), 'utf8'),
) as Record<string, Record<string, unknown>>
assert(
	Object.keys(registry).sort().join() ===
		['contract-folded', 'contract-simulated', 'contract-static']
			.slice()
			.sort()
			.join(),
	'registry: the three served tags, the refused file absent',
)
for (const [tag, entry] of Object.entries(registry)) {
	assert(
		Object.keys(entry).sort().join() === '${PUBLIC_FIELDS}',
		'registry field set: ' + tag + ' carries exactly the public projection',
	)
}
assert(
	registry['contract-folded']?.tier === 'folded' &&
		registry['contract-simulated']?.tier === 'simulated' &&
		registry['contract-static']?.tier === 'static',
	'registry: the tier routing survived to the file',
)

// 4. The generated-module API the stability policy names.
const server = readFileSync(
	join(config.outDir, 'contract-folded.server.ts'),
	'utf8',
)
assert(
	server.includes('export function renderContractFolded'),
	'generated module: render<Name> exported from the server module',
)

console.log('${SUMMARY}')
`

/* === Main === */

const workDir = mkdtempSync(join(tmpdir(), 'le-truc-contract-'))
const keep = process.argv.includes('--keep')

try {
	mkdirSync(join(workDir, 'src'))
	writeFileSync(
		join(workDir, 'src', 'contract-folded.tsx'),
		component('contract-folded', 'ContractFolded', null),
	)
	writeFileSync(
		join(workDir, 'src', 'contract-simulated.tsx'),
		component('contract-simulated', 'ContractSimulated', '0'),
	)
	writeFileSync(
		join(workDir, 'src', 'contract-static.tsx'),
		component('contract-static', 'ContractStatic', 'Date.now()'),
	)
	writeFileSync(join(workDir, 'src', 'contract-refused.tsx'), refused)
	writeFileSync(join(workDir, 'run.ts'), CONSUMER)
	const run = Bun.spawnSync(['bun', 'run.ts'], {
		cwd: workDir,
		env: { ...process.env, NODE_ENV: 'production' },
	})
	const stdout = run.stdout.toString()
	if (stdout.trim()) console.log(stdout.trimEnd())
	if (run.exitCode !== 0) {
		console.error(`✗ scratch consumer exited ${run.exitCode}`)
		console.error(run.stderr.toString().split('\n').slice(-20).join('\n'))
		process.exitCode = 1
	} else if (!stdout.includes(SUMMARY)) {
		console.error('✗ scratch consumer did not report the contract summary')
		process.exitCode = 1
	} else {
		console.log(
			`\n✓ public contract holds: one config in, tiers + diagnostics + the registry projection out — imported through server/compiler/contract.ts only`,
		)
	}
} finally {
	if (keep) console.log(`\nkept: ${workDir}`)
	else rmSync(workDir, { recursive: true, force: true })
}
