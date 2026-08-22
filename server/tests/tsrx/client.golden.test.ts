/**
 * Golden tests — client half (LT-002): the generated `defineComponent()`
 * modules must equal the committed snapshots (regenerate with
 * `UPDATE_SNAPSHOTS=1 bun test server/tests/tsrx` or
 * `bun server/tests/tsrx/update-snapshots.ts`) and must typecheck against
 * the real `@zeix/le-truc` types — emit-then-check, the CI half of ADR
 * 0023 sub-design 6.
 *
 * The snapshots ARE the convergence evidence from
 * spike/tsrx-phase0/expected/unified-lowerings.md: statement-for-statement
 * today's hand-written components, imports solely from '@zeix/le-truc'.
 */
import { describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { compileComponent } from '../../tsrx'

const ROOT = path.resolve(import.meta.dir, '../../..')
const read = (rel: string): string =>
	fs.readFileSync(path.isAbsolute(rel) ? rel : path.join(ROOT, rel), 'utf8')

const registry = new Set<string>(['basic-counter', 'module-tabgroup'])
const SOURCES = [
	'examples/basic/counter/basic-counter.tsrx',
	'examples/module/tabgroup/module-tabgroup.tsrx',
] as const

const compiled = SOURCES.map(rel => ({
	rel,
	result: compileComponent(read(rel), rel, registry),
}))

describe('client golden — generated modules match snapshots', () => {
	for (const { rel, result } of compiled) {
		test(`${rel} → snapshot`, () => {
			const { component, diagnostics } = result
			for (const d of diagnostics)
				console.warn(`[${d.code}] ${d.message}`)
			if (!component) throw new Error(`${rel} did not compile`)
			const snapshotPath = path.join(
				ROOT,
				'server/tests/tsrx/snapshots',
				`${component.entry.tag}.client.ts.snap`,
			)
			if (process.env.UPDATE_SNAPSHOTS === '1') {
				fs.mkdirSync(path.dirname(snapshotPath), { recursive: true })
				fs.writeFileSync(snapshotPath, component.clientCode)
				console.log(`updated ${snapshotPath}`)
			}
			expect(component.clientCode).toBe(read(snapshotPath))
		})
	}
})

describe('client golden — convergence with the hand-written trio', () => {
	test('basic-counter: same seed, handler, and binding as the hand-written component', () => {
		const code = compiled[0]?.result.component?.clientCode ?? ''
		expect(code).toContain("import { asInteger, bindText, createCell, defineComponent } from '@zeix/le-truc'")
		expect(code).toContain("first('span'")
		expect(code).toContain('createCell(asInteger()(span.textContent))')
		expect(code).toContain("on(button, 'click', () => count.set(count.get() + 1))")
		expect(code).toContain('watch(count, bindText(span))')
	})

	test('module-tabgroup: DOM-seeded selection, per-tab effects, hoisted-const rebinding', () => {
		const code = compiled[1]?.result.component?.clientCode ?? ''
		expect(code).toContain("all('button[role=\"tab\"]'")
		expect(code).toContain("all('[role=\"tabpanel\"]'")
		expect(code).toContain(
			"tabs.get().find(el => el.ariaSelected === 'true')?.getAttribute('aria-controls') ?? ''",
		)
		expect(code).toContain("each(tabs, tab => {")
		expect(code).toContain("const pid = tab.getAttribute('aria-controls')!")
		expect(code).toContain(
			"watch(() => String(selected.get() === pid), bindAttribute(tab, 'aria-selected'))",
		)
		expect(code).toContain("on(tab, 'click', () => selected.set(pid))")
		expect(code).toContain('const pid = tab.id')
		expect(code).toContain(
			'watch(() => selected.get() !== pid, bindAttribute(tab, \'hidden\'))',
		)
	})

	test('registry entry records both halves', () => {
		for (const { result } of compiled) {
			const entry = result.component?.entry
			expect(entry?.serverModule).toMatch(/\.server\.ts$/)
			expect(entry?.clientModule).toMatch(/\.client\.ts$/)
			expect(entry?.css).toMatch(/\.css$/)
		}
	})
})

describe('client golden — emit-then-check (ADR 0023 sub-design 6)', () => {
	test('generated client modules typecheck against @zeix/le-truc', async () => {
		const files: string[] = []
		for (const { result } of compiled) {
			const component = result.component
			if (!component) throw new Error('corpus must compile')
			const out = path.join(
				ROOT,
				'server/generated/tsrx',
				component.entry.clientModule,
			)
			fs.mkdirSync(path.dirname(out), { recursive: true })
			fs.writeFileSync(out, component.clientCode)
			files.push(out)
		}
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
				...files,
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
