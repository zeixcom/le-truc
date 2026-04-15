import { existsSync, watch } from 'node:fs'
import { batch, createList, type List } from '@zeix/cause-effect'
import { Glob } from 'bun'
import type { FileInfo } from './file-signals'
import { createFileInfo, getFilePath, isPlaywrightRunning } from './io'

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

	// Debounce rapid bursts (e.g. TypeDoc writing 140 files) into a single
	// batch update so downstream effects re-run only once.
	// On macOS, fs.watch can coalesce multiple creation events into fewer
	// callbacks, so we rescan the whole directory on every flush rather than
	// relying on the set of filenames we happened to receive.
	let debounceTimer: ReturnType<typeof setTimeout> | null = null

	const flushChanges = async (fileList: List<FileInfo>) => {
		// Rescan the entire directory so no events are missed
		const scannedFiles = new Map<string, FileInfo>()
		if (existsSync(directory)) {
			for await (const file of glob.scan(directory)) {
				if (excludeGlob && excludeGlob.match(file)) continue
				const filePath = getFilePath(directory, file)
				const filename = file.split(/[\\/]/).pop() || ''
				const fileInfo = await createFileInfo(filePath, filename)
				if (fileInfo.exists) scannedFiles.set(filePath, fileInfo)
			}
		}

		// Snapshot current list state before mutating
		const currentItems = fileList.get()

		// Apply all signal mutations in one batch → effects re-run only once
		batch(() => {
			for (const [filePath, fileInfo] of scannedFiles) {
				const existing = fileList.byKey(filePath)
				if (existing) {
					if (existing.get().hash !== fileInfo.hash) {
						fileList.replace(filePath, fileInfo)
					}
				} else {
					fileList.add(fileInfo)
				}
			}
			for (const item of currentItems) {
				if (!scannedFiles.has(item.path)) {
					fileList.remove(item.path)
				}
			}
		})
	}

	const scheduleFlush = (fileList: List<FileInfo>, filename: string | null) => {
		// If we have a specific filename, filter out non-matching paths eagerly
		// to avoid unnecessary rescans. A null filename (macOS coalesced event)
		// always triggers a rescan.
		if (filename !== null && !isMatching(filename)) return
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
								scheduleFlush(
									fileList,
									typeof filename === 'string' ? filename : null,
								)
							},
						)
						// Rescan immediately on activation to pick up any files written
						// between initial scan and watcher setup (lazy activation gap).
						flushChanges(fileList)
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
