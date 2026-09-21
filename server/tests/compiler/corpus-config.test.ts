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
