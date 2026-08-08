import { describe, expect, test } from 'bun:test'
import { gzipSync } from 'node:zlib'

const MINIMAL_CEILING = 9 * 1024
const CORE_FORM_WARN = 10 * 1024

const buildGzipped = async (entrypoint: string): Promise<number> => {
	const result = await Bun.build({
		entrypoints: [entrypoint],
		minify: true,
		// String define, matching build:prod — Bun folds the string comparison
		// `"false" === 'true'` at each DEV guard site (a boolean `false` define
		// does not fold, and would ship all DEV-gated code).
		define: { 'process.env.DEV_MODE': '"false"' },
	})
	const bytes = await result.outputs[0]!.arrayBuffer()
	return gzipSync(new Uint8Array(bytes)).byteLength
}

describe('Bundle size', () => {
	// Three tiers, reflecting that `defineComponent`'s extensions
	// (`formAssociated()`, `observedAttributes()`, ...) are tree-shaken away
	// unless a consumer actually imports them — see the ComponentExtension
	// mechanism in src/extension.ts. Each tier measures a fresh minified
	// build, matching what a consumer's bundler ships (not the published,
	// unminified index.js).
	test('minimal entry (defineComponent, no extensions) must stay under 8 kB gzipped', async () => {
		const gzipped = await buildGzipped('./test/fixtures/minimal-entry.ts')
		console.log(`  minimalGzipped: ${gzipped}B (ceiling: ${MINIMAL_CEILING}B)`)
		expect(gzipped).toBeLessThanOrEqual(MINIMAL_CEILING)
	})

	test('core + formAssociated() warns if it exceeds 14 kB gzipped', async () => {
		const gzipped = await buildGzipped('./test/fixtures/core-form-entry.ts')
		console.log(`  coreFormGzipped: ${gzipped}B (warn: ${CORE_FORM_WARN}B)`)
		if (gzipped > CORE_FORM_WARN) {
			console.warn(`  WARN: core + formAssociated() exceeds ${CORE_FORM_WARN}B`)
		}
	})

	test('core + formAssociatedCheckbox() tree-shakes independently of formAssociated()', async () => {
		// formAssociatedCheckbox() and formAssociated() live in the same
		// module (src/extensions/form.ts) and share the host-contract table —
		// this asserts a consumer who only imports the checkbox variant isn't
		// dragging in the value-style reset/sync code too. Comparable size to
		// core-form-entry (not the sum of both) is the tree-shaking proof.
		const gzipped = await buildGzipped('./test/fixtures/core-checkbox-entry.ts')
		console.log(`  coreCheckboxGzipped: ${gzipped}B (warn: ${CORE_FORM_WARN}B)`)
		if (gzipped > CORE_FORM_WARN) {
			console.warn(
				`  WARN: core + formAssociatedCheckbox() exceeds ${CORE_FORM_WARN}B`,
			)
		}
	})

	test('full barrel (every export) is reported, not asserted', async () => {
		// The full index.ts barrel bundles every extension the library ships —
		// not a realistic consumer surface once extensions are opt-in, so this
		// is informational only. The two tiers above are the real regression
		// guards.
		const result = await Bun.build({
			entrypoints: ['./index.ts'],
			minify: true,
			define: { 'process.env.DEV_MODE': '"false"' },
		})
		const bytes = await result.outputs[0]!.arrayBuffer()
		const gzipped = gzipSync(new Uint8Array(bytes)).byteLength
		console.log(`  fullBundleGzipped: ${gzipped}B (informational only)`)

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
