/**
 * The designated export surface pin (LT-265, ADR 0032 amended 2026-09-19).
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

const DESIGNATED_VALUES = [
	'DEFAULT_EMIT_PATHS',
	'compileComponentTsx',
	'compileFromIR',
].sort()

const DESIGNATED_TYPES = [
	'AstNode',
	'AttributeIR',
	'CompileDiagnostic',
	'CompiledComponent',
	'CompileFileResult',
	'ComponentIR',
	'ComponentParam',
	'ComposeAttrIR',
	'ConfigIR',
	'DiagnosticCode',
	'EachForIR',
	'EmitPaths',
	'EvaluationTier',
	'ExposeKind',
	'ForIR',
	'PassEntryIR',
	'ReconcileForIR',
	'RegistryEntry',
	'Resolution',
	'RoutingSignal',
	'RoutingSignalOrigin',
	'SetupStmt',
	'SignalConstructor',
	'SignalIR',
	'SourceRange',
	'SourceSpan',
	'TemplateNode',
	'UnresolvableLimb',
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
