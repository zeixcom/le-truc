import { createHash } from 'crypto'
import { existsSync, mkdirSync, watch, writeFileSync } from 'fs'
import { readFile, readdir, stat } from 'fs/promises'
import { basename, dirname, extname, join, relative } from 'path'
import { brotliCompressSync, gzipSync } from 'zlib'
import type { RequestContext } from './serve'
import type { FileInfo } from './file-signals'

/* === Exported Functions === */

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
			readFile(filePath, 'utf-8'),
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
	await readFile(filePath, 'utf-8')

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

const writeFileSyncSafe = (filePath: string, content: string): boolean => {
	try {
		// Ensure directory exists
		const dir = dirname(filePath)
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true })
		}

		writeFileSync(filePath, content, 'utf-8')
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
	watchDirectory,
	writeFileSyncSafe,
}
