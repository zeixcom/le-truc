/**
 * The Bun implementation of the runtime seam (LT-267).
 *
 * Uses Bun's native file, write, spawn and glob machinery. Loadable under
 * any runtime — everything here touches the `Bun` global only inside method
 * bodies, never at module scope — which is what lets `index.ts` import both
 * implementations statically and still run under Node or Deno.
 */

import { matchGlob } from './glob'
import type { GlobScanOptions, RuntimeIO, SpawnOptions } from './types'

const io: RuntimeIO = {
	name: 'bun',

	async readTextFile(path) {
		return await Bun.file(path).text()
	},

	async fileExists(path) {
		return await Bun.file(path).exists()
	},

	async writeTextFile(path, content) {
		// Bun.write creates parent directories itself.
		await Bun.write(path, content)
	},

	async copyFile(source, dest) {
		await Bun.write(dest, Bun.file(source))
	},

	scanGlob(pattern, options: GlobScanOptions) {
		const matched = [...new Bun.Glob(pattern).scanSync({ cwd: options.cwd })]
		return matched.sort()
	},

	matchGlob,

	async spawn(command, options?: SpawnOptions) {
		const stdoutMode = options?.stdout ?? 'inherit'
		const stderrMode = options?.stderr ?? 'inherit'
		const proc = Bun.spawn([...command], {
			stdout: stdoutMode,
			stderr: stderrMode,
			...(options?.cwd ? { cwd: options.cwd } : {}),
		})
		const [stdout, stderr, exitCode] = await Promise.all([
			stdoutMode === 'pipe' ? new Response(proc.stdout).text() : '',
			stderrMode === 'pipe' ? new Response(proc.stderr).text() : '',
			proc.exited,
		])
		return { exitCode, stdout, stderr }
	},
}

export { io }
