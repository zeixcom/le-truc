import { createEffect, match, resolve } from '@zeix/cause-effect'
import { execSync } from 'child_process'
import { ASSETS_DIR, CSS_FILE } from '../config'
import { componentStyles, docsStyles } from '../file-signals'

export const cssEffect = () =>
	createEffect(() => {
		match(
			resolve({
				components: componentStyles.sources,
				docs: docsStyles.sources,
			}),
			{
				ok: () => {
					try {
						console.log('🎨 Rebuilding CSS assets...')
						execSync(
							`bunx lightningcss --minify --bundle --targets ">= 0.25%" ${CSS_FILE} -o ${ASSETS_DIR}/main.css`,
							{ stdio: 'inherit' },
						)
						console.log('CSS successfully rebuilt')
					} catch (error) {
						console.error('CSS failed to rebuild:', String(error))
					}
				},
				err: errors => {
					console.error('Error in CSS effect:', errors[0].message)
				},
			},
		)
	})
