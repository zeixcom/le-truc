import { createEffect, match, resolve } from '@zeix/cause-effect'
import { OUTPUT_DIR } from '../config'
import {
	componentScripts,
	componentStyles,
	docsScripts,
	docsStyles,
	libraryScripts,
} from '../file-signals'
import { getFilePath, writeFileSafe } from '../io'
import {
	type ServiceWorkerConfig,
	serviceWorker,
} from '../templates/service-worker'

export const serviceWorkerEffect = () =>
	createEffect(() => {
		match(
			resolve({
				docsStyles: docsStyles.sources,
				componentStyles: componentStyles.sources,
				docsScripts: docsScripts.sources,
				componentScripts: componentScripts.sources,
				libraryScripts: libraryScripts.sources,
			}),
			{
				ok: async () => {
					try {
						console.log('🔧 Generating service worker...')

						// Generate asset hashes based on current timestamp
						// In production, these would be actual file content hashes
						const cssHash = Date.now().toString(36)
						const jsHash = Date.now().toString(36)

						const config: ServiceWorkerConfig = {
							cssHash,
							jsHash,
							cacheName: `le-truc-docs-v${Date.now()}`,
							staticAssets: ['/', '/index.html'],
						}
						await writeFileSafe(
							getFilePath(OUTPUT_DIR, 'sw.js'),
							serviceWorker(config),
						)
						console.log('🔧 Service worker generated successfully')
					} catch (error) {
						console.error('Failed to generate service worker:', error)
					}
				},
				err: errors => {
					console.error('Error in service worker effect:', errors[0].message)
					return undefined
				},
			},
		)
	})
