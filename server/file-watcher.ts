import { createStore, type Store, UNSET } from '@zeix/cause-effect'
import { Glob } from 'bun'
import { FileInfo } from './file-signals'
import {
	createFileInfo,
	getFilePath,
	isPlaywrightRunning,
	watchDirectory,
} from './io'

/* === Exported Functions === */

export const watchFiles = async (
	directory: string,
	inlclude: string,
	exclude?: string,
): Promise<Store<Record<string, FileInfo>>> => {
	const glob = new Glob(inlclude)
	const excludeGlob = exclude ? new Glob(exclude) : null
	const store = createStore<Record<string, FileInfo>>(UNSET)
	const playwrightDetected = isPlaywrightRunning()

	const isMatching = (file: string): boolean => {
		if (!glob.match(file)) return false
		if (excludeGlob && excludeGlob.match(file)) return false
		return true
	}

	const files: Record<string, FileInfo> = {}
	try {
		for await (const file of glob.scan(directory)) {
			// Apply exclusion filter
			if (excludeGlob && excludeGlob.match(file)) continue

			const filename = file.split(/[\\/]/).pop() || ''
			const filePath = getFilePath(directory, file)
			const fileInfo = await createFileInfo(filePath, filename)
			if (fileInfo.exists) files[filePath] = fileInfo
		}
		store.set(files)
	} catch (error) {
		console.error(`Error listing files in ${directory}:`, error)
	}

	if (playwrightDetected) {
		console.log(
			'🎭 Skipping file watching for directory (Playwright detected):',
			directory,
		)
	} else {
		console.log('Watching files in directory:', directory)
		watchDirectory(
			directory,
			inlclude.includes('**/'),
			isMatching,
			async (filePath, filename) => {
				const fileInfo = await createFileInfo(filePath, filename)
				const currentFiles = store.get()
				if (currentFiles !== UNSET) {
					const updatedFiles = { ...currentFiles }
					updatedFiles[filePath] = fileInfo
					store.set(updatedFiles)
				}
			},
			filePath => {
				const currentFiles = store.get()
				if (currentFiles !== UNSET) {
					const updatedFiles = { ...currentFiles }
					delete updatedFiles[filePath]
					store.set(updatedFiles)
				}
			},
		)
	}

	return store
}
