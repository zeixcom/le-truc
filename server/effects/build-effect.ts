/**
 * Shared Build Effect Wrapper
 *
 * Every effect in server/effects/ reacts to one or more file signals and
 * writes output to disk. Each one used to hand-roll the same `ready`
 * promise/`resolve`/`firstRun` bookkeeping — and every hand-rolled copy
 * resolved `ready` unconditionally, even after a failure, so a broken first
 * build could still report success. `createBuildEffect` centralizes that
 * bookkeeping with the semantics `build.ts` actually needs: a failure on the
 * very first run rejects `ready` (a one-shot `build:docs` must fail loudly
 * rather than silently ship incomplete output), while a failure on a later,
 * file-watch-triggered run is logged and the effect just waits for the next
 * change (a live dev server shouldn't crash on a typo).
 */

import { createEffect, match, type Signal } from '@zeix/cause-effect'

/* === Types === */

/** Context passed to a build effect's `run` callback. */
type BuildEffectContext = {
	/** True on the effect's very first run (the initial build). */
	firstRun: boolean
}

/** What every effect factory in server/effects/ returns. */
type BuildEffectHandle = {
	cleanup: () => void
	ready: Promise<void>
}

/** Unwraps a tuple of `Signal<T>` into a tuple of their `T`s. */
type SignalValues<T extends readonly Signal<unknown & {}>[]> = {
	[K in keyof T]: T[K] extends Signal<infer V> ? V : never
}

/* === Exported Functions === */

/**
 * Creates a build effect: `createEffect(() => match(signals, {...}))` plus
 * the `ready`/`resolve`/`reject`/`firstRun` bookkeeping every effect needs.
 *
 * `run` receives the resolved signal values and a `{ firstRun }` context; it
 * should perform the effect's work and throw (or reject) on failure. Do not
 * call `onRebuild` yourself — it's invoked automatically after `run`
 * succeeds on a non-first run, matching what every hand-rolled effect did.
 *
 * @param label - Short, human-readable name used in error logs (e.g. `'CSS assets'`)
 * @param signals - Tuple of signals to read; forwarded to `match()`
 * @param run - The effect's work; throwing fails the run
 * @param onRebuild - Called after a successful non-first run (e.g. to trigger HMR reload)
 */
export const createBuildEffect = <T extends readonly Signal<unknown & {}>[]>(
	label: string,
	signals: readonly [...T],
	run: (
		values: SignalValues<T>,
		ctx: BuildEffectContext,
	) => Promise<void> | void,
	onRebuild?: () => void,
): BuildEffectHandle => {
	let resolve: (() => void) | undefined
	let reject: ((reason?: unknown) => void) | undefined
	const ready = new Promise<void>((res, rej) => {
		resolve = res
		reject = rej
	})
	// `resolve`/`reject` become undefined after the effect settles once,
	// so later runs never touch the (already-settled) `ready` promise.
	const settle = () => {
		resolve = undefined
		reject = undefined
	}

	const cleanup = createEffect(() => {
		match(signals, {
			ok: async values => {
				const firstRun = !!resolve
				try {
					await run(values as SignalValues<T>, { firstRun })
					resolve?.()
					if (!firstRun) onRebuild?.()
				} catch (error) {
					console.error(`${label} failed to rebuild:`, error)
					if (firstRun) reject?.(error)
				} finally {
					settle()
				}
			},
			err: errors => {
				console.error(`${label} failed to rebuild:`, errors[0])
				reject?.(errors[0])
				settle()
			},
		})
	})

	return { cleanup, ready }
}

/**
 * Spawns an external tool (TypeDoc, LightningCSS, `bun build`, ...) with
 * inherited stdio and throws if it exits non-zero, so a failing subprocess
 * becomes a `run` failure instead of a console.error that build effects used
 * to swallow.
 */
export const runCommand = async (
	cmd: string[],
	options?: { cwd?: string },
): Promise<void> => {
	const proc = Bun.spawn(cmd, {
		stdout: 'inherit',
		stderr: 'inherit',
		...(options?.cwd ? { cwd: options.cwd } : {}),
	})
	const exitCode = await proc.exited
	if (exitCode !== 0) {
		throw new Error(`${cmd[0]} exited with code ${exitCode}`)
	}
}
