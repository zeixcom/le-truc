/**
 * The public-contract check (LT-265; re-scoped by LT-370, ADR 0034 s8).
 *
 * Writes a consumer into a scratch project OUTSIDE the repo and runs it
 * there. The consumer imports NOTHING but `server/compiler/contract.ts`,
 * the designated export surface, and drives the bundled `.tsx` front end
 * (`compileComponentTsx`) the way a published-package consumer would:
 *
 * - one small component compiles end-to-end in all three tiers (no routing
 *   signal → folded; a realm-answerable signal → simulated; an
 *   unresolvable one → static), producing the three artifacts and the
 *   registry entry, with every signal recorded on the entry;
 * - an error diagnostic refuses the component: `component` is null and the
 *   diagnostic carries through, never a silently wrong component.
 *
 * The IR is not part of this check: it is the lowering, internal, and may
 * change in any release (ADR 0034 s8, D-25). Until LT-370 this script
 * hand-built a `ComponentIR` literal for a toy front end and handed it to
 * `compileFromIR`; that seam left the contract with the IR, and the
 * external extension point is the source-to-source adapter seam instead
 * (ADR 0032 s6, LT-376).
 *
 * This run goes against the repo's OWN module paths — the published-
 * exports variant is LT-254's check and replaces the one interpolated
 * specifier below with the package name.
 *
 *   bun run check:contract
 *
 * Exit code is non-zero on any failure, so it is usable as a gate.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/* === Constants === */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SUMMARY =
	'contract check: the bundled .tsx front end compiled end-to-end through the designated contract surface'

/**
 * The scratch consumer. One authored `.tsx` component, varied along the
 * single axis each case isolates: `seed`'s initializer is never rendered
 * (no harvestable initial-DOM site), so its value decides the tier — the
 * wall clock has no server answer (Static), a literal is realm-answerable
 * (Simulated), and dropping `seed` leaves nothing to route on (Folded). An
 * `async` component function is a real error diagnostic (LTC008).
 */
const CONSUMER = `
import {
	DEFAULT_EMIT_PATHS,
	compileComponentTsx,
	type CompileFileResult,
} from '${ROOT}/server/compiler/contract'

const BASE = \`import { asString, createCell } from '@zeix/le-truc'

export function ContractProbe({ name }: { name: string }) {
	const labelId = \\\`\\\${name}-label\\\`
	const seed = createCell(Date.now())
	expose({ label: asString('') })
	return (
		<contract-probe>
			<span class="label" id={labelId}>Label</span>
			<style>{css\\\`:host { color: red; }\\\`}</style>
		</contract-probe>
	)
}\`

const compile = (source: string): CompileFileResult =>
	compileComponentTsx(
		source,
		'contract-probe.tsx',
		new Set(),
		undefined,
		undefined,
		DEFAULT_EMIT_PATHS,
	)

const assert = (condition: boolean, label: string) => {
	if (!condition) throw new Error('contract check failed: ' + label)
	console.log('  ok: ' + label)
}

// 1. Folded: no routing signal, three artifacts, registry entry.
const folded = compile(BASE.replace('\\tconst seed = createCell(Date.now())\\n', ''))
assert(folded.component !== null, 'folded: component compiled')
assert(folded.component?.entry.tier === 'folded', 'folded: tier is folded')
assert(folded.component?.entry.tag === 'contract-probe', 'folded: entry carries the tag')
assert(
	(folded.component?.serverCode.includes('contract-probe') ?? false) &&
		(folded.component?.clientCode.includes('defineComponent') ?? false) &&
		(folded.component?.css.includes('contract-probe') ?? false),
	'folded: three artifacts produced',
)
assert(
	(folded.component?.clientSpans.length ?? 0) > 0,
	'folded: client span table produced',
)
assert(
	folded.diagnostics.every(d => d.severity !== 'error'),
	'folded: no error diagnostics',
)

// 2. Simulated: a realm-answerable routing signal routes down one step.
const simulated = compile(BASE.replace('createCell(Date.now())', 'createCell(0)'))
assert(simulated.component?.entry.tier === 'simulated', 'simulated: tier is simulated')
assert(
	simulated.component?.entry.routingSignals[0]?.resolution.by === 'realm',
	'simulated: realm-answerable signal recorded on the entry',
)

// 3. Static: an unresolvable routing signal routes past the realm entirely.
const statik = compile(BASE)
assert(statik.component?.entry.tier === 'static', 'static: tier is static')
const limb = statik.component?.entry.routingSignals[0]?.resolution
assert(
	limb?.by === 'none' && limb.limb === 'not-a-server-fact',
	'static: unresolvable signal recorded on the entry',
)

// 4. The diagnostic refusal: component null, the diagnostic carried through.
const refused = compile(BASE.replace('export function', 'export async function'))
assert(refused.component === null, 'refused: no component on refusal')
assert(
	refused.diagnostics.some(d => d.code === 'LTC008' && d.severity === 'error'),
	'refused: real error diagnostic carried through',
)

console.log('${SUMMARY}')
`

/* === Main === */

const workDir = mkdtempSync(join(tmpdir(), 'le-truc-contract-'))
const keep = process.argv.includes('--keep')

try {
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
			`\n✓ public contract holds: one .tsx source, three tiers, both refusal channels — imported through server/compiler/contract.ts only`,
		)
	}
} finally {
	if (keep) console.log(`\nkept: ${workDir}`)
	else rmSync(workDir, { recursive: true, force: true })
}
