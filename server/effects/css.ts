import { createEffect, match } from '@zeix/cause-effect'
import { ASSETS_DIR, CSS_FILE } from '../config'
import { componentStyles, docsStyles } from '../file-signals'

export const cssEffect = () => {
	let resolve: (() => void) | undefined
	const ready = new Promise<void>(res => { resolve = res })
	const cleanup = createEffect(() => {
		match([componentStyles.sources, docsStyles.sources], {
			ok: async () => {
				try {
					console.log('🎨 Rebuilding CSS assets...')
					const proc = Bun.spawn(
						[
							'bunx', 'lightningcss',
							'--minify', '--bundle',
							'--targets', '>= 0.25%',
							CSS_FILE, '-o', `${ASSETS_DIR}/main.css`,
						],
						{ stdout: 'inherit', stderr: 'inherit' },
					)
					const exitCode = await proc.exited
					if (exitCode !== 0) {
						console.error(`CSS rebuild failed with exit code ${exitCode}`)
					} else {
						console.log('CSS successfully rebuilt')
					}
				} catch (error) {
					console.error('CSS failed to rebuild:', String(error))
				} finally {
					resolve?.()
					resolve = undefined
				}
			},
			err: errors => {
				console.error('Error in CSS effect:', errors[0].message)
				resolve?.()
				resolve = undefined
			},
		})
	})
	return { cleanup, ready }
}
