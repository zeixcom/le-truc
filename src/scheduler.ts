/* === Types === */

type Updater = <T>() => T | boolean | undefined

/* === Internal === */

// Map of deduplication symbols to update functions (using Symbol keys prevents unintended overwrites)
const updateMap = new Map<symbol, Updater>()
let requestId: number | undefined

const updateDOM = () => {
	requestId = undefined
	const updates = Array.from(updateMap.values())
	updateMap.clear()
	for (const update of updates) update()
}

const requestTick = () => {
	if (requestId) cancelAnimationFrame(requestId)
	requestId = requestAnimationFrame(updateDOM)
}

// Initial render when the call stack is empty
queueMicrotask(updateDOM)

/* === Exported Function === */

/**
 * Schedule a function to be executed on the next animation frame
 *
 * If the same Symbol is provided for multiple calls before the next animation frame,
 * only the latest call will be executed (deduplication).
 *
 * @param {Updater} fn - function to be executed on the next animation frame; can return updated value <T>, success <boolean> or void
 * @param {symbol} dedupe - Symbol for deduplication; if not provided, a unique Symbol is created ensuring the update is always executed
 */
const schedule = <T>(fn: Updater, dedupe?: symbol) =>
	new Promise<T | boolean | undefined>((resolve, reject) => {
		updateMap.set(dedupe || Symbol(), (): undefined => {
			try {
				resolve(fn())
			} catch (error) {
				reject(error)
			}
		})
		requestTick()
	})

export { type Updater, schedule }
