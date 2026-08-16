import { asInteger, bindText, defineComponent } from '../../../index'

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
 * Use it for demonstrating reactive property updates — the count
 * increments when the button is activated via mouse or keyboard.
 * The host element should contain a `<button>` and a `<span>`; the button must
 * be a real `<button>` element for keyboard activation to work.
 *
 * @demo {https://zeixcom.github.io/le-truc/examples.html#basic-counter} Interactive preview and usage examples
 **/
export default defineComponent<BasicCounterProps>(
	'basic-counter',
	({ expose, first, host, on, watch }) => {
		const count = first('span', 'Add a span to display the count.')

		expose({ count: asInteger()(count.textContent) })

		const button = first(
			'button',
			'Add a native button element to increment the count.',
		)
		on(button, 'click', () => ({ count: host.count + 1 }))
		watch('count', bindText(count))
	},
)
