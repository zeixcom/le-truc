import { batch, createList, type List } from '@zeix/cause-effect'
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
	recursive?: boolean,
): Promise<List<FileInfo>> => {
	const glob = new Glob(include)
	const excludeGlob = exclude ? new Glob(exclude) : null
	const playwrightDetected = isPlaywrightRunning()
	const isRecursive = recursive ?? include.includes('**/')

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

	// Collect pending filenames and debounce rapid bursts (e.g. TypeDoc writing
	// 140 files) into a single batch update so downstream effects run once.
	const pendingChanges = new Set<string>()
	let debounceTimer: ReturnType<typeof setTimeout> | null = null

	const flushChanges = async (fileList: List<FileInfo>) => {
		const filenames = [...pendingChanges]
		pendingChanges.clear()

		// Resolve all file infos in parallel before touching signals
		const updates = await Promise.all(
			filenames.map(async filename => {
				const filePath = join(directory, filename)
				if (!existsSync(filePath)) {
					return { filePath, fileInfo: null } as const
				}
				const fileInfo = await createFileInfo(
					filePath,
					filename.split(/[\\/]/).pop() || '',
				)
				return { filePath, fileInfo } as const
			}),
		)

		// Apply all signal mutations in one batch → effects re-run only once
		batch(() => {
			for (const { filePath, fileInfo } of updates) {
				if (!fileInfo) {
					fileList.remove(filePath)
				} else {
					const existing = fileList.byKey(filePath)
					if (existing) {
						if (existing.get().hash !== fileInfo.hash) existing.set(fileInfo)
					} else {
						fileList.add(fileInfo)
					}
				}
			}
		})
	}

	const handleFileChange = (fileList: List<FileInfo>, filename: string) => {
		if (!isMatching(filename)) return
		pendingChanges.add(filename)
		if (debounceTimer !== null) clearTimeout(debounceTimer)
		debounceTimer = setTimeout(() => {
			debounceTimer = null
			flushChanges(fileList)
		}, 50)
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
								recursive: isRecursive,
								persistent: true,
							},
							(_event, filename) => {
								if (!filename) return
								handleFileChange(fileList, filename)
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
