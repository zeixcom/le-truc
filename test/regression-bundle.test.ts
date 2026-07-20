import { describe, expect, test } from 'bun:test'
import { gzipSync } from 'node:zlib'

const TARGET = 10 * 1024
const CEILING = 14 * 1024

describe('Bundle size', () => {
	// REQUIREMENTS.md §4: ≤10 kB gzipped target, 14 kB hard ceiling (one
	// TCP segment). Measures a fresh minified build — what a consumer's
	// bundler ships — not the published (unminified) index.js.
	test('minified+gzipped bundle must stay under the 14 kB ceiling', async () => {
		const result = await Bun.build({
			entrypoints: ['./index.ts'],
			minify: true,
			// String define, matching build:prod — Bun folds the string comparison
			// `"false" === 'true'` at each DEV guard site (a boolean `false` define
			// does not fold, and would ship all DEV-gated code).
			define: { 'process.env.DEV_MODE': '"false"' },
		})
		const bytes = await result.outputs[0]!.arrayBuffer()
		const gzipped = gzipSync(new Uint8Array(bytes)).byteLength
		console.log(
			`  bundleGzipped: ${gzipped}B (target: ${TARGET}B, ceiling: ${CEILING}B)`,
		)
		if (gzipped > TARGET) {
			console.warn(
				`  WARN: bundle exceeds the ${TARGET}B target (REQUIREMENTS.md §4)`,
			)
		}
		expect(gzipped).toBeLessThanOrEqual(CEILING)

		// DEV-gated diagnostics must be folded out of the production build.
		// Guard sites read `process.env.DEV_MODE === 'true'` inline so the
		// string define above turns them into dead branches; if this assertion
		// fails, a guard was written in a form Bun cannot fold (e.g. via an
		// imported const, or with the env check not in literal position).
		const code = new TextDecoder().decode(bytes)
		expect(code).not.toContain('does not bubble')
		expect(code).not.toContain('key not present in the source')
	})
})
