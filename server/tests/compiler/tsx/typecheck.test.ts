/**
 * The typed `.tsx` ambient gate (LT-208, LT-209): tsc over the authored
 * spike fixtures against `host-profile.d.ts`.
 *
 * The POSITIVE config (`spike/tsx/tsconfig.json`) must compile clean — six
 * fixtures under the precise `FactoryContext` parameter convention and the
 * branded three-arm `boundary`. The NEGATIVE config
 * (`spike/tsx/tsconfig.neg.json`) must fail with exactly the mistyped-arm
 * diagnostics the ambients exist to surface, at native positions on the
 * authored files (the ADR 0032 s3 dividend — no span remapping needed).
 *
 * This is the standing CI form of the spike's manual `tsconfig.neg.json`
 * probes; `check:tsrx` is the corpus-side analog.
 */
import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import * as path from 'node:path'

// Two cold `tsc -p` runs per test — well over the 5s default on a cold
// cache, comfortably under a minute.
setDefaultTimeout(60_000)

const ROOT = path.resolve(import.meta.dir, '../../../..')
const SPIKE = path.join(ROOT, 'spike/tsx')

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
	test('the six fixtures compile clean under the typed ambients', () => {
		const { status, output } = runTsc(path.join(SPIKE, 'tsconfig.json'))
		expect(output).toBe('')
		expect(status).toBe(0)
	})

	test('the negative probes fail at native positions on the authored file', () => {
		const { status, output } = runTsc(path.join(SPIKE, 'tsconfig.neg.json'))
		// The string arm: the branded JSX.Element rejects it — the
		// generic-`T` shape the ruling rejected would have union-absorbed it.
		expect(output).toContain(
			"async-bad-arms.tsx(23,5): error TS2322: Type 'string' is not assignable to type 'Element'",
		)
		// The mistyped err annotation: the contextual Error parameter makes
		// both the annotation and the `.message` read errors.
		expect(output).toContain(
			"async-bad-arms.tsx(24,31): error TS2339: Property 'message' does not exist on type 'string'",
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
})
