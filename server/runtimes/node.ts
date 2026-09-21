/**
 * The Node implementation of the runtime seam (LT-267).
 *
 * Uses only node: APIs — fs for files, child_process for spawning and the
 * shared glob walk. Every node: module used here is implemented by Bun and
 * Deno as well, so this file also loads anywhere; it is simply not the one
 * selected outside Node (`index.ts`).
 */

import { spawn as spawnProcess } from 'node:child_process'
import { constants as fsConstants } from 'node:fs'
import {
	access,
	copyFile as copyFileFs,
	mkdir,
	readFile,
	writeFile,
} from 'node:fs/promises'
import { dirname } from 'node:path'
import { matchGlob, scanGlobSync } from './glob'
import type { GlobScanOptions, RuntimeIO, SpawnOptions } from './types'

const ensureParentDir = (path: string): string => dirname(path)

const io: RuntimeIO = {
	name: 'node',

	async readTextFile(path) {
		return await readFile(path, 'utf8')
	},

	async fileExists(path) {
		try {
			await access(path, fsConstants.F_OK)
			return true
		} catch {
			return false
		}
	},

	async writeTextFile(path, content) {
		await mkdir(ensureParentDir(path), { recursive: true })
		await writeFile(path, content, 'utf8')
	},

	async copyFile(source, dest) {
		await mkdir(ensureParentDir(dest), { recursive: true })
		await copyFileFs(source, dest)
	},

	scanGlob(pattern, options: GlobScanOptions) {
		return scanGlobSync(pattern, options.cwd)
	},

	matchGlob,

	async spawn(command, options?: SpawnOptions) {
		const stdoutMode = options?.stdout ?? 'inherit'
		const stderrMode = options?.stderr ?? 'inherit'
		return await new Promise(resolve => {
			const child = spawnProcess(command[0] as string, command.slice(1), {
				stdio: ['ignore', stdoutMode, stderrMode],
				...(options?.cwd ? { cwd: options.cwd } : {}),
			})
			const stdout: Buffer[] = []
			const stderr: Buffer[] = []
			child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk))
			child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk))
			child.on('error', error => {
				// The process could not be spawned at all — surface it as a
				// non-zero exit carrying the reason, like a shell would.
				resolve({
					exitCode: 127,
					stdout: '',
					stderr: String(error),
				})
			})
			child.on('close', code => {
				resolve({
					exitCode: code ?? -1,
					stdout: Buffer.concat(stdout).toString('utf8'),
					stderr: Buffer.concat(stderr).toString('utf8'),
				})
			})
		})
	},
}

export { io }
