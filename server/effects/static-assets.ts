import { join } from 'path'
import { OUTPUT_DIR, STATIC_DIR } from '../config'

/* === Exported Effect === */

/**
 * Copy hand-authored static assets (favicon, images) from docs-src/static/
 * into docs/, preserving relative paths. docs/ is fully generated and not
 * committed, so every file it must contain needs a source under docs-src/.
 *
 * One-shot copy: static assets are not watched in watch mode.
 */
export const staticAssetsEffect = (_onRebuild?: () => void) => {
	const ready = (async () => {
		console.log('🖼️ Copying static assets...')
		let count = 0
		const glob = new Bun.Glob('**/*')
		for await (const relPath of glob.scan({ cwd: STATIC_DIR })) {
			await Bun.write(
				join(OUTPUT_DIR, relPath),
				Bun.file(join(STATIC_DIR, relPath)),
			)
			count++
		}
		console.log(`✅ Copied ${count} static asset(s) to docs/`)
	})()
	return { ready, cleanup: undefined as (() => void) | undefined }
}
