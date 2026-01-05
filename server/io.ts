import { existsSync, watch } from 'fs'
import { mkdir, readdir, stat } from 'fs/promises'
import { createHash } from 'crypto'
import { basename, dirname, extname, join, relative } from 'path'
import { brotliCompressSync, gzipSync } from 'zlib'
import type { FileInfo } from './file-signals'
import type { RequestContext } from './serve'

/* === Exported Functions === */

/**
 * Detect if we're running under Playwright
 */
const isPlaywrightRunning = (): boolean => {
	return !!(
		process.env.PLAYWRIGHT_TEST_BASE_URL
		|| process.env.PLAYWRIGHT
		|| process.env.PWTEST_SKIP_TEST_OUTPUT
		|| process.argv.some(arg => arg.includes('playwright'))
	)
}

const calculateFileHash = (content: string): string =>
	createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16)

const createFileInfo = async (
	filePath: string,
	filename: string,
): Promise<FileInfo> => {
	const fallback: FileInfo = {
		path: filePath,
		filename,
		content: '',
		hash: '',
		lastModified: 0,
		size: 0,
		exists: false,
	}

	try {
		if (!existsSync(filePath)) return fallback

		const [content, stats] = await Promise.all([
			Bun.file(filePath).text(),
			stat(filePath),
		])

		return {
			path: filePath,
			filename,
			content,
			hash: calculateFileHash(content),
			lastModified: stats.mtimeMs,
			size: stats.size,
			exists: true,
		}
	} catch (error) {
		console.error(`Error reading file ${filePath}:`, error)
		return fallback
	}
}

const fileExists = (filePath: string): boolean => existsSync(filePath)

const getCompressedBuffer = (
	buffer: Buffer,
	context: RequestContext,
): { content: Buffer; encoding: string } => {
	if (context.acceptsBrotli) {
		return { content: brotliCompressSync(buffer), encoding: 'br' }
	} else if (context.acceptsGzip) {
		return { content: gzipSync(buffer), encoding: 'gzip' }
	}
	return { content: buffer, encoding: 'identity' }
}

const getDirectoryEntries = async (directoryPath: string, recursive = false) =>
	await readdir(directoryPath, {
		withFileTypes: true,
		recursive,
	})

const getFileContent = async (filePath: string): Promise<string> =>
	await Bun.file(filePath).text()

const getFileExtension = (filePath: string): string => extname(filePath)

const getFileInfo = async (filePath: string): Promise<FileInfo> => {
	const filename = basename(filePath)
	const content = await getFileContent(filePath)
	const hash = calculateFileHash(content)
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

const getFilePath = (...pathComponents: string[]): string =>
	join(...pathComponents)

const getRelativePath = (basePath: string, filePath: string): string | null => {
	try {
		const relativePath = relative(basePath, filePath)
		return relativePath.startsWith('..') ? null : relativePath
	} catch (error) {
		console.error(`Error getting relative path for ${filePath}:`, error)
		return null
	}
}

const watchDirectory = async (
	directoryPath: string,
	recursive: boolean,
	isMatching: (filename: string) => boolean,
	onUpdate: (filePath: string, filename: string) => void,
	onDelete: (filePath: string) => void,
): Promise<void> => {
	watch(
		directoryPath,
		{ recursive, persistent: true },
		async (event, filename) => {
			if (!filename || !isMatching(filename)) return

			const filePath = join(directoryPath, filename)
			if (event === 'rename' && !existsSync(filePath)) onDelete(filePath)
			else onUpdate(filePath, filename)
		},
	)
}

/**
 * Write file asynchronously and safely (ensure parent dir exists) using Bun.write.
 */
const writeFileSafe = async (
	filePath: string,
	content: string,
): Promise<boolean> => {
	try {
		// Ensure directory exists
		const dir = dirname(filePath)
		if (!existsSync(dir)) {
			await mkdir(dir, { recursive: true })
		}

		await Bun.write(filePath, content)
		return true
	} catch (error) {
		console.error(`Error writing file ${filePath}:`, error)
		return false
	}
}

export {
	calculateFileHash,
	createFileInfo,
	fileExists,
	getCompressedBuffer,
	getDirectoryEntries,
	getFileContent,
	getFileExtension,
	getFileInfo,
	getFilePath,
	getRelativePath,
	isPlaywrightRunning,
	watchDirectory,
	writeFileSafe,
}
