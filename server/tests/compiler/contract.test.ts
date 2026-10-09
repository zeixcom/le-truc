/**
 * The designated export surface pin (LT-265, ADR 0032 amended 2026-09-19;
 * reshaped to the D-32 ruling at LT-480).
 *
 * `server/compiler/contract.ts` names the exact symbol set the published
 * `@zeix/le-truc-compiler` package will carry (`exports` entry rides LT-254).
 * These tests make widening or shrinking that set a DELIBERATE act: the value
 * set is pinned at runtime, and the type set — erased at runtime — is pinned
 * textually against the module's own `export type` re-export statements.
 * Both lists below must change in the same commit as the module and its
 * stability policy, and the change is a public-API decision (minor or major
 * per the policy, never a patch).
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import * as designated from '../../compiler/contract'

/** The one published entry point: the corpus pass (D-32). */
const DESIGNATED_VALUES = ['compileCorpus'].sort()

/**
 * The D-32 set: the corpus entry point's exchange types, the public
 * `RegistryEntry` projection and its `ExposeKind` vocabulary, the five
 * diagnostic record shapes, and `EvaluationTier` (the registry entry's
 * `tier`). The per-file front end (`compileComponentTsx`,
 * `CompileFileResult`, `CompiledComponent`, `SourceSpan`, `EmitPaths`,
 * `DEFAULT_EMIT_PATHS`) left with LT-480, as did `HandlerPlacement`
 * (handler args are internal, ruling 4) and the `RoutingSignal` family —
 * no public type names them once `routingSignals` left `RegistryEntry`.
 */
const DESIGNATED_TYPES = [
	'CompileDiagnostic',
	'CorpusConfig',
	'CorpusConfigInput',
	'CorpusResult',
	'CorpusSummary',
	'DiagnosticCode',
	'DiagnosticEdit',
	'DiagnosticFix',
	'DiagnosticLocation',
	'EvaluationTier',
	'ExposeKind',
	'RegistryEntry',
].sort()

describe('designated export surface', () => {
	test('runtime exports are exactly the named value set', () => {
		expect(Object.keys(designated).sort()).toEqual(DESIGNATED_VALUES)
	})

	test('type re-exports are exactly the named type set', () => {
		const source = readFileSync(
			new URL('../../compiler/contract.ts', import.meta.url),
			'utf8',
		)
		const names = [...source.matchAll(/export type \{([^}]+)\}/g)].flatMap(
			match => (match[1] ?? '').split(',').map(name => name.trim()),
		)
		expect(names.filter(Boolean).sort()).toEqual(DESIGNATED_TYPES)
	})
})
