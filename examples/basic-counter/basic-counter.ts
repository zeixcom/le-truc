import {
	asInteger,
	type Component,
	defineComponent,
	on,
	read,
	setText,
} from '../..'

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
	{
		count: read(ui => ui.count.textContent, asInteger()),
	},
	({ first }) => ({
		increment: first(
			'button',
			'Add a native button element to increment the count.',
		),
		count: first('span', 'Add a span to display the count.'),
	}),
	({ host }) => ({
		increment: [
			on('click', () => {
				host.count++
			}),
		],
		count: [setText('count')],
	}),
)
