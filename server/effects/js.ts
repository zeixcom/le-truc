import { createEffect, match, resolve } from '@zeix/cause-effect'
import { execSync } from 'child_process'
import { componentScripts, docsScripts, libraryScripts } from '../file-signals'

export const jsEffect = () =>
	createEffect(() => {
		match(
			resolve({
				docs: docsScripts.sources,
				library: libraryScripts.sources,
				components: componentScripts.sources,
			}),
			{
				ok: () => {
					try {
						console.log('🔧 Rebuilding JS assets...')
						execSync(
							'bun build docs-src/main.ts --outdir ./docs/assets/ --minify --define process.env.DEV_MODE=false --sourcemap=external',
							{ stdio: 'inherit' },
						)
						console.log('JS successfully rebuilt')
					} catch (error) {
						console.error('JS failed to rebuild:', String(error))
					}
				},
				err: errors => {
					console.error('Error in JS effect:', errors[0].message)
				},
			},
		)
	})
