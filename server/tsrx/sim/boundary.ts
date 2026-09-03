/**
 * The serialization boundary (ADR 0027 sub-design 9, LT-151, amended by
 * LT-154 on 2026-09-03).
 *
 * LT-151 built this as a STRICTLY SYNCHRONOUS window: any microtask drain
 * between instantiate and serialize threw. Measuring composition against the
 * corpus proved that wrong — `resolveDependencies` (`src/helpers/dom.ts`)
 * defers effect activation by a microtask whenever a component queries a
 * custom child, so a synchronous window drops every composing parent's
 * effects (`form-colorgraph` serialized 2343 chars instead of 3302). The
 * library is not changed: a defined child is not necessarily a connected
 * one, and the deferral is load-bearing in the browser.
 *
 * The window is now HERMETIC QUIESCENCE instead: it performs no driver IO,
 * advances no timer, and drains the realm's microtask queue to a bounded
 * quiescence before serializing. Microtask-only, so jsdom timers never fire.
 * The drain is safe only because the realm is hermetic (`patch-table.ts`'s
 * closed network, `realm.ts`'s never-settling stub) — nothing inside the
 * window can settle a task to override the compiler's arm choice.
 *
 * Two rules survive the amendment, at different layers:
 *
 * 1. The instantiate→PARSE step itself (`assertSynchronousWindow`, below)
 *    still must not itself return a promise or yield before its own
 *    microtask boundary — an `async` upgrade callback is still a bug the
 *    driver refuses, because it would make the FIRST turn's content depend
 *    on unrelated scheduling rather than on the parse pass.
 * 2. Quiescence is bounded (`drainToQuiescence`, below): a reactive loop
 *    that never settles surfaces as a `non-quiescent` build warning
 *    attributed to the component, not a hang.
 */

/** Thrown when the instantiate→parse window itself was not synchronous. */
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
 * Run the instantiate→parse step and assert it never yielded on its own.
 * This is NOT the whole serialization boundary (see module header) — it
 * guards only the synchronous parse+upgrade pass; quiescence draining
 * happens after, deliberately, via `drainToQuiescence`.
 *
 * @param work - the step: parse markup, replay definitions, let the
 *   upgrade run
 * @param label - what is being rendered, for the error message
 * @returns whatever `work` returned
 * @throws {SimulationBoundaryError} if `work` awaited or returned a promise
 */
export function assertSynchronousWindow<T>(work: () => T, label: string): T {
	let drained = false
	queueMicrotask(() => {
		drained = true
	})

	const result = work()

	if (isThenable(result))
		throw new SimulationBoundaryError(
			`Serialization boundary for ${label} returned a promise. ` +
				'The instantiate→parse step must be synchronous (ADR 0027 ' +
				'sub-design 9). Await build-time data in the resolution phase, ' +
				'before the simulation.',
		)
	if (drained)
		throw new SimulationBoundaryError(
			`Serialization boundary for ${label} awaited. The microtask queue ` +
				'drained during the parse+upgrade pass itself, before quiescence ' +
				'draining even began (ADR 0027 sub-design 9). Await build-time ' +
				'data in the resolution phase, before the simulation.',
		)

	return result
}

export type QuiescenceResult = {
	/** The value `read()` returned once it stopped changing. */
	value: string
	/** Microtask turns elapsed until stability (>= 1). */
	turns: number
	/** False when `maxTurns` expired with the value still changing. */
	quiescent: boolean
}

/**
 * Drain the realm's microtask queue to quiescence, reading `read()` after
 * every turn. Microtask-only (`await Promise.resolve()`), so jsdom timers
 * never fire and the drain cannot itself advance real time. Bounded: a
 * reactive loop that never settles returns `quiescent: false` after
 * `maxTurns` rather than hanging the build — callers turn that into a
 * `non-quiescent` diagnostic, never a throw (ADR 0027 sub-design 9).
 *
 * The realm must stay alive for the caller's lifetime of this call —
 * draining after `dispose()` tears the patch-table globals out from under
 * deferred effects.
 *
 * @param read - reads the current serialized state (e.g. the component's
 *   `outerHTML`); called once per turn, including turn 0 before draining
 * @param maxTurns - drain bound; `form-colorgraph` (the composing case that
 *   motivated this) quiesces after exactly one turn, so the default is
 *   generous
 */
export async function drainToQuiescence(
	read: () => string,
	maxTurns = 10,
): Promise<QuiescenceResult> {
	let previous = read()
	for (let turns = 1; turns <= maxTurns; turns++) {
		await Promise.resolve()
		const next = read()
		if (next === previous) return { value: next, turns, quiescent: true }
		previous = next
	}
	return { value: previous, turns: maxTurns, quiescent: false }
}
