/**
 * The simulation seam holds (ADR 0035 sub-designs 3 and 4, LT-263).
 *
 * `bun run check:nosubstrate` proves the same property properly — it
 * typechecks the compiler with jsdom uninstalled — but only when jsdom is
 * genuinely absent, which a developer's tree and this test suite never are.
 * So the edge is also read directly here, where it costs milliseconds and
 * fails the moment someone reaches behind the seam.
 *
 * The rule: **nothing compiler-side may import the driver or its substrate.**
 * The one permitted edge is `simulation/resolve.ts`'s dynamic import, whose
 * specifier is a variable precisely so the typechecker does not follow it.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { Glob } from 'bun'

const ROOT = join(import.meta.dir, '..', '..', '..')
const COMPILER = join(ROOT, 'server', 'compiler')
const EFFECTS = join(ROOT, 'server', 'effects')

/**
 * Every module on the compiler side of the seam — the whole compiler with
 * the driver's own directory excluded, plus the build effects, since
 * `effects/simulate.ts` is the seam's one real consumer and is exactly where
 * a shortcut back to `realm.document` would reappear.
 */
const compilerSources = (): string[] => [
	...[...new Glob('**/*.ts').scanSync(COMPILER)]
		.filter(file => !file.startsWith('sim/'))
		.map(file => join(COMPILER, file)),
	...[...new Glob('**/*.ts').scanSync(EFFECTS)].map(file =>
		join(EFFECTS, file),
	),
]

/** Static import/export specifiers, which are the ones tsc follows. */
const staticSpecifiers = (source: string): string[] =>
	[
		...source.matchAll(/(?:^|\n)\s*(?:import|export)[^\n]*?from\s*'([^']+)'/g),
	].map(match => match[1] as string)

describe('the simulation seam (ADR 0035 s3)', () => {
	test('no compiler-side module imports jsdom', () => {
		const offenders = compilerSources().filter(file =>
			staticSpecifiers(readFileSync(file, 'utf8')).includes('jsdom'),
		)
		expect(offenders.map(file => relative(ROOT, file))).toEqual([])
	})

	test('no compiler-side module imports the driver', () => {
		const offenders: string[] = []
		for (const file of compilerSources())
			for (const specifier of staticSpecifiers(readFileSync(file, 'utf8')))
				if (/(^|\/)sim\//.test(specifier))
					offenders.push(`${relative(ROOT, file)} → ${specifier}`)
		expect(offenders).toEqual([])
	})

	test('the resolver reaches the driver through an opaque specifier', () => {
		// A literal would make tsc follow the edge into jsdom and defeat the
		// whole seam, so the indirection is load-bearing rather than stylistic.
		const source = readFileSync(
			join(COMPILER, 'simulation', 'resolve.ts'),
			'utf8',
		)
		expect(source).toContain('await import(SIMULATION_DRIVER)')
		expect(staticSpecifiers(source)).not.toContain('../sim/index.ts')
	})

	test('the contract names no DOM or substrate type', () => {
		const source = readFileSync(
			join(COMPILER, 'simulation', 'contract.ts'),
			'utf8',
		)
		// Comments explain why these are absent; the code must not use them.
		const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
		for (const banned of [
			'JSDOM',
			'Document',
			'Element',
			'CustomElementConstructor',
		])
			expect(code).not.toContain(banned)
		expect(staticSpecifiers(source)).toEqual([])
	})
})
