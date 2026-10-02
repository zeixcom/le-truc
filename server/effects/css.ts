import { ASSETS_DIR, CSS_FILE } from '../config'
import {
	componentStyles,
	docsStyles,
	generatedComponentStyles,
} from '../file-signals'
import { createBuildEffect, runCommand } from './build-effect'

export const cssEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'CSS assets',
		[
			componentStyles.sources,
			docsStyles.sources,
			generatedComponentStyles.sources,
		],
		async () => {
			console.log('🎨 Rebuilding CSS assets...')
			await runCommand([
				'bunx',
				'lightningcss',
				'--minify',
				'--bundle',
				'--targets',
				// The docs site's own audience target (R2, owner 2026-10-02):
				// deliberately NOT the compiler's `cssTargets` — the bundle
				// carries every hand-written page stylesheet beside the
				// emitted component CSS, and the site's baseline is this
				// repo's docs decision, not a component author's.
				'>= 0.25%',
				CSS_FILE,
				'-o',
				`${ASSETS_DIR}/main.css`,
			])
			console.log('CSS successfully rebuilt')
		},
		onRebuild,
	)
