/**
 * The front-end contract check (LT-265, ADR 0032 amended 2026-09-19).
 *
 * Writes a toy front end — a deliberately foreign one-line syntax, neither
 * `.tsrx` nor `.tsx` — into a scratch project OUTSIDE the repo and runs it
 * there. The front end imports NOTHING but `server/compiler/contract.ts`,
 * the designated contract surface, and proves the contract's two halves:
 *
 * - a toy component compiles end-to-end through `compileFromIR` in all
 *   three tiers (no signals → folded; a realm-answerable signal →
 *   simulated; an unresolvable one → static), producing the three
 *   artifacts and the registry entry;
 * - both refusal channels produce a designed outcome, never a silently
 *   wrong component: an error diagnostic (component null, the diagnostic
 *   carried through) and a routing signal (the tier degrades, the signal
 *   recorded on the entry for the census).
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

/**
 * The toy front end. Grammar: `component <tag> [clock|frame] "<text>"` —
 * `clock` stands for a construct the front end cannot fold because it is a
 * fact about the viewing moment (routes Static), `frame` for one the
 * simulation realm CAN answer (routes Simulated), no directive for a
 * fully foldable component (Folded). Anything else is refused with a real
 * error diagnostic. Every construct maps onto contract vocabulary only.
 */
const FRONT_END = `
import {
	DEFAULT_EMIT_PATHS,
	compileFromIR,
	type CompileDiagnostic,
	type CompileFileResult,
	type ComponentIR,
	type RoutingSignal,
} from '${ROOT}/server/compiler/contract'

const TOY_SOURCE = /^component\\s+([a-z][a-z-]*)(?:\\s+(clock|frame))?\\s+"([^"]*)"\\s*$/

const pascal = (tag) => tag.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('')

export const compileToy = (source, filename) => {
	const match = TOY_SOURCE.exec(source)
	if (!match) {
		const diagnostic: CompileDiagnostic = {
			code: 'LTC005',
			severity: 'error',
			message: 'the toy front end only understands: component <tag> [clock|frame] "<text>"',
			line: 1,
		}
		return { component: null, diagnostics: [diagnostic], routingSignals: [] }
	}
	const tag = match[1]
	const directive = match[2]
	const text = match[3]
	const routingSignals: RoutingSignal[] =
		directive === 'clock'
			? [{
					origin: 'LTC004',
					detail: 'toy clock directive reads the wall clock',
					line: 1,
					resolution: {
						by: 'none',
						limb: 'not-a-server-fact',
						reason: 'reads the wall clock, which is a fact about the viewing moment',
					},
				}]
			: directive === 'frame'
				? [{
						origin: 'LTC004',
						detail: 'toy frame directive reads element layout',
						line: 1,
						resolution: { by: 'realm' },
					}]
				: []
	const component: ComponentIR = {
		name: pascal(tag),
		source,
		tag,
		paramsText: '',
		paramNames: [],
		paramProps: [],
		i18nMessages: null,
		declaresI18n: false,
		langBinding: null,
		langArgDefault: null,
		caseType: 'union',
		setup: [],
		clientSetup: [],
		plainSetup: [],
		signals: [],
		exposeText: null,
		exposeRange: null,
		exposeArgNode: null,
		exposeProps: new Map(),
		exposeKinds: new Map(),
		parserExposeProps: new Map(),
		exposeAmbients: [],
		contextRefs: [],
		config: null,
		root: {
			kind: 'element',
			tag,
			attrs: [{ kind: 'static', name: 'class', value: 'toy' }],
			children: [{ kind: 'text', value: text }],
			node: { type: 'ToyElement', start: 0, end: source.length },
		},
		refReasons: new Map(),
		unmatchedOptionalRefs: [],
		deferredComposeRefs: [],
		optionalRefs: new Set(),
		fors: new Map(),
		css: '',
		typeDecls: [],
		globalDecl: null,
		propsTypeName: null,
		componentDoc: null,
		serverKnown: new Set(),
		imports: {
			server: [],
			client: [],
			serverLocalNames: new Set(),
			clientLeTrucNames: new Set(),
			plainLocalNames: new Set(),
		},
	}
	const result: CompileFileResult = compileFromIR(
		component,
		[],
		routingSignals,
		filename,
		new Set(),
		undefined,
		undefined,
		DEFAULT_EMIT_PATHS,
	)
	return result
}
`

/**
 * The scratch runner: compiles the toy source in all three tiers plus both
 * refusal shapes, asserts the designed outcome of each, and reports.
 */
const RUNNER = `
import { compileToy } from './front-end'

const assert = (condition, label) => {
	if (!condition) throw new Error('contract check failed: ' + label)
	console.log('  ok: ' + label)
}

// 1. Folded: no signals, three artifacts, registry entry.
const folded = compileToy(
	'component toy-greeting "Hello from the toy front end"',
	'toy-greeting.toy',
)
assert(folded.component !== null, 'folded: component compiled')
assert(folded.component?.entry.tier === 'folded', 'folded: tier is folded')
assert(folded.component?.entry.tag === 'toy-greeting', 'folded: entry carries the tag')
assert(
	(folded.component?.serverCode.includes('toy-greeting') ?? false) &&
		(folded.component?.clientCode.includes('defineComponent') ?? false) &&
		folded.component?.css === '',
	'folded: three artifacts produced',
)
assert(folded.diagnostics.length === 0, 'folded: no diagnostics')

// 2. Simulated: a realm-answerable refusal routes down one step.
const simulated = compileToy(
	'component toy-panel frame "reads element layout"',
	'toy-panel.toy',
)
assert(simulated.component?.entry.tier === 'simulated', 'simulated: tier is simulated')
assert(
	simulated.component?.entry.routingSignals[0]?.resolution.by === 'realm',
	'simulated: realm-answerable signal recorded',
)

// 3. Static: an unresolvable refusal routes past the realm entirely.
const statik = compileToy(
	'component toy-clock clock "reads the wall clock"',
	'toy-clock.toy',
)
assert(statik.component?.entry.tier === 'static', 'static: tier is static')
assert(
	statik.component?.entry.routingSignals[0]?.resolution.limb === 'not-a-server-fact',
	'static: unresolvable signal recorded',
)

// 4. The diagnostic refusal: component null, the diagnostic carried through.
const refused = compileToy('component broken @@@ ""', 'broken.toy')
assert(refused.component === null, 'refused: no component on refusal')
assert(
	refused.diagnostics[0]?.code === 'LTC005' && refused.diagnostics[0]?.severity === 'error',
	'refused: real error diagnostic carried through',
)

console.log('contract check: toy front end compiled end-to-end through the designated contract surface')
`

/* === Main === */

const workDir = mkdtempSync(join(tmpdir(), 'le-truc-contract-'))
const keep = process.argv.includes('--keep')

try {
	writeFileSync(join(workDir, 'front-end.ts'), FRONT_END)
	writeFileSync(join(workDir, 'run.ts'), RUNNER)
	const run = Bun.spawnSync(['bun', 'run.ts'], {
		cwd: workDir,
		env: { ...process.env, NODE_ENV: 'production' },
	})
	const stdout = run.stdout.toString()
	if (stdout.trim()) console.log(stdout.trimEnd())
	if (run.exitCode !== 0) {
		console.error(`✗ scratch front end exited ${run.exitCode}`)
		console.error(run.stderr.toString().split('\n').slice(-20).join('\n'))
		process.exitCode = 1
	} else if (
		!stdout.includes(
			'contract check: toy front end compiled end-to-end through the designated contract surface',
		)
	) {
		console.error('✗ scratch front end did not report the contract summary')
		process.exitCode = 1
	} else {
		console.log(
			`\n✓ front-end contract holds: one toy syntax, three tiers, both refusal channels — imported through server/compiler/contract.ts only`,
		)
	}
} finally {
	if (keep) console.log(`\nkept: ${workDir}`)
	else rmSync(workDir, { recursive: true, force: true })
}
