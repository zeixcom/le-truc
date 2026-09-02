/**
 * Test Utilities
 *
 * Shared helper functions for testing the server and build system.
 * Provides utilities for temporary directories, mock data, and common test patterns.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/* === Temporary Directory Utilities === */

/**
 * Create a temporary directory for testing
 * Returns the path and a cleanup function
 */
export function createTempDir(): { path: string; cleanup: () => void } {
	const tempPath = mkdtempSync(join(tmpdir(), 'le-truc-test-'))

	return {
		path: tempPath,
		cleanup: () => {
			try {
				rmSync(tempPath, { recursive: true, force: true })
			} catch (error) {
				console.error(`Failed to cleanup temp dir ${tempPath}:`, error)
			}
		},
	}
}

/**
 * Create a temporary file with content
 */
export function createTempFile(
	dir: string,
	filename: string,
	content: string,
): string {
	const filePath = join(dir, filename)
	writeFileSync(filePath, content, 'utf8')
	return filePath
}

/**
 * Create a nested directory structure in a temp directory
 */
export function createTempStructure(
	baseDir: string,
	structure: Record<string, string | Record<string, string>>,
): void {
	for (const [key, value] of Object.entries(structure)) {
		if (typeof value === 'string') {
			// Create file
			createTempFile(baseDir, key, value)
		} else {
			// Create directory and recurse
			const dirPath = join(baseDir, key)
			mkdirSync(dirPath, { recursive: true })
			createTempStructure(dirPath, value)
		}
	}
}

/* === Mock Data Generators === */

/**
 * Generate mock markdown content
 */
export function mockMarkdown(options: {
	title?: string
	content?: string
	frontmatter?: Record<string, any>
}): string {
	const {
		title = 'Test Page',
		content = 'Test content',
		frontmatter = {},
	} = options

	const fm = {
		title,
		...frontmatter,
	}

	const frontmatterStr = Object.entries(fm)
		.map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
		.join('\n')

	return `---
${frontmatterStr}
---

${content}
`
}

/**
 * Generate mock HTML content
 */
export function mockHtml(options: {
	title?: string
	body?: string
	head?: string
}): string {
	const {
		title = 'Test Page',
		body = '<p>Test content</p>',
		head = '',
	} = options

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title}</title>
	${head}
</head>
<body>
	${body}
</body>
</html>`
}

/**
 * Generate mock file info
 */
export function mockFileInfo(options: {
	path?: string
	filename?: string
	content?: string
	hash?: string
	lastModified?: number
	size?: number
	exists?: boolean
}) {
	const {
		path = '/test/file.md',
		filename = 'file.md',
		content = 'test content',
		hash = 'abc123def456',
		lastModified = Date.now(),
		size = content.length,
		exists = true,
	} = options

	return {
		path,
		filename,
		content,
		hash,
		lastModified,
		size,
		exists,
	}
}

/* === Assertion Helpers === */

/**
 * Await a promise that may reject and return its outcome for assertion.
 *
 * bun-types types every `expect()` matcher as returning `void`, so
 * `await expect(p).rejects.toThrow(...)` draws TS 80007 ("await has no
 * effect on the type of this expression") even though the runtime
 * promise is real. Await through this instead and assert on the outcome:
 *
 * ```ts
 * const settled = await settle(mayReject())
 * if (settled.status !== 'rejected')
 * 	throw new Error('expected the call to reject')
 * expect(String(settled.reason)).toContain('boom')
 * ```
 */
export function settle<T>(
	promise: Promise<T>,
): Promise<PromiseSettledResult<T>> {
	return promise.then(
		value => ({ status: 'fulfilled', value }),
		reason => ({ status: 'rejected', reason }),
	)
}

/**
 * Assert that a string contains specific text
 */
export function assertContains(actual: string, expected: string): void {
	if (!actual.includes(expected)) {
		throw new Error(
			`Expected string to contain "${expected}" but it didn't.\nActual: ${actual}`,
		)
	}
}

/**
 * Assert that a string does not contain specific text
 */
export function assertNotContains(actual: string, notExpected: string): void {
	if (actual.includes(notExpected)) {
		throw new Error(
			`Expected string not to contain "${notExpected}" but it did.\nActual: ${actual}`,
		)
	}
}

/**
 * Assert that a string matches a regex pattern
 */
export function assertMatches(actual: string, pattern: RegExp): void {
	if (!pattern.test(actual)) {
		throw new Error(
			`Expected string to match pattern ${pattern} but it didn't.\nActual: ${actual}`,
		)
	}
}

/**
 * Assert that HTML is valid (basic checks)
 */
export function assertValidHtml(html: string): void {
	// Check for balanced tags (simplified)
	const openTags = (html.match(/<[^/][^>]*>/g) || []).length
	const closeTags = (html.match(/<\/[^>]*>/g) || []).length

	// Account for self-closing tags
	const selfClosing = (html.match(/<[^>]*\/>/g) || []).length

	// Basic check (not perfect but catches obvious issues)
	if (openTags - selfClosing !== closeTags) {
		throw new Error(
			`HTML appears to have unbalanced tags.\nOpen: ${openTags}, Self-closing: ${selfClosing}, Close: ${closeTags}`,
		)
	}
}

/* === Mock Request Context === */

/**
 * Create a mock request context for server testing
 */
export function mockRequestContext(options: {
	path?: string
	method?: string
	headers?: Record<string, string>
	acceptsGzip?: boolean
	acceptsBrotli?: boolean
}) {
	const {
		path = '/',
		method = 'GET',
		headers = {},
		acceptsGzip = false,
		acceptsBrotli = false,
	} = options

	const headersObj = new Headers(headers)

	return {
		path,
		method,
		headers: headersObj,
		acceptsGzip,
		acceptsBrotli,
	}
}

/* === Timing Utilities === */

/**
 * Wait for a specified amount of time
 */
export async function wait(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry a function until it succeeds or times out
 *
 * `backoff` grows the wait after each failed attempt by the given factor
 * (1 = fixed interval, the default), capped at `maxInterval` — so a
 * starved machine is polled less aggressively while a healthy one still
 * converges at the initial `interval`. The `timeout` budget is wall-clock:
 * when tests sit behind real-world timing (fs watchers, timers), give it
 * enough room for a loaded CI runner, and raise bun's per-test timeout
 * (third `test()` argument) to match — the lower of the two caps is the
 * one that actually fires.
 */
export async function retryUntil<T>(
	fn: () => T | Promise<T>,
	options: {
		timeout?: number
		interval?: number
		backoff?: number
		maxInterval?: number
		condition?: (result: T) => boolean
	} = {},
): Promise<T> {
	const {
		timeout = 5000,
		interval = 100,
		backoff = 1,
		maxInterval = 1000,
		condition = () => true,
	} = options

	const startTime = Date.now()
	let currentInterval = interval

	while (Date.now() - startTime < timeout) {
		try {
			const result = await fn()
			if (condition(result)) {
				return result
			}
		} catch (_error) {
			// Continue retrying
		}
		await wait(currentInterval)
		currentInterval = Math.min(currentInterval * backoff, maxInterval)
	}

	throw new Error(`retryUntil timed out after ${timeout}ms`)
}

/* === Snapshot Utilities === */

/**
 * Normalize whitespace for snapshot comparisons
 */
export function normalizeWhitespace(str: string): string {
	return str.replace(/\s+/g, ' ').trim()
}

/**
 * Normalize HTML for snapshot comparisons
 */
export function normalizeHtml(html: string): string {
	return html.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim()
}

/* === Path Utilities === */

/**
 * Convert Windows paths to Unix-style for cross-platform tests
 */
export function normalizePathForTest(path: string): string {
	return path.replace(/\\/g, '/')
}
