/**
 * Coverage tests for the .tsrx ambient globals (LT-004, ADR 0023 sub-design 6):
 *
 * 1. Parity — every identifier the compiler recognizes as an ambient (signal
 *    constructors, context names, parser factories, `expose`, `defineMethod`,
 *    `FormAssociatedElement`) is declared in server/tsrx/globals.d.ts, and
 *    the file declares nothing outside that vocabulary.
 * 2. Typecheck — a probe using the full ambient vocabulary (including
 *    `FormAssociatedElement` referenced without import in a `declare global`)
 *    compiles against the globals file alone.
 */
import { describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ComponentProps, FactoryContext } from '@zeix/le-truc'
import {
	CONTEXT_NAMES,
	FACTORY_CONTEXT_MEMBER_NAMES,
	FACTORY_CONTEXT_MEMBERS,
	PARSER_FACTORIES,
	SIGNAL_CONSTRUCTORS,
} from '../../tsrx/ast-utils'

const ROOT = path.resolve(import.meta.dir, '../../..')
const GLOBALS = fs.readFileSync(
	path.join(ROOT, 'server/tsrx/globals.d.ts'),
	'utf8',
)

const declaredConsts = [...GLOBALS.matchAll(/^declare const (\w+)/gm)].map(
	m => m[1] as string,
)
const declaredTypes = [...GLOBALS.matchAll(/^type (\w+)/gm)].map(
	m => m[1] as string,
)

describe('globals.d.ts — ambient vocabulary parity with the compiler', () => {
	test('every recognized ambient is declared', () => {
		const required = [
			...SIGNAL_CONSTRUCTORS,
			...CONTEXT_NAMES,
			...PARSER_FACTORIES,
			'expose',
			'defineMethod',
		]
		for (const name of required) expect(declaredConsts).toContain(name)
		expect(declaredTypes).toContain('FormAssociatedElement')
	})

	test('the file declares nothing outside the recognized vocabulary', () => {
		const allowed = new Set<string>([
			...SIGNAL_CONSTRUCTORS,
			...CONTEXT_NAMES,
			...PARSER_FACTORIES,
			'expose',
			'defineMethod',
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

describe('globals.d.ts — probe typechecks against the ambients alone', () => {
	test('full vocabulary probe compiles', async () => {
		const probePath = path.join(ROOT, 'server/generated/tsrx/globals-probe.ts')
		fs.mkdirSync(path.dirname(probePath), { recursive: true })
		fs.writeFileSync(
			probePath,
			[
				'const count = createCell(0)',
				"const items = createList<string>([], { keyConfig: 'item' })",
				'const store = createStore({ a: 1 })',
				'const d1 = deriveCell(() => 1)',
				"const d2 = deriveList(() => ['a'])",
				'const d3 = deriveStore(() => ({ a: 1 }))',
				'expose({',
				"\tvalue: asString(''),",
				'\tn: asInteger(0),',
				'\tx: asNumber(0),',
				'\tb: asBoolean(false),',
				"\te: asEnum(['a', 'b']),",
				'\tc: asClampedInteger(0, 10),',
				'\tj: asJSON({}),',
				'\tclear: defineMethod(() => {',
				"\t\thost.value = ''",
				"\t\tinternals?.states.add('clearable')",
				'\t}),',
				'\tcount: count.get,',
				'})',
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
				path.join(ROOT, 'server/tsrx/globals.d.ts'),
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
