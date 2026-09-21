import { existsSync, watch } from 'node:fs'
import { batch, createList, type List } from '@zeix/cause-effect'
import type { FileInfo } from './file-signals'
import { createFileInfo, getFilePath, isPlaywrightRunning } from './io'
import { io } from './runtimes'

/* === Exported Types === */

/**
 * A watched file list with an explicit rescan escape hatch. Effects that
 * generate files into a watched directory (e.g. TypeDoc writing docs-src/api)
 * must call rescan() after writing: the initial scan runs before they do, and
 * no fs watcher is attached when the directory doesn't exist at startup.
 */
export type WatchedFiles = List<FileInfo> & { rescan: () => Promise<void> }

/* === Exported Functions === */

export const watchFiles = async (
	directory: string,
	include: string,
	exclude?: string,
	recursive?: boolean,
): Promise<WatchedFiles> => {
	const playwrightDetected = isPlaywrightRunning()
	const isRecursive = recursive ?? include.includes('**/')

	// The seam's matcher (LT-267): one glob semantics on every runtime, and
	// the same one the scans below apply.
	const isMatching = (file: string): boolean =>
		io.matchGlob(include, file) && !(exclude && io.matchGlob(exclude, file))

	// Scan initial files
	const initialFiles: FileInfo[] = []
	if (existsSync(directory)) {
		for (const file of io.scanGlob(include, { cwd: directory })) {
			if (exclude && io.matchGlob(exclude, file)) continue
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
			for (const file of io.scanGlob(include, { cwd: directory })) {
				if (exclude && io.matchGlob(exclude, file)) continue
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
						// Rescan on activation to pick up any files written between
						// initial scan and watcher setup (lazy activation gap).
						// Scheduled, not called directly: the scan is synchronous
						// now (LT-267), and a synchronous flush would read the
						// list from inside its own watched activation — re-entering
						// the getter until the stack blows. The debounce's async
						// boundary settles the activation first.
						scheduleFlush(fileList, null)
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

	return Object.assign(fileList, {
		rescan: () => flushChanges(fileList),
	})
}
