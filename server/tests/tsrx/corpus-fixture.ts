/**
 * Shared .tsrx corpus fixture for tests that exercise the corpus runner
 * (`compileTsrxCorpus`) the way the build does.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { Glob } from 'bun'
import type { FileInfo } from '../../file-signals'

const ROOT = path.resolve(import.meta.dir, '../../..')

/**
 * The .tsrx corpus under `examples/` as `FileInfo[]`, in glob scan order —
 * the same shape `scripts/build-tsrx.ts` and the tsrx build effect feed
 * `compileTsrxCorpus`.
 */
export const loadTsrxCorpus = async (): Promise<FileInfo[]> => {
	const files: FileInfo[] = []
	const glob = new Glob('examples/**/*.tsrx')
	for (const rel of glob.scanSync({ cwd: ROOT, onlyFiles: true })) {
		const full = path.resolve(ROOT, rel)
		// Root boundary: `rel` comes from our own Glob scan, but the resolved
		// path must stay inside the repo before any filesystem access.
		if (!full.startsWith(ROOT + path.sep)) continue
		const stat = fs.statSync(full)
		files.push({
			path: full,
			filename: rel,
			content: fs.readFileSync(full, 'utf8'),
			hash: '',
			lastModified: stat.mtimeMs,
			size: stat.size,
			exists: true,
		})
	}
	return files
}
