import { join } from 'path'
import { OUTPUT_DIR, STATIC_DIR } from '../config'
import { io } from '../runtimes'

/* === Exported Effect === */

/**
 * Copy hand-authored static assets (favicon, images) from docs-src/static/
 * into docs/, preserving relative paths. docs/ is fully generated and not
 * committed, so every file it must contain needs a source under docs-src/.
 *
 * One-shot copy: static assets are not watched in watch mode. The copy is
 * byte-for-byte (binary-safe) through the runtime seam (LT-267).
 */
export const staticAssetsEffect = (_onRebuild?: () => void) => {
	const ready = (async () => {
		console.log('🖼️ Copying static assets...')
		let count = 0
		for (const relPath of io.scanGlob('**/*', { cwd: STATIC_DIR })) {
			await io.copyFile(join(STATIC_DIR, relPath), join(OUTPUT_DIR, relPath))
			count++
		}
		console.log(`✅ Copied ${count} static asset(s) to docs/`)
	})()
	return { ready, cleanup: undefined as (() => void) | undefined }
}
