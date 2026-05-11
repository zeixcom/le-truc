import { bindText, defineComponent } from '../../..'

export type BasicCounterProps = {
	/** Current counter value. Increments on each button click. */
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-counter': HTMLElement & BasicCounterProps
	}
}

/**
 * A simple click counter that increments on each button press.
 */
export default defineComponent<BasicCounterProps>(
	'basic-counter',
	({ expose, first, host, on, watch }) => {
		const increment = first(
			'button',
			'Add a native button element to increment the count.',
		)
		const count = first('span', 'Add a span to display the count.')

		expose({ count: Number.parseInt(count.textContent || '0') })

		return [
			on(increment, 'click', () => ({ count: host.count + 1 })),

			watch('count', bindText(count)),
		]
	},
)
