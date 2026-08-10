import { ASSETS_DIR, CSS_FILE } from '../config'
import { componentStyles, docsStyles } from '../file-signals'
import { createBuildEffect, runCommand } from './build-effect'

export const cssEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'CSS assets',
		[componentStyles.sources, docsStyles.sources],
		async () => {
			console.log('🎨 Rebuilding CSS assets...')
			await runCommand([
				'bunx',
				'lightningcss',
				'--minify',
				'--bundle',
				'--targets',
				'>= 0.25%',
				CSS_FILE,
				'-o',
				`${ASSETS_DIR}/main.css`,
			])
			console.log('CSS successfully rebuilt')
		},
		onRebuild,
	)
