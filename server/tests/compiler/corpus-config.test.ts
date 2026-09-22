/**
 * Corpus configuration tests (LT-255, ADR 0034 sub-design 1): the source
 * globs and the output root are a consumer's to choose, and this repo's paths
 * are only the defaults.
 *
 * The two facts worth pinning are the ones that were hard-coded before:
 * WHICH files are compiled (both authored extensions, from a configured glob
 * list) and WHERE the output goes (at any depth — the `../` prefix the
 * emitted specifiers need is derived from it, not assumed).
 */

import { describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
	CONFIG_FILENAME,
	type CorpusConfigInput,
	DEFAULT_OUT_DIR,
	DEFAULT_RUNTIME_IMPORT,
	DEFAULT_SOURCES,
	emitPathsFor,
	outDirPrefix,
	resolveCorpusConfig,
} from '../../compiler/corpus-config'
import { DEFAULT_EMIT_PATHS } from '../../compiler/emit-paths'
import {
	collectCorpusSources,
	collectSiblingModules,
	loadCorpusConfig,
	REPO_ROOT,
} from '../../corpus-sources'

/** A throwaway project tree outside the repo, cleaned up by the caller. */
const scratchProject = (files: Record<string, string>): string => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lt255-'))
	for (const [rel, content] of Object.entries(files)) {
		const full = path.join(root, rel)
		fs.mkdirSync(path.dirname(full), { recursive: true })
		fs.writeFileSync(full, content)
	}
	return root
}

describe('the defaults are this repo, not the mechanism', () => {
	test('both authored extensions are globbed', () => {
		// The LT-271 gap: `build:corpus` globbed `.tsrx` only while
		// `check:corpus` and the build effect globbed both, so a `.tsx`
		// component was invisible to `build:cem` and `typecheck`. One
		// configured list is now the single place either is widened.
		expect(DEFAULT_SOURCES).toEqual(['examples/**/*.tsrx', 'examples/**/*.tsx'])
	})

	test('an unconfigured resolve reproduces the repo layout', () => {
		const config = resolveCorpusConfig(REPO_ROOT)
		expect(config.root).toBe(REPO_ROOT)
		expect(config.outDir).toBe(path.join(REPO_ROOT, DEFAULT_OUT_DIR))
		expect(config.runtimeImport).toBe(DEFAULT_RUNTIME_IMPORT)
		expect(emitPathsFor(config)).toEqual(DEFAULT_EMIT_PATHS)
	})

	test('the repo needs no config file — none is found above it', () => {
		const config = loadCorpusConfig(REPO_ROOT)
		expect(config.root).toBe(REPO_ROOT)
		expect(config.sources).toEqual(DEFAULT_SOURCES)
	})

	test('the default prefix is the value the emitters hard-coded', () => {
		expect(DEFAULT_EMIT_PATHS.outDirPrefix).toBe('../../../')
	})
})

describe('the output root is the consumer’s to choose', () => {
	test('the back-to-root prefix is derived from its depth', () => {
		const root = '/p'
		expect(outDirPrefix(root, '/p/out')).toBe('../')
		expect(outDirPrefix(root, '/p/build/le-truc')).toBe('../../')
		expect(outDirPrefix(root, '/p/server/generated/components')).toBe(
			'../../../',
		)
	})

	test('an output root outside the project root is refused', () => {
		// The emitted specifiers are "`../` back to the root, then a
		// root-relative path" — a scheme that cannot address a directory the
		// root does not contain. A config mistake, so a thrown error rather
		// than a compile diagnostic.
		expect(() => resolveCorpusConfig('/p', { outDir: '../elsewhere' })).toThrow(
			/must be a directory INSIDE the project root/,
		)
		expect(() => resolveCorpusConfig('/p', { outDir: '.' })).toThrow(
			/must be a directory INSIDE the project root/,
		)
	})

	test('an empty source list is refused', () => {
		expect(() => resolveCorpusConfig('/p', { sources: [] })).toThrow(
			/at least one glob/,
		)
	})
})

describe('the config file is validated, not trusted (LT-273)', () => {
	// The loader reads untrusted JSON; the input type describes the ACCEPTED
	// shape, so the malformed values a test feeds in are cast through here —
	// the runtime check under test is what the cast claims.
	const untrusted = (value: unknown): CorpusConfigInput =>
		value as CorpusConfigInput

	test('an unknown key is rejected naming it and the accepted keys', () => {
		// Probed at the LT-255 review: a mis-cased "outdir" silently wrote to
		// the repo default path inside the consumer's project.
		expect(() =>
			resolveCorpusConfig('/p', untrusted({ outdir: 'build' })),
		).toThrow(
			/unknown key "outdir" — accepted keys are: sources, siblingModules, outDir, i18nDir, runtimeImport, variantSurface, variantOverrides\. Did you mean "outDir"\?/,
		)
		expect(() =>
			resolveCorpusConfig('/p', untrusted({ emitting: 'build' })),
		).toThrow(/unknown key "emitting"/)
		// ...and no did-you-mean when nothing is a casing match.
		expect(() =>
			resolveCorpusConfig('/p', untrusted({ emitting: 'build' })),
		).toThrow(/unknown key "emitting" — accepted keys are: [^.]+\.$/)
	})

	test('a string where an array belongs reports the array spelling', () => {
		// Probed at the LT-255 review: a bare string spread into twelve
		// single-character globs and reported twelve garbage patterns.
		expect(() =>
			resolveCorpusConfig('/p', untrusted({ sources: 'src/**/*.tsx' })),
		).toThrow(
			/"sources" must be an array of glob strings — received the string "src\/\*\*\/\*\.tsx"\. Wrap it in an array: "sources": \["src\/\*\*\/\*\.tsx"\]/,
		)
		expect(() => resolveCorpusConfig('/p', untrusted({ sources: 42 }))).toThrow(
			/"sources" must be an array of glob strings — received a number/,
		)
		expect(() =>
			resolveCorpusConfig('/p', untrusted({ siblingModules: 'lib/**' })),
		).toThrow(/"siblingModules" must be an array of glob strings/)
	})

	test('a non-string glob entry names its index', () => {
		expect(() =>
			resolveCorpusConfig('/p', untrusted({ sources: ['a/**/*.tsx', ''] })),
		).toThrow(/"sources\[1\]" must be a non-empty string — received ""/)
		expect(() =>
			resolveCorpusConfig('/p', untrusted({ sources: ['a/**/*.tsx', 42] })),
		).toThrow(/"sources\[1\]" must be a non-empty string — received 42/)
	})

	test('path and string fields must be non-empty strings', () => {
		expect(() => resolveCorpusConfig('/p', untrusted({ outDir: 42 }))).toThrow(
			/"outDir" must be a non-empty string — received 42/,
		)
		expect(() => resolveCorpusConfig('/p', untrusted({ i18nDir: '' }))).toThrow(
			/"i18nDir" must be a non-empty string/,
		)
		expect(() =>
			resolveCorpusConfig('/p', untrusted({ runtimeImport: null })),
		).toThrow(/"runtimeImport" must be a non-empty string/)
	})

	test('a non-object config is rejected listing the accepted keys', () => {
		for (const value of [null, 'src/**', 42, []]) {
			expect(() => resolveCorpusConfig('/p', untrusted(value))).toThrow(
				new RegExp(
					`expected a JSON object with keys drawn from: sources, siblingModules, outDir, i18nDir, runtimeImport, variantSurface, variantOverrides — received ${JSON.stringify(value) ?? String(value)}`.replace(
						/[.*+?^${}()|[\]\\]/g,
						'\\$&',
					),
				),
			)
		}
	})

	test('variant-surface selection validates the surface vocabulary and the override keys (LT-283)', () => {
		// An unknown surface value is rejected naming the closed vocabulary —
		// a mistyped surface would otherwise silently serve the default.
		expect(() =>
			resolveCorpusConfig('/p', untrusted({ variantSurface: 'jsx' })),
		).toThrow(/"variantSurface" must be one of: "tsx", "tsrx" — received "jsx"/)
		expect(() =>
			resolveCorpusConfig(
				'/p',
				untrusted({ variantOverrides: { 'x-el': 'JSX' } }),
			),
		).toThrow(/"variantOverrides\["x-el"\]" must be one of: "tsx", "tsrx"/)
		// A non-tag override key would never match a corpus tag — reject the
		// key shape itself, not just let the entry sit unused.
		expect(() =>
			resolveCorpusConfig(
				'/p',
				untrusted({ variantOverrides: { counter: 'tsx' } }),
			),
		).toThrow(/"variantOverrides" keys must be custom-element tags/)
		expect(() =>
			resolveCorpusConfig(
				'/p',
				untrusted({ variantOverrides: { 'X-El': 'tsx' } }),
			),
		).toThrow(/"variantOverrides" keys must be custom-element tags/)
		// A non-object override map is a shape error like any other field.
		expect(() =>
			resolveCorpusConfig('/p', untrusted({ variantOverrides: 'x-el' })),
		).toThrow(/"variantOverrides" must be an object mapping component tags/)
		// ...and the accepted shapes resolve.
		const config = resolveCorpusConfig('/p', {
			variantSurface: 'tsrx',
			variantOverrides: { 'basic-counter': 'tsx' },
		})
		expect(config.variantSurface).toBe('tsrx')
		expect(config.variantOverrides).toEqual({ 'basic-counter': 'tsx' })
		// Defaults when absent: `.tsx`, the ADR 0032 default surface, by
		// rule rather than by practice (ADR 0039).
		const defaults = resolveCorpusConfig('/p')
		expect(defaults.variantSurface).toBe('tsx')
		expect(defaults.variantOverrides).toEqual({})
	})
})

describe('the config search stops at the project boundary (LT-273)', () => {
	test('a stray config above the nearest package.json does not capture the build', () => {
		const outer = scratchProject({
			[CONFIG_FILENAME]: JSON.stringify({ outDir: 'captured' }),
			'checkout/package.json': '{}',
			'checkout/src/keep.ts': '',
		})
		try {
			const config = loadCorpusConfig(path.join(outer, 'checkout', 'src'))
			// The repo defaults, not the stray file's root.
			expect(config.root).toBe(REPO_ROOT)
		} finally {
			fs.rmSync(outer, { recursive: true, force: true })
		}
	})

	test('.git bounds the search the same way', () => {
		const outer = scratchProject({
			[CONFIG_FILENAME]: JSON.stringify({ outDir: 'captured' }),
			'checkout/.git': '',
		})
		try {
			const config = loadCorpusConfig(path.join(outer, 'checkout'))
			expect(config.root).toBe(REPO_ROOT)
		} finally {
			fs.rmSync(outer, { recursive: true, force: true })
		}
	})

	test('a config at the boundary directory itself still applies', () => {
		const root = scratchProject({
			[CONFIG_FILENAME]: JSON.stringify({ outDir: 'gen' }),
			'package.json': '{}',
			'sub/keep.txt': '',
		})
		try {
			const config = loadCorpusConfig(path.join(root, 'sub'))
			expect(config.root).toBe(path.resolve(root))
			expect(config.outDir).toBe(path.join(path.resolve(root), 'gen'))
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})
})

describe('a project outside this repo', () => {
	test('is configured by its own file, found by walking up', () => {
		const root = scratchProject({
			[CONFIG_FILENAME]: JSON.stringify({
				sources: ['src/**/*.tsx'],
				siblingModules: ['lib/**/*.ts'],
				outDir: 'build/le-truc',
				runtimeImport: '@zeix/le-truc-compiler/runtime',
			}),
			'src/widgets/scratch-greeting.tsx': '// component\n',
			'src/widgets/notes.md': 'not a source\n',
			'lib/scratch-panel.ts': '// hand-written custom element\n',
			'lib/main.ts': '// helper, no dash in the stem\n',
		})
		try {
			// Found from a NESTED directory, not just the root.
			const config = loadCorpusConfig(path.join(root, 'src', 'widgets'))
			expect(config.root).toBe(path.resolve(root))
			expect(config.outDir).toBe(
				path.join(path.resolve(root), 'build', 'le-truc'),
			)

			const sources = collectCorpusSources(config)
			expect(sources.map(f => f.filename)).toEqual([
				'src/widgets/scratch-greeting.tsx',
			])

			// A depth-2 output root, so two `../` — not the repo's three.
			expect(emitPathsFor(config)).toEqual({
				outDirPrefix: '../../',
				runtimeImport: '@zeix/le-truc-compiler/runtime',
			})
			expect(collectSiblingModules(config)).toEqual(
				new Map([['scratch-panel', '../../lib/scratch-panel']]),
			)
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})

	test('overlapping source globs compile each file once', () => {
		// Two globs matching the same file would otherwise look to the
		// duplicate-tag check (LTC048) like two files declaring one tag.
		const root = scratchProject({
			[CONFIG_FILENAME]: JSON.stringify({
				sources: ['src/**/*.tsx', 'src/widgets/*.tsx'],
			}),
			'src/widgets/scratch-greeting.tsx': '// component\n',
		})
		try {
			const config = loadCorpusConfig(root)
			expect(collectCorpusSources(config)).toHaveLength(1)
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})

	test('a project with no catalog directory censuses no locales', () => {
		// A consumer's build must not read THIS repo's `i18n/` — every key in
		// it would census as an orphan against their corpus.
		const root = scratchProject({ [CONFIG_FILENAME]: '{}' })
		try {
			const config = loadCorpusConfig(root)
			expect(config.i18nDir).toBe(path.join(path.resolve(root), 'i18n'))
		} finally {
			fs.rmSync(root, { recursive: true, force: true })
		}
	})
})
