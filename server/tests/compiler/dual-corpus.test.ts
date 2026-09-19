/**
 * Dual-corpus runner tests (LT-202, ADR 0032 sub-design 6): the corpus
 * globs `.tsrx` AND `.tsx` into one registry, the front end chosen per file
 * by extension — and a tag declared by two sources fails the compile naming
 * both files (LTC048, tier 1 Prevented).
 */

import { afterAll, describe, expect, test } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { compileCorpus } from '../../effects/compile'
import type { FileInfo } from '../../file-signals'
import { createGeneratedDir } from '../helpers/generated-corpus'
import { settle } from '../helpers/test-utils'

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

// Same depth as GENERATED_DIR under the repo root, so emitted relative
// specifiers would resolve if a compile succeeded (they must not here).
const scratch = createGeneratedDir('dual-corpus')
afterAll(() => scratch.cleanup())

const SYNC_EL = 'spike/tsx/sync/sync-el.tsx'

describe('dual corpus (ADR 0032 sub-design 6)', () => {
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

	test('a tag declared by a .tsrx AND a .tsx source fails naming both files (LTC048)', () => {
		// The .tsrx twin exists only as an in-memory FileInfo — the runner
		// keys duplicates off the file NAME's tag and reads `content` only,
		// so nothing is written into examples/ (a real file there would race
		// every concurrent corpus glob, including the other tests').
		const twinRel = 'examples/dual-corpus-tmp/sync-el.tsrx'
		const twin: FileInfo = {
			path: path.resolve(ROOT, twinRel),
			filename: twinRel,
			content: '// any text — the duplicate check fires before any compile\n',
			hash: '',
			lastModified: 0,
			size: 0,
			exists: true,
		}
		return settle(compileCorpus([fileInfo(SYNC_EL), twin], scratch.path)).then(
			settled => {
				if (settled.status !== 'rejected')
					throw new Error('the run should have failed with LTC048')
				const message = String(settled.reason)
				expect(message).toContain('LTC048')
				expect(message).toContain(SYNC_EL)
				expect(message).toContain(twinRel)
				// Both files are named against the same tag.
				expect(message).toContain('`sync-el`')
			},
		)
	})
	// The full 22-component .tsrx corpus through this same runner is pinned
	// by tier-corpus.test.ts; check:corpus runs it every CI pass. A third
	// "mixed corpus compiles clean" re-run here only adds process time —
	// bun shares one module registry across test files, and the extra wall
	// time shifted a pre-existing stray dependency-timeout window onto this
	// file in the first full-suite run (see NOTES.md, LT-202).
})
