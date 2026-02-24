import { createEffect, match } from '@zeix/cause-effect'
import { execSync } from 'child_process'
import { ASSETS_DIR, TS_FILE } from '../config'
import { componentScripts, docsScripts, libraryScripts } from '../file-signals'

export const jsEffect = () => {
	let resolve: (() => void) | undefined
	const ready = new Promise<void>(res => { resolve = res })
	const cleanup = createEffect(() => {
		match(
			[docsScripts.sources, libraryScripts.sources, componentScripts.sources],
			{
				ok: () => {
					try {
						console.log('🔧 Rebuilding JS assets...')
						execSync(
							`bun build ${TS_FILE} --outdir ${ASSETS_DIR}/ --minify --define process.env.DEV_MODE=false --sourcemap=external`,
							{ stdio: 'inherit' },
						)
						console.log('JS successfully rebuilt')
					} catch (error) {
						console.error('JS failed to rebuild:', String(error))
					}
					resolve?.()
					resolve = undefined
				},
				err: errors => {
					console.error('Error in JS effect:', errors[0].message)
					resolve?.()
					resolve = undefined
				},
			},
		)
	})
	return { cleanup, ready }
}
