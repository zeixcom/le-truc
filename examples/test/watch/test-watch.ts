import { createState, defineComponent } from '../../..'

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
 * Test component for the v1.1 factory `watch()` helper.
 * Exercises: single prop, array form, direct Signal, MatchHandlers, conditional false.
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

		return [
			// Single prop string source
			watch('count', n => {
				output.textContent = String(n)
			}),

			// Array form — two prop names
			watch(['count', 'label'], ([n, l]) => {
				combined.textContent = `${n}:${l}`
			}),

			// Direct Signal source (not a prop name)
			watch(externalSignal, v => {
				direct.textContent = String(v)
				direct.dataset.signal = String(v)
			}),

			// MatchHandlers form — ok callback
			watch('count', {
				ok: n => {
					handlers.textContent = `ok:${n}`
				},
			}),

			// Conditional false — must be filtered out and never activate
			false && watch('label', () => {}),
		]
	},
)
