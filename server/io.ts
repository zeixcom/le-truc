import { createHash } from 'crypto'
import { existsSync, statSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import { basename, extname, join, relative } from 'path'
import { brotliCompressSync, gzipSync } from 'zlib'
import type { FileInfo } from './file-signals'
import { io } from './runtimes'
import type { RequestContext } from './serve'

/* === Exported Functions === */

/**
 * Detect if we're running under Playwright
 */
const isPlaywrightRunning = (): boolean => {
	return !!(
		process.env.PLAYWRIGHT_TEST_BASE_URL ||
		process.env.PLAYWRIGHT ||
		process.env.PWTEST_SKIP_TEST_OUTPUT ||
		process.argv.some(arg => arg.includes('playwright'))
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
			io.readTextFile(filePath),
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

/** Directories "exist" for existsSync — sending one fails in sendfile. */
const isDirectory = (filePath: string): boolean => {
	try {
		return statSync(filePath).isDirectory()
	} catch {
		return false
	}
}

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
	await io.readTextFile(filePath)

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

/**
 * Write file asynchronously and safely (ensure parent dir exists) through
 * the runtime seam (LT-267). Returns false instead of throwing so callers
 * that report their own failure keep doing so.
 */
const writeFileSafe = async (
	filePath: string,
	content: string,
): Promise<boolean> => {
	try {
		await io.writeTextFile(filePath, content)
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
	isDirectory,
	isPlaywrightRunning,
	writeFileSafe,
}
