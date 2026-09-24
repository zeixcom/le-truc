/**
 * The runtime seam (LT-267): glob semantics, the Node implementation's file
 * and spawn behavior, and Bun↔Node parity on the patterns the build actually
 * uses.
 *
 * The glob translator is ONE shared implementation (`server/runtimes/glob.ts`)
 * — the tests pin it against Bun.Glob on the repo's real trees, because the
 * scanner it replaced WAS Bun.Glob and a consumer's configured corpus must
 * not change because the runtime did. The Node implementation is exercised
 * directly (it loads fine under Bun — it only touches node: APIs), so a
 * regression there fails here and not first in the cross-runtime check.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { globToRegExp, matchGlob, scanGlobSync } from '../runtimes/glob'
import { io as nodeIO } from '../runtimes/node'

/* === Test Fixture === */

let fixtureDir: string

beforeAll(() => {
	fixtureDir = mkdtempSync(join(tmpdir(), 'le-truc-runtimes-'))
	mkdirSync(join(fixtureDir, 'src', 'deep', 'deeper'), { recursive: true })
	mkdirSync(join(fixtureDir, 'src', 'mocks'), { recursive: true })
	mkdirSync(join(fixtureDir, 'src', '.hidden'), { recursive: true })
	writeFileSync(join(fixtureDir, 'src', 'top.ts'), 'export {}')
	writeFileSync(join(fixtureDir, 'src', 'top.css'), 'x {}')
	writeFileSync(join(fixtureDir, 'src', '.dotfile.css'), 'x {}')
	writeFileSync(join(fixtureDir, 'src', 'deep', 'one.tsx'), 'export {}')
	writeFileSync(join(fixtureDir, 'src', 'deep', 'two.tsrx'), 'export {}')
	writeFileSync(join(fixtureDir, 'src', 'deep', 'deeper', 'three.ts'), 'e {}')
	writeFileSync(join(fixtureDir, 'src', 'mocks', 'mock.html'), '<p>')
	writeFileSync(join(fixtureDir, 'src', '.hidden', 'x.ts'), 'e {}')
})

afterAll(() => {
	rmSync(fixtureDir, { recursive: true, force: true })
})

/* === Glob Translator === */

describe('globToRegExp / matchGlob', () => {
	test('a segment-scoped star never crosses a slash', () => {
		expect(matchGlob('*.css', 'top.css')).toBe(true)
		expect(matchGlob('*.css', 'deep/one.css')).toBe(false)
	})

	test('`**/` matches zero or more directories', () => {
		expect(matchGlob('**/*.tsrx', 'top.tsrx')).toBe(true)
		expect(matchGlob('**/*.tsrx', 'deep/deeper/three.tsrx')).toBe(true)
		expect(matchGlob('**/mocks/**', 'mocks/mock.html')).toBe(true)
		expect(matchGlob('**/mocks/**', 'deep/mocks/mock.html')).toBe(true)
	})

	test('an interior `**` keeps the adjacency of its neighbours', () => {
		expect(matchGlob('src/**/three.ts', 'src/three.ts')).toBe(true)
		expect(matchGlob('src/**/three.ts', 'src/deep/deeper/three.ts')).toBe(true)
		expect(matchGlob('src/**/three.ts', 'src/deep/one.tsx')).toBe(false)
	})

	test('a trailing `**` requires its slash', () => {
		expect(matchGlob('src/**', 'src/top.ts')).toBe(true)
		expect(matchGlob('src/**', 'top.ts')).toBe(false)
	})

	test('regex metacharacters in a pattern are literal', () => {
		expect(matchGlob('a+b/(c).ts', 'a+b/(c).ts')).toBe(true)
		expect(matchGlob('a+b/(c).ts', 'aab/(c).ts')).toBe(false)
	})

	test('wildcards do not match dotfiles; a literal dot segment does', () => {
		expect(matchGlob('*.css', '.dotfile.css')).toBe(false)
		expect(matchGlob('.dotfile.css', '.dotfile.css')).toBe(true)
		expect(matchGlob('**/*.ts', '.hidden/x.ts')).toBe(false)
		expect(matchGlob('.hidden/*.ts', '.hidden/x.ts')).toBe(true)
	})

	test('generated regexes are anchored', () => {
		expect(globToRegExp('*.ts').source.startsWith('^')).toBe(true)
		expect(globToRegExp('*.ts').source.endsWith('$')).toBe(true)
	})
})

describe('scanGlobSync', () => {
	test('scans recursively, files only, sorted, relative to cwd', () => {
		expect(scanGlobSync('**/*.ts', join(fixtureDir, 'src'))).toEqual([
			'deep/deeper/three.ts',
			'top.ts',
		])
	})

	test('never yields dotfiles or their contents', () => {
		const all = scanGlobSync('**/*', fixtureDir)
		expect(all.some(path => path.includes('.hidden'))).toBe(false)
		expect(all.some(path => path.includes('.dotfile'))).toBe(false)
	})
})

/* === Node implementation === */

describe('nodeIO (LT-267 seam, Node half)', () => {
	test('readTextFile / writeTextFile round-trip and create parent dirs', async () => {
		const path = join(fixtureDir, 'nested', 'dir', 'file.txt')
		await nodeIO.writeTextFile(path, 'héllo')
		expect(await nodeIO.readTextFile(path)).toBe('héllo')
	})

	test('copyFile is binary-safe and creates parent dirs', async () => {
		const source = join(fixtureDir, 'blob.bin')
		writeFileSync(source, Buffer.from([0x00, 0xff, 0x10, 0x82]))
		const dest = join(fixtureDir, 'copied', 'blob.bin')
		await nodeIO.copyFile(source, dest)
		const back = await nodeIO.readTextFile(dest)
		expect(back.length).toBe(4)
		expect(back.charCodeAt(0)).toBe(0x00)
	})

	test('removeFile deletes a file and tolerates absence', async () => {
		const path = join(fixtureDir, 'doomed.txt')
		writeFileSync(path, 'x')
		await nodeIO.removeFile(path)
		expect(await nodeIO.fileExists(path)).toBe(false)
		await nodeIO.removeFile(path)
	})

	test('fileExists answers files and absence', async () => {
		expect(
			await nodeIO.fileExists(join(fixtureDir, 'nested', 'dir', 'file.txt')),
		).toBe(true)
		expect(await nodeIO.fileExists(join(fixtureDir, 'nope.txt'))).toBe(false)
	})

	test('scanGlob matches the shared translator, sorted', () => {
		expect(
			nodeIO.scanGlob('**/*.ts', { cwd: join(fixtureDir, 'src') }),
		).toEqual(['deep/deeper/three.ts', 'top.ts'])
	})

	test('spawn captures piped streams and the exit code', async () => {
		const result = await nodeIO.spawn(['bun', '-e', 'console.log("out")'], {
			stdout: 'pipe',
			stderr: 'pipe',
		})
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe('out')
	})

	test('spawn reports a non-zero exit without throwing', async () => {
		const result = await nodeIO.spawn(['bun', '-e', 'process.exit(3)'], {
			stdout: 'pipe',
			stderr: 'pipe',
		})
		expect(result.exitCode).toBe(3)
	})
})

/* === Bun parity on the real trees === */

describe('glob parity with Bun.Glob (the scanner this replaces)', () => {
	const REPO_PATTERNS: Array<[pattern: string, cwd: string]> = [
		['**/*.ts', 'examples'],
		['**/*.tsx', 'examples'],
		['**/*.tsrx', 'examples'],
		['**/*.ts', 'src'],
		['**/*.md', 'docs-src/pages'],
		['**/*', 'docs-src/static'],
	]

	for (const [pattern, cwd] of REPO_PATTERNS) {
		test(`${pattern} under ${cwd}/`, () => {
			const ours = scanGlobSync(pattern, cwd)
			const bun = [
				...new Bun.Glob(pattern).scanSync({ cwd, onlyFiles: true }),
			].sort()
			expect(ours).toEqual(bun)
		})
	}
})
