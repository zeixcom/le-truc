#!/usr/bin/env bun

/**
 * Browser bundle of the TSRX compiler (LT-045, ADR 0025 sub-design 6).
 *
 * `server/tsrx/index.ts` is the same pure string→string pipeline
 * (`compileComponent`) the Node-side build effect uses (LT-039–044 removed
 * the package's only Node APIs, `node:path`'s `posix` helpers, from
 * `imports.ts`) — bundling it for `target: 'browser'` is the whole job.
 * `buildTsrxBrowserBundle` is the reusable half: `server/tests/tsrx/
 * browser-bundle.test.ts` imports it to CI-pin compiler purity and
 * server/client artifact parity against the Node-side compile; running this
 * file directly additionally writes the bundle to
 * `server/generated/tsrx-browser/index.js` — the seed of the playground's
 * compile worker (ADR 0025), lazy-loadable from the docs site once that
 * lands.
 *
 * Bun's bundler silently ships a JS shim for some `node:` built-ins (e.g.
 * `node:path`) even under `target: 'browser'` — a build SUCCEEDING is not
 * proof of purity. `external: ['node:*']` disables that shimming, so a
 * reintroduced `node:` import survives into the bundled text as a literal
 * `from "node:…"` specifier (unresolvable in a real browser) instead of
 * being silently polyfilled away; `assertNodeFree` greps for it.
 */

import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..')
const ENTRY = resolve(ROOT, 'server/tsrx/index.ts')
const OUT_DIR = resolve(ROOT, 'server/generated/tsrx-browser')

/** A literal `node:` import specifier survived into the bundle text. */
const NODE_IMPORT =
	/\bfrom\s+["']node:|\brequire\(\s*["']node:|\bimport\(\s*["']node:/

export const assertNodeFree = (bundleText: string): void => {
	const hit = NODE_IMPORT.exec(bundleText)
	if (hit)
		throw new Error(
			`Browser bundle of server/tsrx/index.ts contains a Node import (${hit[0]}…) — the compiler must stay browser-pure (ADR 0025 sub-design 6, LT-044/LT-045). Move the offending import behind a Node-only entry point (e.g. a CLI script under scripts/), not server/tsrx/.`,
		)
}

/**
 * Builds `server/tsrx/index.ts` for the browser and returns its bundled
 * text, asserting compiler purity (no surviving `node:` import) first.
 */
export const buildTsrxBrowserBundle = async (): Promise<string> => {
	const result = await Bun.build({
		entrypoints: [ENTRY],
		target: 'browser',
		format: 'esm',
		external: ['node:*'],
	})
	if (!result.success) {
		const messages = result.logs.map(log => log.message).join('\n')
		throw new Error(
			`Browser bundle of server/tsrx/index.ts failed:\n${messages}`,
		)
	}
	const text = await result.outputs[0]?.text()
	if (text === undefined) throw new Error('Browser bundle produced no output')
	assertNodeFree(text)
	return text
}

if (import.meta.main) {
	const text = await buildTsrxBrowserBundle()
	await Bun.write(resolve(OUT_DIR, 'index.js'), text)
	console.log(`✅ Browser bundle written to ${resolve(OUT_DIR, 'index.js')}`)
}
