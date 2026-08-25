/**
 * Browser-bundle smoke test (LT-045, ADR 0025 sub-design 6): CI-pins two
 * invariants of `server/tsrx/index.ts` — the same `compileComponent` API the
 * Node-side build effect (`server/effects/tsrx.ts`) uses:
 *
 * 1. **Compiler purity** — the bundle built for `target: 'browser'` contains
 *    no surviving `node:` import (`assertNodeFree`, in the build script
 *    itself). A reintroduced Node API anywhere in the compile pipeline's
 *    import graph fails this test.
 * 2. **Artifact parity** — the two consumption contexts (Node import, browser
 *    bundle) must produce byte-identical server/client code, CSS, and span
 *    tables for the same source (ADR 0025's "Bad" tradeoff #3).
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildTsrxBrowserBundle } from '../../../scripts/build-tsrx-browser'
import { compileComponent } from '../../tsrx'

const FIXTURE = `export function C({}: {})
@{
	const color = createCell('red')
	expose({ color: color.get })
	<>
		<c-el>
			<span title={() => color.get()}>ok</span>
		</c-el>
		<style>c-el { color: red }</style>
	</>
}`

const tmpDir = mkdtempSync(join(tmpdir(), 'tsrx-browser-bundle-'))
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }))

describe('browser bundle', () => {
	test('builds and is free of node: imports (assertNodeFree, run inside buildTsrxBrowserBundle)', async () => {
		const text = await buildTsrxBrowserBundle()
		expect(text.length).toBeGreaterThan(0)
	})

	test('produces byte-identical artifacts to the Node-side compile', async () => {
		const text = await buildTsrxBrowserBundle()
		const outPath = join(tmpDir, 'index.js')
		await Bun.write(outPath, text)
		const browserModule = await import(outPath)

		const browserResult = browserModule.compileComponent(
			FIXTURE,
			'c.tsrx',
			new Set(),
		)
		const nodeResult = compileComponent(FIXTURE, 'c.tsrx', new Set())

		expect(browserResult.diagnostics).toEqual(nodeResult.diagnostics)
		if (!browserResult.component || !nodeResult.component)
			throw new Error('fixture must compile in both contexts')
		expect(browserResult.component.serverCode).toBe(
			nodeResult.component.serverCode,
		)
		expect(browserResult.component.clientCode).toBe(
			nodeResult.component.clientCode,
		)
		expect(browserResult.component.css).toBe(nodeResult.component.css)
		expect(browserResult.component.clientSpans).toEqual(
			nodeResult.component.clientSpans,
		)
		expect(browserResult.component.serverSpans).toEqual(
			nodeResult.component.serverSpans,
		)
	})

	test('a reintroduced node: import is caught (assertNodeFree unit check)', async () => {
		const { assertNodeFree } = await import(
			resolve(import.meta.dir, '../../../scripts/build-tsrx-browser')
		)
		expect(() =>
			assertNodeFree(`import { posix } from "node:path"\nposix.join('a')`),
		).toThrow(/Node import/)
		expect(() => assertNodeFree('const x = 1')).not.toThrow()
	})
})
