/**
 * Dual-corpus runner tests (LT-202, ADR 0032 sub-design 6; variant sets per
 * ADR 0039, LT-283): the corpus globs `.tsrx` AND `.tsx` into one registry,
 * the front end chosen per file by extension. A folder-local VARIANT SET —
 * one authored source per surface, one base name, one directory — is the
 * legal multi-source shape: every member compiles, the set's CSS must agree
 * byte-for-byte (LTC051), and only the selected surface's artifacts are
 * written under the canonical names. Any other collision fails the compile
 * naming every involved file (LTC048, tier 1 Prevented).
 */

import { afterAll, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { CorpusConfig } from '../../compiler/corpus-config'
import {
	compileCorpus,
	REPO_CONFIG,
	relocateClientSpecifiers,
} from '../../corpus-compile'
import { collectSiblingModules } from '../../corpus-sources'
import type { FileInfo } from '../../file-signals'
import { createGeneratedDir } from '../helpers/generated-corpus'
import { settle } from '../helpers/test-utils'
import { loadCorpus } from './corpus-fixture'

const ROOT = path.resolve(import.meta.dir, '../../..')

const fileInfo = (rel: string): FileInfo => {
	const full = path.resolve(ROOT, rel)
	const stat = fs.statSync(full)
	return {
		path: full,
		filename: rel,
		content: fs.readFileSync(full, 'utf8'),
		hash: '',
		lastModified: stat.mtimeMs,
		size: stat.size,
		exists: true,
	}
}

/** An in-memory FileInfo — the runner keys everything off name + content. */
const memoryFile = (rel: string, content: string): FileInfo => ({
	path: path.resolve(ROOT, rel),
	filename: rel,
	content,
	hash: '',
	lastModified: 0,
	size: 0,
	exists: true,
})

// Same depth as GENERATED_DIR under the repo root, so emitted relative
// specifiers would resolve if a compile succeeded (they must not here).
const scratch = createGeneratedDir('dual-corpus')
afterAll(() => scratch.cleanup())

const SYNC_EL = 'spike/tsx/sync/sync-el.tsx'

// A minimal component with a REAL spelling on each surface — the twin pair
// below must compile clean for the variant-set serving to mean anything.
// The CSS spelling mirrors the parity fixtures' proven pair: plain
// `<style>` on `.tsrx`, the `css` tag inside `<style>` on `.tsx`, identical
// inner text, so equal authored CSS compiles byte-identical (ADR 0039).
const DIR = 'examples/dual-corpus-tmp'
const VAR_TSX = `${DIR}/var-el.tsx`
const VAR_TSRX = `${DIR}/var-el.tsrx`

const varTsx = (cssBody: string): string =>
	`export function VarEl({ label = 'x' }: { label?: string })
{
	expose({})

	return (
		<>
			<var-el>
				<p class="label">{label}</p>
			</var-el>
			<style>{css\`
			var-el { ${cssBody} }
			\`}</style>
		</>
	)
}`

const varTsrx = (cssBody: string): string =>
	`export function VarEl({ label = 'x' }: { label?: string })
	@{
		expose({})

		<>
			<var-el>
				<p class="label">{label}</p>
			</var-el>
			<style>
			var-el { ${cssBody} }
			</style>
		</>
	}`

const variantSet = (cssBody = 'display: block'): FileInfo[] => [
	memoryFile(VAR_TSRX, varTsrx(cssBody)),
	memoryFile(VAR_TSX, varTsx(cssBody)),
]

const configAt = (
	outDir: string,
	overrides?: Partial<CorpusConfig>,
): CorpusConfig => ({ ...REPO_CONFIG, outDir, ...overrides })

describe('dual corpus (ADR 0032 sub-design 6, narrowed by ADR 0039)', () => {
	test('a .tsx source compiles through the corpus runner end to end', async () => {
		const outDir = path.join(scratch.path, 'single')
		const spanInfos = await compileCorpus([fileInfo(SYNC_EL)], outDir)
		const tags = spanInfos.map(s => s.tag)
		expect(tags).toContain('sync-el')
		// The entry's source carries the .tsx path — the registry says which
		// surface a component is authored in.
		const entry = spanInfos.find(s => s.tag === 'sync-el')
		expect(entry?.source).toBe(SYNC_EL)
		// The generated artifacts landed: client, server, CSS, registry.
		expect(fs.existsSync(path.join(outDir, 'sync-el.client.ts'))).toBe(true)
		expect(fs.existsSync(path.join(outDir, 'sync-el.server.ts'))).toBe(true)
		const registryJson = fs.readFileSync(
			path.join(outDir, 'registry.json'),
			'utf8',
		)
		expect(registryJson).toContain('sync-el')
	})

	test('a folder-local .tsrx + .tsx variant set compiles clean and serves the selected surface (ADR 0039)', async () => {
		// Both members in memory under one directory — nothing is written
		// into examples/ (a real file there would race every concurrent
		// corpus glob, including the other tests').
		const outDir = path.join(scratch.path, 'variant-set')
		const spanInfos = await compileCorpus(variantSet(), outDir)
		// One registry entry per tag, naming the SELECTED member — `.tsx` is
		// the default served surface (ADR 0032's default, by rule).
		expect(spanInfos).toHaveLength(1)
		expect(spanInfos[0]?.tag).toBe('var-el')
		expect(spanInfos[0]?.source).toBe(VAR_TSX)
		const registry = JSON.parse(
			fs.readFileSync(path.join(outDir, 'registry.json'), 'utf8'),
		) as Record<string, { source: string }>
		expect(Object.keys(registry)).toEqual(['var-el'])
		expect(registry['var-el']?.source).toBe(VAR_TSX)
		// The served bytes are the .tsx member's compile: compile that
		// member ALONE and compare client, server and CSS byte-for-byte.
		const soloDir = path.join(scratch.path, 'variant-set-solo-tsx')
		await compileCorpus(
			[memoryFile(VAR_TSX, varTsx('display: block'))],
			soloDir,
		)
		for (const artifact of [
			'var-el.client.ts',
			'var-el.server.ts',
			'var-el.css',
		])
			expect(fs.readFileSync(path.join(outDir, artifact), 'utf8')).toBe(
				fs.readFileSync(path.join(soloDir, artifact), 'utf8'),
			)
	})

	test('the variantSurface config override flips the served client', async () => {
		const outDir = path.join(scratch.path, 'variant-override')
		const spanInfos = await compileCorpus(
			variantSet(),
			configAt(outDir, {
				variantSurface: 'tsrx',
				variantOverrides: { 'var-el': 'tsrx' },
			}),
		)
		expect(spanInfos).toHaveLength(1)
		expect(spanInfos[0]?.source).toBe(VAR_TSRX)
		const soloDir = path.join(scratch.path, 'variant-override-solo-tsrx')
		await compileCorpus(
			[memoryFile(VAR_TSRX, varTsrx('display: block'))],
			soloDir,
		)
		expect(fs.readFileSync(path.join(outDir, 'var-el.client.ts'), 'utf8')).toBe(
			fs.readFileSync(path.join(soloDir, 'var-el.client.ts'), 'utf8'),
		)
	})

	test('the non-selected member keeps its client under variants/ (LT-284)', async () => {
		// ADR 0039 decision 2's runtime equivalence contract: the component
		// test route serves EACH compiled surface, so the corpus compile
		// keeps the non-selected member's client at
		// `variants/<tag>.<surface>.client.ts` — never a canonical name, so
		// the flat CEM globs and the one-entry-per-tag registry are blind to
		// it. (Composing sets prove the child-import climb live when the
		// first one migrates; a dangling `./` specifier would fail the
		// route's bundle build loudly.)
		const outDir = path.join(scratch.path, 'variant-client-kept')
		await compileCorpus(variantSet(), outDir)
		const soloTsxDir = path.join(scratch.path, 'variant-client-kept-solo-tsx')
		const soloTsrxDir = path.join(scratch.path, 'variant-client-kept-solo-tsrx')
		await compileCorpus(
			[memoryFile(VAR_TSX, varTsx('display: block'))],
			soloTsxDir,
		)
		await compileCorpus(
			[memoryFile(VAR_TSRX, varTsrx('display: block'))],
			soloTsrxDir,
		)
		// `.tsx` is the default served surface; the `.tsrx` member's client
		// is kept, byte-identical to that member's solo compile…
		const keptPath = path.join(outDir, 'variants', 'var-el.tsrx.client.ts')
		expect(fs.readFileSync(keptPath, 'utf8')).toBe(
			fs.readFileSync(path.join(soloTsrxDir, 'var-el.client.ts'), 'utf8'),
		)
		// …its relative specifiers climb out of variants/ (nothing dangles)…
		expect(fs.readFileSync(keptPath, 'utf8')).not.toMatch(/import\s+['"]\.\//)
		// …and the served surface keeps no variants copy.
		expect(
			fs.existsSync(path.join(outDir, 'variants', 'var-el.tsx.client.ts')),
		).toBe(false)
		// The canonical artifacts stay the selected member's.
		expect(fs.readFileSync(path.join(outDir, 'var-el.client.ts'), 'utf8')).toBe(
			fs.readFileSync(path.join(soloTsxDir, 'var-el.client.ts'), 'utf8'),
		)
		// With the override flipped, the kept copy flips with it.
		const flippedDir = path.join(scratch.path, 'variant-client-kept-flipped')
		await compileCorpus(
			variantSet(),
			configAt(flippedDir, { variantSurface: 'tsrx' }),
		)
		expect(
			fs.readFileSync(
				path.join(flippedDir, 'variants', 'var-el.tsx.client.ts'),
				'utf8',
			),
		).toBe(fs.readFileSync(path.join(soloTsxDir, 'var-el.client.ts'), 'utf8'))
		expect(
			fs.existsSync(path.join(flippedDir, 'variants', 'var-el.tsrx.client.ts')),
		).toBe(false)
	})

	test('a variants/ client climbs every relative specifier one level (LT-284)', () => {
		const code = [
			"import './child.client'",
			"import { x } from './helper'",
			"import { y } from '../../../lib/y'",
			"export { z } from './z'",
			"const m = import('./lazy')",
			"import { defineComponent } from '@zeix/le-truc'",
		].join('\n')
		expect(relocateClientSpecifiers(code)).toBe(
			[
				"import '../child.client'",
				"import { x } from '../helper'",
				"import { y } from '../../../../lib/y'",
				"export { z } from '../z'",
				"const m = import('../lazy')",
				"import { defineComponent } from '@zeix/le-truc'",
			].join('\n'),
		)
	})

	test('a CSS drift between set members fails the build with LTC051 naming both', async () => {
		const outDir = path.join(scratch.path, 'variant-drift')
		const settled = await settle(
			compileCorpus(
				// Only the .tsx member's CSS drifts; the compiled stylesheets
				// can no longer both be true of the served name.
				variantSet().map(f =>
					f.filename === VAR_TSX
						? memoryFile(VAR_TSX, varTsx('display: grid'))
						: f,
				),
				outDir,
			),
		)
		if (settled.status !== 'rejected')
			throw new Error('the run should have failed with LTC051')
		const message = String(settled.reason)
		expect(message).toContain('LTC051')
		expect(message).toContain(VAR_TSX)
		expect(message).toContain(VAR_TSRX)
		expect(message).toContain('`var-el`')
	})

	test('a tag declared by two SAME-SURFACE sources fails naming both files (LTC048)', async () => {
		// The twin exists only as an in-memory FileInfo — the runner
		// keys duplicates off the file NAME's tag and reads `content` only,
		// so nothing is written into examples/ (a real file there would race
		// every concurrent corpus glob, including the other tests').
		const twinRel = `${DIR}/sync-el.tsx`
		const twin: FileInfo = {
			path: path.resolve(ROOT, twinRel),
			filename: twinRel,
			content: '// any text — the duplicate check fires before any compile\n',
			hash: '',
			lastModified: 0,
			size: 0,
			exists: true,
		}
		const settled = await settle(
			compileCorpus([fileInfo(SYNC_EL), twin], scratch.path),
		)
		if (settled.status !== 'rejected')
			throw new Error('the run should have failed with LTC048')
		const message = String(settled.reason)
		expect(message).toContain('LTC048')
		expect(message).toContain(SYNC_EL)
		expect(message).toContain(twinRel)
		// Both files are named against the same tag.
		expect(message).toContain('`sync-el`')
	})

	test('a cross-folder .tsrx + .tsx pair is NOT a variant set — LTC048 names both (ADR 0039)', async () => {
		const twinRel = `${DIR}/sync-el.tsrx`
		const twin = memoryFile(
			twinRel,
			'// any text — the duplicate check fires before any compile\n',
		)
		const settled = await settle(
			compileCorpus([fileInfo(SYNC_EL), twin], scratch.path),
		)
		if (settled.status !== 'rejected')
			throw new Error('the run should have failed with LTC048')
		const message = String(settled.reason)
		expect(message).toContain('LTC048')
		expect(message).toContain(SYNC_EL)
		expect(message).toContain(twinRel)
	})
	// The full 22-component .tsrx corpus through this same runner is pinned
	// by tier-corpus.test.ts; check:corpus runs it every CI pass. A third
	// "mixed corpus compiles clean" re-run here only adds process time —
	// bun shares one module registry across test files, and the extra wall
	// time shifted a pre-existing stray dependency-timeout window onto this
	// file in the first full-suite run (see NOTES.md, LT-202).
})

// The three-spelling exemplar (LT-285, the LT-238 exit criterion): the REAL
// basic-counter folder carries the hand-written `.ts` twin beside its
// `.tsrx` and `.tsx` spellings — the pins above, proven against the live set.
const COUNTER_DIR = 'examples/basic/counter'
const COUNTER_TS = `${COUNTER_DIR}/basic-counter.ts`
const COUNTER_TSRX = `${COUNTER_DIR}/basic-counter.tsrx`
const COUNTER_TSX = `${COUNTER_DIR}/basic-counter.tsx`

describe('basic-counter three-spelling variant set (LT-285, ADR 0039)', () => {
	test('the folder carries all three spellings; only the twin declares the tag map', () => {
		for (const rel of [COUNTER_TS, COUNTER_TSRX, COUNTER_TSX])
			expect(fs.existsSync(path.resolve(ROOT, rel))).toBe(true)
		const declaresMap = (rel: string) =>
			/interface HTMLElementTagNameMap/.test(
				fs.readFileSync(path.resolve(ROOT, rel), 'utf8'),
			)
		expect(declaresMap(COUNTER_TS)).toBe(true)
		expect(declaresMap(COUNTER_TSRX)).toBe(false)
		expect(declaresMap(COUNTER_TSX)).toBe(false)
	})

	test('the compiled members compile as one set serving .tsx — the twin adds no registry entry', async () => {
		const outDir = path.join(scratch.path, 'counter-set')
		const spanInfos = await compileCorpus(
			[fileInfo(COUNTER_TSRX), fileInfo(COUNTER_TSX)],
			outDir,
		)
		expect(spanInfos).toHaveLength(1)
		expect(spanInfos[0]?.tag).toBe('basic-counter')
		expect(spanInfos[0]?.source).toBe(COUNTER_TSX)
		const registry = JSON.parse(
			fs.readFileSync(path.join(outDir, 'registry.json'), 'utf8'),
		) as Record<string, unknown>
		expect(Object.keys(registry)).toEqual(['basic-counter'])
	})

	test('a same-surface duplicate of the live set fails the build naming every source (LTC048)', async () => {
		// In memory only, like the pins above: a real file would race every
		// concurrent corpus glob.
		const dupRel = 'examples/basic/counter-copy/basic-counter.tsx'
		const settled = await settle(
			compileCorpus(
				[
					fileInfo(COUNTER_TSRX),
					fileInfo(COUNTER_TSX),
					memoryFile(
						dupRel,
						fs.readFileSync(path.resolve(ROOT, COUNTER_TSX), 'utf8'),
					),
				],
				path.join(scratch.path, 'counter-dup'),
			),
		)
		if (settled.status !== 'rejected')
			throw new Error('the run should have failed with LTC048')
		const message = String(settled.reason)
		expect(message).toContain('LTC048')
		expect(message).toContain('`basic-counter`')
		for (const rel of [COUNTER_TSRX, COUNTER_TSX, dupRel])
			expect(message).toContain(rel)
	})

	test('the retained twin is what childImports resolves the tag to (review rider b)', () => {
		expect(collectSiblingModules(REPO_CONFIG).get('basic-counter')).toEndWith(
			'examples/basic/counter/basic-counter',
		)
	})

	test('no compiled component references basic-counter until LT-291 lands', async () => {
		// childImports keeps the TWIN's module over the generated client, so a
		// compiled parent referencing the tag would import the twin while
		// examples/main.ts registers the served client — a double define.
		// LT-291 makes childImports prefer the served surface; until then the
		// first referrer must fail here, loudly. Matches markup (`<basic-counter`)
		// and module specifiers (`…/basic-counter'`), not prose in comments.
		const referrers = (await loadCorpus())
			.filter(f => !f.filename.startsWith(`${COUNTER_DIR}/`))
			.filter(f =>
				/<basic-counter\b|\/basic-counter(\.[a-z]+)?['"]/.test(f.content),
			)
			.map(f => f.filename)
		expect(referrers).toEqual([])
	})
})
