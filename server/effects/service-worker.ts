import { ASSETS_DIR, OUTPUT_DIR } from '../config'
import {
	componentScripts,
	componentStyles,
	docsScripts,
	docsStyles,
	libraryScripts,
} from '../file-signals'
import {
	calculateFileHash,
	getFileContent,
	getFilePath,
	writeFileSafe,
} from '../io'
import {
	type ServiceWorkerConfig,
	serviceWorker,
} from '../templates/service-worker'
import { createBuildEffect } from './build-effect'

export const serviceWorkerEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'Service worker',
		[
			docsStyles.sources,
			componentStyles.sources,
			docsScripts.sources,
			componentScripts.sources,
			libraryScripts.sources,
		],
		async () => {
			console.log('🔧 Generating service worker...')

			const [cssContent, jsContent] = await Promise.all([
				getFileContent(getFilePath(ASSETS_DIR, 'main.css')),
				getFileContent(getFilePath(ASSETS_DIR, 'main.js')),
			])
			const cssHash = calculateFileHash(cssContent)
			const jsHash = calculateFileHash(jsContent)

			const config: ServiceWorkerConfig = {
				cssHash,
				jsHash,
				cacheName: `le-truc-docs-${cssHash.slice(0, 8)}-${jsHash.slice(0, 8)}`,
				staticAssets: ['/', '/index.html'],
			}
			await writeFileSafe(
				getFilePath(OUTPUT_DIR, 'sw.js'),
				serviceWorker(config),
			)
			console.log('🔧 Service worker generated successfully')
		},
		onRebuild,
	)
