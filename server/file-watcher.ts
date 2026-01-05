import { HOOK_WATCH, List } from '@zeix/cause-effect'
import { Glob } from 'bun'
import { createHash } from 'crypto'
import { existsSync, watch } from 'fs'
import { stat } from 'fs/promises'
import { basename, join } from 'path'
import { FileInfo } from './file-signals'

/* === Exported Functions === */

const isPlaywrightRunning = (): boolean => {
	return !!(
		process.env.PLAYWRIGHT_TEST_BASE_URL
		|| process.env.PLAYWRIGHT
		|| process.env.PWTEST_SKIP_TEST_OUTPUT
		|| process.argv.some(arg => arg.includes('playwright'))
	)
}

const getFileInfo = async (filePath: string): Promise<FileInfo> => {
	const filename = basename(filePath)
	const content = await Bun.file(filePath).text()
	const hash = createHash('sha256')
		.update(content, 'utf8')
		.digest('hex')
		.slice(0, 16)
	const stats = await stat(filePath)

	return {
		path: filePath,
		filename,
		content,
		hash,
		lastModified: stats.mtimeMs,
		size: stats.size,
		exists: true,
	}
}

export const createFileList = async (
	directory: string,
	include: string,
	exclude?: string,
): Promise<List<FileInfo>> => {
	const glob = new Glob(include)
	const excludeGlob = exclude ? new Glob(exclude) : null
	const watchFiles = !isPlaywrightRunning()
	const files = glob.scan(directory)

	const fileList = new List<FileInfo>([], item => item.path)
	for await (const file of files) {
		if (excludeGlob && excludeGlob.match(file)) continue

		const filePath = join(directory, file)
		const fileInfo = await getFileInfo(filePath)
		if (fileInfo.exists) fileList.add(fileInfo)
	}

	const isMatching = (file: string): boolean => {
		if (!glob.match(file)) return false
		if (excludeGlob && excludeGlob.match(file)) return false
		return true
	}

	if (watchFiles) {
		fileList.on(HOOK_WATCH, () => {
			const watcher = watch(
				directory,
				{ recursive: include.includes('**/'), persistent: true },
				async (event, filename) => {
					if (!filename || !isMatching(filename)) return

					const filePath = join(directory, filename)
					if (event === 'rename' && !existsSync(filePath)) {
						fileList.remove(filePath)
					} else {
						const fileInfo = await getFileInfo(filePath)
						const fileSignal = fileList.byKey(filePath)
						if (fileSignal) fileSignal.set(fileInfo)
						else fileList.add(fileInfo)
					}
				},
			)
			return () => {
				watcher.close()
			}
		})
	}

	return fileList
}
