import { createCell, createTask, defineComponent, untrack } from '../../../index'

/**
 * Teaching component for the "Async State" guide section.
 *
 * One unseeded `Task` fetches a simulated release feed. The request token
 * is its only tracked dependency, so every button click re-runs the task
 * and walks `match()` routing through `nil`, `ok`, `stale`, and `err` —
 * visible as the lit state chip, the response card, and the log.
 */

type Feed = { version: string; fetchedAt: string }

const DELAY = 1600

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
	new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', onAbort)
			resolve()
		}, ms)
		const onAbort = () => {
			clearTimeout(timer)
			reject(signal.reason)
		}
		signal.addEventListener('abort', onAbort, { once: true })
	})

defineComponent('docs-task-states', ({ first, on, watch }) => {
	const states = first('.states', 'Add a .states chip row to docs-task-states.')
	const valueEl = first('output.value', 'Add an output.value to docs-task-states.')
	const errorEl = first('p.error', 'Add a p.error to docs-task-states.')
	const fetchBtn = first('button.fetch', 'Add a fetch button to docs-task-states.')
	const failBox = first('input.fail', 'Add an input.fail checkbox to docs-task-states.')
	const log = first('ol.log', 'Add an ol.log to docs-task-states for the state log.')

	const entries: string[] = []
	const lines = createCell<string[]>([])
	const record = (line: string) => {
		entries.unshift(line)
		if (entries.length > 6) entries.length = 6
		lines.set([...entries])
	}

	// Reading the token inside the task makes it the task's dependency:
	// bumping it re-runs — and aborts — the fetch. The fail flag is read
	// untracked, so ticking the checkbox never triggers a fetch by itself.
	const token = createCell(0)
	const failNext = createCell(false)

	const feed = createTask(async (_prev, signal): Promise<Feed> => {
		const n = token.get()
		await sleep(DELAY, signal)
		if (untrack(() => failNext.get()))
			throw new Error('Network unavailable (simulated)')
		return { version: `2.5.${n}`, fetchedAt: new Date().toLocaleTimeString() }
	})

	let last: Feed | null = null

	// Handler order mirrors routing precedence: nil > err > stale > ok.
	watch(feed, {
		nil: () => {
			states.dataset.state = 'nil'
			record('nil — first run in flight, no value resolved yet')
			valueEl.textContent = 'no value resolved yet'
		},
		err: error => {
			states.dataset.state = 'err'
			record(`err — ${error.message}`)
			valueEl.hidden = true
			errorEl.textContent = error.message
			errorEl.hidden = false
			return () => {
				errorEl.hidden = true
				errorEl.textContent = ''
				valueEl.hidden = false
			}
		},
		stale: () => {
			states.dataset.state = 'stale'
			record(`stale — refetching, keeping ${last?.version} visible`)
			valueEl.style.setProperty('opacity', '0.5')
			return () => valueEl.style.removeProperty('opacity')
		},
		ok: value => {
			last = value
			states.dataset.state = 'ok'
			fetchBtn.textContent = 'Refetch'
			record(`ok — ${value.version} resolved`)
			valueEl.textContent = `${value.version} · fetched ${value.fetchedAt}`
		},
	})

	on(fetchBtn, 'click', () => token.update(n => n + 1))
	on(failBox, 'change', () => failNext.set(failBox.checked))

	watch(lines, ls => {
		log.replaceChildren(
			...ls.map(line => {
				const li = document.createElement('li')
				li.textContent = line
				return li
			}),
		)
	})
})
