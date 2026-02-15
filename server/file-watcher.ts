import { createList, type List } from '@zeix/cause-effect'
import { Glob } from 'bun'
import type { FileInfo } from './file-signals'
import { createFileInfo, getFilePath, isPlaywrightRunning } from './io'
import { existsSync, watch } from 'node:fs'
import { join } from 'path'

/* === Exported Functions === */

export const watchFiles = async (
	directory: string,
	include: string,
	exclude?: string,
): Promise<List<FileInfo>> => {
	const glob = new Glob(include)
	const excludeGlob = exclude ? new Glob(exclude) : null
	const playwrightDetected = isPlaywrightRunning()

	const isMatching = (file: string): boolean => {
		if (!glob.match(file)) return false
		if (excludeGlob && excludeGlob.match(file)) return false
		return true
	}

	// Scan initial files
	const initialFiles: FileInfo[] = []
	if (existsSync(directory)) {
		for await (const file of glob.scan(directory)) {
			if (excludeGlob && excludeGlob.match(file)) continue
			const filePath = getFilePath(directory, file)
			const filename = file.split(/[\\/]/).pop() || ''
			const fileInfo = await createFileInfo(filePath, filename)
			if (fileInfo.exists) initialFiles.push(fileInfo)
		}
	}

	const shouldWatch = !playwrightDetected

	const handleFileChange = async (
		fileList: List<FileInfo>,
		filename: string,
	) => {
		if (!isMatching(filename)) return

		const filePath = join(directory, filename)
		if (!existsSync(filePath)) {
			fileList.remove(filePath)
		} else {
			const fileInfo = await createFileInfo(
				filePath,
				filename.split(/[\\/]/).pop() || '',
			)
			const existing = fileList.byKey(filePath)
			if (existing) {
				if (existing.get().hash !== fileInfo.hash) existing.set(fileInfo)
			} else {
				fileList.add(fileInfo)
			}
		}
	}

	const fileList = createList<FileInfo>(initialFiles, {
		keyConfig: item => item.path,
		...(shouldWatch && existsSync(directory)
			? {
					watched: () => {
						console.log('Watching files in directory:', directory)
						const watcher = watch(
							directory,
							{
								recursive: include.includes('**/'),
								persistent: true,
							},
							async (_event, filename) => {
								if (!filename) return
								await handleFileChange(fileList, filename)
							},
						)
						return () => watcher.close()
					},
				}
			: {}),
	})

	if (playwrightDetected) {
		console.log(
			'🎭 Skipping file watching for directory (Playwright detected):',
			directory,
		)
	}

	return fileList
}
