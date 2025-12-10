import { createHash } from 'crypto'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { readFile, stat } from 'fs/promises'
import { dirname, relative } from 'path'
import { FileInfo, PageMetadata } from './types'

export function getRelativePath(
	basePath: string,
	filePath: string,
): string | null {
	try {
		const relativePath = relative(basePath, filePath)
		return relativePath.startsWith('..') ? null : relativePath
	} catch (error) {
		console.error(`Error getting relative path for ${filePath}:`, error)
		return null
	}
}

export function calculateFileHash(content: string): string {
	return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16)
}

export async function createFileInfo(
	filePath: string,
	filename: string,
): Promise<FileInfo> {
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
		if (!existsSync(filePath)) {
			return fallback
		}

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

export function extractFrontmatter(content: string): {
	metadata: PageMetadata
	content: string
} {
	const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
	const match = content.match(frontmatterRegex)

	if (!match) {
		return { metadata: {}, content }
	}

	try {
		// Simple YAML-like parsing for basic frontmatter
		const yamlContent = match[1]
		const metadata: PageMetadata = {}

		const lines = yamlContent.split('\n')
		for (const line of lines) {
			const colonIndex = line.indexOf(':')
			if (colonIndex === -1) continue

			const key = line.slice(0, colonIndex).trim()
			const value = line
				.slice(colonIndex + 1)
				.trim()
				.replace(/^['"]|['"]$/g, '')

			// Parse common metadata fields
			switch (key) {
				case 'title':
				case 'description':
				case 'emoji':
				case 'section':
					metadata[key] = value
					break
				case 'order':
					metadata.order = parseInt(value, 10)
					break
				case 'draft':
					metadata.draft = value === 'true'
					break
				case 'tags':
					metadata.tags = value.split(',').map(t => t.trim())
					break
			}
		}

		return { metadata, content: match[2] }
	} catch (error) {
		console.warn(`Failed to parse frontmatter in content:`, error)
		return { metadata: {}, content: match[2] || content }
	}
}

export function writeFileSyncSafe(filePath: string, content: string): boolean {
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

export function hasFileChanged(
	current: FileInfo | null,
	previous: FileInfo | null,
): boolean {
	if (!current && !previous) return false
	if (!current || !previous) return true

	// Quick check: modification time
	if (current.lastModified !== previous.lastModified) return true

	// Thorough check: content hash
	if (current.hash !== previous.hash) return true

	return false
}
