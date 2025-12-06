/* === Types === */

type Task = () => void

/* === Internal === */

const pendingComponents = new Set<HTMLElement>()
const tasks = new WeakMap<HTMLElement, Task>()
let requestId: number | undefined

const runTasks = () => {
	requestId = undefined
	const components = Array.from(pendingComponents)
	pendingComponents.clear()
	for (const component of components) tasks.get(component)?.()
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
 * @param component - Component instance for deduplication
 * @param task - Function to execute (typically calls batch() or sets a signal)
 */
const schedule = (component: HTMLElement, task: Task) => {
	tasks.set(component, task)
	pendingComponents.add(component)
	requestTick()
}

export { type Task, schedule }
