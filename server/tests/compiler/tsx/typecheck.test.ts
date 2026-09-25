/**
 * The typed `.tsx` ambient gate (LT-208, LT-209): tsc over the authored
 * `.tsx` sources against `host-profile.d.ts`.
 *
 * The POSITIVE config (`server/tests/compiler/fixtures/tsx/tsconfig.json`)
 * must compile clean — the synthetic fixtures under the precise
 * `FactoryContext` parameter convention and the branded
 * `IntrinsicElements['truc:try']` arms (ADR 0041). The NEGATIVE config (`fixtures/tsx/tsconfig.neg.json`) must fail with exactly the mistyped-arm
 * diagnostics the ambients exist to surface, at native positions on the
 * authored files (the ADR 0032 s3 dividend — no span remapping needed).
 *
 * The EXAMPLES config (`examples/tsconfig.json`, LT-285, LT-237) typechecks
 * every `.tsx` variant-set member in `examples/` — with basic-counter's
 * hand-written `.ts` twin in the same program. Under ADR 0039 s4 every
 * member declares its own `HTMLElementTagNameMap` entry, so this program is
 * the cross-spelling Props-drift gate: a `.tsx` Props type diverging from
 * the twin's fails with TS 2717 here.
 *
 * This is the standing CI form of the LT-183 spike's manual
 * `tsconfig.neg.json` probes; `check:corpus` is the corpus-side analog.
 */
import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import * as path from 'node:path'

// Three cold `tsc -p` runs per file — well over the 5s default on a cold
// cache, comfortably under a minute.
setDefaultTimeout(60_000)

const ROOT = path.resolve(import.meta.dir, '../../../..')
const FIXTURES = path.join(ROOT, 'server/tests/compiler/fixtures/tsx')

const runTsc = (config: string): { status: number; output: string } => {
	const proc = spawnSync(
		'bunx',
		['tsc', '-p', config, '--noEmit', '--pretty', 'false'],
		{
			cwd: ROOT,
			encoding: 'utf8',
		},
	)
	return {
		status: proc.status ?? -1,
		output: `${proc.stdout ?? ''}${proc.stderr ?? ''}`,
	}
}

describe('the .tsx host profile typecheck (LT-208, LT-209)', () => {
	test('the synthetic fixtures compile clean under the typed ambients', () => {
		const { status, output } = runTsc(path.join(FIXTURES, 'tsconfig.json'))
		expect(output).toBe('')
		expect(status).toBe(0)
	})

	test('the negative probes fail at native positions on the authored file', () => {
		const { status, output } = runTsc(path.join(FIXTURES, 'tsconfig.neg.json'))
		// The string `pending` arm: the branded JSX.Element rejects it — the
		// generic-`T` shape the ruling rejected would have union-absorbed it.
		expect(output).toContain(
			"async-bad-arms.tsx(24,14): error TS2322: Type 'string' is not assignable to type 'Element'",
		)
		// The mistyped `catch` annotation: the contextual Error parameter
		// makes both the annotation and the `.message` read errors.
		expect(output).toContain(
			"async-bad-arms.tsx(24,29): error TS2322: Type '(e: string) => JSX.Element' is not assignable to type '(error: Error) => Element'",
		)
		expect(output).toContain(
			"async-bad-arms.tsx(24,57): error TS2339: Property 'message' does not exist on type 'string'",
		)
		// A repeated arm: attributes make arm uniqueness tsc's (LT-303).
		expect(output).toContain(
			'async-bad-arms.tsx(27,46): error TS17001: JSX elements cannot have multiple attributes with the same name',
		)
		// The typed context parameter (LT-209): a typo'd host read and a
		// mistyped expose() key — the free P-drift check — are errors at
		// native positions in the ordinary tsconfig.
		expect(output).toContain(
			"bad-host-typo.tsx(29,11): error TS2561: Object literal may only specify known properties, but 'valuee' does not exist in type 'Initializers<BadHostProps>'",
		)
		expect(output).toContain(
			"bad-host-typo.tsx(33,29): error TS2339: Property 'cout' does not exist on type 'FormAssociatedValueElement & BadHostProps'",
		)
		expect(status).not.toBe(0)
	})

	test('the examples variant-set members typecheck — every member declares the tag-map entry (LT-285, LT-237, ADR 0039 s4)', () => {
		// basic-counter's twin and `.tsx` each declare the entry in one
		// program. Verified live (LT-237, temporary divergence): structurally
		// IDENTICAL entries merge silently, and the moment the spellings'
		// Props types diverge, the second fails with TS 2717 naming the
		// offending member.
		const { status, output } = runTsc(path.join(ROOT, 'examples/tsconfig.json'))
		expect(output).toBe('')
		expect(status).toBe(0)
	})
})
