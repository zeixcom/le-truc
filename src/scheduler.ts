/* === Internal === */

const pendingElements = new Set<Element>()
const tasks = new WeakMap<Element, () => void>()
const throttledCallbacks = new Set<() => void>()
let requestId: number | undefined

const runTasks = () => {
	requestId = undefined
	const elements = Array.from(pendingElements)
	pendingElements.clear()
	for (const element of elements) tasks.get(element)?.()
	const callbacks = Array.from(throttledCallbacks)
	throttledCallbacks.clear()
	for (const cb of callbacks) cb()
}

const requestTick = () => {
	if (!requestId) requestId = requestAnimationFrame(runTasks)
}

/* === Exported Functions === */

/**
 * Schedule a task to be executed on the next animation frame, with automatic
 * deduplication per element. If the same element schedules multiple tasks
 * before the next frame, only the latest task will be executed.
 *
 * Used internally by `dangerouslyBindInnerHTML`.
 *
 * @since 0.11.0
 * @param {Element} element - Element used as the deduplication key
 * @param {() => void} task - Function to execute on the next animation frame
 */
const schedule = (element: Element, task: () => void) => {
	tasks.set(element, task)
	pendingElements.add(element)
	requestTick()
}

/**
 * Throttle a function to execute at most once per animation frame, always
 * using the latest arguments. Shares the same RAF tick as `schedule()`.
 *
 * Use this to throttle high-frequency event handlers at the input level,
 * preventing unnecessary churn in the signal graph between frames.
 *
 * The returned function has a `.cancel()` method that discards any pending
 * invocation — call it during cleanup to avoid stale callbacks after
 * an element disconnects.
 *
 * @since 2.0.0
 * @param {T} fn - Function to throttle
 * @param {AbortSignal} [signal] - Optional signal; when aborted, cancels any pending invocation
 * @returns Throttled function with a `.cancel()` method
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
