/* === Internal === */

const objects = new Set<object>()
const tasks = new WeakMap<object, () => void>()
const throttledCallbacks = new Set<() => void>()
let requestId: number | undefined

const runTasks = () => {
	requestId = undefined
	const elements = Array.from(objects)
	objects.clear()
	for (const element of elements) {
		try {
			tasks.get(element)?.()
		} catch (e) {
			console.error('[le-truc scheduler]', e)
		}
	}
	const callbacks = Array.from(throttledCallbacks)
	throttledCallbacks.clear()
	for (const cb of callbacks) {
		try {
			cb()
		} catch (e) {
			console.error('[le-truc scheduler]', e)
		}
	}
}

const requestTick = () => {
	if (!requestId) requestId = requestAnimationFrame(runTasks)
}

/* === Exported Functions === */

/**
 * Schedules a task to run on the next animation frame. If `key` schedules
 * multiple tasks before the next frame, only the latest task runs.
 *
 * @since 0.11.0
 * @param key - Deduplication key; typically the target Element
 * @param task - Function to run on the next animation frame
 */
const schedule = (key: object, task: () => void) => {
	tasks.set(key, task)
	objects.add(key)
	requestTick()
}

/**
 * Throttles a function to run at most once per animation frame, using the
 * latest call's arguments.
 *
 * @since 2.0.0
 * @param fn - Function to throttle
 * @param signal - When aborted, cancels any pending invocation
 * @returns Throttled function with a `.cancel()` method that discards a pending invocation
 */
const throttle = <T extends (...args: any[]) => void>(
	fn: T,
	signal?: AbortSignal,
): T & { cancel: () => void } => {
	let pending = false
	let lastArgs: Parameters<T>
	const flush = () => {
		pending = false
		fn(...lastArgs)
	}
	const wrapped = (...args: Parameters<T>): void => {
		lastArgs = args
		if (pending) return
		pending = true
		throttledCallbacks.add(flush)
		requestTick()
	}
	wrapped.cancel = () => {
		if (pending) {
			throttledCallbacks.delete(flush)
			pending = false
		}
	}
	signal?.addEventListener('abort', wrapped.cancel, { once: true })
	return wrapped as T & { cancel: () => void }
}

export { schedule, throttle }
