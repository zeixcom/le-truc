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
			define: { 'process.env.DEV_MODE': 'false' },
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
	})
})
