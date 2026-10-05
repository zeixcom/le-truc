/**
 * Module-level type declarations reach both generated modules, exported or
 * not (LT-439). A module-local `type`/`interface` naming a setup
 * declaration's type — an item shape for `createList<Task, …>`, a plain
 * annotation — was dropped from the client and server module alike (only
 * `export`ed ones were carried), so the generated code named a type it never
 * declared. Pinned on both surfaces, under `check:corpus`'s tsc flags.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { createGeneratedDir } from '../helpers/generated-corpus'

const ROOT = path.resolve(import.meta.dir, '../../..')

const DECLS = `import { createList, createStore, type MutableStore } from '@zeix/le-truc'

type ProbeTask = { id: string; label: string }
interface ProbeNote {
	text: string
}`

const LIST = `createList<ProbeTask, MutableStore<ProbeTask>>(
		[{ id: 'a', label: 'A' }],
		{ keyConfig: t => t.id, createItem: createStore },
	)`

const FIXTURES = {
	'type-probe-tsrx': {
		surface: 'tsrx',
		source: `${DECLS}

export function TypeProbeTsrx({}: {})
	@{
		const items = ${LIST}
		const note: ProbeNote = { text: 'n' }
		<type-probe-tsrx>
			<p>{note.text}</p>
			<ul>
				@for (const task of items; key k) {
					<li>{task.label.get()}</li>
				}
			</ul>
		</type-probe-tsrx>
	}
`,
	},
	'type-probe-tsx': {
		surface: 'tsx',
		source: `${DECLS}

export function TypeProbeTsx({}: {}) {
	const items = ${LIST}
	const note: ProbeNote = { text: 'n' }
	return (
		<type-probe-tsx>
			<p>{note.text}</p>
			<ul>{items.map((task, k) => <li>{task.label.get()}</li>)}</ul>
		</type-probe-tsx>
	)
}
`,
	},
} as const

const generated = createGeneratedDir('module-type-decls')
afterAll(() => generated.cleanup())

const compiled = new Map<string, { clientCode: string; serverCode: string }>()
for (const [tag, fixture] of Object.entries(FIXTURES)) {
	const registry = new Set([tag])
	const { component, diagnostics } =
		fixture.surface === 'tsrx'
			? compileComponent(fixture.source, `${tag}.tsrx`, registry)
			: compileComponentTsx(fixture.source, `${tag}.tsx`, registry)
	const errors = diagnostics.filter(d => d.severity === 'error')
	if (!component || errors.length > 0)
		throw new Error(`${tag}: ${errors.map(d => d.message).join('; ')}`)
	generated.emit(`${tag}.client.ts`, component.clientCode)
	generated.emit(`${tag}.server.ts`, component.serverCode)
	compiled.set(tag, component)
}

describe('module-local type declarations (LT-439)', () => {
	for (const tag of Object.keys(FIXTURES)) {
		test(`${tag}: both modules carry the type and the interface`, () => {
			const component = compiled.get(tag)
			for (const code of [component?.clientCode, component?.serverCode]) {
				expect(code).toContain('type ProbeTask = { id: string; label: string }')
				expect(code).toContain('interface ProbeNote {')
			}
		})
	}

	test('the generated modules typecheck on both surfaces', () => {
		const proc = Bun.spawnSync(
			[
				'bunx',
				'tsc',
				'--ignoreConfig',
				'--noEmit',
				'--pretty',
				'false',
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
				'--types',
				'node',
				...[...compiled.keys()].flatMap(tag => [
					path.join(generated.relativePath, `${tag}.client.ts`),
					path.join(generated.relativePath, `${tag}.server.ts`),
				]),
			],
			{ cwd: ROOT },
		)
		expect(proc.stdout.toString().trim()).toBe('')
		expect(proc.exitCode).toBe(0)
	})
})
