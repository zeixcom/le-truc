/**
 * Coverage tests for the .tsrx ambient globals (LT-004, ADR 0023 sub-design 6):
 *
 * 1. Parity — every identifier the compiler recognizes as an ambient (signal
 *    constructors, context names, parser factories, `expose`, `defineMethod`,
 *    `FormAssociatedElement`) is declared in server/compiler/frontend/tsrx/globals.d.ts, and
 *    the file declares nothing outside that vocabulary.
 * 2. Barrel parity — every recognized-name set that names `@zeix/le-truc`
 *    value exports is pinned against the package barrel (LT-232): subsets
 *    type-level and at runtime, `REAL_EXPORT_NAMES` exactly.
 * 3. Typecheck — a probe using the full ambient vocabulary (including
 *    `FormAssociatedElement` referenced without import in a `declare global`)
 *    compiles against the globals file alone.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ComponentProps, FactoryContext } from '@zeix/le-truc'
import * as barrel from '@zeix/le-truc'
import {
	CONTEXT_NAMES,
	FACTORY_CONTEXT_MEMBER_NAMES,
	FACTORY_CONTEXT_MEMBERS,
	MUTABLE_SIGNAL_CONSTRUCTOR_NAMES,
	MUTABLE_SIGNAL_CONSTRUCTORS,
	PARSER_FACTORIES,
	PARSER_FACTORY_NAMES,
	REAL_EXPORT_NAMES,
	SIGNAL_CONSTRUCTOR_NAMES,
	SIGNAL_CONSTRUCTORS,
} from '../../compiler/vocabulary'
import { createGeneratedDir } from '../helpers/generated-corpus'

const ROOT = path.resolve(import.meta.dir, '../../..')
const GLOBALS = fs.readFileSync(
	path.join(ROOT, 'server/compiler/frontend/tsrx/globals.d.ts'),
	'utf8',
)

// The probe is emitted into a per-run directory, not the build pipeline's
// own output (LT-140).
const generated = createGeneratedDir('globals')
afterAll(() => generated.cleanup())

const declaredConsts = [...GLOBALS.matchAll(/^declare const (\w+)/gm)].map(
	m => m[1] as string,
)
const declaredTypes = [...GLOBALS.matchAll(/^type (\w+)/gm)].map(
	m => m[1] as string,
)

describe('globals.d.ts — ambient vocabulary parity with the compiler', () => {
	test('every recognized ambient is declared', () => {
		// Sub-design 16: the ambient vocabulary is exactly the
		// FactoryContext members plus the context names — real package
		// exports (signal constructors, parsers, defineMethod) are NOT
		// ambient anymore; authored sources import them explicitly.
		const required = [...FACTORY_CONTEXT_MEMBER_NAMES, ...CONTEXT_NAMES]
		for (const name of required) expect(declaredConsts).toContain(name)
		expect(declaredTypes).toContain('FormAssociatedElement')
	})

	test('the file declares nothing outside the recognized vocabulary', () => {
		const allowed = new Set<string>([
			...FACTORY_CONTEXT_MEMBER_NAMES,
			...CONTEXT_NAMES,
		])
		const stray = declaredConsts.filter(name => !allowed.has(name))
		expect(stray).toEqual([])
	})

	test('FACTORY_CONTEXT_MEMBERS are real FactoryContext members and never module imports (LT-041)', () => {
		// Type-level subset assertion: compiles only while every listed
		// member is a key of the REAL FactoryContext — a rename/removal in
		// @zeix/le-truc fails the standing tsc gate instead of silently
		// mis-splitting the generated client's context vs import lists.
		type IsSubset = [(typeof FACTORY_CONTEXT_MEMBER_NAMES)[number]] extends [
			keyof FactoryContext<ComponentProps>,
		]
			? true
			: false
		const assertSubset: IsSubset = true
		expect(assertSubset).toBe(true)
		// Channel split: a destructured context member is never a signal
		// constructor or parser factory (those import from '@zeix/le-truc').
		const mischanneled = [...FACTORY_CONTEXT_MEMBERS].filter(
			m => SIGNAL_CONSTRUCTORS.has(m) || PARSER_FACTORIES.has(m),
		)
		expect(mischanneled).toEqual([])
		// The one deliberate overlap with the ambient vocabulary: `expose` is
		// both a declared ambient (raw sources call it unqualified) and a
		// destructured context member in the generated client.
		expect(FACTORY_CONTEXT_MEMBERS.has('expose')).toBe(true)
		expect(declaredConsts).toContain('expose')
	})
})

describe('vocabulary — name-set parity with the @zeix/le-truc barrel (LT-232)', () => {
	const barrelExports = Object.keys(barrel).sort()

	test('signal constructors and parser factories are real barrel exports', () => {
		// Type-level: a rename/removal in the barrel fails the tsc gate.
		type Exported = keyof typeof barrel
		type IsSubset = [
			| (typeof SIGNAL_CONSTRUCTOR_NAMES)[number]
			| (typeof PARSER_FACTORY_NAMES)[number],
		] extends [Exported]
			? true
			: false
		const assertSubset: IsSubset = true
		expect(assertSubset).toBe(true)
		for (const name of [...SIGNAL_CONSTRUCTORS, ...PARSER_FACTORIES])
			expect(barrelExports).toContain(name)
	})

	test('mutable signal constructors are a subset of the signal constructors', () => {
		const stray = [...MUTABLE_SIGNAL_CONSTRUCTORS].filter(
			name => !SIGNAL_CONSTRUCTORS.has(name),
		)
		expect(stray).toEqual([])
		expect(MUTABLE_SIGNAL_CONSTRUCTORS.size).toBe(
			MUTABLE_SIGNAL_CONSTRUCTOR_NAMES.length,
		)
	})

	test('REAL_EXPORT_NAMES equals the barrel value exports', () => {
		expect([...REAL_EXPORT_NAMES].sort()).toEqual(barrelExports)
	})

	test('the ambient vocabulary is disjoint from the real exports', () => {
		// Sub-design 16: FactoryContext members and context names are never
		// module imports, so no barrel export may share a name with them.
		const overlap = [...FACTORY_CONTEXT_MEMBERS, ...CONTEXT_NAMES].filter(
			name => REAL_EXPORT_NAMES.has(name),
		)
		expect(overlap).toEqual([])
	})
})

describe('globals.d.ts — probe typechecks against the ambients alone', () => {
	test('full vocabulary probe compiles', async () => {
		const probePath = generated.emit(
			'globals-probe.ts',
			[
				// Sub-design 16: real exports are imported explicitly…
				"import { asBoolean, asEnum, asInteger, asJSON, asNumber, asString, createCell, createContext, defineMethod } from '@zeix/le-truc'",
				'const count = createCell(0)',
				"const theme = requestContext(createContext<() => string>('theme'), 'light')",
				'provideContexts([])',
				'expose({',
				"\tvalue: asString(''),",
				'\tn: asInteger(0),',
				'\tx: asNumber(0),',
				'\tb: asBoolean(false),',
				"\te: asEnum(['a', 'b']),",
				'\tj: asJSON({}),',
				'\tclear: defineMethod(() => {',
				"\t\thost.value = ''",
				"\t\tinternals?.states.add('clearable')",
				'\t}),',
				'\tcount: count.get,',
				'\ttheme: theme.get,',
				'})',
				// …while the FactoryContext vocabulary stays ambient.
				"const clearBtn = first('button')",
				"const items = all('li')",
				"on(clearBtn ?? host, 'click', () => count.set(0))",
				'watch(count, v => { host.dataset.count = String(v) })',
				'void [items]',
				'declare global {',
				'\tinterface HTMLElementTagNameMap {',
				"\t\t'probe-el': FormAssociatedElement & { value: string }",
				'\t}',
				'}',
				'export {}',
			].join('\n'),
		)
		const proc = Bun.spawn(
			[
				'bunx',
				'tsc',
				'--ignoreConfig',
				'--noEmit',
				'--strict',
				'--target',
				'esnext',
				'--module',
				'esnext',
				'--moduleResolution',
				'bundler',
				'--lib',
				'esnext,dom',
				'--skipLibCheck',
				path.join(ROOT, 'server/compiler/frontend/tsrx/globals.d.ts'),
				probePath,
			],
			{ stdout: 'pipe', stderr: 'pipe', cwd: ROOT },
		)
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		])
		expect(`${stdout}${stderr}`).toBe('')
		expect(exitCode).toBe(0)
	}, 60000)
})
