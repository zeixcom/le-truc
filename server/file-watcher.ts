import { createStore, Store, UNSET } from '@zeix/cause-effect'
import { existsSync, watch } from 'fs'
import { readdir } from 'fs/promises'
import { extname, join } from 'path'
import { createFileInfo } from './io'
import { FileInfo, WatcherOptions } from './types'

export function watchFiles(
	directory: string,
	options: WatcherOptions,
): Store<Record<string, FileInfo>> {
	const { recursive = false, extensions = [], ignore = [] } = options
	const signal = createStore<Record<string, FileInfo>>(UNSET)

	const isMatching = (file: string): boolean => {
		if (ignore.some(pattern => file.includes(pattern))) return false
		if (extensions.length > 0) {
			const ext = extname(file)
			return extensions.includes(ext)
		}
		return true
	}

	;(async () => {
		const files: Record<string, FileInfo> = {}

		try {
			const entries = await readdir(directory, {
				withFileTypes: true,
				recursive,
			})

			for (const entry of entries) {
				if (entry.isFile() && isMatching(entry.name)) {
					const filePath = join(entry.parentPath, entry.name)
					const fileInfo = await createFileInfo(filePath, entry.name)
					files[filePath] = fileInfo
				}
			}
			signal.set(files)
		} catch (error) {
			console.error(`Error listing files in ${directory}:`, error)
		}
	})()

	console.log('Watching files in directory:', directory)

	watch(
		directory,
		{ recursive: options.recursive, persistent: true },
		async (event, filename) => {
			if (!filename || !isMatching(filename)) return

			const filePath = join(directory, filename)
			console.log('File event:', event, 'for', filePath)
			if (event === 'rename' && !existsSync(filePath)) {
				signal.remove(filePath)
			} else {
				const fileInfo = await createFileInfo(filePath, filename)
				if (filePath in signal) signal[filePath].set(fileInfo)
				else signal.add(filePath, fileInfo)
			}
		},
	)

	return signal
}
