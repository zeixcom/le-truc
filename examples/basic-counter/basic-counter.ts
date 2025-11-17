import {
	asInteger,
	type Component,
	component,
	getText,
	on,
	read,
	setText,
} from '../..'

type BasicCounterProps = {
	count: number
}

type BasicCounterUI = {
	increment: HTMLButtonElement
	count: HTMLSpanElement
}

declare global {
	interface HTMLElementTagNameMap {
		'basic-counter': Component<BasicCounterProps, BasicCounterUI>
	}
}

export default component<BasicCounterProps, BasicCounterUI>(
	'basic-counter',
	({ first }) => ({
		increment: first(
			'button',
			'Add a native button element to increment the count.',
		),
		count: first('span', 'Add a span to display the count.'),
	}),
	{
		count: read({ count: getText() }, asInteger()),
	},
	el => ({
		increment: [
			on('click', () => {
				el.count++
			}),
		],
		count: [setText('count')],
	}),
)
