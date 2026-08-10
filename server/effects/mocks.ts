import { relative } from 'path'
import { COMPONENTS_DIR, TEST_DIR } from '../config'
import { componentMocks } from '../file-signals'
import { getFilePath, writeFileSafe } from '../io'
import { createBuildEffect } from './build-effect'

/* === Internal Functions === */

export const getMockOutputPath = (filePath: string): string => {
	const rel = relative(COMPONENTS_DIR, filePath)
	const parts = rel.split('/')
	// Convert <type>/<name>/mocks/... to <type>-<name>/mocks/... to match HTML src and URL pattern.
	if (parts.length >= 4 && parts[2] === 'mocks') {
		const componentName = `${parts[0]}-${parts[1]}`
		const mockRelPath = parts.slice(2).join('/')
		return getFilePath(TEST_DIR, componentName, mockRelPath)
	}
	return getFilePath(TEST_DIR, rel)
}

/* === Exported Effect === */

export const mocksEffect = (onRebuild?: () => void) =>
	createBuildEffect(
		'Mocks',
		[componentMocks.sources],
		async ([mockFiles]) => {
			console.log('🔄 Copying mock files...')
			for (const file of mockFiles) {
				await writeFileSafe(getMockOutputPath(file.path), file.content)
			}
			console.log(`✅ Copied ${mockFiles.length} mock file(s) to docs/test/`)
		},
		onRebuild,
	)
