/**
 * The runtime seam (LT-267).
 *
 * The build's file IO and process spawning go through this interface so the
 * corpus compile — the published package's own build path — is not Bun-only.
 * Two implementations exist: `bun.ts` (Bun.file / Bun.write / Bun.spawn /
 * Bun.Glob) and `node.ts` (node:fs / node:child_process), selected once at
 * module load (`index.ts`). `server/compiler/` stays free of this module and
 * of every runtime-specific API: it is pure computation over strings (ADR
 * 0036 s4), and the emitted `.ts`/`.css` files — the interface consumers
 * actually get — are standard output any bundler takes.
 *
 * Glob PATTERN semantics are deliberately NOT per-runtime: `glob.ts` holds
 * one shared translator used by both implementations, so a consumer's
 * configured globs cannot match one file set under Bun and another under
 * Node. What differs is only the machinery underneath read/write/spawn.
 */

/** Options for `scanGlob`. */
export type GlobScanOptions = {
	/** Directory the pattern is matched against; returned paths are relative to it. */
	cwd: string
}

/** Options for `spawn`. Defaults to `'inherit'` for both streams. */
export type SpawnOptions = {
	/** Working directory for the child process. */
	cwd?: string
	/** `'inherit'` streams to the parent's stdout (captured result: `''`). */
	stdout?: 'inherit' | 'pipe'
	/** `'inherit'` streams to the parent's stderr (captured result: `''`). */
	stderr?: 'inherit' | 'pipe'
}

/** The outcome of one spawned process. Captured streams are `''` when inherited. */
export type SpawnResult = {
	exitCode: number
	stdout: string
	stderr: string
}

/** The file-IO and process-spawn surface the build orchestration calls. */
export type RuntimeIO = {
	/** Which implementation answered — for logs and the portability check. */
	readonly name: 'bun' | 'node'
	/** Whole file as UTF-8 text. */
	readTextFile(path: string): Promise<string>
	/** Whether a regular file exists at `path`. */
	fileExists(path: string): Promise<boolean>
	/** Write UTF-8 text, creating parent directories. */
	writeTextFile(path: string, content: string): Promise<void>
	/** Copy a file byte-for-byte (binary-safe), creating parent directories. */
	copyFile(source: string, dest: string): Promise<void>
	/** Delete a file; a missing file is not an error. */
	removeFile(path: string): Promise<void>
	/**
	 * Every FILE the glob selects under `cwd`, as sorted relative paths with
	 * forward slashes. Dotfiles and directories inside dot-directories never
	 * match unless the pattern segment itself starts with a dot. Synchronous
	 * on purpose: both implementations have sync primitives, and the build's
	 * discovery phases are sequential by construction.
	 */
	scanGlob(pattern: string, options: GlobScanOptions): string[]
	/** Full-path glob match — the same semantics `scanGlob` applies. */
	matchGlob(pattern: string, path: string): boolean
	/** Spawn a process; never throws on a non-zero exit (callers branch on it). */
	spawn(
		command: readonly string[],
		options?: SpawnOptions,
	): Promise<SpawnResult>
}
