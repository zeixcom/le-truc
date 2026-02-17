import { createEffect, match } from '@zeix/cause-effect'
import { execSync } from 'child_process'
import { API_DIR } from '../config'
import { libraryScripts } from '../file-signals'

export const apiEffect = () =>
	createEffect(() => {
		match([libraryScripts.sources], {
			ok: () => {
				try {
					console.log('📚 Rebuilding API documentation...')

					// Generate API docs using TypeDoc
					execSync(
						`typedoc --plugin typedoc-plugin-markdown --out ${API_DIR}/ index.ts`,
						{ stdio: 'inherit' },
					)

					console.log('📚 API documentation rebuilt successfully')
				} catch (error) {
					console.error('Failed to rebuild API documentation:', error)
				}
			},
			err: errors => {
				console.error('API reference failed to rebuild', String(errors[0]))
			},
		})
	})
