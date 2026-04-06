import { asInteger, type Component, defineComponent } from '../../..'

export type BasicCounterProps = {
	count: number
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-counter': Component<BasicCounterProps>
	}
}

export default defineComponent<BasicCounterProps>(
	'basic-counter',
	({ expose, first, host, on, run }) => {
		const increment = first(
			'button',
			'Add a native button element to increment the count.',
		)
		const count = first('span', 'Add a span to display the count.')

		expose({
			count: asInteger(parseInt(count.textContent || '0') || 0),
		})

		return [
			on(increment, 'click', () => {
				host.count++
			}),
			run('count', value => {
				count.textContent = String(value)
			}),
		]
	},
)
