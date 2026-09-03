/**
 * The synchronous serialization boundary (ADR 0027 sub-design 9, LT-151).
 *
 * ADR 0024 s13 does not merely observe that the server render is synchronous —
 * it *guarantees* it, and the `@try` arm choice rests on that guarantee. Under
 * execution the guarantee becomes a race: whichever microtasks happen to drain
 * between instantiation and serialization would otherwise decide which arm
 * ships, and CHECKLIST §9 forbids shipping a resolved branch while the client
 * still constructs a pending one.
 *
 * So it is a driver-level assertion, not a convention. `runSynchronously()`
 * detects an `await` in the instantiate→serialize window two ways, because
 * either alone is escapable:
 *
 * 1. A microtask queued before the window runs. If it has run by the time the
 *    window returns, the queue drained — something awaited.
 * 2. The window returned a thenable. An `async` body returns before its own
 *    awaits resolve, so check 1 alone would pass a boundary that is entirely
 *    asynchronous.
 *
 * Note the scope: this governs the instantiate→serialize window only. A
 * resolution phase BEFORE the simulation may await deliberately — that is what
 * a build-time data dependency needs (sub-design 9, "two phases, and only the
 * second is synchronous").
 */

/** Thrown when the instantiate→serialize window was not synchronous. */
export class SimulationBoundaryError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'SimulationBoundaryError'
	}
}

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
	(typeof value === 'object' || typeof value === 'function') &&
	value !== null &&
	typeof (value as { then?: unknown }).then === 'function'

/**
 * Run the instantiate→serialize window and assert it never yielded.
 *
 * @param work - the window: instantiate, let the upgrade run, serialize
 * @param label - what is being rendered, for the error message
 * @returns whatever `work` returned
 * @throws {SimulationBoundaryError} if `work` awaited or returned a promise
 */
export function runSynchronously<T>(work: () => T, label: string): T {
	let drained = false
	queueMicrotask(() => {
		drained = true
	})

	const result = work()

	if (isThenable(result))
		throw new SimulationBoundaryError(
			`Serialization boundary for ${label} returned a promise. ` +
				'The instantiate→serialize window must be synchronous (ADR 0027 ' +
				'sub-design 9) so the compiler, not microtask timing, decides which ' +
				'@try arm ships. Await build-time data in the resolution phase, before ' +
				'the simulation.',
		)
	if (drained)
		throw new SimulationBoundaryError(
			`Serialization boundary for ${label} awaited. The microtask queue ` +
				'drained between instantiation and serialization, so a pending @try ' +
				'task could resolve into the HTML non-deterministically (ADR 0027 ' +
				'sub-design 9). Await build-time data in the resolution phase, before ' +
				'the simulation.',
		)

	return result
}
