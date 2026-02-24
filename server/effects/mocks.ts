import { createEffect, match } from '@zeix/cause-effect'
import { COMPONENTS_DIR, TEST_DIR } from '../config'
import { componentMocks } from '../file-signals'
import { getFilePath, writeFileSafe } from '../io'

/* === Internal Functions === */

export const getMockOutputPath = (filePath: string): string => {
	const prefix = getFilePath(COMPONENTS_DIR) + '/'
	const relative = filePath.replace(prefix, '')
	return getFilePath(TEST_DIR, relative)
}

/* === Exported Effect === */

export const mocksEffect = () =>
	createEffect(() => {
		match([componentMocks.sources], {
			ok: async ([mockFiles]) => {
				console.log('🔄 Copying mock files...')
				for (const file of mockFiles) {
					await writeFileSafe(getMockOutputPath(file.path), file.content)
				}
				console.log(`✅ Copied ${mockFiles.length} mock file(s) to docs/test/`)
			},
			err: errors => {
				console.error('Error in mocks effect:', errors[0].message)
			},
		})
	})
