import {
	asInteger,
	type Component,
	defineComponent,
	on,
	read,
	setText,
} from '../../..'

export type BasicCounterProps = {
	count: number
}

type BasicCounterUI = {
	increment: HTMLButtonElement
	count: HTMLSpanElement
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-counter': Component<BasicCounterProps>
	}
}

export default defineComponent<BasicCounterProps, BasicCounterUI>(
	'basic-counter',
	({ first, host }) => {
		const increment = first(
			'button',
			'Add a native button element to increment the count.',
		)
		const count = first('span', 'Add a span to display the count.')
		return {
			ui: { increment, count },
			props: {
				count: read(() => count.textContent, asInteger()),
			},
			effects: {
				increment: on('click', () => {
					host.count++
				}),
				count: setText('count'),
			},
		}
	},
)
