import { createState, defineComponent } from '@zeix/le-truc'

export type TestWatchProps = {
	count: number
	label: string
}

declare global {
	interface HTMLElementTagNameMap {
		'test-watch': HTMLElement & TestWatchProps
	}
}

/**
 * Test component for the factory `watch()` helper.
 * Exercises: single prop, array form, direct Signal, MatchHandlers, conditional registration.
 */
export default defineComponent<TestWatchProps>(
	'test-watch',
	({ expose, first, watch }) => {
		const output = first('#output', 'Add element with id="output".')
		const combined = first('#combined', 'Add element with id="combined".')
		const direct = first('#direct', 'Add element with id="direct".')
		const handlers = first('#handlers', 'Add element with id="handlers".')

		// Direct Signal passed as source (not a prop name)
		const externalSignal = createState(0)

		expose({
			count: 0,
			label: 'hello',
		})

		// Single prop string source
		watch('count', n => {
			output.textContent = String(n)
		})

		// Array form — two prop names
		watch(['count', 'label'], ([n, l]) => {
			combined.textContent = `${n}:${l}`
		})

		// Direct Signal source (not a prop name)
		watch(externalSignal, v => {
			direct.textContent = String(v)
			direct.dataset.signal = String(v)
		})

		// MatchHandlers form — ok callback
		watch('count', {
			ok: n => {
				handlers.textContent = `ok:${n}`
			},
		})

		// Conditional registration — plain control flow; an unmet condition
		// simply never registers
		const enableLogging: boolean = false
		if (enableLogging) watch('label', () => {})
	},
)
