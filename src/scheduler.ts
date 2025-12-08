/* === Constants === */

// High-frequency events that are passive by default and should be scheduled
const PASSIVE_EVENTS = new Set([
	'scroll',
	'resize',
	'mousewheel',
	'touchstart',
	'touchmove',
	'wheel',
])

/* === Internal === */

const pendingElements = new Set<Element>()
const tasks = new WeakMap<Element, () => void>()
let requestId: number | undefined

const runTasks = () => {
	requestId = undefined
	const elements = Array.from(pendingElements)
	pendingElements.clear()
	for (const element of elements) tasks.get(element)?.()
}

const requestTick = () => {
	if (requestId) cancelAnimationFrame(requestId)
	requestId = requestAnimationFrame(runTasks)
}

/* === Exported Function === */

/**
 * Schedule a task to be executed on the next animation frame, with automatic
 * deduplication per component. If the same component schedules multiple tasks
 * before the next frame, only the latest task will be executed.
 *
 * @param element - Element for deduplication
 * @param task - Function to execute (typically calls batch() or sets a signal)
 */
const schedule = (element: Element, task: () => void) => {
	tasks.set(element, task)
	pendingElements.add(element)
	requestTick()
}

export { PASSIVE_EVENTS, schedule }
