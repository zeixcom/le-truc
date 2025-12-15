import { createStore, type Store, UNSET } from '@zeix/cause-effect'
import {
	createFileInfo,
	getDirectoryEntries,
	getFileExtension,
	getFilePath,
	watchDirectory,
} from './io'
import { FileInfo } from './file-signals'

/* === Types === */

type WatcherOptions = {
	recursive?: boolean
	extensions?: string[]
	ignore?: string[]
}

/* === Exported Functions === */

export function watchFiles(
	directory: string,
	options: WatcherOptions,
): Store<Record<string, FileInfo>> {
	const { recursive = false, extensions = [], ignore = [] } = options
	const store = createStore<Record<string, FileInfo>>(UNSET)

	const isMatching = (file: string): boolean => {
		if (ignore.some(pattern => file.includes(pattern))) return false
		if (extensions.length) return extensions.includes(getFileExtension(file))
		return true
	}

	;(async () => {
		const files: Record<string, FileInfo> = {}

		try {
			const entries = await getDirectoryEntries(directory, recursive)

			for (const entry of entries) {
				if (entry.isFile() && isMatching(entry.name)) {
					const filePath = getFilePath(entry.parentPath, entry.name)
					const fileInfo = await createFileInfo(filePath, entry.name)
					files[filePath] = fileInfo
				}
			}
			store.set(files)
		} catch (error) {
			console.error(`Error listing files in ${directory}:`, error)
		}
	})()

	console.log('Watching files in directory:', directory)
	watchDirectory(
		directory,
		recursive,
		isMatching,
		async (filePath, filename) => {
			const fileInfo = await createFileInfo(filePath, filename)
			if (filePath in store) store[filePath].set(fileInfo)
			else store.add(filePath, fileInfo)
		},
		filePath => {
			if (filePath in store) store.remove(filePath)
		},
	)

	return store
}
