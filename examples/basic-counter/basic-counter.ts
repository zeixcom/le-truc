import { asInteger, type Component, component, on, read, setText } from '../..'

type BasicCounterProps = {
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

export default component<BasicCounterProps, BasicCounterUI>(
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
	ui => ({
		increment: [
			on('click', () => {
				ui.component.count++
			}),
		],
		count: [setText('count')],
	}),
)
