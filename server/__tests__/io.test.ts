/**
 * Unit Tests for io.ts — IO Utilities
 *
 * Tests for pure functions: calculateFileHash, getFilePath, getRelativePath
 * and integration tests for createFileInfo, writeFileSafe, getCompressedBuffer, isPlaywrightRunning
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import {
	calculateFileHash,
	getFilePath,
	getRelativePath,
	createFileInfo,
	writeFileSafe,
	getCompressedBuffer,
	isPlaywrightRunning,
	fileExists,
} from '../io'
import { createTempDir, createTempFile, mockRequestContext } from './helpers/test-utils'

/* === Unit Tests: Pure Functions === */

describe('calculateFileHash', () => {
	test('should generate consistent hash for same content', () => {
		const content = 'test content'
		const hash1 = calculateFileHash(content)
		const hash2 = calculateFileHash(content)

		expect(hash1).toBe(hash2)
		expect(hash1.length).toBe(16)
	})

	test('should generate different hashes for different content', () => {
		const content1 = 'test content 1'
		const content2 = 'test content 2'

		const hash1 = calculateFileHash(content1)
		const hash2 = calculateFileHash(content2)

		expect(hash1).not.toBe(hash2)
	})

	test('should handle empty string', () => {
		const hash = calculateFileHash('')
		expect(hash).toBeTruthy()
		expect(hash.length).toBe(16)
	})

	test('should handle unicode content', () => {
		const content = '测试内容 🚀 émojis'
		const hash = calculateFileHash(content)
		expect(hash).toBeTruthy()
		expect(hash.length).toBe(16)
	})

	test('should handle very large content', () => {
		const content = 'a'.repeat(100000)
		const hash = calculateFileHash(content)
		expect(hash).toBeTruthy()
		expect(hash.length).toBe(16)
	})

	test('should generate hex string only', () => {
		const content = 'test'
		const hash = calculateFileHash(content)
		expect(/^[0-9a-f]+$/.test(hash)).toBe(true)
	})
})

describe('getFilePath', () => {
	test('should join path components correctly', () => {
		const path = getFilePath('dir1', 'dir2', 'file.txt')
		expect(path).toContain('dir1')
		expect(path).toContain('dir2')
		expect(path).toContain('file.txt')
	})

	test('should handle single component', () => {
		const path = getFilePath('file.txt')
		expect(path).toBe('file.txt')
	})

	test('should handle empty array', () => {
		const path = getFilePath()
		expect(path).toBe('.')
	})

	test('should normalize path separators', () => {
		const path = getFilePath('dir1', 'dir2', 'file.txt')
		// Should not have double slashes
		expect(path).not.toContain('//')
		expect(path).not.toContain('\\\\')
	})

	test('should handle trailing slashes', () => {
		const path1 = getFilePath('dir1/', 'dir2/', 'file.txt')
		const path2 = getFilePath('dir1', 'dir2', 'file.txt')
		// Both should result in valid paths
		expect(path1).toBeTruthy()
		expect(path2).toBeTruthy()
	})
})

describe('getRelativePath', () => {
	test('should return relative path for nested file', () => {
		const basePath = '/base/path'
		const filePath = '/base/path/subdir/file.txt'
		const relativePath = getRelativePath(basePath, filePath)

		expect(relativePath).toBe('subdir/file.txt')
	})

	test('should return null for path outside base', () => {
		const basePath = '/base/path'
		const filePath = '/other/path/file.txt'
		const relativePath = getRelativePath(basePath, filePath)

		expect(relativePath).toBeNull()
	})

	test('should handle same path', () => {
		const basePath = '/base/path'
		const filePath = '/base/path'
		const relativePath = getRelativePath(basePath, filePath)

		expect(relativePath).toBe('')
	})

	test('should handle base path with trailing slash', () => {
		const basePath = '/base/path/'
		const filePath = '/base/path/file.txt'
		const relativePath = getRelativePath(basePath, filePath)

		expect(relativePath).toBeTruthy()
		expect(relativePath).not.toBeNull()
	})

	test('should handle parent directory traversal', () => {
		const basePath = '/base/path'
		const filePath = '/base/file.txt'
		const relativePath = getRelativePath(basePath, filePath)

		// Should return null as it requires going up
		expect(relativePath).toBeNull()
	})
})

/* === Integration Tests: File Operations === */

describe('createFileInfo', () => {
	let tempDir: { path: string; cleanup: () => void }

	beforeEach(() => {
		tempDir = createTempDir()
	})

	afterEach(() => {
		tempDir.cleanup()
	})

	test('should create file info for existing file', async () => {
		const content = 'test content'
		const filename = 'test.txt'
		const filePath = createTempFile(tempDir.path, filename, content)

		const fileInfo = await createFileInfo(filePath, filename)

		expect(fileInfo.exists).toBe(true)
		expect(fileInfo.filename).toBe(filename)
		expect(fileInfo.path).toBe(filePath)
		expect(fileInfo.content).toBe(content)
		expect(fileInfo.hash).toBeTruthy()
		expect(fileInfo.hash.length).toBe(16)
		expect(fileInfo.size).toBe(content.length)
		expect(fileInfo.lastModified).toBeGreaterThan(0)
	})

	test('should return fallback for non-existent file', async () => {
		const filename = 'nonexistent.txt'
		const filePath = getFilePath(tempDir.path, filename)

		const fileInfo = await createFileInfo(filePath, filename)

		expect(fileInfo.exists).toBe(false)
		expect(fileInfo.filename).toBe(filename)
		expect(fileInfo.path).toBe(filePath)
		expect(fileInfo.content).toBe('')
		expect(fileInfo.hash).toBe('')
		expect(fileInfo.size).toBe(0)
		expect(fileInfo.lastModified).toBe(0)
	})

	test('should handle unicode content', async () => {
		const content = '测试内容 🚀 émojis'
		const filename = 'unicode.txt'
		const filePath = createTempFile(tempDir.path, filename, content)

		const fileInfo = await createFileInfo(filePath, filename)

		expect(fileInfo.exists).toBe(true)
		expect(fileInfo.content).toBe(content)
		expect(fileInfo.hash).toBeTruthy()
	})

	test('should handle empty file', async () => {
		const content = ''
		const filename = 'empty.txt'
		const filePath = createTempFile(tempDir.path, filename, content)

		const fileInfo = await createFileInfo(filePath, filename)

		expect(fileInfo.exists).toBe(true)
		expect(fileInfo.content).toBe('')
		expect(fileInfo.size).toBe(0)
	})
})

describe('writeFileSafe', () => {
	let tempDir: { path: string; cleanup: () => void }

	beforeEach(() => {
		tempDir = createTempDir()
	})

	afterEach(() => {
		tempDir.cleanup()
	})

	test('should write file successfully', async () => {
		const filename = 'test.txt'
		const content = 'test content'
		const filePath = getFilePath(tempDir.path, filename)

		const result = await writeFileSafe(filePath, content)

		expect(result).toBe(true)
		expect(fileExists(filePath)).toBe(true)

		const fileInfo = await createFileInfo(filePath, filename)
		expect(fileInfo.content).toBe(content)
	})

	test('should create nested directories', async () => {
		const filename = 'nested/deep/file.txt'
		const content = 'test content'
		const filePath = getFilePath(tempDir.path, filename)

		const result = await writeFileSafe(filePath, content)

		expect(result).toBe(true)
		expect(fileExists(filePath)).toBe(true)
	})

	test('should overwrite existing file', async () => {
		const filename = 'test.txt'
		const content1 = 'original content'
		const content2 = 'updated content'
		const filePath = getFilePath(tempDir.path, filename)

		await writeFileSafe(filePath, content1)
		const result = await writeFileSafe(filePath, content2)

		expect(result).toBe(true)

		const fileInfo = await createFileInfo(filePath, filename)
		expect(fileInfo.content).toBe(content2)
	})

	test('should handle unicode content', async () => {
		const filename = 'unicode.txt'
		const content = '测试内容 🚀 émojis'
		const filePath = getFilePath(tempDir.path, filename)

		const result = await writeFileSafe(filePath, content)

		expect(result).toBe(true)

		const fileInfo = await createFileInfo(filePath, filename)
		expect(fileInfo.content).toBe(content)
	})

	test('should handle empty content', async () => {
		const filename = 'empty.txt'
		const content = ''
		const filePath = getFilePath(tempDir.path, filename)

		const result = await writeFileSafe(filePath, content)

		expect(result).toBe(true)

		const fileInfo = await createFileInfo(filePath, filename)
		expect(fileInfo.content).toBe('')
	})
})

describe('getCompressedBuffer', () => {
	test('should return brotli compressed when accepted', () => {
		const buffer = Buffer.from('test content'.repeat(100))
		const context = mockRequestContext({
			acceptsBrotli: true,
			acceptsGzip: false,
		})

		const result = getCompressedBuffer(buffer, context)

		expect(result.encoding).toBe('br')
		expect(result.content).toBeInstanceOf(Buffer)
		expect(result.content.length).toBeLessThan(buffer.length)
	})

	test('should return gzip compressed when accepted', () => {
		const buffer = Buffer.from('test content'.repeat(100))
		const context = mockRequestContext({
			acceptsBrotli: false,
			acceptsGzip: true,
		})

		const result = getCompressedBuffer(buffer, context)

		expect(result.encoding).toBe('gzip')
		expect(result.content).toBeInstanceOf(Buffer)
		expect(result.content.length).toBeLessThan(buffer.length)
	})

	test('should prefer brotli over gzip when both accepted', () => {
		const buffer = Buffer.from('test content'.repeat(100))
		const context = mockRequestContext({
			acceptsBrotli: true,
			acceptsGzip: true,
		})

		const result = getCompressedBuffer(buffer, context)

		expect(result.encoding).toBe('br')
	})

	test('should return identity when no compression accepted', () => {
		const buffer = Buffer.from('test content')
		const context = mockRequestContext({
			acceptsBrotli: false,
			acceptsGzip: false,
		})

		const result = getCompressedBuffer(buffer, context)

		expect(result.encoding).toBe('identity')
		expect(result.content).toBe(buffer)
	})

	test('should handle empty buffer', () => {
		const buffer = Buffer.from('')
		const context = mockRequestContext({
			acceptsBrotli: true,
			acceptsGzip: true,
		})

		const result = getCompressedBuffer(buffer, context)

		expect(result.content).toBeInstanceOf(Buffer)
		expect(result.encoding).toBeTruthy()
	})

	test('should handle large buffer', () => {
		const buffer = Buffer.from('a'.repeat(100000))
		const context = mockRequestContext({
			acceptsBrotli: true,
			acceptsGzip: false,
		})

		const result = getCompressedBuffer(buffer, context)

		expect(result.encoding).toBe('br')
		expect(result.content.length).toBeLessThan(buffer.length)
		// Brotli should compress repeated content very well
		expect(result.content.length).toBeLessThan(buffer.length / 10)
	})
})

describe('isPlaywrightRunning', () => {
	const originalEnv = { ...process.env }
	const originalArgv = [...process.argv]

	afterEach(() => {
		// Restore original environment
		process.env = { ...originalEnv }
		process.argv = [...originalArgv]
	})

	test('should detect PLAYWRIGHT_TEST_BASE_URL', () => {
		process.env.PLAYWRIGHT_TEST_BASE_URL = 'http://localhost:3000'
		expect(isPlaywrightRunning()).toBe(true)
	})

	test('should detect PLAYWRIGHT', () => {
		process.env.PLAYWRIGHT = '1'
		expect(isPlaywrightRunning()).toBe(true)
	})

	test('should detect PWTEST_SKIP_TEST_OUTPUT', () => {
		process.env.PWTEST_SKIP_TEST_OUTPUT = '1'
		expect(isPlaywrightRunning()).toBe(true)
	})

	test('should detect playwright in argv', () => {
		process.argv = ['node', 'test.js', '--playwright']
		expect(isPlaywrightRunning()).toBe(true)
	})

	test('should return false when not running under Playwright', () => {
		delete process.env.PLAYWRIGHT_TEST_BASE_URL
		delete process.env.PLAYWRIGHT
		delete process.env.PWTEST_SKIP_TEST_OUTPUT
		process.argv = ['node', 'test.js']

		expect(isPlaywrightRunning()).toBe(false)
	})
})

describe('fileExists', () => {
	let tempDir: { path: string; cleanup: () => void }

	beforeEach(() => {
		tempDir = createTempDir()
	})

	afterEach(() => {
		tempDir.cleanup()
	})

	test('should return true for existing file', () => {
		const filename = 'test.txt'
		const filePath = createTempFile(tempDir.path, filename, 'content')

		expect(fileExists(filePath)).toBe(true)
	})

	test('should return false for non-existent file', () => {
		const filePath = getFilePath(tempDir.path, 'nonexistent.txt')

		expect(fileExists(filePath)).toBe(false)
	})

	test('should return true for directory', () => {
		expect(fileExists(tempDir.path)).toBe(true)
	})
})
