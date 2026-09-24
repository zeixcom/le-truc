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

const SYNC_EL = 'server/tests/compiler/fixtures/tsx/sync/sync-el.tsx'

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

	test('a stale variantOverrides entry fails the run as a config error (LT-292)', async () => {
		// No source declares the tag (a renamed or deleted component, a
		// tag-shaped typo) ...
		const missing = await settle(
			compileCorpus(
				variantSet(),
				configAt(path.join(scratch.path, 'override-missing'), {
					variantOverrides: { 'var-elm': 'tsrx' },
				}),
			),
		)
		if (missing.status !== 'rejected')
			throw new Error('the run should have failed on the stale override')
		expect(String(missing.reason)).toContain(
			'le-truc.config.json: "variantOverrides["var-elm"]" names no variant set — no variant set declares this tag.',
		)
		// ... or only one surface authors it.
		const single = await settle(
			compileCorpus(
				[memoryFile(VAR_TSX, varTsx('display: block'))],
				configAt(path.join(scratch.path, 'override-single'), {
					variantOverrides: { 'var-el': 'tsrx' },
				}),
			),
		)
		if (single.status !== 'rejected')
			throw new Error('the run should have failed on the stale override')
		expect(String(single.reason)).toContain(
			`"variantOverrides["var-el"]" names no variant set — only one surface authors it (${VAR_TSX})`,
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

	test('a rebuild prunes variants/ clients it did not write (LT-296)', async () => {
		const outDir = path.join(scratch.path, 'variant-client-pruned')
		const kept = path.join(outDir, 'variants', 'var-el.tsrx.client.ts')
		const flipped = path.join(outDir, 'variants', 'var-el.tsx.client.ts')
		await compileCorpus(variantSet(), outDir)
		expect(fs.existsSync(kept)).toBe(true)
		// A flipped override swaps the kept client — the old one goes.
		await compileCorpus(
			variantSet(),
			configAt(outDir, { variantSurface: 'tsrx' }),
		)
		expect(fs.existsSync(flipped)).toBe(true)
		expect(fs.existsSync(kept)).toBe(false)
		// A dissolved set (the .tsrx member deleted) keeps no variants client.
		await compileCorpus([memoryFile(VAR_TSX, varTsx('display: block'))], outDir)
		expect(fs.existsSync(flipped)).toBe(false)
		expect(fs.readdirSync(path.join(outDir, 'variants'))).toEqual([])
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
	test('the folder carries all three spellings; every member declares the tag map (ADR 0039 s4)', () => {
		for (const rel of [COUNTER_TS, COUNTER_TSRX, COUNTER_TSX])
			expect(fs.existsSync(path.resolve(ROOT, rel))).toBe(true)
		const declaresMap = (rel: string) =>
			/interface HTMLElementTagNameMap/.test(
				fs.readFileSync(path.resolve(ROOT, rel), 'utf8'),
			)
		// Whichever member is served, its generated client carries the entry
		// a composing parent types through (LT-237 amendment).
		expect(declaresMap(COUNTER_TS)).toBe(true)
		expect(declaresMap(COUNTER_TSRX)).toBe(true)
		expect(declaresMap(COUNTER_TSX)).toBe(true)
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

	test('the retained twin still seeds the sibling-module map (review rider b)', () => {
		// The twin keeps seeding tag knowledge; LT-291 only stops a COMPILED
		// tag's child import from resolving to it (see the pins below).
		expect(collectSiblingModules(REPO_CONFIG).get('basic-counter')).toEndWith(
			'examples/basic/counter/basic-counter',
		)
	})
})

// LT-291 (ADR 0039): a compiled parent referencing a tag whose variant set
// retains its hand-written `.ts` twin registers the SERVED surface — the
// generated client — never the twin, which `examples/main.ts` does not
// import. In memory, like the pins above.
const PARENT_REL = 'examples/twin-parent-tmp/twin-parent.tsx'
const twinParent = (prop: string): string =>
	`import type { FactoryContext } from '@zeix/le-truc'

export type TwinParentProps = { total: number }

export function TwinParent(
	{}: {},
	{ first, expose }: FactoryContext<TwinParentProps>,
) {
	const counter = first('basic-counter', 'Needed to read its count.')
	expose({ total: () => counter.${prop} })

	return (
		<>
			<twin-parent>
				<basic-counter>
					<button type="button">
						💐 <span>0</span>
					</button>
				</basic-counter>
			</twin-parent>
			<style>{css\`
			twin-parent { display: block }
			\`}</style>
		</>
	)
}`

const compileWithParent = async (label: string, prop: string) => {
	const outDir = path.join(scratch.path, label)
	await compileCorpus(
		[
			fileInfo(COUNTER_TSRX),
			fileInfo(COUNTER_TSX),
			memoryFile(PARENT_REL, twinParent(prop)),
		],
		outDir,
	)
	return outDir
}

const typecheck = async (file: string) => {
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
			'--types',
			'node',
			file,
		],
		{ stdout: 'pipe', stderr: 'pipe', cwd: ROOT },
	)
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	])
	return { output: `${stdout}${stderr}`, exitCode }
}

describe('a compiled parent registers the served surface of a twin-carrying tag (LT-291)', () => {
	test('the child import is the generated client, and the bundle defines the tag once', async () => {
		const outDir = await compileWithParent('twin-parent', 'count')
		const parentClient = path.join(outDir, 'twin-parent.client.ts')
		const code = fs.readFileSync(parentClient, 'utf8')
		expect(code).toContain("import './basic-counter.client'")
		expect(code).not.toMatch(/examples\/basic\/counter\/basic-counter['"]/)
		const build = await Bun.build({ entrypoints: [parentClient] })
		expect(build.success).toBe(true)
		const bundle = (await Promise.all(build.outputs.map(o => o.text()))).join(
			'\n',
		)
		const defines = bundle.match(/defineComponent\(\s*["']basic-counter["']/g)
		expect(defines).toHaveLength(1)
		// Bun's per-module banner names every bundled source: the served
		// client made it in, the retained twin did not.
		expect(bundle).toContain('basic-counter.client.ts')
		expect(bundle).not.toMatch(/examples\/basic\/counter\/basic-counter\.ts/)
	})

	test('the served client carries the tag map: a mistyped child prop still fails tsc', async () => {
		const good = await compileWithParent('twin-parent-typed', 'count')
		const ok = await typecheck(path.join(good, 'twin-parent.client.ts'))
		expect(ok.output).toBe('')
		expect(ok.exitCode).toBe(0)
		const bad = await compileWithParent('twin-parent-mistyped', 'cuont')
		const ko = await typecheck(path.join(bad, 'twin-parent.client.ts'))
		expect(ko.exitCode).not.toBe(0)
		expect(ko.output).toContain('cuont')
	}, 60000)
})
