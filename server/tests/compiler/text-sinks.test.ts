/**
 * Text positions take primitives, through TypeScript (ADR 0046 s6, LT-428).
 *
 * Every text sink the compiler emits is typed: the server's `text`/`textOf`
 * harness calls take `string | number | null | undefined`, the client's
 * `bindText` takes `string | number`. An object or a boolean reaching a text
 * position is therefore a tsc error in both generated modules, and the span
 * tables locate it at the authored child — the emit-then-check pass
 * `check:corpus` runs, reproduced here per fixture on both surfaces.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { compileComponent } from '../../compiler/frontend/tsrx'
import { compileComponentTsx } from '../../compiler/frontend/tsx'
import { esc, text, textOf } from '../../compiler/runtime'
import {
	fileLineColToOffset,
	fileOffsetToLineCol,
	findSpanForGeneratedOffset,
	type SourceSpan,
} from '../../compiler/spans'
import { createGeneratedDir } from '../helpers/generated-corpus'

const ROOT = path.resolve(import.meta.dir, '../../..')

const pascal = (tag: string): string =>
	tag.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase())

const tsrx = (tag: string, imports: string, setup: string, body: string) =>
	`import { ${imports} } from '@zeix/le-truc'
export function ${pascal(tag)}({}: {})
	@{
		${setup}
		expose({})
		<${tag}>
			${body}
		</${tag}>
	}`

const tsx = (tag: string, imports: string, setup: string, body: string) =>
	`import { ${imports} } from '@zeix/le-truc'
export function ${pascal(tag)}({}: {}) {
	${setup}
	expose({})
	return (
		<${tag}>
			${body}
		</${tag}>
	)
}`

type Fixture = {
	surface: 'tsrx' | 'tsx'
	source: string
	/** The authored child the errors must be reported at. */
	child: string | null
}

const OBJECT_LIST = `const items = createList<{ label: string }>([{ label: 'a' }])`
const ASYNC_OBJECT = `const data = deriveCell(async () => ({ label: 'a' }))`

const FIXTURES: Record<string, Fixture> = {
	'c-obj-tsrx': {
		surface: 'tsrx',
		source: tsrx(
			'c-obj-tsrx',
			'createList',
			OBJECT_LIST,
			`<ul data-container>
				@for (const item of items; key k) {
					<li><span>{item}</span></li>
				}
			</ul>`,
		),
		child: '{item}',
	},
	'c-obj-tsx': {
		surface: 'tsx',
		source: tsx(
			'c-obj-tsx',
			'createList',
			OBJECT_LIST,
			`<ul data-container>
				{items.map(item => (
					<li><span>{item}</span></li>
				))}
			</ul>`,
		),
		child: '{item}',
	},
	'c-bool-tsrx': {
		surface: 'tsrx',
		source: tsrx(
			'c-bool-tsrx',
			'createState',
			'const done = createState(false)',
			'<span>{done}</span>',
		),
		child: '{done}',
	},
	'c-bool-tsx': {
		surface: 'tsx',
		source: tsx(
			'c-bool-tsx',
			'createState',
			'const done = createState(false)',
			'<span>{() => done.get()}</span>',
		),
		child: '{() => done.get()}',
	},
	'c-async-tsrx': {
		surface: 'tsrx',
		source: tsrx(
			'c-async-tsrx',
			'deriveCell',
			ASYNC_OBJECT,
			`<div class="frame">@try {
				<div class="ok">{data}</div>
			} @pending {
				<p class="wait">…</p>
			} @catch (e) {
				<p class="err">{e.message}</p>
			}</div>`,
		),
		child: '{data}',
	},
	'c-async-tsx': {
		surface: 'tsx',
		source: tsx(
			'c-async-tsx',
			'deriveCell',
			ASYNC_OBJECT,
			`<div class="frame"><truc:try
				pending={<p class="wait">…</p>}
				catch={e => <p class="err">{e.message}</p>}
			>
				<div class="ok">{data}</div>
			</truc:try></div>`,
		),
		child: '{data}',
	},
	'c-error-tsrx': {
		surface: 'tsrx',
		source: tsrx(
			'c-error-tsrx',
			'deriveCell',
			"const data = deriveCell(async () => 'x')",
			`<div class="frame">@try {
				<div class="ok">{data}</div>
			} @pending {
				<p class="wait">…</p>
			} @catch (e) {
				<p class="err">{e}</p>
			}</div>`,
		),
		child: '{e}',
	},
	// A ternary for a boolean — one of the fixes the sink's JSDoc names (a
	// list item's field waits on ADR 0046 s1) — and a comment child: clean.
	'c-fixed-tsrx': {
		surface: 'tsrx',
		source: tsrx(
			'c-fixed-tsrx',
			'createState',
			'const done = createState(false)',
			`<span>{() => (done.get() ? 'Done' : 'Open')}</span>
			<p>{/* a comment renders nothing */}</p>`,
		),
		child: null,
	},
	'c-fixed-tsx': {
		surface: 'tsx',
		source: tsx(
			'c-fixed-tsx',
			'createState, deriveCell',
			`const done = createState(false)
	const data = deriveCell(async () => 'x')`,
			`<span>{() => (done.get() ? 'Done' : 'Open')}</span>
			<p>{/* a comment renders nothing */}</p>
			<div class="frame"><truc:try
				pending={<p class="wait">…</p>}
				catch={e => <p class="err">{e.message}</p>}
			>
				<div class="ok">{data}</div>
			</truc:try></div>`,
		),
		child: null,
	},
}

type Compiled = {
	source: string
	clientSpans: SourceSpan[]
	serverSpans: SourceSpan[]
}

const generated = createGeneratedDir('text-sinks')
afterAll(() => generated.cleanup())

const compiled = new Map<string, Compiled>()
const compileErrors: string[] = []
for (const [tag, fixture] of Object.entries(FIXTURES)) {
	const registry = new Set([tag])
	const { component, diagnostics } =
		fixture.surface === 'tsrx'
			? compileComponent(fixture.source, `${tag}.tsrx`, registry)
			: compileComponentTsx(fixture.source, `${tag}.tsx`, registry)
	const errors = diagnostics.filter(d => d.severity === 'error')
	if (!component || errors.length > 0) {
		compileErrors.push(`${tag}: ${errors.map(d => d.message).join('; ')}`)
		continue
	}
	generated.emit(`${tag}.client.ts`, component.clientCode)
	generated.emit(`${tag}.server.ts`, component.serverCode)
	compiled.set(tag, {
		source: fixture.source,
		clientSpans: component.clientSpans,
		serverSpans: component.serverSpans,
	})
}

/** Every tsc error, remapped onto its authored source like `check:corpus`. */
type Reported = { half: 'client' | 'server'; line: number; message: string }

const typecheck = (): Map<string, Reported[]> => {
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
	const byTag = new Map<string, Reported[]>()
	const pattern =
		/^.+\/(?<tag>[a-z-]+)\.(?<half>client|server)\.ts\((?<line>\d+),(?<col>\d+)\): error (?<message>TS\d+: .*)$/
	for (const raw of proc.stdout.toString().split('\n')) {
		const groups = pattern.exec(raw)?.groups
		if (!groups) continue
		const tag = groups.tag as string
		const half = groups.half as 'client' | 'server'
		const entry = compiled.get(tag)
		if (!entry) continue
		const code = readFileSync(
			path.join(generated.path, `${tag}.${half}.ts`),
			'utf8',
		)
		const offset = fileLineColToOffset(
			code,
			Number(groups.line),
			Number(groups.col),
		)
		const spans = half === 'client' ? entry.clientSpans : entry.serverSpans
		const span = findSpanForGeneratedOffset(spans, offset)
		// Exact means inside a recorded span — a fallback onto the nearest
		// earlier span would only be a guess at the line.
		const line =
			span && offset < span.generatedStart + span.length
				? fileOffsetToLineCol(
						entry.source,
						span.sourceStart + (offset - span.generatedStart),
					).line
				: -1
		const list = byTag.get(tag) ?? []
		list.push({ half, line, message: groups.message as string })
		byTag.set(tag, list)
	}
	return byTag
}

const lineOf = (source: string, needle: string): number =>
	source.slice(0, source.indexOf(needle)).split('\n').length

describe('typed text sinks (ADR 0046 s6, LT-428)', () => {
	test('every fixture compiles', () => {
		expect(compileErrors).toEqual([])
	})

	const reported = typecheck()

	for (const [tag, fixture] of Object.entries(FIXTURES)) {
		if (fixture.child === null) {
			test(`${tag}: a ternary and a comment typecheck clean`, () => {
				expect(reported.get(tag) ?? []).toEqual([])
			})
			continue
		}
		const child = fixture.child
		test(`${tag}: ${child} fails tsc at its authored line, server and client`, () => {
			const errors = reported.get(tag) ?? []
			const line = lineOf(fixture.source, child)
			for (const half of ['server', 'client'] as const) {
				const own = errors.filter(e => e.half === half)
				expect(own.length).toBeGreaterThan(0)
				for (const error of own) expect(error.line).toBe(line)
			}
		})
	}

	test('the server sink names the offending type', () => {
		const messages = (reported.get('c-obj-tsrx') ?? [])
			.filter(e => e.half === 'server')
			.map(e => e.message)
		expect(messages).toContain(
			"TS2345: Argument of type '{ label: string; }' is not assignable to parameter of type 'TextValue'.",
		)
	})
})

describe('the server text sink renders like the client', () => {
	test('a string escapes and a number stringifies', () => {
		expect(text('<b>')).toBe(esc('<b>'))
		expect(text(3)).toBe('3')
		expect(textOf(() => 0)).toBe('0')
	})

	test('nil renders empty', () => {
		expect(text(null)).toBe('')
		expect(text(undefined)).toBe('')
		expect(textOf(() => undefined)).toBe('')
	})
})
